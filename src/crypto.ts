import { EncryptedEnvelope } from './types';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateRoomId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function generateEncryptionKey(): Promise<{ key: CryptoKey; keyString: string }> {
  const key = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', key));
  return { key, keyString: toBase64Url(raw) };
}

export async function importEncryptionKey(keyString: string): Promise<CryptoKey> {
  const raw = fromBase64Url(keyString);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
  return globalThis.crypto.subtle.importKey('raw', buffer, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptJson(data: unknown, key: CryptoKey): Promise<EncryptedEnvelope> {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoded
  );
  return {
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(new Uint8Array(encrypted)),
  };
}

export async function decryptJson<T>(envelope: EncryptedEnvelope, key: CryptoKey): Promise<T> {
  const iv = fromBase64Url(envelope.iv);
  const ciphertext = fromBase64Url(envelope.ciphertext);
  const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const ctBuf = ciphertext.buffer.slice(
    ciphertext.byteOffset,
    ciphertext.byteOffset + ciphertext.byteLength
  ) as ArrayBuffer;
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf },
    key,
    ctBuf
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export function parseRoomHash(hash: string): { roomId: string; keyString: string } | null {
  if (!hash.startsWith('#room=')) return null;
  const payload = hash.slice('#room='.length);
  const commaIdx = payload.indexOf(',');
  if (commaIdx <= 0) return null;
  const roomId = payload.slice(0, commaIdx).trim();
  const keyString = payload.slice(commaIdx + 1).trim();
  if (!roomId || !keyString) return null;
  return { roomId, keyString };
}

export function buildRoomShareUrl(origin: string, roomId: string, keyString: string): string {
  return `${origin}/#room=${roomId},${keyString}`;
}
