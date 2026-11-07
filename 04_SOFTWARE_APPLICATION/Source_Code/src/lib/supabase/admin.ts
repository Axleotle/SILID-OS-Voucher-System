import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getMockStore } from '../mock-store';

/**
 * Checks if a real Supabase URL is configured.
 */
export function isRealSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (
    url.includes('your-project') ||
    url.includes('placeholder') ||
    key.includes('your-anon-key') ||
    key.includes('your-service-role-key')
  ) {
    return false;
  }
  return true;
}

/**
 * Builds a Chainable Mock Client matching Supabase Query Builder syntax
 * to support complete offline demonstration without any external database.
 */
function createMockAdminClient(): any {
  const store = getMockStore();

  return {
    from(tableName: string) {
      const records = (store as any)[tableName] || [];
      let filtered = [...records];
      let limitCount: number | null = null;
      let orderField: string | null = null;
      let orderAscending = true;
      let isHeadOnly = false;
      let pendingUpdates: any = null;
      let isDelete = false;

      const builder: any = {
        select(columns?: string, options?: { count?: string; head?: boolean }) {
          if (options?.head) {
            isHeadOnly = true;
          }
          return builder;
        },
        update(updates: any) {
          pendingUpdates = updates;
          return builder;
        },
        delete() {
          isDelete = true;
          return builder;
        },
        eq(column: string, val: any) {
          filtered = filtered.filter((item: any) => {
            const prop = column.includes('.') ? column.split('.').pop()! : column;
            return item[prop] === val;
          });
          return builder;
        },
        in(column: string, values: any[]) {
          filtered = filtered.filter((item: any) => values.includes(item[column]));
          return builder;
        },
        lt(column: string, val: any) {
          filtered = filtered.filter((item: any) => new Date(item[column]) < new Date(val));
          return builder;
        },
        gt(column: string, val: any) {
          filtered = filtered.filter((item: any) => new Date(item[column]) > new Date(val));
          return builder;
        },
        order(column: string, opts?: { ascending?: boolean }) {
          orderField = column;
          orderAscending = opts?.ascending ?? true;
          return builder;
        },
        limit(count: number) {
          limitCount = count;
          return builder;
        },
        async single() {
          const item = filtered[0] || null;
          return { data: item, error: item ? null : { message: 'Row not found' } };
        },
        async maybeSingle() {
          return { data: filtered[0] || null, error: null };
        },
        then(resolve: (res: any) => void) {
          if (pendingUpdates) {
            for (const item of filtered) {
              Object.assign(item, pendingUpdates, { updated_at: new Date().toISOString() });
            }
            resolve({ data: filtered, error: null });
            return;
          }

          if (isDelete) {
            const idsToDelete = new Set(filtered.map((f: any) => f[`${tableName}_id`] || f.id));
            for (let i = records.length - 1; i >= 0; i--) {
              if (idsToDelete.has(records[i][`${tableName}_id`] || records[i].id)) {
                records.splice(i, 1);
              }
            }
            resolve({ data: null, error: null });
            return;
          }

          let res = [...filtered];
          if (orderField) {
            res.sort((a, b) => {
              if (a[orderField!] > b[orderField!]) return orderAscending ? 1 : -1;
              if (a[orderField!] < b[orderField!]) return orderAscending ? -1 : 1;
              return 0;
            });
          }
          if (limitCount !== null) {
            res = res.slice(0, limitCount);
          }
          if (isHeadOnly) {
            resolve({ data: null, error: null, count: res.length });
          } else {
            resolve({ data: res, error: null, count: res.length });
          }
        },
        async insert(rows: any | any[]) {
          const toAdd = Array.isArray(rows) ? rows : [rows];
          for (const row of toAdd) {
            const withId = {
              [`${tableName}_id`]: row[`${tableName}_id`] || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...row,
            };
            records.push(withId);
          }
          return {
            data: Array.isArray(rows) ? toAdd : toAdd[0],
            error: null,
            select() {
              return {
                async single() {
                  return { data: toAdd[0], error: null };
                },
              };
            },
          };
        },
        async upsert(row: any) {
          const keyField = `${tableName}_id`;
          const existing = records.find((r: any) => r[keyField] === row[keyField]);
          if (existing) {
            Object.assign(existing, row, { updated_at: new Date().toISOString() });
          } else {
            records.push({ ...row, created_at: new Date().toISOString() });
          }
          return { error: null };
        },
      };

      return builder;
    },
    async rpc(funcName: string, params: any) {
      if (funcName === 'atomic_redeem_voucher') {
        const pv = store.personal_voucher.find((v) => v.personal_qr_code === params.p_personal_qr_code);
        if (!pv) return { data: null, error: { message: '[VOUCHER_NOT_FOUND] Voucher not found.' } };
        if (pv.status !== 'Active') return { data: null, error: { message: `[VOUCHER_${pv.status.toUpperCase()}] Voucher is ${pv.status}.` } };
        if (new Date(pv.expiry_date) < new Date()) {
          pv.status = 'Expired';
          return { data: null, error: { message: '[VOUCHER_EXPIRED] Voucher has expired.' } };
        }

        const rid = `red-${Date.now()}`;
        pv.status = 'Redeemed';

        store.redemption.push({
          redemption_id: rid,
          personal_voucher_id: pv.personal_voucher_id,
          processed_by_staff_id: params.p_processed_by_staff_id,
          source: params.p_source || 'staff_ui',
          session_ref: params.p_session_ref || null,
          idempotency_key: params.p_idempotency_key || null,
          gross_amount: 180,
          discount_amount: 36,
          net_amount: 144,
          is_reversed: false,
          redeemed_at: new Date().toISOString(),
        });

        return {
          data: {
            redemption_id: rid,
            discount_percent: 20,
            gross_amount: 180,
            discount_amount: 36,
            net_amount: 144,
            batch_used_percent: 0.1,
          },
          error: null,
        };
      }
      return { data: null, error: { message: `Function ${funcName} not simulated` } };
    },
  };
}

export function createAdminClient() {
  if (isRealSupabaseConfigured()) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
  }

  // Zero-dependency offline mock client
  return createMockAdminClient();
}
