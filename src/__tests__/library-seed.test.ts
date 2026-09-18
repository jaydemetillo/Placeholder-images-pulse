import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import seed from '../image-library/library.seed.json';
import assignmentsSeed from '../image-library/assignments.seed.json';
import { PLACEHOLDERS } from '../image-library/placeholders';
import { ALLOWED_LICENSES } from '../image-library/license-policy';
import { assetUrl } from '../image-library/asset-url';
import type { LibraryImage } from '../image-library/types';

/**
 * Guards the images checked into the repo.
 *
 * The seed is the one place where a record enters the library without passing through
 * the admin UI, so these are the checks the UI would otherwise make: allowed licence,
 * resolvable provenance, a real file on disk, and — above all — nothing pre-approved.
 * A seed that shipped `status: 'approved'` would put an unvetted photo on a screen.
 */
const records = seed as LibraryImage[];
const PUBLIC_DIR = resolve(__dirname, '../../public');

describe('checked-in image seed', () => {
  it('stages an image for every placeholder slot', () => {
    const sourced = records.map((r) => r.sourcedForPlaceholderId);
    for (const p of PLACEHOLDERS) expect(sourced).toContain(p.id);
  });

  it('is entirely pending — nothing ships pre-approved', () => {
    for (const r of records) {
      expect(r.status).toBe('pending');
      expect(r.approvedBy).toBeNull();
      expect(r.approvedAt).toBeNull();
    }
  });

  it('ships with all four verification boxes unticked', () => {
    for (const r of records) {
      expect(r.realPhotoChecked).toBe(false);
      expect(r.matchesEquipmentChecked).toBe(false);
      expect(r.sourceAndLicenceChecked).toBe(false);
      expect(r.noPatientInfoChecked).toBe(false);
    }
  });

  it('assigns nothing, so no seeded image can reach a screen', () => {
    expect(assignmentsSeed).toHaveLength(0);
  });

  it('carries only allowed licences', () => {
    for (const r of records) expect(ALLOWED_LICENSES).toContain(r.license);
  });

  it('records full provenance for every image', () => {
    for (const r of records) {
      expect(r.title.trim().length).toBeGreaterThan(0);
      expect(r.creator?.trim().length).toBeGreaterThan(0);
      expect(r.sourcePageUrl).toMatch(/^https:\/\//);
      expect(r.licenseUrl).toMatch(/^https:\/\//);
      expect(r.originalFileUrl).toMatch(/^https:\/\//);
      expect(r.attribution.length).toBeGreaterThan(0);
    }
  });

  it('serves local files rather than hotlinking the upstream host', () => {
    for (const r of records) {
      expect(r.imageUrl).toMatch(/^\/images\/[a-z0-9-]+\.jpg$/);
      expect(existsSync(resolve(PUBLIC_DIR, r.imageUrl.replace(/^\//, '')))).toBe(true);
    }
  });

  it('downloaded a real JPEG, not an error page', () => {
    for (const r of records) {
      const bytes = readFileSync(resolve(PUBLIC_DIR, r.imageUrl.replace(/^\//, '')));
      expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // JPEG SOI marker
      expect(bytes.length).toBeGreaterThan(1024);
    }
  });

  it('indicates the changes made, which CC BY requires', () => {
    for (const r of records) expect(r.modifications?.trim().length).toBeGreaterThan(0);
  });

  it('gives every id a unique, stable shape', () => {
    const ids = records.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^img_\d{3}$/);
  });
});

describe('asset URLs resolve under any deployment base', () => {
  it('leaves an absolute upstream URL untouched', () => {
    expect(assetUrl('https://example.org/pump.jpg')).toBe('https://example.org/pump.jpg');
  });

  it('joins a stored path to the base without doubling the slash', () => {
    const resolved = assetUrl('/images/digital-stethoscope.jpg');
    expect(resolved).not.toContain('//images');
    expect(resolved.endsWith('/images/digital-stethoscope.jpg')).toBe(true);
  });
});
