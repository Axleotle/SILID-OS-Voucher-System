'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './StaffShell.module.css';

interface StaffShellProps {
  staffName: string;
  role: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/staff', label: 'Dashboard', exact: true },
  { href: '/staff/templates', label: 'Templates' },
  { href: '/staff/batches', label: 'Batches & Tickets' },
  { href: '/staff/registrations', label: 'Registrations' },
  { href: '/staff/redeem', label: 'Redeem (Scan)' },
  { href: '/staff/simulator', label: '🖥️ Silid OS Simulator' },
  { href: '/staff/reports', label: 'Reports' },
  { href: '/staff/audit', label: 'Audit Trail' },
  { href: '/staff/import', label: 'Import Legacy' },
  { href: '/staff/admin', label: 'Admin Settings' },
];

export default function StaffShell({ staffName, role, children }: StaffShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/staff/login') {
    return <>{children}</>;
  }

  async function handleSignOut() {
    try {
      document.cookie = 'silid_mock_session=; path=/; max-age=0';
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
    window.location.href = '/staff/login';
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/staff" className={styles.brand}>
          <span className={styles.brandTitle}>SILID</span>
          <span className={styles.brandSubtitle}>Voucher Service</span>
        </Link>

        <nav className={styles.nav} aria-label="Staff main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userBadge}>
            <span className={styles.userName}>{staffName}</span>
            <span className={styles.userRole}>{role}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="btn"
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
