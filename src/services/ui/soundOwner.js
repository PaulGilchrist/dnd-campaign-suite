import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getTvPref } from './tvModeStore.js';
import { isLocalhostBrowser } from './isLocalhostBrowser.js';

/**
 * Sound Owner (learnability/engagement plan Phase 5) — the table talks with
 * ONE set of speakers.
 *
 * The law: short combat cues and the weather bed play ONLY on the designated
 * sound screen. The role is a claimable, server-first campaign setting
 * (`soundOwner` change-data key, value { screen: 'gm' | 'tv' }):
 *   - unset / 'gm'  → the GM's browser (a localhost tab that is NOT itself in
 *                     TV mode, so a GM with a TV tab on the same machine gets
 *                     exactly one speaker, not two);
 *   - 'tv'          → the tab running the TV presentation (per-client TV pref
 *                     on) — typically a device wired to the living-room screen.
 * Every other browser stays silent while the shared state (floaters, chips,
 * banners) keeps syncing everywhere. Anyone at the table may move the role
 * from the Music view — same shared-table authoring spirit as the overlay
 * lane — and the choice is logged in nothing but the synced key itself.
 *
 * Ambience already keeps the single-speaker law via MusicPlayer's
 * remote-adoption rule ("only the acting tab mounts the frame"); this service
 * extends the same discipline to the cue lane (services/ui/audioCues.js),
 * whose per-seat ON/OFF toggle now governs the OWNER screen's volume, not
 * per-seat playback.
 */
export const SOUND_OWNER_KEY = 'soundOwner';

export function readSoundScreen() {
  const value = getRuntimeValue('campaign', SOUND_OWNER_KEY);
  return value?.screen === 'tv' ? 'tv' : 'gm';
}

export function claimSoundScreen(campaignName, screen) {
  return setRuntimeValue('campaign', SOUND_OWNER_KEY, { screen }, campaignName);
}

/** True when THIS browser is the screen that should be making sound. */
export function isSoundOwnerHere() {
  if (readSoundScreen() === 'tv') return getTvPref();
  return isLocalhostBrowser() && !getTvPref();
}

export function soundScreenLabel(screen = readSoundScreen()) {
  return screen === 'tv' ? 'the TV screen' : 'the GM machine';
}
