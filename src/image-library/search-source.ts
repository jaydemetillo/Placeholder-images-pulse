import { filterResults, searchOpenverse, type FilterOutcome } from './openverse';
import fixture from './fixtures/openverse-sample.json';
import type { OpenverseResult } from './types';

/**
 * Live Openverse, or recorded fixtures for offline work.
 *
 * Fixture mode exists because some sandboxes and CI runners cannot reach
 * api.openverse.org. It runs the identical filter pipeline, so what a reviewer sees
 * offline matches what they would see live — only the transport differs.
 */

function matchesQuery(result: OpenverseResult, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    result.title,
    result.description,
    result.creator,
    ...(result.tags ?? []).map((t) => t?.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return terms.some((t) => haystack.includes(t));
}

export function searchFixtures(query: string): FilterOutcome {
  const results = (fixture.results as OpenverseResult[]).filter((r) => matchesQuery(r, query));
  return filterResults(results);
}

export async function searchCandidates(query: string, useFixtures: boolean): Promise<FilterOutcome> {
  if (useFixtures) return searchFixtures(query);
  return searchOpenverse(query);
}
