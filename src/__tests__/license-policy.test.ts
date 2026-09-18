import { describe, it, expect } from 'vitest';
import {
  isAllowedLicense,
  checkLicense,
  buildAttribution,
  licenseLabel,
  requiresAttribution,
  resolveLicenseUrl,
  OPENVERSE_LICENSE_PARAM,
} from '../image-library/license-policy';
import type { OpenverseResult } from '../image-library/types';

function result(over: Partial<OpenverseResult> = {}): OpenverseResult {
  return {
    id: 'x',
    title: 'Infusion pump',
    creator: 'A. Photographer',
    url: 'https://example.org/i.jpg',
    thumbnail: 'https://example.org/i_t.jpg',
    foreign_landing_url: 'https://example.org/page',
    license: 'by',
    license_version: '4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    tags: [],
    description: '',
    ...over,
  };
}

describe('licence allowlist', () => {
  it('accepts exactly CC0, PDM and CC BY', () => {
    expect(isAllowedLicense('cc0')).toBe(true);
    expect(isAllowedLicense('pdm')).toBe(true);
    expect(isAllowedLicense('by')).toBe(true);
  });

  it.each(['by-sa', 'by-nc', 'by-nd', 'by-nc-sa', 'by-nc-nd', 'nc-sampling+'])(
    'rejects %s',
    (lic) => {
      expect(isAllowedLicense(lic)).toBe(false);
      expect(checkLicense(result({ license: lic }))).toEqual({
        kind: 'license-not-allowed',
        license: lic,
      });
    },
  );

  it('rejects missing, null and blank licences rather than defaulting to allow', () => {
    expect(checkLicense(result({ license: null }))).toEqual({ kind: 'license-missing' });
    expect(checkLicense(result({ license: '   ' }))).toEqual({ kind: 'license-missing' });
  });

  it('rejects an otherwise-valid result with no source page to verify', () => {
    expect(checkLicense(result({ foreign_landing_url: null }))).toEqual({ kind: 'no-source-page' });
  });

  it('passes a well-formed CC BY result', () => {
    expect(checkLicense(result())).toBeNull();
  });

  it('sends only the allowed licences to Openverse', () => {
    expect(OPENVERSE_LICENSE_PARAM).toBe('cc0,pdm,by');
  });
});

describe('attribution', () => {
  it('requires attribution for CC BY only', () => {
    expect(requiresAttribution('by')).toBe(true);
    expect(requiresAttribution('cc0')).toBe(false);
    expect(requiresAttribution('pdm')).toBe(false);
  });

  it('labels licences readably', () => {
    expect(licenseLabel('by', '4.0')).toBe('CC BY 4.0');
    expect(licenseLabel('cc0', '1.0')).toBe('CC0 1.0');
    expect(licenseLabel('pdm', null)).toBe('Public Domain Mark 1.0');
  });

  it('builds attribution text including creator and licence', () => {
    expect(buildAttribution('Infusion pump', 'A. Photographer', 'by', '4.0')).toBe(
      '"Infusion pump" by A. Photographer, CC BY 4.0',
    );
  });

  it('omits the creator clause when the creator is unknown', () => {
    expect(buildAttribution('Infusion pump', null, 'cc0', '1.0')).toBe('"Infusion pump", CC0 1.0');
  });

  it('falls back to a canonical licence URL when none is supplied', () => {
    expect(resolveLicenseUrl('by', '4.0', null)).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(resolveLicenseUrl('by', '4.0', 'not-a-url')).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(resolveLicenseUrl('by', '4.0', 'https://example.org/l')).toBe('https://example.org/l');
  });
});
