import { generateTempToken, validateTempToken } from './otp';

interface TempTokenData {
  userId: string;
  username: string;
  role: string;
  expiresAt: number;
  pendingOtpSecret?: string;
}

const tempTokenStore = new Map<string, TempTokenData>();

const TEMP_TOKEN_LIFETIME_MS = 5 * 60 * 1000;

export function createTempToken(userId: string, username: string, role: string): string {
  const token = generateTempToken();
  tempTokenStore.set(token, {
    userId,
    username,
    role,
    expiresAt: Date.now() + TEMP_TOKEN_LIFETIME_MS,
  });
  return token;
}

export function updateTempToken(token: string, data: Partial<TempTokenData>): boolean {
  const existing = tempTokenStore.get(token);
  if (!existing) return false;
  Object.assign(existing, data);
  return true;
}

export function validateAndConsumeTempToken(token: string): TempTokenData | null {
  if (!validateTempToken(token)) {
    return null;
  }

  const data = tempTokenStore.get(token);
  if (!data) {
    return null;
  }

  if (Date.now() > data.expiresAt) {
    tempTokenStore.delete(token);
    return null;
  }

  tempTokenStore.delete(token);
  return data;
}

export function getTempTokenData(token: string): TempTokenData | null {
  if (!validateTempToken(token)) {
    return null;
  }

  const data = tempTokenStore.get(token);
  if (!data) {
    return null;
  }

  if (Date.now() > data.expiresAt) {
    tempTokenStore.delete(token);
    return null;
  }

  return data;
}

export function cleanupExpiredTempTokens(): void {
  const now = Date.now();
  for (const [token, data] of tempTokenStore.entries()) {
    if (now > data.expiresAt) {
      tempTokenStore.delete(token);
    }
  }
}

setInterval(cleanupExpiredTempTokens, 60 * 1000);
