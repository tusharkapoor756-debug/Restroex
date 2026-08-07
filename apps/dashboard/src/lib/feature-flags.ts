/**
 * RESTROEX FEATURE FLAGS
 *
 * These flags control which features are visible in the user-facing UI.
 * Backend services, routes, controllers, and database tables are NEVER
 * affected by these flags — they remain intact and deployable.
 *
 * To enable a feature:  change false → true and redeploy the frontend.
 * To disable a feature: change true → false and redeploy the frontend.
 *
 * ─────────────────────────────────────────────────────────────────────
 * MENU_IMPORT
 *   Status: TEMPORARILY DISABLED (MVP Decision — 2026-08-05)
 *   Reason: The automatic Menu Import pipeline (RDIE/OCR/PDF/CSV/Excel)
 *           works on some menus but is not reliable enough for production
 *           restaurant onboarding at scale. Restaurants will be onboarded
 *           manually by the Restroex team until this feature reaches
 *           production quality.
 *   Re-enable: Set MENU_IMPORT to true after RDIE engine validation passes
 *              the full 30-menu benchmark with acceptable accuracy thresholds.
 * ─────────────────────────────────────────────────────────────────────
 */
export const FEATURE_FLAGS = {
  MENU_IMPORT: false,
} as const;
