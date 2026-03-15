package com.flowstral.intellij.statusbar

import com.flowstral.intellij.api.DashboardMetrics
import com.flowstral.intellij.api.FlowstralApiClient
import com.flowstral.intellij.settings.FlowstralSettingsState
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.util.Consumer
import kotlinx.coroutines.*
import java.awt.Component
import java.awt.event.MouseEvent

class FlowstralStatusBarWidget(private val project: Project) : StatusBarWidget, StatusBarWidget.TextPresentation {

    companion object {
        const val ID = "FlowstralStatusBar"
    }

    private var statusBar: StatusBar? = null
    private var metrics: DashboardMetrics? = null
    private var refreshJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun ID(): String = ID

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
        startPeriodicRefresh()
    }

    override fun dispose() {
        refreshJob?.cancel()
        scope.cancel()
    }

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun getText(): String {
        val m = metrics ?: return "Flowstral: --"
        val totalTests = m.total_tests ?: 0
        val passRate = m.pass_rate ?: 0.0
        val passedCount = (totalTests * passRate / 100.0).toInt()
        return "Flowstral: $passedCount/$totalTests"
    }

    override fun getTooltipText(): String {
        val m = metrics ?: return "Flowstral QA - Not connected"
        val passRate = m.pass_rate ?: 0.0
        val defects = m.total_defects ?: 0
        val recentRuns = m.recent_runs ?: 0
        return "Flowstral QA\n" +
               "Pass rate: ${"%.1f".format(passRate)}%\n" +
               "Total defects: $defects\n" +
               "Recent runs: $recentRuns"
    }

    override fun getAlignment(): Float = Component.CENTER_ALIGNMENT

    override fun getClickConsumer(): Consumer<MouseEvent> {
        return Consumer {
            val settings = FlowstralSettingsState.getInstance()
            val baseUrl = settings.apiUrl.replace("/api", "").trimEnd('/')
            BrowserUtil.browse("$baseUrl/dashboard")
        }
    }

    private fun startPeriodicRefresh() {
        val settings = FlowstralSettingsState.getInstance()
        if (!settings.autoRefresh) return

        refreshJob = scope.launch {
            while (isActive) {
                try {
                    val dashboardMetrics = FlowstralApiClient.getDashboard()
                    metrics = dashboardMetrics
                    ApplicationManager.getApplication().invokeLater {
                        statusBar?.updateWidget(ID)
                    }
                } catch (_: Exception) {
                    // Silently ignore refresh errors for status bar
                }
                delay(settings.refreshIntervalSeconds * 1000L)
            }
        }
    }
}
