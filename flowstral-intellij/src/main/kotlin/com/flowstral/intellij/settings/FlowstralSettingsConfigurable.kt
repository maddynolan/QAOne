package com.flowstral.intellij.settings

import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JSpinner
import javax.swing.SpinnerNumberModel

class FlowstralSettingsConfigurable : Configurable {

    private var mainPanel: JPanel? = null
    private var apiUrlField: JBTextField? = null
    private var apiKeyField: JBPasswordField? = null
    private var projectIdField: JBTextField? = null
    private var autoRefreshCheckbox: JBCheckBox? = null
    private var refreshIntervalSpinner: JSpinner? = null

    override fun getDisplayName(): String = "Flowstral"

    override fun createComponent(): JComponent {
        apiUrlField = JBTextField()
        apiKeyField = JBPasswordField()
        projectIdField = JBTextField()
        autoRefreshCheckbox = JBCheckBox("Enable auto-refresh")
        refreshIntervalSpinner = JSpinner(SpinnerNumberModel(30, 5, 300, 5))

        mainPanel = FormBuilder.createFormBuilder()
            .addLabeledComponent(JBLabel("API URL:"), apiUrlField!!, 1, false)
            .addLabeledComponent(JBLabel("API Key:"), apiKeyField!!, 1, false)
            .addLabeledComponent(JBLabel("Project ID:"), projectIdField!!, 1, false)
            .addComponent(autoRefreshCheckbox!!, 1)
            .addLabeledComponent(JBLabel("Refresh interval (seconds):"), refreshIntervalSpinner!!, 1, false)
            .addComponentFillVertically(JPanel(), 0)
            .panel

        reset()
        return mainPanel!!
    }

    override fun isModified(): Boolean {
        val settings = FlowstralSettingsState.getInstance()
        val currentApiKey = getStoredApiKey() ?: ""
        val enteredApiKey = String(apiKeyField?.password ?: charArrayOf())

        return apiUrlField?.text != settings.apiUrl ||
                enteredApiKey != currentApiKey ||
                projectIdField?.text != settings.projectId ||
                autoRefreshCheckbox?.isSelected != settings.autoRefresh ||
                (refreshIntervalSpinner?.value as? Int) != settings.refreshIntervalSeconds
    }

    override fun apply() {
        val settings = FlowstralSettingsState.getInstance()
        settings.apiUrl = apiUrlField?.text ?: settings.apiUrl
        settings.projectId = projectIdField?.text ?: settings.projectId
        settings.autoRefresh = autoRefreshCheckbox?.isSelected ?: settings.autoRefresh
        settings.refreshIntervalSeconds = (refreshIntervalSpinner?.value as? Int) ?: settings.refreshIntervalSeconds

        // Store API key in PasswordSafe
        val apiKey = String(apiKeyField?.password ?: charArrayOf())
        val credentialAttributes = CredentialAttributes(
            generateServiceName("Flowstral", "apiKey")
        )
        PasswordSafe.instance.set(credentialAttributes, Credentials("flowstral", apiKey))
    }

    override fun reset() {
        val settings = FlowstralSettingsState.getInstance()
        apiUrlField?.text = settings.apiUrl
        projectIdField?.text = settings.projectId
        autoRefreshCheckbox?.isSelected = settings.autoRefresh
        refreshIntervalSpinner?.value = settings.refreshIntervalSeconds

        // Load API key from PasswordSafe
        val storedKey = getStoredApiKey()
        apiKeyField?.text = storedKey ?: ""
    }

    private fun getStoredApiKey(): String? {
        val credentialAttributes = CredentialAttributes(
            generateServiceName("Flowstral", "apiKey")
        )
        return PasswordSafe.instance.getPassword(credentialAttributes)
    }

    override fun disposeUIResources() {
        mainPanel = null
        apiUrlField = null
        apiKeyField = null
        projectIdField = null
        autoRefreshCheckbox = null
        refreshIntervalSpinner = null
    }
}
