package com.flowstral.intellij.api

data class TestCase(
    val id: String,
    val name: String,
    val status: String? = null,
    val folder_id: String? = null,
    val steps: List<Any>? = null,
    val created_at: String? = null
)

data class TestRun(
    val id: String,
    val test_case_id: String? = null,
    val status: String,
    val duration_ms: Long? = null,
    val steps: List<TestStep>? = null,
    val created_at: String? = null
)

data class TestStep(
    val step_number: Int,
    val action: String? = null,
    val status: String,
    val target: String? = null,
    val error: String? = null
)

data class AITestResult(
    val test_name: String? = null,
    val steps: List<TestStep>,
    val passed: Boolean,
    val screenshots: List<String>
)

data class ScanResult(
    val scan_id: String? = null,
    val url: String,
    val summary: ScanSummary? = null,
    val issues: List<AccessibilityIssue>? = null
)

data class ScanSummary(
    val total: Int,
    val critical: Int,
    val serious: Int,
    val moderate: Int,
    val minor: Int
)

data class AccessibilityIssue(
    val rule: String? = null,
    val impact: String? = null,
    val description: String? = null,
    val element: String? = null,
    val suggested_fix: String? = null
)

data class ExploreResult(
    val session_id: String? = null,
    val pages_visited: Int? = null,
    val defects: List<Defect>? = null,
    val status: String? = null
)

data class Defect(
    val id: String,
    val title: String,
    val severity: String,
    val status: String? = null,
    val url: String? = null,
    val description: String? = null
)

data class DashboardMetrics(
    val total_tests: Int? = null,
    val pass_rate: Double? = null,
    val total_defects: Int? = null,
    val recent_runs: Int? = null
)

class FlowstralApiException(
    message: String,
    val statusCode: Int? = null,
    cause: Throwable? = null
) : Exception(message, cause)
