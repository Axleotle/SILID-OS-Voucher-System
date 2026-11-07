'use client';

import React from 'react';

interface ExportCsvButtonProps {
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  filename: string;
  label?: string;
}

export function ExportCsvButton({
  headers,
  rows,
  filename,
  label = '📥 Export CSV Report (Matching Screen)',
}: ExportCsvButtonProps) {
  const handleExport = () => {
    if (typeof window === 'undefined') return;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        headers.join(','),
        ...rows.map((r) => r.map((val) => `"${val ?? ''}"`).join(',')),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button type="button" className="btn btn-primary" onClick={handleExport}>
      {label}
    </button>
  );
}
