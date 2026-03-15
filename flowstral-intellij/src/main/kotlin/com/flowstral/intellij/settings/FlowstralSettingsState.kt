package com.flowstral.intellij.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

@State(name = "FlowstralSettings", storages = [Storage("flowstral.xml")])
class FlowstralSettingsState : PersistentStateComponent<FlowstralSettingsState> {

    var apiUrl: String = "https://api.flowstral.com"
    var projectId: String = ""
    var autoRefresh: Boolean = true
    var refreshIntervalSeconds: Int = 30

    override fun getState(): FlowstralSettingsState = this

    override fun loadState(state: FlowstralSettingsState) {
        apiUrl = state.apiUrl
        projectId = state.projectId
        autoRefresh = state.autoRefresh
        refreshIntervalSeconds = state.refreshIntervalSeconds
    }

    companion object {
        fun getInstance(): FlowstralSettingsState {
            return ApplicationManager.getApplication().getService(FlowstralSettingsState::class.java)
        }
    }
}
