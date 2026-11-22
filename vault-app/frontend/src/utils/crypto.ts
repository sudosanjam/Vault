/**
 * Zero-knowledge client-side encryption utilities for password-protected notes.
 * Uses Web Crypto API: PBKDF2 for key derivation and AES-GCM (256-bit) for encryption.
 */

const ENCRYPTION_PREFIX = '<!-- VAULT_ENCRYPTED_v1:';
const ENCRYPTION_SUFFIX = ' -->';
const PBKDF2_ITERATIONS = 100_000;

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const clean = hex.trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export function generateSalt(): string {
  const salt = new Uint8Array(16);
  window.crypto.getRandomValues(salt);
  return bufferToHex(salt);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const saltBytes = hexToBuffer(saltHex);
  const passBytes = enc.encode(password);

  const combined = new Uint8Array(saltBytes.length + passBytes.length);
  combined.set(saltBytes);
  combined.set(passBytes, saltBytes.length);

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
  return bufferToHex(hashBuffer);
}

async function deriveKey(password: string, saltHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: (hexToBuffer(saltHex) as unknown) as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return trimmed.startsWith(ENCRYPTION_PREFIX) && trimmed.endsWith(ENCRYPTION_SUFFIX);
}

export async function encryptNoteContent(
  plaintext: string,
  password: string,
  saltHex: string
): Promise<string> {
  const key = await deriveKey(password, saltHex);
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);

  const enc = new TextEncoder();
  const encodedData = enc.encode(plaintext);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: (iv as unknown) as ArrayBuffer,
    },
    key,
    encodedData
  );

  const ivHex = bufferToHex(iv);
  const cipherHex = bufferToHex(cipherBuffer);

  return `${ENCRYPTION_PREFIX}${ivHex}:${cipherHex}${ENCRYPTION_SUFFIX}`;
}

export async function decryptNoteContent(
  encryptedString: string,
  password: string,
  saltHex: string
): Promise<string> {
  const trimmed = encryptedString.trim();
  if (!trimmed.startsWith(ENCRYPTION_PREFIX) || !trimmed.endsWith(ENCRYPTION_SUFFIX)) {
    throw new Error('Invalid encrypted note format');
  }

  const inner = trimmed.slice(ENCRYPTION_PREFIX.length, -ENCRYPTION_SUFFIX.length);
  const parts = inner.split(':');
  if (parts.length !== 2) {
    throw new Error('Corrupted encrypted data payload');
  }

  const [ivHex, cipherHex] = parts;
  const iv = hexToBuffer(ivHex);
  const cipherBytes = hexToBuffer(cipherHex);

  const key = await deriveKey(password, saltHex);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: (iv as unknown) as ArrayBuffer,
      },
      key,
      (cipherBytes as unknown) as ArrayBuffer
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch {
    throw new Error('Incorrect password or corrupted note data');
  }
}
