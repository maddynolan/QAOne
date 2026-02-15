/**
 * Test Repository API Service
 *
 * Functions for CRUD operations against the backend API,
 * localStorage, and Electron storage. All functions take
 * explicit parameters (no React state closures).
 */

import { API_BASE_URL } from '@/lib/api-config';
import type { TestCase, TestSuite, TestPlan, TestRun, Defect } from '../types/test-repository.types';
import { mapSuiteFromApi, mapPlanFromApi, mapRunFromApi, mapDefectFromApi } from './data-mappers';
import { calculateAutomationStatus } from './test-repository-utils';

// ═══════════════════════════════════════════════════════════════════════════
// DELETE FROM ALL SOURCES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delete a test case from all storage sources: localStorage, backend APIs,
 * Electron storage, and the scale database.
 *
 * Synchronously updates deleted_test_ids first to prevent race conditions,
 * then fires async backend deletions in parallel.
 */
export async function deleteTestCaseFromAllSources(testId: string): Promise<void> {
  // FIRST: Update deleted_test_ids in localStorage SYNCHRONOUSLY to prevent race conditions
  try {
    const existingDeleted = JSON.parse(localStorage.getItem('deleted_test_ids') || '[]');
    if (!existingDeleted.includes(testId)) {
      existingDeleted.push(testId);
      localStorage.setItem('deleted_test_ids', JSON.stringify(existingDeleted));
      console.log(`[Repository] Added ${testId} to deleted_test_ids (sync)`);
    }
  } catch (e) {
    console.warn(`[Repository] Failed to update deleted_test_ids:`, e);
  }

  // 1. Delete from localStorage entries FIRST (synchronous)
  localStorage.removeItem(`unified_test_case_${testId}`);

  // 2. Delete from flowstral_test_cases localStorage
  try {
    const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
    const updatedFlowstral = flowstralCases.filter((tc: any) => tc.id !== testId);
    localStorage.setItem('flowstral_test_cases', JSON.stringify(updatedFlowstral));
  } catch (e) {}

  // 3. Delete from test_cases localStorage
  try {
    const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
    const updatedLocal = localCases.filter((tc: any) => tc.id !== testId);
    localStorage.setItem('test_cases', JSON.stringify(updatedLocal));
  } catch (e) {}

  // NOW do async backend deletions (these can happen in parallel)
  const deletePromises: Promise<any>[] = [];

  // 4. Delete from backend API (PostgreSQL)
  deletePromises.push(
    fetch(`${API_BASE_URL}/test-cases/${testId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) console.log(`[Repository] Deleted ${testId} from PostgreSQL backend`);
        return res;
      })
      .catch(e => console.warn(`[Repository] PostgreSQL delete failed:`, e))
  );

  // 5. Delete from Flowstral backend (alternative endpoint)
  deletePromises.push(
    fetch(`${API_BASE_URL}/api/flowstral/test-cases/${testId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) console.log(`[Repository] Deleted ${testId} from Flowstral backend`);
        return res;
      })
      .catch(e => {})
  );

  // 6. Delete from SQLite scale database
  deletePromises.push(
    fetch(`${API_BASE_URL}/test-cases/scale-data/${testId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) console.log(`[Repository] Deleted ${testId} from SQLite scale DB`);
        return res;
      })
      .catch(e => console.warn(`[Repository] SQLite delete failed:`, e))
  );

  // 7. Delete from Electron storage if available
  try {
    const electronAPI = (window as any).electronAPI || (window as any).flowstral;
    if (electronAPI?.localStorage?.deleteTestCase) {
      deletePromises.push(
        electronAPI.localStorage.deleteTestCase(testId)
          .then(() => console.log(`[Repository] Deleted ${testId} from Electron storage`))
          .catch((e: any) => console.warn(`[Repository] Electron delete failed:`, e))
      );
    }
  } catch (e) {}

  // Wait for all backend deletions to complete
  await Promise.allSettled(deletePromises);
  console.log(`[Repository] Completed deletion of ${testId} from all sources`);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD ALL TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load test cases from all available sources: Electron storage, localStorage,
 * unified_test_case_* keys, backend API, and scale database.
 * Deduplicates by name, keeping the most recently updated version.
 */
export async function loadAllTestCases(): Promise<TestCase[]> {
  const allCases: TestCase[] = [];
  const seenIds = new Set<string>();

  // Load deleted IDs to skip them while loading
  const deletedIds = new Set<string>(JSON.parse(localStorage.getItem('deleted_test_ids') || '[]'));
  console.log('[Repository] Deleted IDs to skip:', deletedIds.size);

  // CLEANUP: Actually remove deleted entries from localStorage to prevent reappearing
  if (deletedIds.size > 0) {
    for (const deletedId of deletedIds) {
      localStorage.removeItem(`unified_test_case_${deletedId}`);
    }

    try {
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      const cleanedLocal = localCases.filter((tc: any) => !deletedIds.has(tc.id));
      if (cleanedLocal.length !== localCases.length) {
        localStorage.setItem('test_cases', JSON.stringify(cleanedLocal));
        console.log('[Repository] Cleaned', localCases.length - cleanedLocal.length, 'deleted entries from test_cases');
      }
    } catch (e) {}

    try {
      const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
      const cleanedFlowstral = flowstralCases.filter((tc: any) => !deletedIds.has(tc.id));
      if (cleanedFlowstral.length !== flowstralCases.length) {
        localStorage.setItem('flowstral_test_cases', JSON.stringify(cleanedFlowstral));
        console.log('[Repository] Cleaned', flowstralCases.length - cleanedFlowstral.length, 'deleted entries from flowstral_test_cases');
      }
    } catch (e) {}
  }

  const isDeleted = (id: string) => deletedIds.has(id);

  // 0. Check if we should load from backend scale database (for large datasets)
  const useScaleDb = localStorage.getItem('use_scale_db') === 'true';
  if (useScaleDb) {
    try {
      console.log('[Repository] Loading from backend scale database...');
      const response = await fetch(`${API_BASE_URL}/test-cases/scale-data`);
      if (response.ok) {
        const data = await response.json();
        console.log('[Repository] Loaded from scale DB:', data.testCases?.length || 0, 'test cases');
        for (const tc of (data.testCases || [])) {
          if (tc.id && !seenIds.has(tc.id) && !isDeleted(tc.id)) {
            seenIds.add(tc.id);
            allCases.push({
              id: tc.id,
              name: tc.name,
              description: tc.description || '',
              folderId: tc.folder_id || null,
              priority: tc.priority || 'medium',
              status: tc.status || 'ready',
              automationStatus: (tc.automation_status as 'none' | 'partial' | 'full') || 'none',
              tags: tc.tags || [],
              steps: tc.steps || [],
              createdAt: tc.created_at,
              updatedAt: tc.updated_at
            });
          }
        }
        // Also load suites, plans, releases if present
        if (data.suites?.length > 0) {
          console.log('[Repository] Saving suites to localStorage:', data.suites.length);
          localStorage.setItem('test_suites', JSON.stringify(data.suites));
        }
        if (data.plans?.length > 0) {
          console.log('[Repository] Saving plans to localStorage:', data.plans.length);
          localStorage.setItem('test_plans', JSON.stringify(data.plans));
        }
        if (data.releases?.length > 0) {
          console.log('[Repository] Saving releases to localStorage:', data.releases.length);
          localStorage.setItem('test_releases', JSON.stringify(data.releases));
        }
        window.dispatchEvent(new CustomEvent('reload-related-data'));
      }
    } catch (e) {
      console.log('[Repository] Scale DB not available, falling back to other sources');
    }
  }

  // 1. From Electron local storage
  try {
    const electronAPI = (window as any).electronAPI || (window as any).flowstral;
    if (electronAPI?.localStorage?.getTestCases) {
      const electronCases = await electronAPI.localStorage.getTestCases();
      console.log('[Repository] Loaded from Electron storage:', electronCases?.length || 0, 'test cases');
      for (const tc of (electronCases || [])) {
        if (tc.id && !seenIds.has(tc.id) && !isDeleted(tc.id)) {
          seenIds.add(tc.id);
          allCases.push({
            ...tc,
            folderId: tc.folderId || null,
            automationStatus: calculateAutomationStatus(tc)
          });
        }
      }
    }
  } catch (e) {
    console.log('[Repository] Electron storage not available, using browser localStorage');
  }

  // 2. From browser localStorage test_cases key
  try {
    const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
    for (const tc of localCases) {
      if (tc.id && !seenIds.has(tc.id) && !isDeleted(tc.id)) {
        seenIds.add(tc.id);
        allCases.push({
          ...tc,
          folderId: tc.folderId || null,
          automationStatus: calculateAutomationStatus(tc)
        });
      }
    }
  } catch (e) {}

  // 3. From unified_test_case_* keys (legacy format)
  const keys = Object.keys(localStorage).filter(k => k.startsWith('unified_test_case_'));
  for (const key of keys) {
    try {
      const tc = JSON.parse(localStorage.getItem(key) || '{}');
      if (tc.id && !seenIds.has(tc.id) && !isDeleted(tc.id)) {
        seenIds.add(tc.id);
        allCases.push({
          ...tc,
          folderId: tc.folderId || null,
          automationStatus: calculateAutomationStatus(tc)
        });
      }
    } catch (e) {}
  }

  // 4. From persistent database API
  try {
    const response = await fetch(`${API_BASE_URL}/api/db/test-cases?limit=1000`);
    if (response.ok) {
      const dbCases = await response.json();
      const list = Array.isArray(dbCases) ? dbCases : dbCases.items || dbCases.test_cases || [];
      for (const row of list) {
        const id = row.id || row.test_case_id;
        if (!id || seenIds.has(id) || isDeleted(id)) continue;
        seenIds.add(id);
        const meta = row.metadata || {};
        const isApi = row.category === 'api' || meta.type === 'automated';
        allCases.push({
          id,
          name: row.name || row.title || 'Untitled',
          description: row.description || '',
          folderId: row.folder_id || row.folderId || null,
          priority: (row.priority as TestCase['priority']) || 'medium',
          status: (row.status as TestCase['status']) || 'draft',
          type: (row.category === 'api' ? 'functional' : row.type) as TestCase['type'],
          automationStatus: isApi ? 'full' : (meta.automationStatus as TestCase['automationStatus']) || calculateAutomationStatus({ steps: row.steps }),
          tags: [...new Set([...(Array.isArray(row.tags) ? row.tags : row.tags ? [row.tags] : []), ...(row.category === 'api' ? ['api-testing'] : [])])],
          steps: row.steps || [],
          createdAt: row.created_at || row.createdAt,
          updatedAt: row.updated_at || row.updatedAt,
          unified_data: { ...meta, method: meta.method, endpoint: meta.endpoint, assertions: meta.assertions },
        });
      }
      console.log('[Repository] Loaded from /api/db/test-cases:', list.length, 'test cases');
    }
  } catch (e) {
    console.log('[Repository] /api/db/test-cases not available:', (e as Error).message);
  }

  // Deduplicate by name - keep the most recently updated version
  const byName = new Map<string, TestCase>();
  for (const tc of allCases) {
    const existing = byName.get(tc.name);
    if (!existing) {
      byName.set(tc.name, tc);
    } else {
      const existingDate = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newDate = new Date(tc.updatedAt || tc.createdAt || 0).getTime();
      if (newDate > existingDate) {
        byName.set(tc.name, tc);
      }
    }
  }
  const dedupedCases = Array.from(byName.values());

  console.log('[Repository] Total test cases loaded:', dedupedCases.length, '(deduped from', allCases.length, ', skipped', deletedIds.size, 'deleted)');
  return dedupedCases;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD RELATED DATA (suites, plans, runs, defects)
// ═══════════════════════════════════════════════════════════════════════════

export interface RelatedData {
  suites: TestSuite[];
  plans: TestPlan[];
  runs: TestRun[];
  defects: Defect[];
  releases: import('../types/test-repository.types').Release[];
}

/**
 * Load suites, plans, runs, defects from backend first (shared data),
 * then fallback to localStorage for any that fail.
 * Releases always come from localStorage (no backend endpoint yet).
 */
export async function loadRelatedData(): Promise<RelatedData> {
  let apiSuitesOk = false, apiPlansOk = false, apiRunsOk = false, apiDefectsOk = false;
  let suites: TestSuite[] = [];
  let plans: TestPlan[] = [];
  let runs: TestRun[] = [];
  let defects: Defect[] = [];
  let releases: import('../types/test-repository.types').Release[] = [];

  try {
    const [suitesRes, plansRes, runsRes, defectsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/db/test-suites?limit=1000`),
      fetch(`${API_BASE_URL}/api/db/test-plans?limit=1000`),
      fetch(`${API_BASE_URL}/api/db/test-runs?limit=1000`),
      fetch(`${API_BASE_URL}/api/db/defects?limit=1000`),
    ]);
    if (suitesRes.ok) {
      const list = await suitesRes.json().catch(() => []);
      const arr = Array.isArray(list) ? list : list.items ?? [];
      suites = arr.map((r: Record<string, unknown>) => mapSuiteFromApi(r));
      apiSuitesOk = true;
      console.log('[Repository] Loaded suites from /api/db/test-suites:', arr.length);
    }
    if (plansRes.ok) {
      const list = await plansRes.json().catch(() => []);
      const arr = Array.isArray(list) ? list : list.items ?? [];
      plans = arr.map((r: Record<string, unknown>) => mapPlanFromApi(r));
      apiPlansOk = true;
      console.log('[Repository] Loaded plans from /api/db/test-plans:', arr.length);
    }
    if (runsRes.ok) {
      const list = await runsRes.json().catch(() => []);
      const arr = Array.isArray(list) ? list : list.items ?? [];
      runs = arr.map((r: Record<string, unknown>) => mapRunFromApi(r));
      apiRunsOk = true;
      console.log('[Repository] Loaded runs from /api/db/test-runs:', arr.length);
    }
    if (defectsRes.ok) {
      const list = await defectsRes.json().catch(() => []);
      const arr = Array.isArray(list) ? list : list.items ?? [];
      defects = arr.map((r: Record<string, unknown>) => mapDefectFromApi(r));
      apiDefectsOk = true;
      console.log('[Repository] Loaded defects from /api/db/defects:', arr.length);
    }
  } catch (e) {
    console.log('[Repository] Backend not available for related data, using localStorage');
  }

  // Releases: no backend endpoint yet; always from localStorage
  const savedReleases = localStorage.getItem('test_releases');
  if (savedReleases) {
    try {
      releases = JSON.parse(savedReleases);
    } catch (e) {}
  }

  // Fallback to localStorage only when API did not succeed
  if (!apiSuitesOk) {
    const saved = localStorage.getItem('test_suites');
    if (saved) { try { suites = JSON.parse(saved); } catch (e) {} }
  }
  if (!apiPlansOk) {
    const saved = localStorage.getItem('test_plans');
    if (saved) { try { plans = JSON.parse(saved); } catch (e) {} }
  }
  if (!apiRunsOk) {
    const saved = localStorage.getItem('test_execution_history');
    if (saved) { try { runs = JSON.parse(saved); } catch (e) {} }
  }
  if (!apiDefectsOk) {
    const saved = localStorage.getItem('test_defects');
    if (saved) { try { defects = JSON.parse(saved); } catch (e) {} }
  }

  return { suites, plans, runs, defects, releases };
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN API TEST
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiRunResult {
  passed: boolean;
  message: string;
  detail?: string;
}

