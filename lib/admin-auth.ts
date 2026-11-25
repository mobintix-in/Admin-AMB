import { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'amb_admin_session';

export const ALLOWED_ADMIN_EMAIL = (
  process.env.ADMIN_ALLOWED_EMAIL || 'aryanbhimani0011@gmail.com'
)
  .trim()
  .toLowerCase();

export const ALLOWED_ADMIN_PHONE = (
  process.env.ADMIN_ALLOWED_PHONE || '9409383803'
)
  .replace(/[^0-9]/g, '')
  .slice(-10);

export function normalizeIndianPhone(phone?: string | null): string {
  return String(phone || '')
    .replace(/[^0-9]/g, '')
    .slice(-10);
}

export function isAuthorizedSuperAdmin(email?: string | null, phone?: string | null): boolean {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = normalizeIndianPhone(phone);
  return cleanEmail === ALLOWED_ADMIN_EMAIL && cleanPhone === ALLOWED_ADMIN_PHONE;
}

export interface AdminSession {
  userId: string;
  email: string;
  phone: string;
  name: string;
  role: string;
  exp: number;
}

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'amb-admin-local-session-secret'
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createAdminSessionToken(
  payload: Omit<AdminSession, 'exp'>,
  ttlMs = 7 * 24 * 60 * 60 * 1000
): Promise<string> {
  const session: AdminSession = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  const encodedSig = toBase64Url(new Uint8Array(sig));
  return `${encodedPayload}.${encodedSig}`;
}

export async function verifyAdminSessionToken(token?: string | null): Promise<AdminSession | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  try {
    const key = await getHmacKey();
    const sigBytes = fromBase64Url(encodedSig);
    const sigBuffer = sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      new TextEncoder().encode(encodedPayload)
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const parsed = JSON.parse(payloadJson) as AdminSession;
    if (
      !parsed.email ||
      !parsed.exp ||
      parsed.exp < Date.now() ||
      !isAuthorizedSuperAdmin(parsed.email, parsed.phone)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function requireAdminSession(req: NextRequest): Promise<AdminSession | null> {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}
