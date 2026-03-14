/**
 * Environment persistence functions for the API Testing module.
 * Handles loading/saving environments from/to localStorage and the database.
 *
 * Extracted from EnhancedAPITesting.tsx for code splitting.
 */

import { API_BASE_URL } from "@/lib/api-config";

const STORAGE_KEY = "apex_environments";

/**
 * Load persisted environments from localStorage.
 */
export function loadPersistedEnvironments(): any[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to load persisted environments:", error);
  }
  return [];
}

/**
 * Save environments array to localStorage.
 */
export function saveEnvironmentsToLocalStorage(envs: any[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envs));
  } catch (error) {
    console.error("Failed to save environments:", error);
  }
}

/**
 * Save an environment to the database (best-effort, logs on failure).
 * Returns true if saved successfully, false otherwise.
 */
export async function saveEnvironmentToDb(env: any): Promise<boolean> {
  try {
    const envId = env.environment_id || env.id;
    if (!envId || !env.name) {
      console.warn('[EnvPersistence] Skipping invalid environment (missing id or name):', env);
      return false;
    }
    const payload = {
      id: envId,
      name: env.name,
      env_type: env.type || env.env_type || "development",
      base_url: env.base_url || "",
      variables: Array.isArray(env.variables) ? env.variables : [],
      auth: (env.auth && typeof env.auth === "object") ? env.auth : {},
    };
    // Try POST (create) -- backend should handle "already exists" gracefully
    const resp = await fetch(`${API_BASE_URL}/api/db/environments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // If 409 Conflict (already exists), try PUT to update
    if (resp.status === 409 || resp.status === 422) {
      const putResp = await fetch(`${API_BASE_URL}/api/db/environments/${envId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!putResp.ok) {
        console.warn(`[EnvPersistence] PUT update failed for env "${env.name}" (HTTP ${putResp.status})`);
        return false;
      }
    } else if (!resp.ok) {
      console.warn(`[EnvPersistence] POST create failed for env "${env.name}" (HTTP ${resp.status})`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[EnvPersistence] DB save failed for env (using localStorage fallback):', env.name, err);
    return false;
  }
}

/**
 * Load environments from DB + localStorage with merge and migration.
 * Returns the merged environment array. Also saves merged result to localStorage.
 *
 * @param setEnvironments - state setter to update the component's environments
 */
export async function loadEnvironments(
  setEnvironments: (envs: any[]) => void
) {
  try {
    // Primary source: database
    const dbResp = await fetch(`${API_BASE_URL}/api/db/environments`);
    const dbEnvs: any[] = dbResp.ok ? await dbResp.json() : [];

    // Normalize DB format to frontend format
    const normalized = dbEnvs.map((e: any) => ({
      environment_id: e.id || e.environment_id,
      name: e.name,
      type: e.env_type || e.type || "development",
      base_url: e.base_url || "",
      variables: e.variables || [],
      auth: e.auth || { type: "none" },
      created_at: e.created_at,
      updated_at: e.updated_at,
    }));

    // Merge with localStorage (for migration of old data)
    const persisted = loadPersistedEnvironments();
    const allEnvs = [...normalized];

    // Add any localStorage envs that aren't in DB yet (one-time migration)
    const envsToMigrate: any[] = [];
    for (const p of persisted) {
      const pId = p.environment_id || p.id;
      // Check by ID or name to avoid duplicates
      if (!allEnvs.find(e => e.environment_id === pId || e.name === p.name)) {
        allEnvs.push(p);
        envsToMigrate.push(p);
      }
    }
    // Migrate up to 5 environments to DB in the background (sequential, bounded)
    if (envsToMigrate.length > 0) {
      const migrateEnvs = async () => {
        let successCount = 0;
        for (const env of envsToMigrate.slice(0, 5)) {
          const ok = await saveEnvironmentToDb(env);
          if (ok) successCount++;
        }
        if (successCount > 0) {
          console.info(`[EnvPersistence] Migrated ${successCount}/${envsToMigrate.length} environments to DB`);
        }
      };
      // Fire-and-forget but with proper error boundary
      migrateEnvs().catch(err => console.warn('[EnvPersistence] Background migration failed:', err));
    }

    if (allEnvs.length > 0) {
      setEnvironments(allEnvs);
      saveEnvironmentsToLocalStorage(allEnvs);
    }
  } catch (error) {
    console.error("Failed to load environments:", error);
    // Fallback to localStorage if API fails
    const persisted = loadPersistedEnvironments();
    if (persisted.length > 0) {
      setEnvironments(persisted);
    }
  }
}
