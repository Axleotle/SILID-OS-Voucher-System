'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  label: string;
  loadingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SubmitButton({
  label,
  loadingLabel = 'Generating Batch & QR Codes…',
  className = 'btn btn-primary',
  style,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      style={{
        ...style,
        opacity: pending ? 0.75 : 1,
        cursor: pending ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {pending ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
