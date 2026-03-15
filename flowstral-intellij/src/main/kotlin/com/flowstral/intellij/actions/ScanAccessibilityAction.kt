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

class ScanAccessibilityAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val url = Messages.showInputDialog(
            project,
            "Enter the URL to scan for accessibility issues:",
            "WCAG Accessibility Scan",
            Messages.getQuestionIcon(),
            "https://",
            null
        ) ?: return

        if (url.isBlank()) {
            Messages.showWarningDialog(project, "Please provide a URL to scan.", "Accessibility Scan")
            return
        }

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Scanning accessibility...", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                indicator.text = "Running WCAG accessibility scan on $url"

                try {
                    val result = kotlinx.coroutines.runBlocking {
                        FlowstralApiClient.scanAccessibility(url, "AA")
                    }

                    ApplicationManager.getApplication().invokeLater {
                        val summary = result.summary
                        val issueCount = result.issues?.size ?: 0

                        if (summary != null) {
                            val type = if (summary.critical > 0) NotificationType.ERROR
                                       else if (summary.serious > 0) NotificationType.WARNING
                                       else NotificationType.INFORMATION

                            NotificationGroupManager.getInstance()
                                .getNotificationGroup("Flowstral")
                                .createNotification(
                                    "Accessibility Scan Complete\n" +
                                    "Total: ${summary.total} issues\n" +
                                    "Critical: ${summary.critical}, Serious: ${summary.serious}, " +
                                    "Moderate: ${summary.moderate}, Minor: ${summary.minor}",
                                    type
                                )
                                .notify(project)
                        } else {
                            NotificationGroupManager.getInstance()
                                .getNotificationGroup("Flowstral")
                                .createNotification(
                                    "Accessibility scan complete: $issueCount issues found",
                                    if (issueCount > 0) NotificationType.WARNING else NotificationType.INFORMATION
                                )
                                .notify(project)
                        }
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        val notification = NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "Accessibility scan failed: ${ex.message}",
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
