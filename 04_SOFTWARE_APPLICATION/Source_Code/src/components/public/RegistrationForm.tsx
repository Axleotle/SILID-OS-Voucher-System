'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './RegistrationForm.module.css';

interface RegistrationFormProps {
  claimCode: string;
}

export default function RegistrationForm({ claimCode }: RegistrationFormProps) {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [dpaConsent, setDpaConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [registrationOutcome, setRegistrationOutcome] = useState<{
    statusToken: string;
    statusUrl: string;
    message: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dpaConsent) {
      setErrorMessage('You must acknowledge and consent to the Philippine Data Privacy Act agreement to proceed.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_code: claimCode,
          student_id: studentId.trim(),
          student_name: studentName.trim(),
          email: email.trim(),
          mobile_number: mobileNumber.trim() || undefined,
          dpa_consent: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error?.message || 'Registration could not be completed. Please check your details.');
        setLoading(false);
        return;
      }

      setRegistrationOutcome({
        statusToken: data.status_token,
        statusUrl: data.status_url,
        message: data.message,
      });
      setLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Network error occurred. Please try again.');
      setLoading(false);
    }
  }

  if (registrationOutcome) {
    return (
      <div className={styles.successPanel}>
        <div className={styles.successIcon}>✓</div>
        <h2 style={{ margin: 0 }}>Registration Submitted!</h2>
        <p style={{ color: 'var(--color-muted)', margin: 0 }}>
          {registrationOutcome.message}
        </p>

        <div className={styles.statusLinkCard}>
          <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
            Your Private Status Link (§5.3):
          </span>
          <Link
            href={registrationOutcome.statusUrl}
            style={{ wordBreak: 'break-all', fontWeight: 600, fontSize: '0.9rem' }}
          >
            {registrationOutcome.statusUrl}
          </Link>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '8px 0 0' }}>
            Bookmark or save this private link to check whether your registration has been approved and retrieve your QR code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
        </div>
      )}

      <label>
        Student Identification Number *
        <input
          type="text"
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="e.g. 2024-10892"
          autoFocus
        />
      </label>

      <label>
        Full Name (as registered with your school) *
        <input
          type="text"
          required
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="e.g. Maria Clara Santos"
          autoComplete="name"
        />
      </label>

      <label>
        Active Email Address *
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. maria.santos@university.edu.ph"
          autoComplete="email"
        />
      </label>

      <label>
        Mobile Phone Number (Optional)
        <input
          type="tel"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          placeholder="0917-123-4567"
          autoComplete="tel"
        />
      </label>

      {/* DPA Consent Checkbox (§7) */}
      <label className={styles.checkboxContainer}>
        <input
          type="checkbox"
          required
          checked={dpaConsent}
          onChange={(e) => setDpaConsent(e.target.checked)}
        />
        <span>
          I hereby consent to the collection and processing of my student information by <strong>SILID Malolos</strong> solely for the purpose of voucher issuance, verification, and audit reconciliation in compliance with the <strong>Philippine Data Privacy Act of 2012 (RA 10173)</strong>.
        </span>
      </label>

      <button
        type="submit"
        className="btn-primary"
        disabled={loading || !dpaConsent}
        style={{ minHeight: 52, marginTop: 8, fontSize: '1rem', fontWeight: 700 }}
      >
        {loading ? 'Submitting Registration…' : 'Submit Claim Registration'}
      </button>
    </form>
  );
}
