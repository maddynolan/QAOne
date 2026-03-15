package com.flowstral.intellij.ui

import com.flowstral.intellij.api.Defect
import com.flowstral.intellij.api.FlowstralApiClient
import com.flowstral.intellij.api.FlowstralApiException
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
import javax.swing.DefaultComboBoxModel
import javax.swing.JComboBox
import javax.swing.JLabel
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JTable
import javax.swing.table.DefaultTableCellRenderer
import javax.swing.table.DefaultTableModel

class DefectsPanel(private val project: Project) : JPanel(BorderLayout()) {

    private val tableModel = object : DefaultTableModel(
        arrayOf("Title", "Severity", "Status", "URL"),
        0
    ) {
        override fun isCellEditable(row: Int, column: Int): Boolean = false
    }

    private val table = JBTable(tableModel)
    private val loadingPanel = JBLoadingPanel(BorderLayout(), project)
    private val allDefects = mutableListOf<Defect>()
    private val filteredDefects = mutableListOf<Defect>()
    private val severityFilter = JComboBox(DefaultComboBoxModel(arrayOf("All", "Critical", "High", "Medium", "Low")))

    init {
        table.setShowGrid(false)
        table.rowHeight = 28
        table.tableHeader.reorderingAllowed = false

        // Color-coded severity column
        table.columnModel.getColumn(1).cellRenderer = object : DefaultTableCellRenderer() {
            override fun getTableCellRendererComponent(
                table: JTable, value: Any?, isSelected: Boolean,
                hasFocus: Boolean, row: Int, column: Int
            ): Component {
                val label = super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column) as JLabel
                val severity = value?.toString()?.lowercase() ?: ""
                if (!isSelected) {
                    label.foreground = when (severity) {
                        "critical" -> Color(0xC6, 0x28, 0x28) // red
                        "high" -> Color(0xE6, 0x51, 0x00) // orange
                        "medium" -> Color(0xF5, 0x7F, 0x17) // amber/yellow
                        "low" -> Color(0x75, 0x75, 0x75) // gray
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
                    if (row >= 0 && row < filteredDefects.size) {
                        val defect = filteredDefects[row]
                        val url = defect.url
                        if (!url.isNullOrBlank()) {
                            BrowserUtil.browse(url)
                        } else {
                            val settings = FlowstralSettingsState.getInstance()
                            val baseUrl = settings.apiUrl.replace("/api", "").trimEnd('/')
                            BrowserUtil.browse("$baseUrl/defects/${defect.id}")
                        }
                    }
                }
            }
        })

        severityFilter.addActionListener {
            applyFilter()
        }

        // Toolbar
        val topPanel = JPanel(BorderLayout())
        val toolbar = createToolbar()
        topPanel.add(toolbar, BorderLayout.WEST)

        val filterPanel = JPanel()
        filterPanel.add(JLabel("Severity: "))
        filterPanel.add(severityFilter)
        topPanel.add(filterPanel, BorderLayout.EAST)

        add(topPanel, BorderLayout.NORTH)

        loadingPanel.add(JBScrollPane(table))
        add(loadingPanel, BorderLayout.CENTER)

        refreshData()
    }

    private fun createToolbar(): JComponent {
        val actionGroup = DefaultActionGroup()

        actionGroup.add(object : AnAction("Refresh", "Refresh defects", AllIcons.Actions.Refresh) {
            override fun actionPerformed(e: AnActionEvent) {
                refreshData()
            }
        })

        val actionToolbar = ActionManager.getInstance()
            .createActionToolbar("FlowstralDefects", actionGroup, true)
        actionToolbar.targetComponent = this
        return actionToolbar.component
    }

    fun refreshData() {
        loadingPanel.startLoading()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val defects = FlowstralApiClient.getDefects()
                ApplicationManager.getApplication().invokeLater {
                    allDefects.clear()
                    allDefects.addAll(defects)
                    applyFilter()
                    loadingPanel.stopLoading()
                }
            } catch (e: FlowstralApiException) {
                ApplicationManager.getApplication().invokeLater {
                    loadingPanel.stopLoading()
                    showNotification(
                        "Failed to load defects: ${e.message}",
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

    private fun applyFilter() {
        val selectedSeverity = severityFilter.selectedItem?.toString() ?: "All"
        filteredDefects.clear()
        if (selectedSeverity == "All") {
            filteredDefects.addAll(allDefects)
        } else {
            filteredDefects.addAll(allDefects.filter {
                it.severity.equals(selectedSeverity, ignoreCase = true)
            })
        }

        tableModel.rowCount = 0
        for (defect in filteredDefects) {
            tableModel.addRow(arrayOf(
                defect.title,
                defect.severity,
                defect.status ?: "Open",
                defect.url ?: "-"
            ))
        }
    }

    private fun showNotification(message: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Flowstral")
            .createNotification(message, type)
            .notify(project)
    }
}
