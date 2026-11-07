import { createAdminClient } from './supabase/admin';

// In-memory cache with 30s TTL to prevent hitting DB on every single fast API call
let cache: Map<string, boolean> | null = null;
let lastFetched = 0;
const CACHE_TTL_MS = 30_000;

export async function getFeatureFlags(): Promise<Map<string, boolean>> {
  const now = Date.now();
  if (cache && now - lastFetched < CACHE_TTL_MS) {
    return cache;
  }

  const map = new Map<string, boolean>();

  // Dev override from env
  if (process.env.FEATURE_FLAGS_OVERRIDE) {
    for (const key of process.env.FEATURE_FLAGS_OVERRIDE.split(',')) {
      if (key.trim()) map.set(key.trim(), true);
    }
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('feature_flag').select('flag_key, is_enabled');
    if (!error && data) {
      for (const row of data) {
        if (!map.has(row.flag_key)) {
          map.set(row.flag_key, row.is_enabled);
        }
      }
    }
  } catch (err) {
    console.error('[FeatureFlag] Error loading flags from database:', err);
  }

  cache = map;
  lastFetched = now;
  return map;
}

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.get(flagKey) ?? false;
}
