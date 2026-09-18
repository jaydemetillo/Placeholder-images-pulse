import type { ApprovedImage, Assignment, LibraryImage } from './types';

/**
 * The live app's ONLY route to an image.
 *
 * Resolution requires both an assignment AND a record whose status is 'approved'.
 * A search result cannot reach this function — it has no id in the library at all — and
 * a staged `pending` record fails the status check even if something assigned it. That
 * is what makes "only approved images can replace placeholders" a structural property
 * rather than a convention someone has to remember.
 *
 * Returns null when a slot is unassigned, and the caller renders the placeholder.
 */
export function resolveImage(
  placeholderId: string,
  library: LibraryImage[],
  assignments: Assignment[],
): ApprovedImage | null {
  const assignment = assignments.find((a) => a.placeholderId === placeholderId);
  if (!assignment) return null;

  const image = library.find((a) => a.id === assignment.imageId);
  if (!image) return null;
  if (image.status !== 'approved') return null;

  return image;
}
