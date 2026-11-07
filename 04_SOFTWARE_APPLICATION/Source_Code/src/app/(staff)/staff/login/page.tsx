'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './login.module.css';

export default function StaffLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const cleanEmail = email.trim();
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMsg(error.message || 'Invalid credentials. Please verify your email and password.');
        setLoading(false);
        return;
      }

      // Store session cookie for instant authentication
      document.cookie = `silid_mock_session=${encodeURIComponent(cleanEmail)}; path=/; max-age=604800; SameSite=Lax`;

      // Navigate directly
      window.location.href = '/staff';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandWordmark}>SILID</span>
          <span className={styles.brandLocation}>Malolos</span>
        </div>

        <h1 className={styles.title}>Voucher Center</h1>
        <p className={styles.subtitle}>Staff sign-in to issue, review, and redeem vouchers</p>

        {errorMsg && (
          <div className={styles.errorAlert} role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className={styles.form}>
          <label>
            Staff Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. founder@silid.ph"
              autoComplete="email"
              autoFocus
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ minHeight: 48, marginTop: 8 }}
          >
            {loading ? 'Authenticating…' : 'Sign In to Voucher Center'}
          </button>
        </form>

        <div className={styles.demoBox}>
          <strong>Default Demo Accounts:</strong><br />
          • Founder: <code>founder@silid.ph</code> / <code>password123</code><br />
          • Staff: <code>staff@silid.ph</code> / <code>password123</code>
        </div>
      </div>
    </div>
  );
}
