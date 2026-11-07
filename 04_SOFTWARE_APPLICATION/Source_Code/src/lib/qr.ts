import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * QRCodeGenerator service class (from class diagram).
 */
export class QRCodeGenerator {
  /**
   * Generate a unique claim code for a claim ticket.
   * Format: [PREFIX]-[EVENT/RANDOM_HEX]
   */
  static generateClaimCode(prefix: string = 'CT', length: number = 8): string {
    const raw = crypto.randomBytes(Math.ceil(length / 2)).toString('hex').toUpperCase();
    const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return `${cleanPrefix}-${raw.slice(0, length)}`;
  }

  /**
   * Generate a unique personal voucher QR token string.
   * Format: PV-[32-hex-characters]
   */
  static generatePersonalQrData(): string {
    const hex = crypto.randomBytes(16).toString('hex').toUpperCase();
    return `PV-${hex}`;
  }

  /**
   * Generate unguessable status token for student access tracking (cryptographically random hex).
   */
  static generateUnguessableToken(byteLength: number = 24): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * Generate public claim ticket registration URL / QR payload.
   */
  static generateClaimTicketPayload(claimCode: string, baseUrl?: string): string {
    const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${base}/register/${encodeURIComponent(claimCode)}`;
  }

  /**
   * Render QR code as a base64 Data URL (PNG).
   */
  static async toDataURL(data: string, width: number = 300): Promise<string> {
    return QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width,
      color: {
        dark: '#1f5d46', // Primary forest green
        light: '#fffdf7', // Paper cream
      },
    });
  }

  /**
   * Render QR code as SVG string (ideal for crisp printing).
   */
  static async toSVG(data: string): Promise<string> {
    return QRCode.toString(data, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      color: {
        dark: '#1f5d46',
        light: '#ffffff',
      },
    });
  }
}
