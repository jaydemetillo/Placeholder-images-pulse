import { describe, it, expect } from 'vitest';
import { searchFixtures } from '../image-library/search-source';
import { filterResults, buildSearchUrl, describeRejection } from '../image-library/openverse';
import fixture from '../image-library/fixtures/openverse-sample.json';
import { PLACEHOLDERS } from '../image-library/placeholders';
import type { OpenverseResult } from '../image-library/types';

describe('search URL', () => {
  it('constrains the licence server-side too', () => {
    const url = buildSearchUrl('infusion pump', { pageSize: 5 });
    expect(url).toContain('license=cc0%2Cpdm%2Cby');
    expect(url).toContain('q=infusion+pump');
    expect(url).toContain('page_size=5');
  });
});

describe('filter pipeline over the fixture set', () => {
  const outcome = filterResults(fixture.results as OpenverseResult[]);

  it('admits only allowed licences', () => {
    for (const c of outcome.candidates) {
      expect(['cc0', 'pdm', 'by']).toContain(c.license);
    }
  });

  it('withholds the BY-SA, NC, AI, unlicensed and sourceless results', () => {
    const withheld = outcome.rejected.map((r) => r.result.id);
    expect(withheld).toEqual(
      expect.arrayContaining(['fx-head-02', 'fx-boot-02', 'fx-bp-02', 'fx-suture-02', 'fx-suture-03']),
    );
  });

  it('keeps the "airway / repair / training" result, which a substring filter would lose', () => {
    expect(outcome.candidates.map((c) => c.openverseId)).toContain('fx-steth-02');
  });

  it('gives every candidate a source page, licence URL and attribution', () => {
    for (const c of outcome.candidates) {
      expect(c.sourcePageUrl).toMatch(/^https?:\/\//);
      expect(c.licenseUrl).toMatch(/^https?:\/\//);
      expect(c.attribution.length).toBeGreaterThan(0);
    }
  });

  it('explains every rejection in words', () => {
    for (const r of outcome.rejected) {
      expect(describeRejection(r.reason).length).toBeGreaterThan(0);
    }
  });
});

describe('placeholder registry', () => {
  it('has unique, stable, slug-shaped ids', () => {
    const ids = PLACEHOLDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('gives every slot search terms to seed the admin query', () => {
    for (const p of PLACEHOLDERS) expect(p.searchWords.trim().length).toBeGreaterThan(0);
  });

  it('returns candidates when searching a slot’s own terms', () => {
    expect(searchFixtures('stethoscope').candidates.length).toBeGreaterThan(0);
  });
});
