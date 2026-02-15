/**
 * Data Mappers - Transform API responses to frontend types
 *
 * Maps raw database row objects from the backend API into
 * properly typed frontend interfaces for TestSuite, TestPlan,
 * TestRun, and Defect.
 */

import type { TestSuite, TestPlan, TestRun, Defect } from '../types/test-repository.types';

export const mapSuiteFromApi = (row: Record<string, unknown>): TestSuite => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  description: row.description != null ? String(row.description) : undefined,
  testCaseIds: Array.isArray(row.test_case_ids) ? row.test_case_ids as string[] : [],
  status: (row.status as TestSuite['status']) ?? 'active',
  createdAt: String(row.created_at ?? new Date().toISOString()),
});

export const mapPlanFromApi = (row: Record<string, unknown>): TestPlan => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  description: row.description != null ? String(row.description) : undefined,
  suiteIds: Array.isArray(row.suite_ids) ? row.suite_ids as string[] : [],
  testCaseIds: Array.isArray(row.test_case_ids) ? row.test_case_ids as string[] : [],
  status: (row.status as TestPlan['status']) ?? 'draft',
  createdAt: String(row.created_at ?? new Date().toISOString()),
});

export const mapRunFromApi = (row: Record<string, unknown>): TestRun => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  suiteId: row.suite_id != null ? String(row.suite_id) : undefined,
  testCaseIds: Array.isArray(row.test_case_ids) ? row.test_case_ids as string[] : [],
  mode: 'automated',
  status: (row.status as TestRun['status']) ?? 'pending',
  startTime: String(row.started_at ?? row.created_at ?? new Date().toISOString()),
  endTime: row.completed_at != null ? String(row.completed_at) : undefined,
  results: (row.results as TestRun['results']) ?? undefined,
  browser: row.browser != null ? String(row.browser) : undefined,
  environment: row.environment != null ? String(row.environment) : undefined,
});

export const mapDefectFromApi = (row: Record<string, unknown>): Defect => ({
  id: String(row.id ?? ''),
  title: String(row.title ?? ''),
  description: row.description != null ? String(row.description) : undefined,
  severity: (row.severity as Defect['severity']) ?? 'major',
  priority: 'medium',
  status: (row.status as Defect['status']) ?? 'open',
  linkedTestCaseIds: row.test_case_id ? [String(row.test_case_id)] : undefined,
  linkedRunIds: row.test_run_id ? [String(row.test_run_id)] : undefined,
  createdAt: String(row.created_at ?? new Date().toISOString()),
});
