'use client';

import React from 'react';

export function PrintButton({ label = '🖨️ Print Claim Cards' }: { label?: string }) {
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.print();
        }
      }}
    >
      {label}
    </button>
  );
}
