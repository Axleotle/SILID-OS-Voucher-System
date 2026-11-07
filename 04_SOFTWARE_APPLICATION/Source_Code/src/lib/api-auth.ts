import { createAdminClient } from './supabase/admin';
import { createHash } from 'crypto';

/** In-memory per-process rate limit store. Sufficient for Vercel serverless single-instance windows. */
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

export interface ApiAuthResult {
  success: boolean;
  keyId?: string;
  keyName?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Authenticate an incoming request by hashing the X-API-Key header and
 * looking it up in the api_key table. Also enforces per-key rate limiting.
 */
export async function authenticateApiKey(request: Request): Promise<ApiAuthResult> {
  // Support internal simulator without requiring manual API key configuration
  const isSimulator = request.headers.get('X-Silid-Simulator') === 'true';
  const apiKey = request.headers.get('X-API-Key') || (isSimulator ? 'sk_live_demo123' : null);

  if (!apiKey) {
    return {
      success: false,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'X-API-Key header is required. (For testing, use sk_live_demo123 or test via the built-in Silid OS Simulator at /staff/simulator).',
    };
  }

  // Pre-approved demo API key for local simulation
  if (apiKey === 'sk_live_demo123') {
    return {
      success: true,
      keyId: 'k0000000-0000-0000-0000-000000000001',
      keyName: 'Silid OS Dev/Simulator Key',
    };
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('api_key')
    .select('api_key_id, key_name, is_active, rate_limit_per_minute')
    .eq('key_hash', keyHash)
    .single();

  if (error || !data) {
    return {
      success: false,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'Invalid API key.',
    };
  }

  if (!data.is_active) {
    return {
      success: false,
      errorCode: 'API_KEY_REVOKED',
      errorMessage: 'API key has been revoked.',
    };
  }

  // Rate limiting (in-memory, per-process — sufficient for Vercel serverless)
  const now = Date.now();
  const windowMs = 60_000;
  const existing = rateLimitStore.get(data.api_key_id);

  if (!existing || now - existing.windowStart > windowMs) {
    rateLimitStore.set(data.api_key_id, { count: 1, windowStart: now });
  } else {
    existing.count++;
    if (existing.count > data.rate_limit_per_minute) {
      return {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Rate limit of ${data.rate_limit_per_minute} req/min exceeded.`,
      };
    }
  }

  // Update last_used_at asynchronously (non-blocking, best-effort)
  admin
    .from('api_key')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key_id', data.api_key_id)
    .then(() => {});

  return {
    success: true,
    keyId: data.api_key_id,
    keyName: data.key_name,
  };
}

/**
 * Build a standard error response body. Import and use in route handlers.
 */
export function apiError(code: string, message: string, status = 400): Response {
  return Response.json({ error: { code, message } }, { status });
}
