import type { OpenverseResult, RejectionReason } from './types';

/**
 * A "LIKELY NON-AI" FILTER. NOT A GUARANTEE.
 *
 * This is metadata pattern-matching, nothing more. It cannot inspect pixels, and an
 * AI-generated image whose uploader did not say so will sail straight through. That is
 * precisely why approval requires a human to tick "I verified this is a real photo"
 * after opening the original source page. Never describe this filter as guaranteeing
 * anything; the UI label is "likely non-AI".
 *
 * Matching is deliberately word-boundaried rather than substring-based. A naive
 * `text.includes('ai')` rejects "airway", "repair", "training" and "captain" — all
 * plausible in a medical-equipment library — so every pattern below anchors on \b.
 *
 * Text is normalised before matching because \b counts "_" as a word character, so
 * `\bmidjourney\b` does not match the creator handle "midjourney_bot" — and underscored
 * handles are a common way these tools get credited. Normalising "_" (and "+") to spaces
 * restores the boundary without resorting to lookbehind.
 */

export interface AiTerm {
  /** Name shown to the reviewer when this term matches. */
  label: string;
  pattern: RegExp;
}

export const AI_TERMS: AiTerm[] = [
  // Standalone "AI" only. \bai\b does not match airway/repair/training/captain, but does
  // match "AI", "ai", and the "AI" in "AI-generated".
  { label: 'AI', pattern: /\bai\b/i },

  // "generative" as a whole word. Deliberately NOT a "generat" stem: that would reject
  // "oxygen generator" and "power generator", which are real medical equipment.
  { label: 'generative', pattern: /\bgenerative\b/i },

  { label: 'Midjourney', pattern: /\bmid[\s-]*journey\b/i },

  // Requires the full two-word phrase. Bare "diffusion" is a legitimate medical term
  // (diffusion MRI, gas diffusion) and must not trigger a rejection on its own.
  { label: 'Stable Diffusion', pattern: /\bstable[\s-]*diffusion\b/i },

  // DALL-E, DALL·E, DALL E, DALLE.
  { label: 'DALL-E', pattern: /\bdall[\s.·-]?e\b/i },

  { label: 'synthetic', pattern: /\bsynthetic\b/i },

  // render / renders / rendered / rendering.
  { label: 'render', pattern: /\brender(s|ed|ing)?\b/i },
];

/**
 * Separators that \b treats as word characters, which would otherwise hide a term
 * embedded in a handle such as "ai_artist" or "dalle_images".
 */
export function normalizeForMatching(text: string): string {
  return text.replace(/[_+]+/g, ' ');
}

/** Flattens the metadata fields the filter is required to scan. */
export function collectScannedText(result: OpenverseResult): string {
  const tagNames = (result.tags ?? []).map((t) => t?.name).filter(Boolean);
  return [result.title, result.description, result.creator, ...tagNames]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' • ');
}

/** Every AI term present in the result's metadata. Empty means the result passed. */
export function findAiTerms(result: OpenverseResult): string[] {
  const text = normalizeForMatching(collectScannedText(result));
  return AI_TERMS.filter((t) => t.pattern.test(text)).map((t) => t.label);
}

/** AI-stage rejection. Returns null when the result passes. */
export function checkLikelyNonAi(result: OpenverseResult): RejectionReason | null {
  const matchedTerms = findAiTerms(result);
  return matchedTerms.length > 0 ? { kind: 'likely-ai', matchedTerms } : null;
}
