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

/** Same endpoint, reached through the dev server's proxy. See `vite.config.ts`. */
export const OPENVERSE_DEV_PROXY_ENDPOINT = '/openverse/v1/images/';

/**
 * Where a search request should actually be sent.
 *
 * In a browser, a direct call to api.openverse.org is blocked before it returns: the API
 * sends no CORS headers for this origin, so `fetch` rejects with an opaque
 * "Failed to fetch" and the admin page shows "Search failed" with nothing useful in it.
 * During development we therefore go through the Vite proxy, which makes the request
 * same-origin and performs the real hop in Node.
 *
 * Node callers — tests, scripts — have no CORS to satisfy and keep the absolute URL, as
 * does a production build, which has no proxy behind it.
 */
export function searchEndpoint(): string {
  return useDevProxy() ? OPENVERSE_DEV_PROXY_ENDPOINT : OPENVERSE_ENDPOINT;
}

function useDevProxy(): boolean {
  const inBrowser = typeof window !== 'undefined';
  const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  return inBrowser && isDev;
}

const OPENVERSE_ORIGIN = 'https://api.openverse.org';

/**
 * Rewrites an Openverse-hosted URL onto the dev proxy.
 *
 * Preview thumbnails are served from `api.openverse.org/v1/images/<id>/thumb/`, and
 * loading one straight from the page fails the same way a direct search does — that
 * endpoint answers 406 to some of the `Accept` headers a browser sends for an `<img>`.
 * Sending it through the proxy lets Node ask for it with a header it accepts, so a
 * candidate shows a picture instead of a broken-image icon.
 *
 * URLs on any other host — the upstream file itself, on Flickr or Wikimedia — are left
 * alone. They are not ours to proxy, and they are not what the preview uses.
 */
export function proxiedOpenverseUrl(url: string | null): string | null {
  if (!url) return url;
  if (!useDevProxy()) return url;
  if (!url.startsWith(`${OPENVERSE_ORIGIN}/`)) return url;
  return `/openverse${url.slice(OPENVERSE_ORIGIN.length)}`;
}

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
  return `${searchEndpoint()}?${params.toString()}`;
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
    // Proxied in dev so the preview actually renders; see `proxiedOpenverseUrl`.
    thumbnailUrl: proxiedOpenverseUrl(result.thumbnail ?? null),
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
