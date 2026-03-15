package com.flowstral.intellij.actions

import com.flowstral.intellij.settings.FlowstralSettingsState
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class OpenDashboardAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val settings = FlowstralSettingsState.getInstance()
        // The API URL might be like https://api.flowstral.com, strip /api if present
        // and construct the frontend dashboard URL
        val baseUrl = settings.apiUrl
            .replace("/api", "")
            .trimEnd('/')

        BrowserUtil.browse("$baseUrl/dashboard")
    }
}
