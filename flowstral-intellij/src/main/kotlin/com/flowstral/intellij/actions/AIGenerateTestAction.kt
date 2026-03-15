package com.flowstral.intellij.actions

import com.flowstral.intellij.api.FlowstralApiClient
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

class AIGenerateTestAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        // Ask for instruction
        val instruction = Messages.showInputDialog(
            project,
            "Describe the test you want to generate:",
            "AI Test Generation",
            Messages.getQuestionIcon()
        ) ?: return

        if (instruction.isBlank()) {
            Messages.showWarningDialog(project, "Please provide a test description.", "AI Test Generation")
            return
        }

        // Ask for target URL
        val targetUrl = Messages.showInputDialog(
            project,
            "Enter the target URL to test:",
            "AI Test Generation - Target URL",
            Messages.getQuestionIcon(),
            "https://",
            null
        ) ?: return

        if (targetUrl.isBlank()) {
            Messages.showWarningDialog(project, "Please provide a target URL.", "AI Test Generation")
            return
        }

        // Run AI generation in background
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Generating AI test...", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = false
                indicator.fraction = 0.1
                indicator.text = "Connecting to Flowstral AI..."

                try {
                    indicator.fraction = 0.3
                    indicator.text = "AI is generating test steps..."

                    val result = kotlinx.coroutines.runBlocking {
                        FlowstralApiClient.aiGenerateTest(instruction, targetUrl)
                    }

                    indicator.fraction = 1.0
                    indicator.text = "Test generation complete"

                    ApplicationManager.getApplication().invokeLater {
                        val passed = result.passed
                        val type = if (passed) NotificationType.INFORMATION else NotificationType.WARNING
                        val statusText = if (passed) "PASSED" else "FAILED"
                        val testName = result.test_name ?: "AI Generated Test"
                        val stepCount = result.steps.size

                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "AI Test '$testName' $statusText\n$stepCount steps executed on $targetUrl",
                                type
                            )
                            .notify(project)
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        val notification = NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "AI test generation failed: ${ex.message}",
                                NotificationType.ERROR
                            )
                        notification.addAction(NotificationAction.createSimple("Configure Flowstral") {
                            ShowSettingsUtil.getInstance().showSettingsDialog(project, "Flowstral")
                        })
                        notification.notify(project)
                    }
                }
            }
        })
    }
}
