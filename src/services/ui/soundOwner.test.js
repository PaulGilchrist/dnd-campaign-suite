import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRuntimeState, seedTrackedResources } from '../../hooks/runtime/useRuntimeState.js';
import {
  SOUND_OWNER_KEY,
  readSoundScreen,
  claimSoundScreen,
  isSoundOwnerHere,
  soundScreenLabel,
} from './soundOwner.js';

// jsdom default hostname is 'localhost' → the GM branch of the predicate;
// the TV branch rides the localStorage `initiative-tv` pref (mocked in
// src/test/setup.js), flipped here directly.

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

  it('claim writes {screen} server-first and readSoundScreen follows', () => {
    claimSoundScreen('Test Camp', 'tv');
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
});
