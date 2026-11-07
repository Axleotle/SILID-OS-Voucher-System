import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | SILID Voucher Service',
    default: 'SILID Voucher Service · Silid Malolos',
  },
  description: 'Standalone voucher issuance, management and redemption service for SILID Malolos study hub.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
