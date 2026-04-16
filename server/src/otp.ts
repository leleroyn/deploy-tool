import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const OTP_ISSUER = 'DeployTool';
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA1';
const TOTP_WINDOW = 1;

function getEncryptionKey(): Buffer {
  const key = process.env.OTP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('OTP_ENCRYPTION_KEY environment variable is not set');
  }
  return Buffer.from(key, 'hex');
}

export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }
  const [ivHex, authTagHex, encryptedData] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateOtpSecret(): string {
  const totp = new OTPAuth.TOTP({
    issuer: OTP_ISSUER,
    label: 'Setup',
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
  });
  return totp.secret.base32;
}

export async function generateQrCode(secret: string, username: string): Promise<string> {
  const totp = new OTPAuth.TOTP({
    issuer: OTP_ISSUER,
    label: username,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const uri = totp.toString();
  return await QRCode.toDataURL(uri);
}

export function verifyOtp(encryptedSecret: string, token: string): boolean {
  try {
    const secret = decryptSecret(encryptedSecret);
    const totp = new OTPAuth.TOTP({
      issuer: OTP_ISSUER,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token, window: TOTP_WINDOW });
    return delta !== null;
  } catch {
    return false;
  }
}

export function generateTempToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateTempToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
