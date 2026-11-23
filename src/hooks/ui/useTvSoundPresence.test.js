import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { clearRuntimeState, seedTrackedResources, getRuntimeValue } from '../runtime/useRuntimeState.js';
import { saveTvPref } from '../../services/ui/tvModeStore.js';
import { SOUND_OWNER_KEY, tvScreensOf } from '../../services/ui/soundOwner.js';
import { useTvSoundPresence } from './useTvSoundPresence.js';

// Beacon face plan (backlog 2026-11-22): a TV-mode tab under a 'tv' claim is
// the ONLY writer on this lane — announce on mount/pref flip/echo, strip on
// pagehide with a keepalive POST, silent (zero writes — the historical pref
// law) for every other combination. No timers anywhere.

const posted = () =>
  fetch.mock.calls.map(([, init]) => JSON.parse(init.body).value);

describe('useTvSoundPresence', () => {
  beforeEach(() => {
    clearRuntimeState('campaign');
    saveTvPref(false);
    vi.restoreAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  it('writes NOTHING for a non-TV tab (pref off), even under a tv claim', () => {
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).not.toHaveBeenCalled();
    expect(getRuntimeValue('campaign', SOUND_OWNER_KEY)).toEqual({ screen: 'tv' });
  });

  it('writes NOTHING for a TV-pref tab while the claim is gm (zero-write pref law)', () => {
    saveTvPref(true);
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'gm' } });
    renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).not.toHaveBeenCalled();
    // …and with NO stored claim at all.
    clearRuntimeState('campaign');
    renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a TV-pref tab under a tv claim announces its token on the shared key', () => {
    saveTvPref(true);
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/campaigns/Test%20Camp/soundOwner');
    expect(init.method).toBe('POST');
    const value = posted()[0];
    expect(value.screen).toBe('tv'); // claim rides untouched
    expect(Object.values(tvScreensOf(value))).toEqual([true]); // exactly one marker
    // The local mirror carries the marker too (echo-free face of the write).
    expect(Object.keys(tvScreensOf(getRuntimeValue('campaign', SOUND_OWNER_KEY)))).toHaveLength(1);
  });

  it('re-announces when a foreign write clobbers the presence map (echo self-heal, no heartbeat)', () => {
    saveTvPref(true);
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    const { unmount } = renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).toHaveBeenCalledTimes(1);
    // A raw claim-only overwrite (e.g. someone re-presses the control) must
    // NOT leave the TV screen silently unmarked.
    act(() => {
      seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(Object.values(tvScreensOf(posted()[1]))).toEqual([true]);
    // A peer-marked echo (mine gone, foreign present) heals to BOTH markers.
    act(() => {
      seedTrackedResources('campaign', {
        [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { 'tab-foreign': true } },
      });
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    const healed = posted()[2];
    expect(Object.keys(healed.tvScreens)).toHaveLength(2); // foreign + mine
    unmount();
  });

  it('pagehide strips this page\'s marker with a keepalive POST; unmount detaches the listener', () => {
    saveTvPref(true);
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    const { unmount } = renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [, init] = fetch.mock.calls[1];
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body).value).toEqual({ screen: 'tv' }); // field dropped, claim kept
    unmount();
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(fetch).toHaveBeenCalledTimes(2); // no double-release after SPA unmount
  });

  it('a pref flip OFF strips the marker through the shared lane; flip back ON re-marks', () => {
    saveTvPref(true);
    const marked = { screen: 'tv' };
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: marked });
    renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).toHaveBeenCalledTimes(1);
    const token = Object.keys(
      tvScreensOf(getRuntimeValue('campaign', SOUND_OWNER_KEY)))[0];
    act(() => {
      // Simulate the echo landing the announce, then leaving TV mode (which
      // is what `Exit TV mode` does to the pref).
      seedTrackedResources('campaign', {
        [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { [token]: true } },
      });
      saveTvPref(false);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(posted()[1]).toEqual({ screen: 'tv' });
    act(() => saveTvPref(true));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(Object.values(posted()[2].tvScreens)).toEqual([true]);
  });

  it('a claim flip off tv HOLDS the marker while the tab is still in TV mode (no round-trip zero-window)', () => {
    saveTvPref(true);
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    renderHook(() => useTvSoundPresence('Test Camp'));
    expect(fetch).toHaveBeenCalledTimes(1);
    const token = Object.keys(
      tvScreensOf(getRuntimeValue('campaign', SOUND_OWNER_KEY)))[0];
    // The announce echo lands (nothing to do), then the claim flips to gm
    // with the marker carried (the fixed claimSoundScreen shape).
    act(() => {
      seedTrackedResources('campaign', {
        [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { [token]: true } },
      });
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => {
      seedTrackedResources('campaign', {
        [SOUND_OWNER_KEY]: { screen: 'gm', tvScreens: { [token]: true } },
      });
    });
    expect(fetch).toHaveBeenCalledTimes(1); // held — no strip under a gm claim
    // Leaving TV mode for real strips through the shared lane, claim or no claim.
    act(() => saveTvPref(false));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(posted()[1]).toEqual({ screen: 'gm' });
  });

  it('pagehide strips even a marker held under a gm claim (graceful departure leaves no stale token)', () => {
    saveTvPref(true);
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    const { unmount } = renderHook(() => useTvSoundPresence('Test Camp'));
    const token = Object.keys(
      tvScreensOf(getRuntimeValue('campaign', SOUND_OWNER_KEY)))[0];
    act(() => {
      seedTrackedResources('campaign', {
        [SOUND_OWNER_KEY]: { screen: 'gm', tvScreens: { [token]: true } },
      });
    });
    expect(fetch).toHaveBeenCalledTimes(1); // held, unstripped
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [, init] = fetch.mock.calls[1];
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body).value).toEqual({ screen: 'gm' }); // own token gone, claim kept
    unmount();
  });
});
