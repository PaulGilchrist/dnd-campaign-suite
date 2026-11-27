// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRuntimeState, seedTrackedResources, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import {
  SOUND_OWNER_KEY,
  readSoundScreen,
  claimSoundScreen,
  isSoundOwnerHere,
  soundScreenLabel,
  tvScreensOf,
  nextTvPresenceValue,
} from './soundOwner.js';

// jsdom default hostname is 'localhost' → the GM branch of the predicate;
// the TV branch rides the localStorage `initiative-tv` pref (mocked in
// src/test/setup.js), flipped here directly.
// The pagehide keepalive-release lane is proved end-to-end through its only
// production caller in src/hooks/ui/useTvSoundPresence.test.js (URL, keepalive
// flag, stripped body, no double-release) — not restated as a unit test here.

describe('soundOwner', () => {
  beforeEach(() => {
    clearRuntimeState('campaign');
    localStorage.removeItem('initiative-tv');
    vi.restoreAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  it('defaults to the GM screen with no claim stored', () => {
    expect(readSoundScreen()).toBe('gm');
    expect(isSoundOwnerHere()).toBe(true); // localhost, TV pref off
  });

  it('claim writes the canonical claim-only shape and moves the speaker slot', () => {
    claimSoundScreen('Test Camp', 'tv');
    const stored = getRuntimeValue('campaign', SOUND_OWNER_KEY);
    expect(stored).toEqual({ screen: 'tv' });
    expect('tvScreens' in stored).toBe(false); // no phantom empty map
    expect(readSoundScreen()).toBe('tv');
    // This localhost non-TV tab is NOT the speaker once the TV owns sound…
    expect(isSoundOwnerHere()).toBe(false);
    // …and the TV tab (pref on) is exactly the speaker.
    localStorage.setItem('initiative-tv', '1');
    expect(isSoundOwnerHere()).toBe(true);
  });

  it('a GM tab in TV mode yields the speaker slot to the TV screen', () => {
    // screen 'gm' means "the GM machine's normal tab" — a TV-mode tab on the
    // same laptop must not double up as a second speaker.
    localStorage.setItem('initiative-tv', '1');
    expect(isSoundOwnerHere()).toBe(false);
  });

  it('unknown stored shapes fall back honestly to gm', () => {
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'whatever' } });
    expect(readSoundScreen()).toBe('gm');
  });

  it('labels read as plain English for both screens', () => {
    expect(soundScreenLabel('gm')).toBe('the GM machine');
    expect(soundScreenLabel('tv')).toBe('the TV screen');
  });

  describe('TV-screen presence lane (backlog 2026-11-22)', () => {
    // The per-page token is random — locate it as the diff against a known
    // foreign marker instead of pinning its (unknowable) bytes.
    const ownTokenOf = (value, baseline = {}) =>
      Object.keys(tvScreensOf(value)).find((k) => !(k in baseline));

    it('marks presence on the existing key as an additive tvScreens sub-field', () => {
      const claim = { screen: 'tv' };
      const marked = nextTvPresenceValue(claim, true);
      const token = ownTokenOf(marked);
      expect(token).toBeTruthy();
      expect(marked.screen).toBe('tv'); // the claim rides untouched
      expect(marked.tvScreens).toEqual({ [token]: true });
      // A second announce is a no-op — no write churn (no heartbeat clock).
      expect(nextTvPresenceValue(marked, true)).toBeNull();
    });

    it('strips ONLY this page\'s token; the last strip restores the claim-only shape', () => {
      const marked = nextTvPresenceValue({ screen: 'tv' }, true);
      const token = ownTokenOf(marked);
      const both = { screen: 'tv', tvScreens: { [token]: true, 'tab-foreign': true } };
      const stripped = nextTvPresenceValue(both, false);
      expect(stripped.tvScreens).toEqual({ 'tab-foreign': true }); // peer marker rides untouched
      expect(nextTvPresenceValue(stripped, false)).toBeNull();    // already absent → silent
      // Only our own marker present: emptying drops the field entirely.
      expect(nextTvPresenceValue(marked, false)).toEqual({ screen: 'tv' });
    });

    it('presence writes never fabricate a claim: no value, no write', () => {
      expect(nextTvPresenceValue(null, true)).toBeNull();
      expect(nextTvPresenceValue(null, false)).toBeNull();
      expect(tvScreensOf(null)).toEqual({});
      expect(tvScreensOf({ screen: 'tv' })).toEqual({});
    });

    it('claimSoundScreen carries the presence map verbatim across a flip (backlog 2026-11-23)', () => {
      const marked = nextTvPresenceValue({ screen: 'tv' }, true);
      const token = ownTokenOf(marked);
      seedTrackedResources('campaign', {
        [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { [token]: true, 'tab-foreign': true } },
      });
      claimSoundScreen('Test Camp', 'gm');
      // The new screen rides with BOTH tokens untouched — no zero-TV window.
      expect(getRuntimeValue('campaign', SOUND_OWNER_KEY)).toEqual({
        screen: 'gm',
        tvScreens: { [token]: true, 'tab-foreign': true },
      });
    });
  });
});
