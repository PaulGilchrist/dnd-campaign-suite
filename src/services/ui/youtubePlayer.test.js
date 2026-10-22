// @maintained-by-ai
/**
 * youtubePlayer.js — YouTube IFrame API wrapper unit lane.
 *
 * EXTERNAL-SDK BOUNDARY (#1547-fetch-boundary-exception-form):
 * window.YT, window.onYouTubeIframeAPIReady, and the injected
 * <script src="https://www.youtube.com/iframe_api"> are documented
 * third-party boundary stubs (exact-of-N census below). The unit-under-test
 * (youtubePlayer.js) is REAL, never mocked; the DOM is REAL jsdom.
 *
 * Stub-faithfulness law (#1545-sanitize-config-law analog): PlayerState
 * constant bytes mirror the documented YouTube IFrame API categories
 * verbatim (UNSTARTED -1, ENDED 0, PLAYING 1, PAUSED 2, BUFFERING 3,
 * CUED 5) — nothing invented; the module destructures only PLAYING /
 * PAUSED / ENDED, and non-terminal constants are probed inert (T10).
 * Stub methods are exact-of-6 vs the wrapper-call census:
 * loadVideoById, pauseVideo, playVideo, stopVideo, setVolume, destroy
 * (#1440 mock-completeness — every method the wrapper invokes is defined
 * as a pure recorder #1498-pure-recorder-form; args recorded verbatim,
 * no canned outcomes baked).
 *
 * NO-CLOCK: no timers, no fake timers, no wall-clock. Every SDK handshake
 * is a manual deferred (direct callback invocation) — presentation-layer
 * audio UI only; repo no-game-timers mandate untouched (#1547-form
 * "proven with manual deferreds — no timers").
 *
 * DOMAIN ADJACENCY (#1544, musicConfig lane live findings):
 * - musicConfig.js:89 hostname.endsWith('youtube.com') accepts lookalike
 *   hosts — that trust gate lives in extractVideoId (musicConfig/MusicPlayer
 *   lanes), NOT here: youtubePlayer.js parses no URLs and builds no iframe
 *   src itself. Its only written URL is the API_URL literal (T2 exact-be
 *   chokepoint pin); video ids reach loadVideoById as documented-API args
 *   and the SDK composes the iframe src internally (third-party boundary).
 *   Lookalike-host bytes here are STRUCT data probes only (#1545-form).
 * - shared-mutation class (#1544/#1537): the wrapper copies every inbound
 *   array (queue = [...videoIds]). The law is pinned live in T10 via a
 *   post-call array mutation that must NOT leak into the queue.
 *
 * FIXTURES (#1509-1547 thirty-nine-streak adaptation, inline-config-IS-the-
 * law #1544-form): video ids are REAL disk-catalog bytes extracted from
 * musicConfig.js MOODS at load time — never retyped; drift throws.
 * Mutually-distinguishable per #1348. Campaign not URL-scoped (no
 * campaign keys in this module).
 *
 * Caller-boundary table (#1544 exporter->caller census):
 *   youtubePlayer.export   | caller (src/components/sidebar/MusicPlayer.jsx)
 *   ensurePlayer           | :36   | dispose     | :37   | setVolume   | :41
 *   playTracks            | :51,:75,:118 | pause | :65  | resume       | :77
 *   stop                  | :84
 *   subscribe / isPlayingNow -> NO production callers (dead-export 📌
 *   report-only; retained logic still unit-tested compactly in T10/T11).
 * MusicPlayer.test.jsx vi.mock's the whole youtubePlayer module, so this
 * file is the ONLY lane exercising the internal state machine — no overlap.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as youtubePlayer from './youtubePlayer.js';
import { MOODS } from './musicConfig.js';

// ---- fixture integrity: REAL catalog bytes, drift-throw (#1509-form) ----
if (MOODS[0].key !== 'town' || MOODS[1].key !== 'outdoors') {
  throw new Error(`musicConfig drift: expected MOODS[0]='town', MOODS[1]='outdoors', got ${MOODS.map((m) => m.key).join(',')}`);
}
const [TOWN_A, TOWN_B] = MOODS[0].tracks.map((t) => t.videoId);
const [OUT_A, OUT_B] = MOODS[1].tracks.map((t) => t.videoId);
for (const id of [TOWN_A, TOWN_B, OUT_A, OUT_B]) {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    throw new Error(`musicConfig drift: catalog id ${JSON.stringify(id)} is not an 11-char base62-ish YouTube id`);
  }
}
if (new Set([TOWN_A, TOWN_B, OUT_A, OUT_B]).size !== 4) {
  throw new Error('musicConfig drift: fixture ids must be mutually distinguishable (#1348)');
}

// ---- external boundary stubs (documented YT IFrame API shapes) ----
const API_URL = 'https://www.youtube.com/iframe_api'; // mirrors youtubePlayer.js:17 chokepoint constant, byte-exact

let lastPlayer; // set by every YT.Player construction — construction order is observable

function makeRecPlayer() {
  // exact-of-6 census of methods youtubePlayer.js calls; pure recorders (#1498).
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    loadVideoById: rec('loadVideoById'),
    pauseVideo: rec('pauseVideo'),
    playVideo: rec('playVideo'),
    stopVideo: rec('stopVideo'),
    setVolume: rec('setVolume'),
    destroy: rec('destroy'),
  };
}

function installYTStub() {
  window.YT = {
    // documented PlayerState bytes mirrored verbatim; module reads 3 of 6.
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: function (elementId, options) {
      lastPlayer = makeRecPlayer();
      lastPlayer.elementId = elementId;
      lastPlayer.options = options;
      return lastPlayer;
    },
  };
}

// manual deferreds — direct invocation of the SDK event seams, zero timers
function readyPlayer() {
  lastPlayer.options.events.onReady();
}
function fireState(data) {
  lastPlayer.options.events.onStateChange({ data });
}
function ytScripts() {
  return [...document.head.querySelectorAll('script')].filter((s) => s.getAttribute('src') === API_URL);
}

beforeEach(() => {
  youtubePlayer._resetForTests();
  lastPlayer = null;
  installYTStub();
});

afterEach(() => {
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  ytScripts().forEach((s) => s.remove()); // jsdom head persists per-file; keep injection counts exact
  vi.restoreAllMocks();
  youtubePlayer._resetForTests();
});

describe('ensurePlayer — API-already-loaded lane', () => {
  it('constructs the Player once with the exact documented tuple and ignores repeat calls', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    expect(lastPlayer.elementId).toBe('yt-music-frame');
    // full-set playerVars pin — bytes mirrored from the module's documented autoplay-off config
    expect(lastPlayer.options.playerVars).toEqual({ autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1 });
    // events exact-of-3: no fabricated API keys
    expect(Object.keys(lastPlayer.options.events).sort()).toEqual(['onError', 'onReady', 'onStateChange']);

    const first = lastPlayer;
    youtubePlayer.ensurePlayer('other-frame');
    expect(lastPlayer).toBe(first); // singleton: even a different id spawns no second Player
    expect(ytScripts()).toHaveLength(0); // YT preloaded => no script injection at all
  });
});

describe('ensurePlayer — script-injection chokepoint', () => {
  it('injects the official API URL exactly once, coalesces repeat calls while loading, and defers creation to the onYouTubeIframeAPIReady handshake', () => {
    delete window.YT;
    youtubePlayer.ensurePlayer('yt-music-frame');
    youtubePlayer.ensurePlayer('yt-music-frame'); // apiLoading guard: no duplicate <script>
    const scripts = ytScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(API_URL); // exact literal, not includes() — #1544 hostname-trust lesson
    expect(lastPlayer).toBeNull(); // no player before the handshake
    installYTStub(); // SDK arrives late, as in a real browser
    window.onYouTubeIframeAPIReady();
    expect(lastPlayer.elementId).toBe('yt-music-frame'); // creation deferred to ready, right target id
  });

  it('chains a pre-existing onYouTubeIframeAPIReady handler before creating the player', () => {
    delete window.YT;
    const order = [];
    window.onYouTubeIframeAPIReady = () => {
      order.push('previousReady');
      order.push(lastPlayer === null ? 'no-player-yet' : 'player-already-created');
    };
    youtubePlayer.ensurePlayer('yt-music-frame');
    installYTStub(); // SDK is present by the time its ready callback fires
    window.onYouTubeIframeAPIReady();
    expect(order).toEqual(['previousReady', 'no-player-yet']); // delegate first, create after
    expect(lastPlayer.elementId).toBe('yt-music-frame');
  });
});

describe('ready gating and pending flush', () => {
  it('buffers commands pre-ready and flushes exactly-once volume-before-track (volume 0 survives the != null guard)', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    youtubePlayer.playTracks([TOWN_A, TOWN_B]);
    youtubePlayer.setVolume(0); // falsy-trap pin: pending-volume gate is `!= null`, not truthiness (#1352-form)
    youtubePlayer.pause();
    youtubePlayer.resume();
    expect(lastPlayer.calls).toEqual([]); // nothing dispatched before ready

    readyPlayer();
    const first = lastPlayer;
    // exact ordered ledger: volume lands BEFORE the first load (audio starts at user volume)
    expect(first.calls).toEqual([['setVolume', 0], ['loadVideoById', TOWN_A]]);

    youtubePlayer.dispose(); // ready player => destroy runs
    expect(first.calls).toEqual([['setVolume', 0], ['loadVideoById', TOWN_A], ['destroy']]);

    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    expect(lastPlayer.calls).toEqual([]); // flush is one-shot; pending buffers were consumed and wiped
  });

  it('last-write-wins when playTracks is called repeatedly before ready', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    youtubePlayer.playTracks([TOWN_A, TOWN_B]);
    youtubePlayer.playTracks([OUT_A, OUT_B]); // GM flips mood pre-ready: latest queue wins
    readyPlayer();
    expect(lastPlayer.calls).toEqual([['loadVideoById', OUT_A]]);
    fireState(0); // ENDED
    expect(lastPlayer.calls).toEqual([['loadVideoById', OUT_A], ['loadVideoById', OUT_B]]);
  });

  it('buffers tracks requested before any player exists and delivers them on create + ready', () => {
    youtubePlayer.playTracks([TOWN_A, TOWN_B]); // player === null branch
    youtubePlayer.ensurePlayer('yt-music-frame');
    expect(lastPlayer.calls).toEqual([]); // creation alone is not readiness
    readyPlayer();
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A]]);
  });

  it('stop before ready disarms autoplay but volume intent survives stop', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    youtubePlayer.playTracks([TOWN_A]);
    youtubePlayer.setVolume(0.5);
    youtubePlayer.stop(); // clears pendingTrackIds; quirk pin: pendingVolumePct is NOT cleared
    readyPlayer();
    expect(lastPlayer.calls).toEqual([['setVolume', 50]]); // no loadVideoById, no stopVideo (not ready)
    fireState(0); // ENDED with intentStopped => still inert
    expect(lastPlayer.calls).toEqual([['setVolume', 50]]);
  });
});

describe('dispose and generation guard', () => {
  it('drops destroy for never-ready players, destroys ready players once, and ignores late events from a destroyed generation', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    const neverReady = lastPlayer;
    youtubePlayer.dispose();
    expect(neverReady.calls).toEqual([]); // destroy gated on ready

    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([TOWN_A, TOWN_B]);
    const staleEvents = lastPlayer.options.events;
    youtubePlayer.dispose();
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A], ['destroy']]);

    youtubePlayer.ensurePlayer('yt-music-frame'); // new generation
    readyPlayer();
    youtubePlayer.playTracks([OUT_A, OUT_B]);
    staleEvents.onStateChange({ data: 0 }); // stale-generation ENDED must not advance new queue
    staleEvents.onError({ data: 100 }); // stale-generation error must not advance either
    expect(lastPlayer.calls).toEqual([['loadVideoById', OUT_A]]); // generation guard LIVE
  });

  it('state changes are inert when window.YT has vanished (unguarded-deref guard, youtubePlayer.js:43)', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    const seen = [];
    youtubePlayer.subscribe((s) => seen.push(s));
    const events = lastPlayer.options.events;
    delete window.YT;
    events.onStateChange({ data: 1 }); // without the guard this TypeErrors on PlayerState destructure
    events.onStateChange({ data: 0 });
    expect(seen).toEqual([]); // no notify
    expect(youtubePlayer.isPlayingNow()).toBe(false); // golden silent-return pinned
    expect(lastPlayer.calls).toEqual([]);
  });
});

describe('queue loop and transport (raw documented numeric state codes)', () => {
  it('drives loop, wrap, transport and notify ledger from numeric bytes; pause does not disarm auto-advance; BUFFERING/UNSTARTED/CUED are inert; inbound arrays are copied', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    const seen = [];
    const off = youtubePlayer.subscribe((s) => seen.push(s));

    const town = [TOWN_A, TOWN_B];
    youtubePlayer.playTracks(town);
    town[1] = 'HIJACKED0'; // shared-mutation probe (#1544/#1537): wrapper copied the array, so the queue must still hold real bytes
    fireState(1); // PLAYING (documented 1)
    youtubePlayer.pause();
    youtubePlayer.resume();
    fireState(2); // PAUSED (documented 2)
    fireState(0); // ENDED advances even after PAUSED — intentStopped is set only by playTracks/stop (quirk pin)
    fireState(0); // ENDED wraps back to first — loop law
    fireState(3); fireState(-1); fireState(5); // BUFFERING/UNSTARTED/CUED inert
    // full-set ordered ledger (invocationCallOrder: create-before-cue, load-before-pause)
    expect(lastPlayer.calls).toEqual([
      ['loadVideoById', TOWN_A],
      ['pauseVideo'],
      ['playVideo'],
      ['loadVideoById', TOWN_B], // real disk bytes, not the mutation
      ['loadVideoById', TOWN_A],
    ]);
    expect(seen).toEqual([{ playing: true }, { playing: false }]);
    expect(seen[0]).not.toBe(seen[1]); // fresh state object per notify
    expect(youtubePlayer.isPlayingNow()).toBe(false);
    off();
    fireState(1);
    expect(seen).toHaveLength(2); // unsubscribe honoured
    expect(youtubePlayer.isPlayingNow()).toBe(true); // internal state still tracks after unsubscribe
  });

  it('stop halts transport, notifies once, and late ENDED never resumes', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    const seen = [];
    youtubePlayer.subscribe((s) => seen.push(s));
    youtubePlayer.playTracks([TOWN_A, TOWN_B]);
    fireState(1); // PLAYING
    youtubePlayer.stop();
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A], ['stopVideo']]);
    expect(seen).toEqual([{ playing: true }, { playing: false }]); // stop notifies {playing:false}
    fireState(0);
    fireState(0);
    expect(lastPlayer.calls.filter((c) => c[0] === 'loadVideoById')).toEqual([['loadVideoById', TOWN_A]]); // no post-stop advance
    expect(youtubePlayer.isPlayingNow()).toBe(false);
  });

  it('onError logs exact message bytes and skips to the next track; post-stop errors log the undefined-slot quirk without advancing', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([TOWN_A, TOWN_B]);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    lastPlayer.options.events.onError({ data: 101 }); // documented code: video not embeddable
    expect(spy).toHaveBeenCalledWith(`YouTube playback error (code 101) for video ${TOWN_A}. Skipping to next track.`);
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A], ['loadVideoById', TOWN_B]]);

    youtubePlayer.stop();
    spy.mockClear();
    lastPlayer.options.events.onError({ data: 100 }); // documented code: video not found; queue already cleared
    expect(spy).toHaveBeenCalledWith('YouTube playback error (code 100) for video undefined. Skipping to next track.'); // silent-undefined quirk pinned #1360-family
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A], ['loadVideoById', TOWN_B], ['stopVideo']]); // no advance
  });
});

describe('input guards and clamps', () => {
  it('playTracks rejects the falsy triple with console.error but passes empty-string ids raw to the SDK', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    youtubePlayer.playTracks([]);
    youtubePlayer.playTracks(null);
    youtubePlayer.playTracks(undefined);
    expect(spy).toHaveBeenCalledTimes(3); // falsy triple each logged
    expect(spy).toHaveBeenCalledWith('playTracks called with no video ids');
    expect(lastPlayer.calls).toEqual([]);
    youtubePlayer.playTracks(['']); // quirk pin: guard is length===0 only — '' passes byte-verbatim to the documented-API arg slot (id validation lives upstream in extractVideoId/MusicPlayer lanes)
    expect(lastPlayer.calls).toEqual([['loadVideoById', '']]);
    expect(spy).toHaveBeenCalledTimes(3); // '' addendum logged nothing
  });

  it('setVolume clamps and rounds to the 0-100 percent ledger', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.setVolume(0.5);
    youtubePlayer.setVolume(1.5);
    youtubePlayer.setVolume(-1);
    youtubePlayer.setVolume(0.499); // Math.round(49.9) => 50
    expect(lastPlayer.calls).toEqual([['setVolume', 50], ['setVolume', 100], ['setVolume', 0], ['setVolume', 50]]);
  });
});
