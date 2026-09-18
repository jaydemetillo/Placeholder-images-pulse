import { useSyncExternalStore } from 'react';
import { getApproved, getAssignments, getLibrary, getPending, subscribe } from './store';
import { resolveImage } from './resolve-image';
import type { ApprovedImage, LibraryImage, PendingImage } from './types';

export function useApproved(): ApprovedImage[] {
  return useSyncExternalStore(subscribe, getApproved, getApproved);
}

/** Staged-but-unvetted records. Admin surfaces only. */
export function usePending(): PendingImage[] {
  return useSyncExternalStore(subscribe, getPending, getPending);
}

/** Every record, whatever its status. Admin surfaces only. */
export function useLibrary(): LibraryImage[] {
  return useSyncExternalStore(subscribe, getLibrary, getLibrary);
}

export function useAssignments() {
  return useSyncExternalStore(subscribe, getAssignments, getAssignments);
}

/** Resolved approved image for a slot, or null when the slot is still a placeholder. */
export function useResolvedImage(placeholderId: string): ApprovedImage | null {
  const approved = useApproved();
  const assignments = useAssignments();
  return resolveImage(placeholderId, approved, assignments);
}
