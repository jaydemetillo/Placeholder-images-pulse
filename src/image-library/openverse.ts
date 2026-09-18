import { checkLicense, OPENVERSE_LICENSE_PARAM, buildAttribution, resolveLicenseUrl } from './license-policy';
import { checkLikelyNonAi, collectScannedText } from './ai-heuristic';
import type { AllowedLicense, Candidate, OpenverseResult, RejectionReason } from './types';

/**
 * SEARCH ONLY.
 *
 * Nothing in this module writes to the approved store. Its output is `Candidate[]`,
 * an ephemeral shape that lives in admin UI state until a human approves one. This is
 * the boundary that keeps Openverse search results separate from live app images.
 */

export const OPENVERSE_ENDPOINT = 'https://api.openverse.org/v1/images/';

export interface SearchOptions {
  pageSize?: number;
  page?: number;
  signal?: AbortSignal;
}

export function buildSearchUrl(query: string, opts: SearchOptions = {}): string {
  const params = new URLSearchParams({
    q: query,
    // Filter server-side as well as client-side. The client-side check in
    // `filterResults` remains authoritative — we never trust the server to have
    // honoured this parameter.
    license: OPENVERSE_LICENSE_PARAM,
    page_size: String(opts.pageSize ?? 20),
    page: String(opts.page ?? 1),
  });
  return `${OPENVERSE_ENDPOINT}?${params.toString()}`;
}

export interface FilteredResult {
  result: OpenverseResult;
  reason: RejectionReason;
}

export interface FilterOutcome {
  candidates: Candidate[];
  rejected: FilteredResult[];
}

function toCandidate(result: OpenverseResult): Candidate {
  const license = result.license!.trim().toLowerCase() as AllowedLicense;
  const version = result.license_version ?? null;
  const title = result.title?.trim() || 'Untitled';
  return {
    openverseId: result.id,
    title,
    creator: result.creator?.trim() || null,
    imageUrl: result.url,
    thumbnailUrl: result.thumbnail ?? null,
    sourcePageUrl: result.foreign_landing_url!,
    license,
    licenseVersion: version,
    licenseUrl: resolveLicenseUrl(license, version, result.license_url),
    attribution: buildAttribution(title, result.creator?.trim() || null, license, version),
    scannedText: collectScannedText(result),
  };
}

/**
 * Two gates, in order: licence, then the likely-non-AI heuristic. Rejections are
 * returned rather than silently dropped so the admin page can show what was withheld
 * and why — a reviewer should be able to see the filter working.
 */
export function filterResults(results: OpenverseResult[]): FilterOutcome {
  const candidates: Candidate[] = [];
  const rejected: FilteredResult[] = [];

  for (const result of results) {
    const licenseProblem = checkLicense(result);
    if (licenseProblem) {
      rejected.push({ result, reason: licenseProblem });
      continue;
    }
    const aiProblem = checkLikelyNonAi(result);
    if (aiProblem) {
      rejected.push({ result, reason: aiProblem });
      continue;
    }
    candidates.push(toCandidate(result));
  }

  return { candidates, rejected };
}

export interface OpenverseResponse {
  result_count: number;
  results: OpenverseResult[];
}

/** Fetches and filters. Throws on network/HTTP failure so the UI can surface it. */
export async function searchOpenverse(query: string, opts: SearchOptions = {}): Promise<FilterOutcome> {
  const response = await fetch(buildSearchUrl(query, opts), {
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Openverse search failed: ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as OpenverseResponse;
  return filterResults(body.results ?? []);
}

export function describeRejection(reason: RejectionReason): string {
  switch (reason.kind) {
    case 'license-missing':
      return 'No licence stated';
    case 'license-not-allowed':
      return `Licence not allowed (${reason.license.toUpperCase()})`;
    case 'likely-ai':
      return `Possible AI metadata: ${reason.matchedTerms.join(', ')}`;
    case 'no-source-page':
      return 'No original source page to verify';
  }
}
