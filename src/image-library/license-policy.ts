import type { AllowedLicense, OpenverseResult, RejectionReason } from './types';

/**
 * Allowlist, not a blocklist.
 *
 * Only CC0, Public Domain Mark and CC BY may be shown. Everything else falls through
 * to rejection, which covers NC, ND, BY-SA and any licence code Openverse adds later
 * without us having to enumerate it. A missing or unrecognised licence is a rejection,
 * never a default-allow.
 */
export const ALLOWED_LICENSES: readonly AllowedLicense[] = ['cc0', 'pdm', 'by'] as const;

export function isAllowedLicense(license: string | null | undefined): license is AllowedLicense {
  if (!license) return false;
  return (ALLOWED_LICENSES as readonly string[]).includes(license.trim().toLowerCase());
}

/** The `license` query value sent to Openverse so filtering starts server-side too. */
export const OPENVERSE_LICENSE_PARAM = ALLOWED_LICENSES.join(',');

const CANONICAL_LICENSE_URL: Record<AllowedLicense, (version: string | null) => string> = {
  cc0: (v) => `https://creativecommons.org/publicdomain/zero/${v || '1.0'}/`,
  pdm: (v) => `https://creativecommons.org/publicdomain/mark/${v || '1.0'}/`,
  by: (v) => `https://creativecommons.org/licenses/by/${v || '4.0'}/`,
};

/**
 * Prefer the licence URL Openverse gives us; fall back to the canonical CC URL so an
 * approved record always carries a resolvable licence link as evidence.
 */
export function resolveLicenseUrl(
  license: AllowedLicense,
  version: string | null,
  provided: string | null | undefined,
): string {
  if (provided && /^https?:\/\//i.test(provided)) return provided;
  return CANONICAL_LICENSE_URL[license](version);
}

/** Human-readable licence name, e.g. "CC BY 4.0". */
export function licenseLabel(license: AllowedLicense, version: string | null): string {
  switch (license) {
    case 'cc0':
      return `CC0 ${version || '1.0'}`;
    case 'pdm':
      return 'Public Domain Mark 1.0';
    case 'by':
      return `CC BY ${version || '4.0'}`;
  }
}

/**
 * Only CC BY carries a legal attribution requirement. We still store attribution text
 * for CC0/PDM so the credit area can show provenance if the app chooses to.
 */
export function requiresAttribution(license: AllowedLicense): boolean {
  return license === 'by';
}

export function buildAttribution(
  title: string,
  creator: string | null,
  license: AllowedLicense,
  version: string | null,
): string {
  const label = licenseLabel(license, version);
  const by = creator?.trim() ? ` by ${creator.trim()}` : '';
  return `"${title}"${by}, ${label}`;
}

/** Licence-stage rejection. Returns null when the result passes. */
export function checkLicense(result: OpenverseResult): RejectionReason | null {
  if (!result.license || !result.license.trim()) return { kind: 'license-missing' };
  if (!isAllowedLicense(result.license)) {
    return { kind: 'license-not-allowed', license: result.license.trim().toLowerCase() };
  }
  // Licence evidence is only meaningful if a reviewer can open the original page.
  if (!result.foreign_landing_url) return { kind: 'no-source-page' };
  return null;
}
