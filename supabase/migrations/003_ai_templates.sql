-- Migration: Add ai_templates table for storing prompt templates
-- Users can edit prompt templates for different AI tasks in Settings

CREATE TABLE IF NOT EXISTS ai_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(255),
    task VARCHAR(100) NOT NULL, -- 'jira-to-tests', 'testcase-to-playwright', 'api-tests', 'perf-tests', 'a11y-tests', 'triage'
    template TEXT NOT NULL, -- The prompt template
    version INTEGER DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ai_templates_project_id ON ai_templates(project_id);
CREATE INDEX idx_ai_templates_task ON ai_templates(task);
CREATE INDEX idx_ai_templates_org_id ON ai_templates(org_id);

-- Insert default templates
INSERT INTO ai_templates (project_id, org_id, task, template, is_default, version) VALUES
('default', 'default', 'jira-to-tests', 'You are an expert QA engineer. Convert the following Jira story into comprehensive manual test cases.

Jira Story/Requirements:
{requirements}

Generate an array of manual test cases in JSON format. Each test case should have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags

Respond ONLY with valid JSON array of test cases.', true, 1),

('default', 'default', 'testcase-to-playwright', 'You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

Test Case:
{test_case}

Generate complete, runnable Playwright test code in TypeScript. Include proper imports, test structure, step-by-step automation, assertions, and proper selectors.', true, 1),

('default', 'default', 'triage', 'You are an expert QA engineer analyzing test failures. Analyze the following test run logs and provide root cause analysis.

Test Run ID: {run_id}
Logs:
{logs}

Provide a comprehensive analysis in JSON format with summary, root_cause, category, suggested_fixes, selector_suggestions, likelihood_flaky, and related_cases.', true, 1);

