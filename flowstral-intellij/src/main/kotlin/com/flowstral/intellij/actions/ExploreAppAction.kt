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

class ExploreAppAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val url = Messages.showInputDialog(
            project,
            "Enter the URL to explore:",
            "Explore Application",
            Messages.getQuestionIcon(),
            "https://",
            null
        ) ?: return

        if (url.isBlank()) {
            Messages.showWarningDialog(project, "Please provide a URL to explore.", "Explore Application")
            return
        }

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Exploring application...", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                indicator.text = "Crawling and analyzing $url"

                try {
                    val result = kotlinx.coroutines.runBlocking {
                        FlowstralApiClient.exploreApp(url, 50)
                    }

                    ApplicationManager.getApplication().invokeLater {
                        val pagesVisited = result.pages_visited ?: 0
                        val defectsFound = result.defects?.size ?: 0
                        val status = result.status ?: "complete"

                        val type = if (defectsFound > 0) NotificationType.WARNING else NotificationType.INFORMATION
                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "Exploration Complete ($status)\n" +
                                "Pages visited: $pagesVisited\n" +
                                "Defects found: $defectsFound",
                                type
                            )
                            .notify(project)
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        val notification = NotificationGroupManager.getInstance()
                            .getNotificationGroup("Flowstral")
                            .createNotification(
                                "Application exploration failed: ${ex.message}",
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
