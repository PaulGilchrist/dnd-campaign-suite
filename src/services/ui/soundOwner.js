import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getTvPref } from './tvModeStore.js';
import { isLocalhostBrowser } from './isLocalhostBrowser.js';

/**
 * Sound Owner (learnability/engagement plan Phase 5) — the table talks with
 * ONE set of speakers.
 *
 * The law: short combat cues and the weather bed play ONLY on the designated
 * sound screen. The role is a claimable, server-first campaign setting
 * (`soundOwner` change-data key, value { screen: 'gm' | 'tv', tvScreens? }):
 * `tvScreens` is the additive TV-presence map (see the presence lane below) —
 * it never changes who owns the claim.
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

/**
 * TV-screen presence (backlog 2026-11-22): a `screen:'tv'` claim is only
 * honest while some connected tab actually carries the TV pref — otherwise
 * every tab reads "Sound plays on the TV screen" for a screen that may not
 * exist. A tab that WOULD self-claim (TV pref on while the claim says 'tv')
 * marks its per-page token in an additive `tvScreens` sub-field of the SAME
 * soundOwner key, and strips it on `pagehide` with a keepalive POST — the
 * savePrompt OWNER_TAB_TOKEN / MusicPlayer pagehide-release precedent, event
 * driven with zero wall-clock timers. The claim itself is NEVER auto-reverted
 * and no origin gating is added (shared-table authoring posture): this lane
 * only makes the note truthful. A hard crash skips pagehide and leaves a
 * stale marker — the same accepted residual the savePrompt lane carries.
 */
const TV_TAB_TOKEN = `tv-tab-${Math.random().toString(36).slice(2, 10)}`;

/** Presence map of a stored soundOwner value ({} when none marked). */
export function tvScreensOf(value) {
  const screens = value?.tvScreens;
  return screens && typeof screens === 'object' ? screens : {};
}

/**
 * The next soundOwner value with THIS page's TV presence marked (present)
 * or stripped, or null when nothing would change (setRuntimeValue's deep
 * equality makes a redundant write a no-op anyway, so callers stay quiet).
 * Stripping the LAST marker drops the `tvScreens` field entirely — the
 * canonical claim-only shape — and never touches foreign tokens.
 */
export function nextTvPresenceValue(value, present) {
  if (!value || typeof value !== 'object') return null;
  const screens = tvScreensOf(value);
  const marked = Object.prototype.hasOwnProperty.call(screens, TV_TAB_TOKEN);
  if (present === marked) return null;
  const tvScreens = { ...screens };
  if (present) tvScreens[TV_TAB_TOKEN] = true;
  else delete tvScreens[TV_TAB_TOKEN];
  const next = { ...value, tvScreens };
  if (Object.keys(tvScreens).length === 0) delete next.tvScreens;
  return next;
}

/**
 * Unload-resilient presence strip (pagehide only, mirrors the savePrompt
 * marker-strip shape): same wildcard POST as setRuntimeValue but with
 * keepalive so it survives navigation. Returns true when a POST fired.
 */
export function releaseTvPresenceKeepalive(campaignName, value) {
  const next = nextTvPresenceValue(value, false);
  if (!next) return false;
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(SOUND_OWNER_KEY)}`, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: next }),
    keepalive: true,
  }).catch((e) => console.error('[soundOwner] Error stripping TV presence on unload:', e));
  return true;
}
