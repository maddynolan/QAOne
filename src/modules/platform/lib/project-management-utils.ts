/**
 * Pure utility functions for ProjectManagement page.
 * These functions have no React dependencies and no side effects.
 */

import type { Issue } from '../types/project-management-types';

/**
 * Generate Gherkin feature file from an Issue.
 */
export function generateLocalGherkin(issue: Issue): string {
  return `Feature: ${issue.title}
  As a user
  I want to ${issue.title.toLowerCase()}
  So that I can achieve the expected outcome

  Background:
    Given the system is accessible
    And I am authenticated

  @${issue.type} @${issue.priority}
  Scenario: Successfully ${issue.title.toLowerCase()}
    Given ${issue.description || 'the preconditions are met'}
    When I perform the required action
    Then the expected result should occur
    And the system state should be valid

  @negative
  Scenario: Handle error case for ${issue.title.toLowerCase()}
    Given the preconditions are NOT met
    When I attempt the action
    Then an appropriate error should be shown
    And the system should remain stable
`;
}

/**
 * Generate Gherkin feature file from free-form text.
 */
export function generateGherkinFromText(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  const title = lines[0] || 'Custom Feature';
  const desc = lines.slice(1).join(' ') || text;

  return `Feature: ${title}
  As a stakeholder
  I want to ${title.toLowerCase()}
  So that business value is delivered

  Background:
    Given the system is operational
    And all dependencies are available

  Scenario: Primary success path
    Given ${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}
    When the user performs the action
    Then the expected outcome occurs

  Scenario: Edge case handling
    Given an edge case condition exists
    When the user attempts the action
    Then appropriate handling occurs
`;
}
