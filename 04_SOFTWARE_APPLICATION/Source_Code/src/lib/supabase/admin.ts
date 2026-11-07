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

const PK_MAP: Record<string, string> = {
  voucher_template: 'template_id',
  voucher_batch: 'batch_id',
  personal_voucher: 'personal_voucher_id',
  claim_ticket: 'claim_ticket_id',
  registration: 'registration_id',
  student: 'student_id',
  redemption: 'redemption_id',
  legacy_voucher: 'legacy_id',
  audit_log: 'audit_id',
  api_key: 'api_key_id',
  feature_flag: 'flag_id',
  staff: 'staff_id',
};

function getTablePK(tableName: string): string {
  return PK_MAP[tableName] || `${tableName}_id`;
}

function enrichMockRecord(tableName: string, raw: any, store: any): any {
  if (!raw) return null;
  const item = { ...raw };

  if (tableName === 'claim_ticket' && item.batch_id) {
    const batch = store.voucher_batch?.find((b: any) => b.batch_id === item.batch_id);
    if (batch) {
      const template = store.voucher_template?.find((t: any) => t.template_id === batch.template_id);
      item.voucher_batch = { ...batch, voucher_template: template ? { ...template } : null };
    }
  } else if (tableName === 'registration') {
    if (item.batch_id) {
      const batch = store.voucher_batch?.find((b: any) => b.batch_id === item.batch_id);
      if (batch) {
        const template = store.voucher_template?.find((t: any) => t.template_id === batch.template_id);
        item.voucher_batch = { ...batch, voucher_template: template ? { ...template } : null };
      }
    }
    if (item.student_id) {
      const student = store.student?.find((s: any) => s.student_id === item.student_id);
      if (student) item.student = { ...student };
    }
    if (item.claim_ticket_id) {
      const ticket = store.claim_ticket?.find((c: any) => c.claim_ticket_id === item.claim_ticket_id);
      if (ticket) item.claim_ticket = { ...ticket };
    }
    const pv = store.personal_voucher?.find((p: any) => p.registration_id === item.registration_id);
    if (pv) item.personal_voucher = { ...pv };
  } else if (tableName === 'voucher_batch' && item.template_id) {
    const template = store.voucher_template?.find((t: any) => t.template_id === item.template_id);
    if (template) item.voucher_template = { ...template };
  } else if (tableName === 'personal_voucher' && item.registration_id) {
    const reg = store.registration?.find((r: any) => r.registration_id === item.registration_id);
    if (reg) {
      item.registration = enrichMockRecord('registration', reg, store);
    }
  }

  return item;
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
      const pkField = getTablePK(tableName);
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
          const raw = filtered[0] || null;
          const item = raw ? enrichMockRecord(tableName, raw, store) : null;
          return { data: item, error: item ? null : { message: 'Row not found' } };
        },
        async maybeSingle() {
          const raw = filtered[0] || null;
          const item = raw ? enrichMockRecord(tableName, raw, store) : null;
          return { data: item, error: null };
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
            const idsToDelete = new Set(filtered.map((f: any) => f[pkField] || f.id));
            for (let i = records.length - 1; i >= 0; i--) {
              if (idsToDelete.has(records[i][pkField] || records[i].id)) {
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
            const enriched = res.map((r: any) => enrichMockRecord(tableName, r, store));
            resolve({ data: enriched, error: null, count: res.length });
          }
        },
        insert(rows: any | any[]) {
          const rawRows = Array.isArray(rows) ? rows : [rows];
          const inserted: any[] = [];
          for (const row of rawRows) {
            const idField = pkField;
            const idValue = row[idField] || row.id || `mock-${tableName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const withId = {
              ...row,
              [idField]: idValue,
              created_at: row.created_at || new Date().toISOString(),
            };
            if (tableName === 'registration' && !withId.status_token) {
              withId.status_token = `token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            }
            records.push(withId);
            inserted.push(withId);
          }
          const result = { data: Array.isArray(rows) ? inserted : inserted[0], error: null };
          return {
            ...result,
            select() {
              return {
                ...result,
                async single() {
                  return { data: inserted[0], error: null };
                },
                async maybeSingle() {
                  return { data: inserted[0] || null, error: null };
                },
                then(resolve: (val: any) => void) {
                  resolve(result);
                },
                catch(reject?: any) {
                  return this;
                },
              };
            },
            then(resolve: (val: any) => void) {
              resolve(result);
            },
            catch(reject?: any) {
              return this;
            },
          };
        },
        upsert(row: any) {
          const keyField = pkField;
          const existing = records.find((r: any) => r[keyField] === row[keyField]);
          if (existing) {
            Object.assign(existing, row, { updated_at: new Date().toISOString() });
          } else {
            records.push({ ...row, created_at: new Date().toISOString() });
          }
          const result = { data: row, error: null };
          return {
            ...result,
            select() {
              return {
                ...result,
                async single() {
                  return { data: row, error: null };
                },
                then(resolve: (val: any) => void) {
                  resolve(result);
                },
                catch(reject?: any) {
                  return this;
                },
              };
            },
            then(resolve: (val: any) => void) {
              resolve(result);
            },
            catch(reject?: any) {
              return this;
            },
          };
        },
      };

      return builder;
    },
    async rpc(funcName: string, params: any) {
      if (funcName === 'atomic_redeem_voucher') {
        const pv = store.personal_voucher.find((v) => v.personal_qr_code === params.p_personal_qr_code);
        if (!pv) return { data: null, error: { message: '[VOUCHER_NOT_FOUND] Voucher not found.' } };
        if (pv.status !== 'Active' && pv.status !== 'Held') {
          return { data: null, error: { message: `[VOUCHER_${pv.status.toUpperCase()}] Voucher is ${pv.status}.` } };
        }
        if (new Date(pv.expiry_date) < new Date()) {
          pv.status = 'Expired';
          return { data: null, error: { message: '[VOUCHER_EXPIRED] Voucher has expired.' } };
        }

        const rid = `red-${Date.now()}`;
        pv.status = 'Redeemed';

        let discountPercent = 20;
        const reg = store.registration.find((r: any) => r.registration_id === pv.registration_id);
        const batch = reg ? store.voucher_batch.find((b: any) => b.batch_id === reg.batch_id) : null;
        const tmpl = batch ? store.voucher_template.find((t: any) => t.template_id === batch.template_id) : null;
        if (tmpl && tmpl.benefit_value) {
          discountPercent = Number(tmpl.benefit_value);
        }

        let gross = 180;
        if (params.p_line_items) {
          try {
            const items = typeof params.p_line_items === 'string' ? JSON.parse(params.p_line_items) : params.p_line_items;
            if (Array.isArray(items) && items.length > 0) {
              gross = items.reduce((sum: number, it: any) => sum + (Number(it.unitPrice || it.unit_price || 0) * Number(it.quantity || 1)), 0);
            }
          } catch {}
        }
        const discount = Math.round((gross * (discountPercent / 100)) * 100) / 100;
        const net = Math.max(0, Math.round((gross - discount) * 100) / 100);

        store.redemption.push({
          redemption_id: rid,
          personal_voucher_id: pv.personal_voucher_id,
          processed_by_staff_id: params.p_processed_by_staff_id,
          source: params.p_source || 'staff_ui',
          session_ref: params.p_session_ref || null,
          idempotency_key: params.p_idempotency_key || null,
          gross_amount: gross,
          discount_amount: discount,
          net_amount: net,
          is_reversed: false,
          redeemed_at: new Date().toISOString(),
        });

        return {
          data: {
            redemption_id: rid,
            discount_percent: discountPercent,
            gross_amount: gross,
            discount_amount: discount,
            net_amount: net,
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