/**
 * Execute an API test directly from the repository via the backend engine.
 */
export async function runApiTestFromRepository(tc: TestCase): Promise<ApiRunResult> {
  const ud = tc.unified_data || {};
  const method = ud.method || 'GET';
  const endpoint = ud.endpoint || ud.path || (tc as any).path || '';
  const isFullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  const testPath = isFullUrl ? endpoint : (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (ud.headers) headers = typeof ud.headers === 'string' ? JSON.parse(ud.headers) : ud.headers;
  } catch { /* keep default */ }
  let body: any = undefined;
  try {
    if (ud.request_body != null) body = typeof ud.request_body === 'string' ? JSON.parse(ud.request_body) : ud.request_body;
  } catch { /* leave undefined */ }
  const assertions = Array.isArray(ud.assertions) ? ud.assertions : [];
  const expectedStatus = ud.expected_status != null ? parseInt(String(ud.expected_status), 10) : (method === 'POST' ? 201 : 200);

  const res = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      test_suite: {
        test_cases: [{
          test_case_id: tc.id,
          title: tc.name || 'API Test',
          method,
          path: testPath,
          request: { headers, body },
          expected_status: expectedStatus,
          assertions,
          test_type: 'functional',
        }],
        base_url: isFullUrl ? '' : '',
      },
      execution_config: { base_url: '', parallel: false },
      mode: 'automated',
    }),
  });

  const data = await res.json().catch(() => ({}));
  const tr = data?.execution_results?.test_results?.[0];
  const passed = tr?.status === 'passed';
  const message = passed
    ? `Passed (${tr?.actual_status} in ${tr?.response_time_ms ?? 0}ms)`
    : (tr?.error || `Failed: ${tr?.actual_status} (expected ${expectedStatus})`);

  return {
    passed,
    message,
    detail: tr?.response_body ? String(tr.response_body).slice(0, 200) : undefined,
  };
}
