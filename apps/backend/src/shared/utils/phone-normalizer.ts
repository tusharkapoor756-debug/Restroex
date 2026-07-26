/**
 * Shared Phone Number Normalizer
 * Consistently strips domain suffixes (like @lid or @c.us), spaces, hyphens, plus signs,
 * and normalizes phone numbers to standard format for cross-table joining and CRM analytics.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';

  let cleaned = String(phone).trim();

  // 1. Strip domain suffix if present (e.g. "82073285091419@lid" -> "82073285091419")
  if (cleaned.includes('@')) {
    const parts = cleaned.split('@');
    cleaned = parts[0] ?? '';
  }

  // 2. Remove all non-numeric characters except leading '+'
  cleaned = cleaned.replace(/[^\d]/g, '');

  return cleaned;
}
