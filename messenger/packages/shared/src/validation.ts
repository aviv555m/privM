export const MAX_MESSAGE_LENGTH = 1000;

export function sanitizeMessage(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isValidMessage(text: string): boolean {
  const normalized = sanitizeMessage(text);
  return normalized.length > 0 && normalized.length <= MAX_MESSAGE_LENGTH;
}

export function validatePhotoUrl(photoURL?: string): boolean {
  if (!photoURL) return true;
  try {
    const parsed = new URL(photoURL);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
