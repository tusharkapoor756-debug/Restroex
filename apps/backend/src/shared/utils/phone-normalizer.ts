/**
 * Dedicated Customer Phone Normalization Service (Phase 3)
 *
 * Rules:
 * 1. Never assume a WhatsApp LID (@lid) is a real phone number.
 *    LIDs (e.g. "82073285091419@lid") are internal WhatsApp 14-15 digit pseudonyms.
 *    If an input contains "@lid", primary_phone MUST BE null, and whatsapp_lid MUST BE populated.
 *
 * 2. Real Phone Normalization (+91, 91, 10-digit, @s.whatsapp.net, @c.us):
 *    - Strips suffixes like "@s.whatsapp.net" or "@c.us".
 *    - Removes spaces, hyphens, and leading plus.
 *    - Standardizes Indian numbers to 12-digit "91XXXXXXXXXX" canonical format.
 */

export interface ParsedPhoneIdentity {
  /** Clean numeric phone string (e.g. "919876543210"), or null if input is an LID / invalid. */
  primaryPhone: string | null;

  /** Raw WhatsApp LID string (e.g. "82073285091419@lid"), or null if not an LID. */
  whatsappLid: string | null;

  /** True if the original input was a WhatsApp LID handle. */
  isLid: boolean;
}

export function parseCustomerPhoneIdentity(input: string | null | undefined): ParsedPhoneIdentity {
  if (!input) {
    return { primaryPhone: null, whatsappLid: null, isLid: false };
  }

  const raw = String(input).trim();

  // Rule 1: Handle WhatsApp LID
  if (raw.toLowerCase().includes('@lid')) {
    return {
      primaryPhone: null,
      whatsappLid: raw.toLowerCase(),
      isLid: true,
    };
  }

  // Rule 2: Clean string (strip @s.whatsapp.net, @c.us, non-digits)
  let cleaned = raw;
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0] ?? '';
  }

  cleaned = cleaned.replace(/[^\d]/g, '');

  if (!cleaned) {
    return { primaryPhone: null, whatsappLid: null, isLid: false };
  }

  // Indian phone number canonical formatting (10 digit -> prepend 91)
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }

  // Validate length: Real E.164 phone numbers are 10-13 digits with country code.
  // Exception: If 14-15 digits without LID tag, check if it's a numeric-only LID string.
  const isLikelyRealPhone = cleaned.length >= 10 && cleaned.length <= 13;

  return {
    primaryPhone: isLikelyRealPhone ? cleaned : null,
    whatsappLid: !isLikelyRealPhone ? `${raw}@lid` : null,
    isLid: !isLikelyRealPhone,
  };
}

/**
 * Legacy compatibility wrapper. Returns clean numeric string or empty string.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  const parsed = parseCustomerPhoneIdentity(phone);
  return parsed.primaryPhone || '';
}

