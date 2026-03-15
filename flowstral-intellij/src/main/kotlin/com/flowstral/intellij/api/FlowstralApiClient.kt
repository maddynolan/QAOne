package com.flowstral.intellij.api

import com.flowstral.intellij.settings.FlowstralSettingsState
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

object FlowstralApiClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val baseUrl: String
        get() {
            val settings = FlowstralSettingsState.getInstance()
            return settings.apiUrl.trimEnd('/')
        }

    private val apiKey: String?
        get() {
            val credentialAttributes = CredentialAttributes(
                generateServiceName("Flowstral", "apiKey")
            )
            return PasswordSafe.instance.getPassword(credentialAttributes)
        }

    private val projectId: String?
        get() {
            val settings = FlowstralSettingsState.getInstance()
            return settings.projectId.ifBlank { null }
        }

    private fun buildRequest(
        path: String,
        method: String = "GET",
        body: String? = null
    ): Request {
        val url = "$baseUrl$path"
        val builder = Request.Builder().url(url)

        val key = apiKey
        if (!key.isNullOrBlank()) {
            builder.addHeader("Authorization", "Bearer $key")
        }
        builder.addHeader("Accept", "application/json")

        when (method.uppercase()) {
            "GET" -> builder.get()
            "POST" -> {
                val requestBody = (body ?: "{}").toRequestBody(jsonMediaType)
                builder.post(requestBody)
            }
            "PUT" -> {
                val requestBody = (body ?: "{}").toRequestBody(jsonMediaType)
                builder.put(requestBody)
            }
            "DELETE" -> builder.delete()
        }

        return builder.build()
    }

    private fun <T> executeRequest(request: Request, typeToken: TypeToken<T>): T {
        val response = client.newCall(request).execute()
        val responseBody = response.body?.string()
            ?: throw FlowstralApiException("Empty response from server", response.code)

        if (!response.isSuccessful) {
            val errorMsg = try {
                val json = JsonParser.parseString(responseBody).asJsonObject
                json.get("detail")?.asString ?: json.get("message")?.asString ?: responseBody
            } catch (_: Exception) {
                responseBody
            }
            throw FlowstralApiException(
                "API request failed: $errorMsg",
                response.code
            )
        }

        return gson.fromJson(responseBody, typeToken.type)
    }

    private inline fun <reified T> executeRequest(request: Request): T {
        return executeRequest(request, object : TypeToken<T>() {})
    }

    suspend fun listTestCases(overrideProjectId: String? = null): List<TestCase> = withContext(Dispatchers.IO) {
        val pid = overrideProjectId ?: projectId
        val path = if (pid != null) "/test-cases?project_id=$pid" else "/test-cases"
        val request = buildRequest(path)
        try {
            executeRequest<List<TestCase>>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Failed to connect to Flowstral: ${e.message}", cause = e)
        }
    }

    suspend fun runTestCase(testCaseId: String): TestRun = withContext(Dispatchers.IO) {
        val body = gson.toJson(mapOf("test_case_id" to testCaseId))
        val request = buildRequest("/test-runs", "POST", body)
        try {
            executeRequest<TestRun>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Failed to run test case: ${e.message}", cause = e)
        }
    }

    suspend fun getTestRun(runId: String): TestRun = withContext(Dispatchers.IO) {
        val request = buildRequest("/test-runs/$runId")
        try {
            executeRequest<TestRun>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Failed to get test run: ${e.message}", cause = e)
        }
    }

    suspend fun listTestRuns(limit: Int = 20): List<TestRun> = withContext(Dispatchers.IO) {
        val path = "/test-runs?limit=$limit"
        val request = buildRequest(path)
        try {
            executeRequest<List<TestRun>>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Failed to list test runs: ${e.message}", cause = e)
        }
    }

    suspend fun aiGenerateTest(instruction: String, targetUrl: String): AITestResult = withContext(Dispatchers.IO) {
        val body = gson.toJson(mapOf(
            "instruction" to instruction,
            "target_url" to targetUrl
        ))
        val request = buildRequest("/api/ai-testing/start", "POST", body)

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                throw FlowstralApiException("AI test generation failed: $errorBody", response.code)
            }

            // Parse SSE stream
            val steps = mutableListOf<TestStep>()
            var testName: String? = null
            var passed = false
            val screenshots = mutableListOf<String>()

            val reader = BufferedReader(InputStreamReader(response.body!!.byteStream()))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                val currentLine = line ?: continue
                if (!currentLine.startsWith("data: ")) continue

                val data = currentLine.removePrefix("data: ").trim()
                if (data.isEmpty() || data == "[DONE]") continue

                try {
                    val json = JsonParser.parseString(data).asJsonObject
                    val type = json.get("type")?.asString

                    when (type) {
                        "step" -> {
                            val stepNum = json.get("step_number")?.asInt ?: steps.size + 1
                            val action = json.get("action")?.asString
                            val status = json.get("status")?.asString ?: "running"
                            val target = json.get("target")?.asString
                            val error = json.get("error")?.asString
                            steps.add(TestStep(stepNum, action, status, target, error))
                        }
                        "screenshot" -> {
                            val screenshotData = json.get("data")?.asString
                            if (screenshotData != null) screenshots.add(screenshotData)
                        }
                        "test_complete", "complete" -> {
                            testName = json.get("test_name")?.asString
                            passed = json.get("passed")?.asBoolean ?: false
                        }
                    }
                } catch (_: Exception) {
                    // Skip malformed SSE events
                }
            }

            AITestResult(testName, steps, passed, screenshots)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("AI test generation failed: ${e.message}", cause = e)
        }
    }

    suspend fun scanAccessibility(url: String, level: String = "AA"): ScanResult = withContext(Dispatchers.IO) {
        val body = gson.toJson(mapOf("url" to url, "level" to level))
        val request = buildRequest("/api/accessibility/scan", "POST", body)
        try {
            executeRequest<ScanResult>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Accessibility scan failed: ${e.message}", cause = e)
        }
    }

    suspend fun exploreApp(url: String, maxPages: Int = 50): ExploreResult = withContext(Dispatchers.IO) {
        val body = gson.toJson(mapOf("url" to url, "max_pages" to maxPages))
        val request = buildRequest("/api/blaze/start-sync", "POST", body)
        try {
            executeRequest<ExploreResult>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Application exploration failed: ${e.message}", cause = e)
        }
    }

    suspend fun getDefects(overrideProjectId: String? = null): List<Defect> = withContext(Dispatchers.IO) {
        val pid = overrideProjectId ?: projectId
        val path = if (pid != null) "/defects?project_id=$pid" else "/defects"
        val request = buildRequest(path)
        try {
            executeRequest<List<Defect>>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Failed to fetch defects: ${e.message}", cause = e)
        }
    }

    suspend fun getDashboard(overrideProjectId: String? = null): DashboardMetrics = withContext(Dispatchers.IO) {
        val pid = overrideProjectId ?: projectId
        val path = if (pid != null) "/dashboard/metrics?project_id=$pid" else "/dashboard/metrics"
        val request = buildRequest(path)
        try {
            executeRequest<DashboardMetrics>(request)
        } catch (e: FlowstralApiException) {
            throw e
        } catch (e: Exception) {
            throw FlowstralApiException("Failed to fetch dashboard: ${e.message}", cause = e)
        }
    }

    fun testConnection(): Boolean {
        return try {
            val request = buildRequest("/health")
            val response = client.newCall(request).execute()
            response.isSuccessful
        } catch (_: Exception) {
            false
        }
    }
}
