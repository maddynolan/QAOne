package com.flowstral.intellij.actions

import com.flowstral.intellij.api.FlowstralApiClient
import com.flowstral.intellij.api.FlowstralApiException
import com.flowstral.intellij.api.TestCase
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages

class RunTestAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        // First, fetch test cases in background
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Loading test cases...", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                val testCases: List<TestCase>
                try {
                    testCases = kotlinx.coroutines.runBlocking {
                        FlowstralApiClient.listTestCases()
                    }
                } catch (ex: FlowstralApiException) {
                    ApplicationManager.getApplication().invokeLater {
                        val notification = NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "Failed to load test cases: ${ex.message}",
                                NotificationType.ERROR
                            )
                        notification.addAction(NotificationAction.createSimple("Configure Flowstral") {
                            ShowSettingsUtil.getInstance().showSettingsDialog(project, "Flowstral")
                        })
                        notification.notify(project)
                    }
                    return
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        val notification = NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "Connection error: ${ex.message}",
                                NotificationType.ERROR
                            )
                        notification.addAction(NotificationAction.createSimple("Configure Flowstral") {
                            ShowSettingsUtil.getInstance().showSettingsDialog(project, "Flowstral")
                        })
                        notification.notify(project)
                    }
                    return
                }

                if (testCases.isEmpty()) {
                    ApplicationManager.getApplication().invokeLater {
                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification("No test cases found", NotificationType.INFORMATION)
                            .notify(project)
                    }
                    return
                }

                // Show popup on EDT
                ApplicationManager.getApplication().invokeLater {
                    val testCaseNames = testCases.map { it.name }.toTypedArray()
                    val selectedIndex = Messages.showChooseDialog(
                        project,
                        "Select a test case to run:",
                        "Run Test Case",
                        Messages.getQuestionIcon(),
                        testCaseNames,
                        testCaseNames.firstOrNull() ?: ""
                    )
                    if (selectedIndex >= 0 && selectedIndex < testCases.size) {
                        executeTestCase(project, testCases[selectedIndex])
                    }
                }
            }
        })
    }

    private fun executeTestCase(project: com.intellij.openapi.project.Project, testCase: TestCase) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Running: ${testCase.name}", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                indicator.text = "Executing test case: ${testCase.name}"

                try {
                    val run = kotlinx.coroutines.runBlocking {
                        FlowstralApiClient.runTestCase(testCase.id)
                    }
                    ApplicationManager.getApplication().invokeLater {
                        val passed = run.status.equals("passed", ignoreCase = true)
                        val type = if (passed) NotificationType.INFORMATION else NotificationType.ERROR
                        val statusText = if (passed) "PASSED" else "FAILED"
                        val duration = run.duration_ms?.let { "${it}ms" } ?: "N/A"

                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "Test '${testCase.name}' $statusText (${duration})",
                                type
                            )
                            .notify(project)
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "Failed to run test: ${ex.message}",
                                NotificationType.ERROR
                            )
                            .notify(project)
                    }
                }
            }
        })
    }
}
