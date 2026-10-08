const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes a string for safe HTML embedding (XSS prevention). */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/** Collapses whitespace and caps length; returns null when effectively empty. */
export function cleanText(str, maxLength = 500) {
  if (str === null || str === undefined) return null;
  const cleaned = String(str).replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

/** Strict title cleaner: max 100 chars, single-spaced. */
export function cleanTitle(str) {
  return cleanText(str, 100);
}

/** Validates and normalises a phone number to E.164-ish form or null. */
export function normalizePhone(str) {
  if (!str) return null;
  const digits = String(str).replace(/[^\d+]/g, '');
  return /^\+?\d{7,15}$/.test(digits) ? digits : null;
}
