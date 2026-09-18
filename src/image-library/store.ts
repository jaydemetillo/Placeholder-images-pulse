import type {
  ApprovedImage,
  Assignment,
  Candidate,
  LibraryImage,
  PendingImage,
  ReviewChecklist,
} from './types';
import librarySeed from './library.seed.json';
import assignmentsSeed from './assignments.seed.json';

/**
 * The image library and the placeholder→image assignments.
 *
 * The library holds two kinds of record. A `pending` one has been sourced and staged
 * with full provenance but not vetted; it is inert, because `resolveImage` only returns
 * `approved` records. An `approved` one carries a reviewer's name and all four
 * attestations. Staging can therefore never publish anything on its own.
 *
 * Prototype persistence is localStorage so a reviewer's approvals survive a reload
 * without a backend. In production these two collections belong behind the admin API,
 * written only by an authenticated reviewer. The shapes are already correct for that;
 * only the transport changes.
 */

// v2: records gained a status, licence version and local-file provenance. The key is
// versioned so a browser holding v1 records falls back to the seed rather than
// deserialising a shape that no longer exists.
const LIBRARY_KEY = 'image-library.library.v2';
const ASSIGNMENTS_KEY = 'image-library.assignments.v2';

type Listener = () => void;
const listeners = new Set<Listener>();

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupt or blocked storage must never take the app down; fall back to the seed.
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) — state stays in memory for this session */
  }
}

let library: LibraryImage[] = readJson(LIBRARY_KEY, librarySeed as LibraryImage[]);
let assignments: Assignment[] = readJson(ASSIGNMENTS_KEY, assignmentsSeed as Assignment[]);

/**
 * Derived views are cached because `useSyncExternalStore` compares snapshots by
 * identity — returning a freshly filtered array on every read would loop forever.
 * Every mutation goes through `emit()`, so clearing the cache there is sufficient.
 */
let approvedCache: ApprovedImage[] | null = null;
let pendingCache: PendingImage[] | null = null;

