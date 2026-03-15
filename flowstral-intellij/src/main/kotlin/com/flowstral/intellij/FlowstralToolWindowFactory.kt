package com.flowstral.intellij

import com.flowstral.intellij.ui.DefectsPanel
import com.flowstral.intellij.ui.TestCasesPanel
import com.flowstral.intellij.ui.TestRunsPanel
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import javax.swing.JPanel
import java.awt.BorderLayout
import com.intellij.ui.components.JBTabbedPane

class FlowstralToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val contentFactory = ContentFactory.getInstance()

        val mainPanel = JPanel(BorderLayout())
        val tabbedPane = JBTabbedPane()

        val testCasesPanel = TestCasesPanel(project)
        val testRunsPanel = TestRunsPanel(project)
        val defectsPanel = DefectsPanel(project)

        tabbedPane.addTab("Test Cases", testCasesPanel)
        tabbedPane.addTab("Recent Runs", testRunsPanel)
        tabbedPane.addTab("Defects", defectsPanel)

        mainPanel.add(tabbedPane, BorderLayout.CENTER)

        val content = contentFactory.createContent(mainPanel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}
