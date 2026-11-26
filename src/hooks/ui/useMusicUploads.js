import { useCallback, useRef, useState } from 'react';
import { uploadCampaignAudio, deleteCampaignAudio } from '../../services/ui/musicService.js';
import { isLocalhostBrowser } from '../../services/ui/isLocalhostBrowser.js';

/**
 * Local-audio draft lane of the Music track editor (offline-ambience backlog
 * Item 3, 2026-11-25). Owns the editor's { kind:'local' } draft rows: the
 * upload round-trip into the campaign's audio/ folder, row removal, and the
 * abandoned-upload sweep.
 *
 * File-lifetime law (no orphans, two disjoint lanes):
 *   • a row uploaded into the OPEN draft and never saved is owned HERE —
 *     removing the row or discarding the draft DELETEs the file immediately
 *     (GM-origin only: the server route is GM-gated, a player DJ leaves the
 *     file for the GM's next sweep);
 *   • a row that a Save persisted belongs to stored data from then on — the
 *     POST /music SUPERSEDE PRUNE on the server unlinks files when saved
 *     lists drop them (campaigns-changedata.js), so this lane never deletes
 *     a saved file and the two lanes cannot double-delete.
 */
export function useMusicUploads(campaignName, onUploaded, onRejected) {
  const [localTracks, setLocalTracks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef(null);
  // Uploads added to THIS editor draft that a Save has not persisted yet
  // (seedEditor resets it; saveTracks clears it on success).
  const draftUploadsRef = useRef([]);

  const handleAudioUpload = useCallback(async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // re-picking the same file must fire change again
    if (!file) return;
    setUploading(true);
    const result = await uploadCampaignAudio(campaignName, file);
    setUploading(false);
    if (result.error) {
      onRejected(result.error);
      return;
    }
    draftUploadsRef.current = [...draftUploadsRef.current, result.row.src];
    setLocalTracks((rows) => [...rows, result.row]);
    onUploaded(result.row);
  }, [campaignName, onUploaded, onRejected]);

  // Removing an UNSAVED row unlinks its file immediately (it can never be
  // referenced later); stored rows ride the save-minus-row law instead.
  const removeLocalTrack = useCallback((src) => {
    setLocalTracks((rows) => rows.filter(row => row.src !== src));
    if (draftUploadsRef.current.includes(src)) {
      draftUploadsRef.current = draftUploadsRef.current.filter((s) => s !== src);
      if (isLocalhostBrowser()) deleteCampaignAudio(campaignName, src);
    }
  }, [campaignName]);

  // Discard sweep: a discarded draft abandons its never-saved uploads.
  const pruneAbandonedUploads = useCallback(() => {
    const orphans = draftUploadsRef.current;
    draftUploadsRef.current = [];
    if (orphans.length === 0) return;
    if (!isLocalhostBrowser()) return; // GM-only route; players leave it to the GM
    orphans.forEach((src) => deleteCampaignAudio(campaignName, src));
  }, [campaignName]);

  return {
    localTracks,
    setLocalTracks,
    uploading,
    uploadInputRef,
    draftUploadsRef,
    handleAudioUpload,
    removeLocalTrack,
    pruneAbandonedUploads,
  };
}
