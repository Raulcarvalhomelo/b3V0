// ============================================
// SITE BLOCKER - CRYPTO UTILITIES
// ============================================

export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  if (!salt) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    salt = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

  return { hash, salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}

export function generateToken(): string {
  return crypto.randomUUID();
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
