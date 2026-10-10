import { useCallback, useEffect, useRef, useState } from 'react';

// Post-rollback carry-over. UI-only flags are allowed to be local per the
// server-first rules (this is NOT game state). CampaignAdmin's rollback
// success handler stores a notice in sessionStorage before its full page
// reload; App boot consumes it here to auto-select the campaign, request the
// Admin view landing, and show the "restored" banner naming the snapshot.
export function usePostRestoreNotice(activeView) {
  const restoreRef = useRef(null);
  const [autoSelectCampaign, setAutoSelectCampaign] = useState(null);
  const [restoredSnapshot, setRestoredSnapshot] = useState(null);

  useEffect(() => {
    let notice = null;
    try {
      notice = JSON.parse(sessionStorage.getItem('postRestoreNotice') || 'null');
    } catch (err) {
      console.error('Failed to parse post-restore notice:', err);
    }
    if (!notice || !notice.campaign || !notice.restored) return;
    try {
      sessionStorage.removeItem('postRestoreNotice');
    } catch (err) {
      console.error('Failed to clear post-restore notice:', err);
    }
    restoreRef.current = notice;
    setAutoSelectCampaign(notice.campaign);
    setRestoredSnapshot(notice.restored);
  }, []);

  // The banner is a one-shot confirmation — drop it once the GM navigates
  // away from the Admin view (while a restore is no longer pending).
  useEffect(() => {
    if (restoredSnapshot && !restoreRef.current && activeView && activeView !== 'campaignRepair') {
      setRestoredSnapshot(null);
    }
  }, [activeView, restoredSnapshot]);

  // Returns true when the selected campaign is the one awaiting restore,
  // consuming the pending notice so the caller can land on the Admin view.
  const consumeRestore = useCallback((name) => {
    if (restoreRef.current && restoreRef.current.campaign === name) {
      restoreRef.current = null;
      return true;
    }
    return false;
  }, []);

  return { autoSelectCampaign, restoredSnapshot, consumeRestore };
}
