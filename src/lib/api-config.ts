// Central API configuration
// Change this to update all API calls at once

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://qaone-production.up.railway.app';

// Helper function to get the API base URL
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export const API_ENDPOINTS = {
  // AI Endpoints
  AI_JIRA_TO_TESTCASES: `${API_BASE_URL}/ai/jira-to-testcases`,
  AI_GENERATE_TESTS: `${API_BASE_URL}/ai/generate-tests`,
  AI_GENERATE_TESTS_ENHANCED: `${API_BASE_URL}/ai/generate-tests-enhanced`,
  AI_TRIAGE: `${API_BASE_URL}/ai/triage`,
  AI_TEMPLATES: `${API_BASE_URL}/ai/templates`,
  
  // Test Cases
  TEST_CASES: `${API_BASE_URL}/test-cases`,
  TEST_CASE: (id: string) => `${API_BASE_URL}/test-cases/${id}`,
  TEST_CASE_ASSIGN_PLAN: (id: string) => `${API_BASE_URL}/test-cases/${id}/assign-plan`,
  
  // Test Plans
  TEST_PLANS: `${API_BASE_URL}/plans`,
  TEST_PLAN: (id: string) => `${API_BASE_URL}/plans/${id}`,
  
  // Test Runs
  TEST_RUNS: `${API_BASE_URL}/test-runs`,
  TEST_RUN: (id: string) => `${API_BASE_URL}/test-runs/${id}`,
  TEST_RUN_START: (id: string) => `${API_BASE_URL}/test-runs/${id}/start`,
  TEST_RUN_COMMENTS: (id: string, stepId?: string) => 
    stepId 
      ? `${API_BASE_URL}/test-runs/${id}/comments?step_id=${stepId}`
      : `${API_BASE_URL}/test-runs/${id}/comments`,
  TEST_RUN_STEP_MARK: (runId: string, stepId: string) => 
    `${API_BASE_URL}/test-runs/${runId}/steps/${stepId}/mark`,
  TEST_RUN_STEP_SCREENSHOT: (runId: string, stepId?: string) =>
    stepId
      ? `${API_BASE_URL}/test-runs/${runId}/steps/${stepId}/screenshot`
      : `${API_BASE_URL}/test-runs/${runId}/screenshot`,
  TEST_RUN_LINK_DEFECT: (runId: string, stepId?: string) =>
    stepId
      ? `${API_BASE_URL}/test-runs/${runId}/steps/${stepId}/link-defect`
      : `${API_BASE_URL}/test-runs/${runId}/link-defect`,
  
  // Requirements
  REQUIREMENTS: `${API_BASE_URL}/requirements`,
  REQUIREMENT: (id: string) => `${API_BASE_URL}/requirements/${id}`,
  REQUIREMENTS_JIRA_TO_TESTCASES: `${API_BASE_URL}/requirements/jira-to-testcases`,
  
  // Defects
  DEFECTS: `${API_BASE_URL}/defects`,
  DEFECT: (id: string) => `${API_BASE_URL}/defects/${id}`,
  
  // Test Execution
  TEST_EXECUTE: `${API_BASE_URL}/tests/execute`,
  
  // Traceability
  TRACEABILITY: `${API_BASE_URL}/traceability`,
  
  // Health
  HEALTH: `${API_BASE_URL}/health`,
  
  // Dashboard
  DASHBOARD_STATS: `${API_BASE_URL}/dashboard/stats`,
  DASHBOARD_ACTIVITY: `${API_BASE_URL}/dashboard/activity`,
  
  // Flowstral
  FLOWSTRAL_START: `${API_BASE_URL}/api/flowstral/start`,
  FLOWSTRAL_CAPTURE_EVENT: `${API_BASE_URL}/api/flowstral/capture-event`,
  FLOWSTRAL_STOP: `${API_BASE_URL}/api/flowstral/stop`,
  FLOWSTRAL_SESSION_STATUS: (sessionId: string) => `${API_BASE_URL}/api/flowstral/session/${sessionId}/status`,
  FLOWSTRAL_ARTIFACTS: (sessionId: string) => `${API_BASE_URL}/api/flowstral/session/${sessionId}/artifacts`,
  FLOWSTRAL_SESSIONS: `${API_BASE_URL}/api/flowstral/sessions`,
  FLOWSTRAL_SESSION_SUMMARY: (sessionId: string) => `${API_BASE_URL}/api/flowstral/session/${sessionId}/summary`,
  FLOWSTRAL_WS: (sessionId: string) => {
    const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    return `${wsUrl}/api/flowstral/ws/${sessionId}`;
  },
};


