import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  getRuntimeValue,
  setRuntimeValue,
  useRuntimeValue,
} from '../runtime/useRuntimeState.js';
import { subscribeTvPref, getTvPref } from '../../services/ui/tvModeStore.js';
import {
  SOUND_OWNER_KEY,
  nextTvPresenceValue,
  releaseTvPresenceKeepalive,
} from '../../services/ui/soundOwner.js';

/**
 * TV-screen presence beacon (soundOwner.js presence lane, backlog 2026-11-22):
 * a tab that WOULD self-claim the sound screen (per-client TV pref on while
 * the shared claim says 'tv') marks its per-page token in the shared
 * `soundOwner.tvScreens` sub-field so every OTHER tab's remote note can state
 * honestly whether any TV screen exists right now. Mounted once by MusicPlayer
 * (which stays mounted across view navigation for the whole campaign session),
 * so presence rides the campaign for every tab, GM or visitor.
 *
 * Strictly event-driven — pref flips, shared-key echoes, pagehide/pageshow —
 * zero wall-clock timers (No-Game-Timers law). The claim is never touched
 * here (no auto-revert, no origin gating); a non-TV tab writes NOTHING, so the
 * pref's historical zero-write face is unchanged.
 */
export function useTvSoundPresence(campaignName) {
  const tvPref = useSyncExternalStore(subscribeTvPref, getTvPref);
  const owner = useRuntimeValue('campaign', SOUND_OWNER_KEY, campaignName);
  // Exactly the self-claim condition (isSoundOwnerHere under a 'tv' claim):
  // this page is a speaker only while the claim says 'tv' AND the pref is on.
  const present = Boolean(tvPref && owner?.screen === 'tv');

  // Announce/withdraw on pref flips and shared-key echoes (a foreign claim
  // flip or a clobbering write re-arms this tab's marker on the next echo —
  // self-healing with no heartbeat clock). One carve-out (backlog 2026-11-23):
  // a strip is HELD while this tab is still in TV mode but the claim has
  // moved off 'tv' — the zero-TV note only qualifies a 'tv' claim, so the
  // marker is invisible there, and keeping it lets claimSoundScreen carry it
  // across a tv→gm→tv round trip with no zero-window. Strips still fire
  // whenever this tab actually leaves TV mode (pref off) or the claim still
  // names tv while this page is not a speaker.
  useEffect(() => {
    if (!campaignName) return;
    const next = nextTvPresenceValue(owner, present);
    if (next && (present || !tvPref)) {
      setRuntimeValue('campaign', SOUND_OWNER_KEY, next, campaignName);
    }
  }, [campaignName, owner, present, tvPref]);

  const latestRef = useRef({ campaignName, present });
  latestRef.current = { campaignName, present };

  useEffect(() => {
    // Reload/tab-close teardown twin of MusicPlayer's pagehide release:
    // keepalive carries the strip past navigation so peers stop seeing this
    // screen the moment it is gone. Attempted even when the beacon is not
    // self-claiming: a marker HELD under a non-'tv' claim (above) must still
    // leave on graceful departure — nextTvPresenceValue answers null when
    // nothing is marked, so TV-silent tabs still never POST.
    const release = () => {
      const { campaignName: name } = latestRef.current;
      if (!name) return;
      releaseTvPresenceKeepalive(name, getRuntimeValue('campaign', SOUND_OWNER_KEY));
    };
    // bfcache resume: pagehide already fired (SSE closed, marker stripped)
    // while the page itself survives — re-mark from the live mirror.
    const reAnnounce = () => {
      const { campaignName: name, present: isPresent } = latestRef.current;
      if (!name || !isPresent) return;
      const next = nextTvPresenceValue(
        getRuntimeValue('campaign', SOUND_OWNER_KEY), true);
      if (next) setRuntimeValue('campaign', SOUND_OWNER_KEY, next, name);
    };
    window.addEventListener('pagehide', release);
    window.addEventListener('pageshow', reAnnounce);
    return () => {
      window.removeEventListener('pagehide', release);
      window.removeEventListener('pageshow', reAnnounce);
    };
  }, []);
}
