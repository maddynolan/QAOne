/**
 * Constants for ProjectManagement page.
 */

import type { TeamMember, Issue, BoardColumn, Cycle, Goal } from '../types/project-management-types';

// ==================== MOCK DATA ====================

export const TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Alex Chen', email: 'alex@company.com', role: 'Lead Developer', color: '#6366f1' },
  { id: '2', name: 'Sarah Miller', email: 'sarah@company.com', role: 'QA Engineer', color: '#ec4899' },
  { id: '3', name: 'Mike Johnson', email: 'mike@company.com', role: 'Backend Dev', color: '#22c55e' },
  { id: '4', name: 'Emma Wilson', email: 'emma@company.com', role: 'Frontend Dev', color: '#f59e0b' },
  { id: '5', name: 'James Brown', email: 'james@company.com', role: 'DevOps', color: '#06b6d4' },
];

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'queue', name: 'Queue', color: '#64748b', isDefault: true },
  { id: 'ready', name: 'Ready', color: '#3b82f6' },
  { id: 'in_progress', name: 'In Progress', color: '#f59e0b' },
  { id: 'review', name: 'Review', color: '#8b5cf6' },
  { id: 'ready_to_test', name: 'Ready to Test', color: '#06b6d4' },
  { id: 'testing', name: 'Testing', color: '#ec4899' },
  { id: 'done', name: 'Done', color: '#22c55e' },
];

export const MOCK_ISSUES: Issue[] = [
  {
    id: '1', key: 'AT-101', title: 'User authentication flow', description: 'Implement OAuth2 login',
    type: 'card', status: 'in_progress', priority: 'high', assigneeId: '1', reporterId: '2',
    cycleId: '1', goalId: '1', points: 8, labels: ['auth', 'security'],
    created_at: '2025-12-01', updated_at: '2025-12-10',
    linkedRequirements: ['REQ-001', 'REQ-002'], linkedTestCases: ['TC-101', 'TC-102'],
    linkedDefects: [], linkedCommits: ['abc123']
  },
  {
    id: '2', key: 'AT-102', title: 'Dashboard performance', description: 'Reduce load time',
    type: 'action', status: 'ready', priority: 'normal', assigneeId: '3', reporterId: '1',
    cycleId: '1', points: 5, labels: ['performance'],
    created_at: '2025-12-02', updated_at: '2025-12-09',
    linkedRequirements: ['REQ-003'], linkedTestCases: ['TC-201'], linkedDefects: ['BUG-001'], linkedCommits: []
  },
  {
    id: '3', key: 'AT-103', title: 'Login button not responding', description: 'Mobile Safari issue',
    type: 'issue', status: 'testing', priority: 'urgent', assigneeId: '2', reporterId: '4',
    cycleId: '1', points: 3, labels: ['mobile', 'urgent'],
    created_at: '2025-12-08', updated_at: '2025-12-11',
    linkedRequirements: [], linkedTestCases: ['TC-101'], linkedDefects: [], linkedCommits: ['ghi789']
  },
  {
    id: '4', key: 'AT-104', title: 'API rate limiting', description: 'Implement rate limits',
    type: 'enhancement', status: 'queue', priority: 'normal', reporterId: '1',
    points: 13, labels: ['api', 'security'],
    created_at: '2025-12-05', updated_at: '2025-12-05',
    linkedRequirements: ['REQ-010'], linkedTestCases: [], linkedDefects: [], linkedCommits: []
  },
  {
    id: '5', key: 'AT-105', title: 'User profile redesign', description: 'Modern profile page',
    type: 'goal', status: 'review', priority: 'low', assigneeId: '4', reporterId: '1',
    points: 21, labels: ['design', 'ux'],
    created_at: '2025-11-20', updated_at: '2025-12-10',
    linkedRequirements: ['REQ-020'], linkedTestCases: [], linkedDefects: [], linkedCommits: []
  },
  {
    id: '6', key: 'AT-106', title: 'Export reports to PDF', description: 'PDF export feature',
    type: 'card', status: 'done', priority: 'normal', assigneeId: '1', reporterId: '2',
    cycleId: '2', points: 5, labels: ['reports'],
    created_at: '2025-11-25', updated_at: '2025-12-05',
    linkedRequirements: ['REQ-015'], linkedTestCases: ['TC-301'], linkedDefects: [], linkedCommits: ['jkl012']
  },
  {
    id: '7', key: 'AT-107', title: 'Database connection pooling', description: 'Optimize DB',
    type: 'action', status: 'ready_to_test', priority: 'high', assigneeId: '3', reporterId: '5',
    cycleId: '1', points: 8, labels: ['backend'],
    created_at: '2025-12-06', updated_at: '2025-12-06',
    linkedRequirements: [], linkedTestCases: [], linkedDefects: ['BUG-002'], linkedCommits: []
  },
  {
    id: '8', key: 'AT-108', title: 'Mobile responsive tables', description: 'Mobile tables',
    type: 'card', status: 'queue', priority: 'low', reporterId: '4',
    points: 5, labels: ['mobile', 'ux'],
    created_at: '2025-12-07', updated_at: '2025-12-07',
    linkedRequirements: ['REQ-025'], linkedTestCases: [], linkedDefects: [], linkedCommits: []
  },
];

