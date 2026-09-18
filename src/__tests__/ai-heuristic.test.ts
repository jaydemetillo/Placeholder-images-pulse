import { describe, it, expect } from 'vitest';
import { findAiTerms, checkLikelyNonAi } from '../image-library/ai-heuristic';
import type { OpenverseResult } from '../image-library/types';

function result(over: Partial<OpenverseResult> = {}): OpenverseResult {
  return {
    id: 'x',
    title: 'Infusion pump',
    creator: 'A. Photographer',
    url: 'https://example.org/i.jpg',
    thumbnail: null,
    foreign_landing_url: 'https://example.org/page',
    license: 'cc0',
    license_version: '1.0',
    license_url: null,
    tags: [],
    description: '',
    ...over,
  };
}

describe('likely non-AI filter — terms it must catch', () => {
  it.each([
    ['title', { title: 'AI-generated hospital scene' }, 'AI'],
    ['description', { description: 'A generative artwork' }, 'generative'],
    ['creator', { creator: 'midjourney_bot' }, 'Midjourney'],
    ['tags', { tags: [{ name: 'Stable Diffusion' }] }, 'Stable Diffusion'],
    ['title', { title: 'Made with DALL-E' }, 'DALL-E'],
    ['description', { description: 'A synthetic image' }, 'synthetic'],
    ['tags', { tags: [{ name: '3d render' }] }, 'render'],
  ])('flags %s containing "%s"', (_field, over, expected) => {
    expect(findAiTerms(result(over))).toContain(expected);
  });

  it('catches DALL-E spelling variants', () => {
    for (const t of ['DALL-E', 'DALL·E', 'DALLE', 'dall e']) {
      expect(findAiTerms(result({ title: `Art via ${t}` }))).toContain('DALL-E');
    }
  });

  it('catches render word forms', () => {
    for (const t of ['render', 'renders', 'rendered', 'rendering']) {
      expect(findAiTerms(result({ description: `A ${t} of a ward` }))).toContain('render');
    }
  });

  /**
   * Regression: \b treats "_" as a word character, so these handles previously slipped
   * through the filter entirely.
   */
  it.each([
    ['midjourney_bot', 'Midjourney'],
    ['ai_artist', 'AI'],
    ['dalle_images', 'DALL-E'],
    ['stable_diffusion_daily', 'Stable Diffusion'],
  ])('flags the underscored creator handle %s', (creator, expected) => {
    expect(findAiTerms(result({ creator }))).toContain(expected);
  });

  it('returns a rejection with the matched terms listed', () => {
    expect(checkLikelyNonAi(result({ title: 'AI render' }))).toEqual({
      kind: 'likely-ai',
      matchedTerms: ['AI', 'render'],
    });
  });
});

describe('likely non-AI filter — false positives it must NOT produce', () => {
  /**
   * The substring "ai" appears in ordinary medical vocabulary. A naive
   * `includes('ai')` check would discard all of these real photographs.
   */
  it.each(['airway manikin', 'equipment repair kit', 'clinical training aid', 'captain of the ward'])(
    'does not flag %s',
    (text) => {
      expect(findAiTerms(result({ title: text }))).toEqual([]);
    },
  );

  it('does not treat "generator" as "generative"', () => {
    expect(findAiTerms(result({ title: 'Portable oxygen generator' }))).toEqual([]);
  });

  it('does not flag "diffusion" outside the Stable Diffusion phrase', () => {
    expect(findAiTerms(result({ title: 'Diffusion MRI scanner' }))).toEqual([]);
    expect(findAiTerms(result({ description: 'gas diffusion membrane' }))).toEqual([]);
  });

  it('passes a clean medical result', () => {
    expect(checkLikelyNonAi(result({ title: 'Infusion pump in hospital room' }))).toBeNull();
  });
});
