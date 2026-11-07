import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isRealSupabaseConfigured } from './admin';

export async function createClient() {
  if (isRealSupabaseConfigured()) {
    const cookieStore = await cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
  }

  // Offline mock client for server components
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: 'a0000000-0000-0000-0000-000000000001',
              email: 'founder@silid.ph',
            },
          },
          error: null,
        };
      },
      async signOut() {
        return { error: null };
      },
    },
    from(tableName: string) {
      const { createAdminClient } = require('./admin');
      return createAdminClient().from(tableName);
    },
  } as any;
}
