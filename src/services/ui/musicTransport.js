/**
 * Shared music-transport bytes (improve 2026-11-08 EM backlog): the exact
 * commit payloads and audit rows for Pause/Stop, single source of truth for
 * BOTH the sidebar MusicPlayer and the TV tracker header transport.
 *
 * The transport components still own their plumbing (MusicPlayer additionally
 * commands its local YouTube frame; the TV header relies on MusicPlayer's
 * remote-adoption lane to drive the owner's frame via the SSE echo). This
 * module pins only the LANDED bytes so header and sidebar stay byte-consistent.
 */

import { DEFAULT_VOLUME } from './musicConfig.js';

// Shape of the top-level campaign change-data `music` key.
export const DEFAULT_MUSIC = { mood: null, playing: false, volume: DEFAULT_VOLUME, overrides: {}, customCategories: {} };

// Defensive hydrate: the store can hold null/partial data before the first
// server echo — always render/commit from a fully-shaped object.
export function normalizeMusic(raw) {
  return raw && typeof raw === 'object' ? { ...DEFAULT_MUSIC, ...raw } : DEFAULT_MUSIC;
}

// Pause keeps the mood armed (a later resume reuses it); Stop un-arms it.
export function pauseCommit(music) {
  return { ...music, playing: false };
}

export function pauseLogEntry(moodKey, moodLabel) {
  return {
    type: 'music',
    action: 'pause',
    mood: moodKey,
    message: `Paused ${moodLabel} ambience`
  };
}

export function stopCommit(music) {
  return { ...music, mood: null, playing: false };
}

export function stopLogEntry() {
  return { type: 'music', action: 'stop', message: 'Stopped ambience' };
}
