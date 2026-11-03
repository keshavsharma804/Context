// Web Crypto API implementation for the Secure Personal Vault.
// All encryption, decryption, and key derivation happen strictly in browser memory.

function assertWebCrypto() {
  if (
    typeof window === 'undefined' ||
    !window.crypto ||
    !window.crypto.subtle ||
    !window.crypto.getRandomValues
  ) {
    throw new Error('Web Crypto API is not supported in this environment.')
  }
}

export async function deriveKey(
  passphrase: string,
  salt: string
): Promise<CryptoKey> {
  assertWebCrypto()
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // NOT extractable — key cannot be exported or read
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  assertWebCrypto()
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

export async function decrypt(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  assertWebCrypto()
  const cipherBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    cipherBytes
  )
  return new TextDecoder().decode(decrypted)
}

export function generateSalt(): string {
  assertWebCrypto()
  const salt = crypto.getRandomValues(new Uint8Array(16)) // 128-bit salt
  return btoa(String.fromCharCode(...salt))
}

// Generate a random 256-bit AES-GCM Vault Encryption Key (VEK)
export async function generateMasterKey(): Promise<CryptoKey> {
  assertWebCrypto()
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so it can be encrypted by K_pass and K_rec
    ['encrypt', 'decrypt']
  )
}

// Export raw key bytes as base64
export async function exportRawKey(key: CryptoKey): Promise<string> {
  assertWebCrypto()
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

// Import base64 back into an AES-GCM CryptoKey
export async function importRawKey(rawB64: string): Promise<CryptoKey> {
  assertWebCrypto()
  const bytes = Uint8Array.from(atob(rawB64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  )
}

// Generate formatted 16-character alphanumeric recovery key (XXXX-XXXX-XXXX-XXXX)
export function generateRecoveryKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // unambiguous 32-char alphabet
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let raw = ''
  for (let i = 0; i < 16; i++) {
    raw += chars[bytes[i] % chars.length]
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

