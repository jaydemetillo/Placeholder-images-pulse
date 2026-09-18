/**
 * Three deliberately separate data layers.
 *
 *   1. Placeholder  — a slot in the app. Checked into the repo. Never mutated at runtime.
 *   2. LibraryImage — a sourced image with full provenance, either `pending` or `approved`.
 *                     Only human approval moves a record from one to the other.
 *   3. Assignment   — binds a placeholder to an approved image.
 *
 * Openverse search results are a fourth, ephemeral shape (`Candidate`). They are never
 * persisted into the library; a Candidate becomes a LibraryImage only by being staged for
 * review, and reaches `approved` only through the human approval gate — which is what
 * keeps search results separate from live app images.
 */

/** Licences we are willing to display. Anything not in this union is rejected. */
export type AllowedLicense = 'cc0' | 'pdm' | 'by';

export type PlaceholderShape = 'tall' | 'wide' | 'square';

/** A slot in the app that wants a real photograph. */
export interface Placeholder {
  id: string;
  label: string;
  /** Query terms sent to Openverse when a reviewer searches for this slot. */
  searchWords: string;
  shape: PlaceholderShape;
  needsPeople: boolean;
  allowsBrandLogos: boolean;
}

/** A raw Openverse search hit, before any filtering. Never persisted. */
export interface OpenverseResult {
  id: string;
  title: string | null;
  creator: string | null;
  url: string;
  thumbnail: string | null;
  foreign_landing_url: string | null;
  license: string | null;
  license_version: string | null;
  license_url: string | null;
  tags?: { name: string }[] | null;
  description?: string | null;
  source?: string | null;
}

/** Why a result was withheld from the reviewer. */
export type RejectionReason =
  | { kind: 'license-missing' }
  | { kind: 'license-not-allowed'; license: string }
  | { kind: 'likely-ai'; matchedTerms: string[] }
  | { kind: 'no-source-page' };

/** A search hit that survived filtering and may be shown to a reviewer. */
export interface Candidate {
  openverseId: string;
  title: string;
  creator: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  sourcePageUrl: string;
  license: AllowedLicense;
  licenseVersion: string | null;
  licenseUrl: string;
  attribution: string;
  /** Terms the AI heuristic scanned. Retained so the reviewer can see what was checked. */
  scannedText: string;
}

/**
 * The four attestations a reviewer must make. All four are required; there is no
 * partial-approval path.
 */
export interface ReviewChecklist {
  realPhotoChecked: boolean;
  matchesEquipmentChecked: boolean;
  sourceAndLicenceChecked: boolean;
  noPatientInfoChecked: boolean;
}

export const CHECKLIST_ITEMS: { key: keyof ReviewChecklist; label: string }[] = [
  { key: 'realPhotoChecked', label: 'I verified this is a real photo, not AI-generated.' },
  { key: 'matchesEquipmentChecked', label: 'I verified the image matches the requested equipment.' },
  { key: 'sourceAndLicenceChecked', label: 'I checked the original source page and licence.' },
  {
    key: 'noPatientInfoChecked',
    label: 'I verified no identifiable patient or private medical information is visible.',
  },
];

/**
 * Everything a library record carries regardless of status.
 *
 * `imageUrl` is what the app serves. For images sourced by the team it is a local path
 * under `public/images/`, so a live screen never hotlinks a third-party host: the bytes
 * we vetted are the bytes we ship. `originalFileUrl` keeps the upstream file we
 * downloaded from, so provenance survives the copy.
 */
export interface LibraryImageBase {
  id: string;
  /** What the app renders. A local `/images/…` path for anything we downloaded. */
  imageUrl: string;
  /** The upstream file this was downloaded from, or null if the record hotlinks. */
  originalFileUrl: string | null;
  /** Changes made to the upstream file. CC BY requires these to be indicated. */
  modifications: string | null;
  sourcePageUrl: string;
  title: string;
  creator: string | null;
  license: AllowedLicense;
  licenseVersion: string | null;
  licenseUrl: string;
  attribution: string;
  /** The slot this image was sourced for. A hint for the reviewer, not a binding. */
  sourcedForPlaceholderId: string | null;
}

/**
 * Sourced and staged, but NOT yet vetted by a human.
 *
 * A pending record is inert: `resolveImage` refuses it, so nothing about staging one can
 * put an image on a screen. Its four attestations are all false by construction — the
 * reviewer ticks them, nobody else.
 */
export interface PendingImage extends LibraryImageBase, ReviewChecklist {
  status: 'pending';
  approvedAt: null;
  approvedBy: null;
  /** Why this candidate was picked, and anything the reviewer should weigh. */
  sourcingNote: string | null;
}

/** A human-approved image. The only shape the live app is allowed to render. */
export interface ApprovedImage extends LibraryImageBase, ReviewChecklist {
  status: 'approved';
  /** ISO date, e.g. "2026-09-18". */
  approvedAt: string;
  approvedBy: string;
  sourcingNote?: string | null;
}

/** Either status. The store holds these; only the approved ones reach the app. */
export type LibraryImage = PendingImage | ApprovedImage;

/** Binds a placeholder slot to an approved image. */
export interface Assignment {
  placeholderId: string;
  imageId: string;
}