function emit(): void {
  approvedCache = null;
  pendingCache = null;
  for (const l of listeners) l();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every record, whatever its status. Admin surfaces only — never the live app. */
export function getLibrary(): LibraryImage[] {
  return library;
}

/**
 * Approved records only.
 *
 * The live app reads through this, so a pending record cannot reach a screen even if
 * something assigned one by mistake. `resolveImage` re-checks the status anyway; the
 * two guards are deliberate belt and braces.
 */
export function getApproved(): ApprovedImage[] {
  approvedCache ??= library.filter((i): i is ApprovedImage => i.status === 'approved');
  return approvedCache;
}

/** Records staged for review, in the order they were sourced. */
export function getPending(): PendingImage[] {
  pendingCache ??= library.filter((i): i is PendingImage => i.status === 'pending');
  return pendingCache;
}

export function getAssignments(): Assignment[] {
  return assignments;
}

export function allChecked(checklist: ReviewChecklist): boolean {
  return (
    checklist.realPhotoChecked &&
    checklist.matchesEquipmentChecked &&
    checklist.sourceAndLicenceChecked &&
    checklist.noPatientInfoChecked
  );
}

/** Next free `img_NNN`, derived from the highest id in the library rather than a count. */
function nextImageId(): string {
  const highest = library.reduce((max, image) => {
    const n = Number(/^img_(\d+)$/.exec(image.id)?.[1] ?? NaN);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `img_${String(highest + 1).padStart(3, '0')}`;
}

export class ApprovalRejectedError extends Error {}

/** Shared gate. Both approval paths go through it; neither can skip it. */
function requireHumanApproval(checklist: ReviewChecklist, approvedBy: string): void {
  if (!allChecked(checklist)) {
    throw new ApprovalRejectedError('All four verification checkboxes are required.');
  }
  if (!approvedBy.trim()) {
    throw new ApprovalRejectedError('A reviewer name is required.');
  }
}

/**
 * Stages a search result for review WITHOUT approving it.
 *
 * Deliberately takes no checklist and no reviewer: staging is a sourcing step, and
 * nothing it writes can be rendered. The record lands as `pending` with all four
 * attestations false, for a human to tick later.
 */
export function stageCandidate(
  candidate: Candidate,
  options: {
    sourcedForPlaceholderId?: string | null;
    imageUrl?: string;
    modifications?: string | null;
    sourcingNote?: string | null;
  } = {},
): PendingImage {
  const record: PendingImage = {
    id: nextImageId(),
    status: 'pending',
    imageUrl: options.imageUrl ?? candidate.imageUrl,
    originalFileUrl: candidate.imageUrl,
    modifications: options.modifications ?? null,
    sourcePageUrl: candidate.sourcePageUrl,
    title: candidate.title,
    creator: candidate.creator,
    license: candidate.license,
    licenseVersion: candidate.licenseVersion,
    licenseUrl: candidate.licenseUrl,
    attribution: candidate.attribution,
    sourcedForPlaceholderId: options.sourcedForPlaceholderId ?? null,
    sourcingNote: options.sourcingNote ?? null,
    realPhotoChecked: false,
    matchesEquipmentChecked: false,
    sourceAndLicenceChecked: false,
    noPatientInfoChecked: false,
    approvedAt: null,
    approvedBy: null,
  };

  library = [...library, record];
  writeJson(LIBRARY_KEY, library);
  emit();
  return record;
}

/**
 * Promotes a staged record to approved. The ONLY path from pending to live.
 *
 * Refuses unless every checklist item is ticked and a reviewer is named. The record
 * already carries its licence evidence and source URL from staging; approval adds the
 * attestations, the reviewer and the date.
 */
export function approvePending(
  imageId: string,
  checklist: ReviewChecklist,
  approvedBy: string,
  now: Date = new Date(),
): ApprovedImage {
  requireHumanApproval(checklist, approvedBy);

  const existing = library.find((i) => i.id === imageId);
  if (!existing) throw new ApprovalRejectedError(`No image ${imageId} in the library.`);
  if (existing.status === 'approved') {
    throw new ApprovalRejectedError(`Image ${imageId} is already approved.`);
  }

  const record: ApprovedImage = {
    ...existing,
    status: 'approved',
    approvedBy: approvedBy.trim(),
    approvedAt: now.toISOString().slice(0, 10),
    ...checklist,
  };

  library = library.map((i) => (i.id === imageId ? record : i));
  writeJson(LIBRARY_KEY, library);
  emit();
  return record;
}

/**
 * Approves a search result outright, without a staging step.
 *
 * Same gate as `approvePending`: all four boxes, plus a named reviewer. Captures the
 * licence evidence and original source URL on the record itself, so provenance travels
 * with the image rather than living in a separate audit log.
 */
export function approveCandidate(
  candidate: Candidate,
  checklist: ReviewChecklist,
  approvedBy: string,
  now: Date = new Date(),
): ApprovedImage {
  requireHumanApproval(checklist, approvedBy);

  const record: ApprovedImage = {
    id: nextImageId(),
    status: 'approved',
    imageUrl: candidate.imageUrl,
    originalFileUrl: candidate.imageUrl,
    modifications: null,
    sourcePageUrl: candidate.sourcePageUrl,
    title: candidate.title,
    creator: candidate.creator,
    license: candidate.license,
    licenseVersion: candidate.licenseVersion,
    licenseUrl: candidate.licenseUrl,
    attribution: candidate.attribution,
    sourcedForPlaceholderId: null,
    sourcingNote: null,
    approvedBy: approvedBy.trim(),
    approvedAt: now.toISOString().slice(0, 10),
    ...checklist,
  };

  library = [...library, record];
  writeJson(LIBRARY_KEY, library);
  emit();
  return record;
}

/** Binds a slot to an approved image. Refuses pending records and unknown ids alike. */
export function assignImage(placeholderId: string, imageId: string): void {
  if (!library.some((a) => a.id === imageId && a.status === 'approved')) {
    throw new ApprovalRejectedError(`Image ${imageId} is not an approved image.`);
  }
  assignments = [
    ...assignments.filter((a) => a.placeholderId !== placeholderId),
    { placeholderId, imageId },
  ];
  writeJson(ASSIGNMENTS_KEY, assignments);
  emit();
}

export function unassign(placeholderId: string): void {
  assignments = assignments.filter((a) => a.placeholderId !== placeholderId);
  writeJson(ASSIGNMENTS_KEY, assignments);
  emit();
}

/** Test/dev helper. Not used by the app. */
export function __resetStore(
  nextLibrary: LibraryImage[] = [],
  nextAssignments: Assignment[] = [],
): void {
  library = nextLibrary;
  assignments = nextAssignments;
  emit();
}
