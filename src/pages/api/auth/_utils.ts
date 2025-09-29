// Shared utilities for GitHub App auth with cookie-only storage
import type { APIRoute } from 'astro';

const TEXT = new TextEncoder();
const UNT = new TextDecoder();

export type EnvLike = Record<string, string | undefined>;

export function getEnv(localsEnv?: EnvLike): EnvLike {
  // Prefer Cloudflare env from locals, fall back to process.env for dev
  const nodeEnv = (typeof process !== 'undefined' && (process as any).env) || {};
  return {
    GITHUB_APP_CLIENT_ID: localsEnv?.GITHUB_APP_CLIENT_ID || (nodeEnv as any).GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: localsEnv?.GITHUB_APP_CLIENT_SECRET || (nodeEnv as any).GITHUB_APP_CLIENT_SECRET,
    COOKIE_SECRET: localsEnv?.COOKIE_SECRET || (nodeEnv as any).COOKIE_SECRET,
  };
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

export function makeCookie(name: string, value: string, options: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'Lax'|'Strict'|'None'; maxAge?: number; expires?: Date } = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  if (options.maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join('; ');
}

export function deleteCookie(name: string, path = '/'): string {
  return makeCookie(name, '', { path, expires: new Date(0) });
}

function b64urlEncode(buf: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  const b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < arr.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

async function importKeyFromSecret(secret: string): Promise<CryptoKey> {
  // Expect 32-byte base64 or raw utf-8 secret; derive 256-bit key
  let raw: ArrayBuffer;
  try {
    raw = b64urlDecode(secret);
  } catch {
    raw = TEXT.encode(secret);
  }
  // If not 32 bytes, hash to 32
  if ((raw as any).byteLength !== 32) {
    const digest = await crypto.subtle.digest('SHA-256', raw);
    raw = digest;
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealCookiePayload(obj: any, secret: string): Promise<string> {
  const key = await importKeyFromSecret(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = TEXT.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `v1.${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function unsealCookiePayload(token: string, secret: string): Promise<any | null> {
  try {
    const key = await importKeyFromSecret(secret);
    const [v, ivB64, ctB64] = token.split('.');
    if (v !== 'v1') return null;
    const iv = new Uint8Array(b64urlDecode(ivB64));
    const ct = b64urlDecode(ctB64);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(UNT.decode(new Uint8Array(pt)));
  } catch {
    return null;
  }
}

export function absoluteCallbackURL(requestUrl: URL): string {
  const origin = `${requestUrl.protocol}//${requestUrl.host}`;
  return `${origin}/api/auth/github/callback`;
}

