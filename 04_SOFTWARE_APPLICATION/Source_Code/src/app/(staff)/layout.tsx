import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import StaffShell from '@/components/staff/StaffShell';
import { isRealSupabaseConfigured } from '@/lib/supabase/admin';

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let staffName = 'Founder Admin';
  let staffRole = 'Founder';

  if (!isRealSupabaseConfigured()) {
    const cookieStore = await cookies();
    const mockEmail = cookieStore.get('silid_mock_session')?.value;
    if (mockEmail && decodeURIComponent(mockEmail).includes('staff')) {
      staffName = 'Frontdesk Staff';
      staffRole = 'Staff';
    } else {
      staffName = 'Founder Admin';
      staffRole = 'Founder';
    }
    return (
      <StaffShell staffName={staffName} role={staffRole}>
        {children}
      </StaffShell>
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('staff')
        .select('staff_name, role')
        .eq('staff_id', user.id)
        .single();

      if (profile) {
        staffName = profile.staff_name;
        staffRole = profile.role;
      } else {
        staffName = user.email || 'Staff Member';
      }
    }
  } catch (err) {
    // Local development fallback
    staffName = 'Founder Admin';
    staffRole = 'Founder';
  }

  return (
    <StaffShell staffName={staffName} role={staffRole}>
      {children}
    </StaffShell>
  );
}
