import React from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { toggleFeatureFlagAction, createApiKeyAction, revokeApiKeyAction } from './actions';
import { formatDisplayPHT } from '@/lib/timezone';

export const metadata = {
  title: 'Admin Settings & Integration Flags',
};

async function getAdminData() {
  const admin = createAdminClient();

  const [flagsRes, keysRes, staffRes] = await Promise.all([
    admin.from('feature_flag').select('*').order('flag_key', { ascending: true }),
    admin.from('api_key').select('*').order('created_at', { ascending: false }),
    admin.from('staff').select('*').order('created_at', { ascending: true }),
  ]);

  return {
    flags: flagsRes.data || [],
    keys: keysRes.data || [],
    staffMembers: staffRes.data || [],
  };
}

export default async function AdminPage() {
  const { flags, keys, staffMembers } = await getAdminData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1>Admin Control & Staged Rollout</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Manage integration feature flags per Silid OS checkpoint (§2, §6, §7), provision rotatable API keys, and review staff RBAC privileges.
        </p>
      </div>

      {/* Feature Flags for Staged Rollout */}
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Staged Rollout & Rollback Feature Flags (§2, §6)</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Toggle individual endpoints on or off without redeploying. Changes take effect within 30 seconds across all servers.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {flags.map((flag: any, idx: number) => (
            <div
              key={flag.flag_id || flag.flag_key || `flag-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                  {flag.flag_key}
                </strong>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                  {flag.description}
                </div>
              </div>

              <form
                action={async () => {
                  'use server';
                  await toggleFeatureFlagAction(flag.flag_key, !flag.is_enabled);
                }}
              >
                <button
                  type="submit"
                  className={flag.is_enabled ? 'btn-primary' : 'btn'}
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.85rem',
                    background: flag.is_enabled ? 'var(--color-primary)' : '#eee7dc',
                    color: flag.is_enabled ? '#ffffff' : 'var(--color-ink)',
                  }}
                >
                  {flag.is_enabled ? '✓ Enabled' : '○ Disabled'}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys Management */}
      <div className="card" style={{ display: 'grid', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Silid OS API Keys (§7)</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Hashed, rotatable keys with rate limiting over HTTPS. Only the SHA-256 hash is persisted in the database.
          </p>
        </div>

        {/* Generate Key Form */}
        <form action={createApiKeyAction as any} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'end' }}>
          <label>
            Application / Key Name *
            <input name="keyName" type="text" required placeholder="e.g. Silid OS Production Server" />
          </label>

          <label>
            Rate Limit (Req/Min)
            <input name="rateLimit" type="number" defaultValue="60" min="10" max="600" />
          </label>

          <button type="submit" className="btn btn-primary" style={{ height: 44 }}>
            + Generate New API Key
          </button>
        </form>

        {/* Existing Keys Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f5f2e9', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 14px' }}>Name</th>
                <th style={{ padding: '10px 14px' }}>Rate Limit</th>
                <th style={{ padding: '10px 14px' }}>Created</th>
                <th style={{ padding: '10px 14px' }}>Last Used</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-muted)' }}>
                    No API keys generated yet.
                  </td>
                </tr>
              ) : (
                keys.map((k: any, idx: number) => (
                  <tr key={k.api_key_id || `key-${idx}`} style={{ borderBottom: '1px solid #f0eae0' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{k.key_name}</td>
                    <td style={{ padding: '12px 14px' }}>{k.rate_limit_per_minute} req/min</td>
                    <td style={{ padding: '12px 14px' }}>{formatDisplayPHT(k.created_at)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-muted)' }}>
                      {k.last_used_at ? formatDisplayPHT(k.last_used_at) : 'Never'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${k.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {k.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {k.is_active && (
                        <form
                          action={async () => {
                            'use server';
                            await revokeApiKeyAction(k.api_key_id);
                          }}
                        >
                          <button type="submit" className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                            Revoke
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Accounts & RBAC */}
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Staff Roles & Permissions (§7)</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Founder, Manager, and Staff roles. Staff role can review and redeem only. Bulk batches &gt;50 tickets require Founder/Manager.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {staffMembers.map((staff: any, idx: number) => (
            <div
              key={staff.staff_id || `staff-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <strong>{staff.staff_name}</strong>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{staff.email}</div>
              </div>
              <span className={`badge ${staff.role === 'Founder' ? 'badge-success' : staff.role === 'Manager' ? 'badge-pending' : 'badge-muted'}`}>
                {staff.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
