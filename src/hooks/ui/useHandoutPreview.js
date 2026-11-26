import { useCallback, useState } from 'react';

/**
 * Open/close pair for the shared HandoutPreview sheet (backlog Item 4).
 * Stable callback identities so hosts whose render memo lists the opener in
 * its deps (MonsterCardBody) never recompute on parent re-renders, and one
 * destructure keeps the host's statement count down (complexity ceilings).
 * Pure per-client UI flag — printing never touches the runtime store.
 */
export function useHandoutPreview() {
  const [open, setOpen] = useState(false);
  const openPreview = useCallback(() => setOpen(true), []);
  const closePreview = useCallback(() => setOpen(false), []);
  return { open, openPreview, closePreview };
}
