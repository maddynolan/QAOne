package com.flowstral.intellij.ui

import com.flowstral.intellij.api.FlowstralApiClient
import com.flowstral.intellij.api.FlowstralApiException
import com.flowstral.intellij.api.TestCase
import com.intellij.icons.AllIcons
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.DefaultActionGroup
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBLoadingPanel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.table.JBTable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.awt.BorderLayout
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.table.DefaultTableModel

class TestCasesPanel(private val project: Project) : JPanel(BorderLayout()) {

    private val tableModel = object : DefaultTableModel(
        arrayOf("Name", "Status", "Steps", "Folder"),
        0
    ) {
        override fun isCellEditable(row: Int, column: Int): Boolean = false
    }

    private val table = JBTable(tableModel)
    private val loadingPanel = JBLoadingPanel(BorderLayout(), project)
    private val testCases = mutableListOf<TestCase>()

    init {
        table.setShowGrid(false)
        table.rowHeight = 28
        table.tableHeader.reorderingAllowed = false

        table.addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                if (e.clickCount == 2) {
                    val row = table.selectedRow
                    if (row >= 0 && row < testCases.size) {
                        runTestCase(testCases[row])
                    }
                }
            }
        })

        // Toolbar
        val toolbar = createToolbar()
        add(toolbar, BorderLayout.NORTH)

        loadingPanel.add(JBScrollPane(table))
        add(loadingPanel, BorderLayout.CENTER)

        // Initial load
        refreshData()
    }

    private fun createToolbar(): JComponent {
        val actionGroup = DefaultActionGroup()

        actionGroup.add(object : AnAction("Refresh", "Refresh test cases", AllIcons.Actions.Refresh) {
            override fun actionPerformed(e: AnActionEvent) {
                refreshData()
            }
        })

        actionGroup.add(object : AnAction("Run Selected", "Run selected test case", AllIcons.RunConfigurations.TestState.Run) {
            override fun actionPerformed(e: AnActionEvent) {
                val row = table.selectedRow
                if (row >= 0 && row < testCases.size) {
                    runTestCase(testCases[row])
                }
            }
        })

        val actionToolbar = ActionManager.getInstance()
            .createActionToolbar("FlowstralTestCases", actionGroup, true)
        actionToolbar.targetComponent = this
        return actionToolbar.component
    }

    fun refreshData() {
        loadingPanel.startLoading()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val cases = FlowstralApiClient.listTestCases()
                ApplicationManager.getApplication().invokeLater {
                    testCases.clear()
                    testCases.addAll(cases)
                    tableModel.rowCount = 0
                    for (tc in cases) {
                        tableModel.addRow(arrayOf(
                            tc.name,
                            tc.status ?: "N/A",
                            tc.steps?.size?.toString() ?: "0",
                            tc.folder_id ?: "-"
                        ))
                    }
                    loadingPanel.stopLoading()
                }
            } catch (e: FlowstralApiException) {
                ApplicationManager.getApplication().invokeLater {
                    loadingPanel.stopLoading()
                    showNotification(
                        "Failed to load test cases: ${e.message}",
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

    private fun runTestCase(testCase: TestCase) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Running test: ${testCase.name}", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                indicator.text = "Executing test case: ${testCase.name}"

                kotlinx.coroutines.runBlocking {
                    try {
                        val run = FlowstralApiClient.runTestCase(testCase.id)
                        ApplicationManager.getApplication().invokeLater {
                            val type = if (run.status == "passed") NotificationType.INFORMATION else NotificationType.ERROR
                            val icon = if (run.status == "passed") "PASSED" else "FAILED"
                            showNotification(
                                "Test '${ testCase.name}' $icon\nDuration: ${run.duration_ms ?: 0}ms",
                                type
                            )
                        }
                    } catch (e: Exception) {
                        ApplicationManager.getApplication().invokeLater {
                            showNotification(
                                "Failed to run test: ${e.message}",
                                NotificationType.ERROR
                            )
                        }
                    }
                }
            }
        })
    }

    private fun showNotification(message: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Flowstral")
            .createNotification(message, type)
            .notify(project)
    }
}
