import { createBrowserClient } from '@supabase/ssr';
import { isRealSupabaseConfigured } from './admin';
import { getMockStore } from '../mock-store';

export function createClient() {
  if (isRealSupabaseConfigured()) {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // Offline mock client for client-side forms and auth
  return {
    auth: {
      async signInWithPassword({ email, password }: any) {
        // Allow demo logins offline
        if (email.includes('founder') || email.includes('staff')) {
          return { data: { user: { id: 'a0000000-0000-0000-0000-000000000001', email } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid credentials. Use founder@silid.ph or staff@silid.ph' } };
      },
      async signOut() {
        return { error: null };
      },
      async getUser() {
        return { data: { user: { id: 'a0000000-0000-0000-0000-000000000001', email: 'founder@silid.ph' } }, error: null };
      },
    },
  } as any;
}
