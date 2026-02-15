/**
 * Utility functions for the API Testing module.
 * Extracted from EnhancedAPITesting.tsx for code splitting.
 */

/**
 * Ensure a test suite object has a folders array for collection hierarchy support.
 * Returns the suite with folders guaranteed to be an array.
 */
export function ensureTestSuiteFolders(suite: any): any {
  if (!suite) return suite;
  return { ...suite, folders: Array.isArray(suite.folders) ? suite.folders : [] };
}