export const MOCK_CYCLES: Cycle[] = [
  { id: '1', name: 'Cycle 23', objective: 'Complete authentication', startDate: '2025-12-09', endDate: '2025-12-23', status: 'active', issueIds: ['1', '2', '3', '7'] },
  { id: '2', name: 'Cycle 22', objective: 'Reporting features', startDate: '2025-11-25', endDate: '2025-12-08', status: 'complete', issueIds: ['6'] },
  { id: '3', name: 'Cycle 24', objective: 'API enhancements', startDate: '2025-12-23', endDate: '2026-01-06', status: 'planning', issueIds: [] },
];

export const MOCK_GOALS: Goal[] = [
  { id: '1', key: 'GOAL-1', name: 'Authentication System', description: 'Complete auth module', color: '#6366f1', progress: 65 },
  { id: '2', key: 'GOAL-2', name: 'Performance Optimization', description: 'Speed improvements', color: '#22c55e', progress: 30 },
];

// ==================== CONFIGURATION ====================

export const TYPE_CONFIG = {
  goal: { label: 'Goal', color: 'bg-purple-600', icon: '\uD83C\uDFAF', description: 'Large objective' },
  enhancement: { label: 'Enhancement', color: 'bg-green-600', icon: '\u2728', description: 'New capability' },
  card: { label: 'Card', color: 'bg-blue-600', icon: '\uD83D\uDCCB', description: 'Work item' },
  action: { label: 'Action', color: 'bg-cyan-600', icon: '\u26A1', description: 'Task to complete' },
  issue: { label: 'Issue', color: 'bg-red-600', icon: '\uD83D\uDD34', description: 'Problem to fix' },
} as const;

export const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-600 text-white', icon: '\uD83D\uDD25', dotColor: 'bg-red-500' },
  high: { label: 'High', color: 'bg-orange-500 text-white', icon: '\u2B06\uFE0F', dotColor: 'bg-orange-500' },
  normal: { label: 'Normal', color: 'bg-blue-500 text-white', icon: '\u27A1\uFE0F', dotColor: 'bg-blue-500' },
  low: { label: 'Low', color: 'bg-slate-400 text-white', icon: '\u2B07\uFE0F', dotColor: 'bg-slate-400' },
} as const;

export const GHERKIN_TEMPLATES = {
  default: {
    name: 'Default BDD',
    description: 'Standard Gherkin format with Given/When/Then',
    template: `Feature: {{feature_name}}
  As a {{user_type}}
  I want to {{action}}
  So that {{benefit}}

  Background:
    Given I am a {{user_type}}

  Scenario: {{scenario_name}}
    Given {{precondition}}
    When {{action}}
    Then {{expected_result}}`
  },
  api_testing: {
    name: 'API Testing',
    description: 'For REST API endpoint testing',
    template: `Feature: {{endpoint_name}} API
  As an API consumer
  I want to interact with {{endpoint_name}}
  So that I can {{benefit}}

  Background:
    Given the API server is running
    And I have valid authentication

  Scenario: Successful {{operation}}
    Given the request body is valid
    When I send a {{method}} request to "{{path}}"
    Then the response status code should be {{status}}
    And the response should contain {{expected_field}}`
  },
  user_story: {
    name: 'User Story',
    description: 'User story focused scenarios',
    template: `Feature: {{story_title}}
  As a {{persona}}
  I want to {{goal}}
  So that {{value}}

  Scenario: Happy path - {{success_scenario}}
    Given I am on the {{page}}
    When I {{action}}
    Then I should see {{result}}

  Scenario: Error handling - {{error_scenario}}
    Given I am on the {{page}}
    When I {{invalid_action}}
    Then I should see an error message "{{error_message}}"`
  },
  e2e_flow: {
    name: 'E2E Flow',
    description: 'End-to-end user journey testing',
    template: `Feature: {{journey_name}}
  Complete user journey for {{process}}

  Background:
    Given the application is accessible
    And test data is prepared

  Scenario Outline: {{scenario_outline}}
    Given I am logged in as "<user_type>"
    When I navigate to "<page>"
    And I perform "<action>"
    Then I should see "<expected_outcome>"

    Examples:
      | user_type | page | action | expected_outcome |
      | admin | dashboard | view reports | analytics displayed |
      | user | profile | update settings | confirmation message |`
  },
  data_driven: {
    name: 'Data-Driven',
    description: 'Parameterized testing with examples',
    template: `Feature: {{feature_name}}
  Data-driven tests for {{component}}

  Scenario Outline: {{test_name}} with various inputs
    Given the system is in state "<initial_state>"
    When I input "<input_value>"
    And I submit the form
    Then the result should be "<expected_result>"
    And the system state should be "<final_state>"

    Examples:
      | initial_state | input_value | expected_result | final_state |
      | empty | valid data | success | populated |
      | existing | duplicate | error | unchanged |
      | empty | invalid | validation error | empty |`
  }
} as const;
