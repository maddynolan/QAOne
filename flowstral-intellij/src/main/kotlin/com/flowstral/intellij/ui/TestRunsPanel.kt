package com.flowstral.intellij.ui

import com.flowstral.intellij.api.FlowstralApiClient
import com.flowstral.intellij.api.FlowstralApiException
import com.flowstral.intellij.api.TestRun
import com.flowstral.intellij.settings.FlowstralSettingsState
import com.intellij.icons.AllIcons
import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.DefaultActionGroup
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBLoadingPanel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.table.JBTable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Component
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import javax.swing.JLabel
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JTable
import javax.swing.table.DefaultTableCellRenderer
import javax.swing.table.DefaultTableModel

class TestRunsPanel(private val project: Project) : JPanel(BorderLayout()) {

    private val tableModel = object : DefaultTableModel(
        arrayOf("Test", "Status", "Duration", "Timestamp"),
        0
    ) {
        override fun isCellEditable(row: Int, column: Int): Boolean = false
    }

    private val table = JBTable(tableModel)
    private val loadingPanel = JBLoadingPanel(BorderLayout(), project)
    private val testRuns = mutableListOf<TestRun>()

    init {
        table.setShowGrid(false)
        table.rowHeight = 28
        table.tableHeader.reorderingAllowed = false

        // Color-coded status column
        table.columnModel.getColumn(1).cellRenderer = object : DefaultTableCellRenderer() {
            override fun getTableCellRendererComponent(
                table: JTable, value: Any?, isSelected: Boolean,
                hasFocus: Boolean, row: Int, column: Int
            ): Component {
                val label = super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column) as JLabel
                val status = value?.toString()?.lowercase() ?: ""
                if (!isSelected) {
                    label.foreground = when {
                        status.contains("pass") -> Color(0x2E, 0x7D, 0x32) // green
                        status.contains("fail") -> Color(0xC6, 0x28, 0x28) // red
                        status.contains("running") -> Color(0xF5, 0x7F, 0x17) // amber
                        else -> table.foreground
                    }
                }
                return label
            }
        }

        table.addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                if (e.clickCount == 2) {
                    val row = table.selectedRow
                    if (row >= 0 && row < testRuns.size) {
                        val run = testRuns[row]
                        val settings = FlowstralSettingsState.getInstance()
                        val baseUrl = settings.apiUrl.replace("/api", "").trimEnd('/')
                        BrowserUtil.browse("$baseUrl/test-runs/${run.id}")
                    }
                }
            }
        })

        // Toolbar
        val toolbar = createToolbar()
        add(toolbar, BorderLayout.NORTH)

        loadingPanel.add(JBScrollPane(table))
        add(loadingPanel, BorderLayout.CENTER)

        refreshData()
    }

    private fun createToolbar(): JComponent {
        val actionGroup = DefaultActionGroup()

        actionGroup.add(object : AnAction("Refresh", "Refresh test runs", AllIcons.Actions.Refresh) {
            override fun actionPerformed(e: AnActionEvent) {
                refreshData()
            }
        })

        val actionToolbar = ActionManager.getInstance()
            .createActionToolbar("FlowstralTestRuns", actionGroup, true)
        actionToolbar.targetComponent = this
        return actionToolbar.component
    }

    fun refreshData() {
        loadingPanel.startLoading()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val runs = FlowstralApiClient.listTestRuns(20)
                ApplicationManager.getApplication().invokeLater {
                    testRuns.clear()
                    testRuns.addAll(runs)
                    tableModel.rowCount = 0
                    for (run in runs) {
                        val duration = run.duration_ms?.let { "${it}ms" } ?: "N/A"
                        val timestamp = run.created_at?.take(19)?.replace("T", " ") ?: "N/A"
                        tableModel.addRow(arrayOf(
                            run.test_case_id ?: run.id,
                            run.status.uppercase(),
                            duration,
                            timestamp
                        ))
                    }
                    loadingPanel.stopLoading()
                }
            } catch (e: FlowstralApiException) {
                ApplicationManager.getApplication().invokeLater {
                    loadingPanel.stopLoading()
                    showNotification(
                        "Failed to load test runs: ${e.message}",
                        NotificationType.WARNING
                    )
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    loadingPanel.stopLoading()
                    showNotification(
                        "Connection error: ${e.message}",
                        NotificationType.WARNING
                    )
                }
            }
        }
    }

    private fun showNotification(message: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Flowstral")
            .createNotification(message, type)
            .notify(project)
    }
}
