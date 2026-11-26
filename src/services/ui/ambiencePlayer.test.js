// @maintained-by-ai: 2026-11-25
/**
 * ambiencePlayer.js — unified ambience engine unit lane
 * (formerly youtubePlayer.test.js; Item 3 offline-ambience migration).
 *
 * The module under test (ambiencePlayer.js) is REAL, never mocked; the DOM is
 * REAL jsdom. Documented boundaries are stubbed at their true seams:
 *   - YouTube IFrame API: window.YT.Player recorder (exact-of-6 method census)
 *     + window.onYouTubeIframeAPIReady handshake + <script> injection probe.
 *   - Local audio arm: global Audio replaced by a recorder FakeAudio
 *     (jsdom implements no media playback; prototype touches would surface as
 *     "not implemented" noise instead of assertions).
 *
 * Pinned laws (carried + new):
 *   T1  ensurePlayer only REGISTERS the frame element — nothing contacts
 *       youtube.com until the queue actually reaches a 'youtube' row
 *       (offline boot law, Item 3).
 *   T2  Pre-ready commands buffer; onReady flushes volume BEFORE the first
 *       load; last-write-wins on repeated pre-ready playTracks.
 *   T3  Queue loops over track ROWS ({kind,src,title}); ENDED advances;
 *       pause does not disarm; undocumented states are inert; inbound arrays
 *       are copied.
 *   T4  Arm switching is exclusive: arming local pauses the YouTube arm;
 *       arming youtube tears the audio element down (removeAttribute+load).
 *       Foreign-arm events are inert (arm + generation guards).
 *   T5  Local URL law: /campaigns/<enc campaign>/<enc src segments> for
 *       campaign uploads; root-absolute bundled beds ('/audio/…', Item 3b)
 *       pass through to the app origin, campaign optional.
 *   T6  dispose: destroy only for ready players; audio is torn down; late
 *       events from a destroyed generation never advance.
 *   T7  setVolume drives both arms; the 0-100 percent ledger and the `!= null`
 *       pending-volume gate survive.
 *
 * Catalog fixtures are REAL disk bytes from musicConfig.js MOODS — drift
 * throws. The YT-Player construction boundary in this file is the module's
 * only YT surface; MusicPlayer.jsx integration is mocked at this module
 * (ambiencePlayer.js parses no URLs and builds no iframe itself).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as ambiencePlayer from './ambiencePlayer.js';
import { MOODS } from './musicConfig.js';

// ---- fixture integrity: REAL catalog bytes, drift-throw (#1509-form) ----
if (MOODS[0].key !== 'town' || MOODS[1].key !== 'outdoors') {
  throw new Error(`musicConfig drift: expected MOODS[0]='town', MOODS[1]='outdoors', got ${MOODS.map((m) => m.key).join(',')}`);
}
const TOWN_YT = MOODS[0].tracks.filter((t) => t.kind === 'youtube');
const OUT_YT = MOODS[1].tracks.filter((t) => t.kind === 'youtube');
const [TOWN_A, TOWN_B] = TOWN_YT;
const [OUT_A, OUT_B] = OUT_YT;
for (const row of [TOWN_A, TOWN_B, OUT_A, OUT_B]) {
  if (row.kind !== 'youtube' || !/^[a-zA-Z0-9_-]{11}$/.test(row.src)) {
    throw new Error(`musicConfig drift: catalog row ${JSON.stringify(row)} is not a canonical {kind:'youtube', src:11-char}`);
  }
}
if (new Set([TOWN_A.src, TOWN_B.src, OUT_A.src, OUT_B.src]).size !== 4) {
  throw new Error('musicConfig drift: fixture ids must be mutually distinguishable (#1348)');
}
const LOCAL_ROW = { kind: 'local', src: 'audio/amb-1700000000000-abcdef.mp3', title: 'Campfire' };
// Item 3b: the bundled-bed home — root-absolute src, served off the app origin.
const BUNDLED_ROW = { kind: 'local', src: '/audio/dungeon-ambient.mp3', title: 'Dungeon Ambience' };

// ---- external boundary stubs (documented YT IFrame API shapes) ----
const API_URL = 'https://www.youtube.com/iframe_api'; // mirrors ambiencePlayer.js chokepoint constant, byte-exact

let lastPlayer; // set by every YT.Player construction — construction order is observable

function makeRecPlayer() {
  // exact-of-6 census of methods the engine calls; pure recorders (#1498).
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

// FakeAudio: recorder stand-in for the local-arm HTMLMediaElement.
let lastAudio;
class FakeAudio {
  constructor() {
    this.calls = [];
    this.listeners = {};
    this.volume = 1;
    this._src = '';
    this.playResult = Promise.resolve();
    lastAudio = this;
  }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  fire(name) { (this.listeners[name] || []).forEach((fn) => fn()); }
  get src() { return this._src; }
  set src(value) { this.calls.push(['src', value]); this._src = value; }
  play() { this.calls.push(['play']); return this.playResult; }
  pause() { this.calls.push(['pause']); }
  load() { this.calls.push(['load']); }
  removeAttribute(name) { this.calls.push(['removeAttribute', name]); }
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
const loads = () => (lastPlayer ? lastPlayer.calls.filter((c) => c[0] === 'loadVideoById') : []);

// MusicPlayer's real arm order: click → playTracks, then the mount effect
// registers the frame via ensurePlayer.
function armQueue(rows, campaign = 'test-campaign') {
  ambiencePlayer.playTracks(rows, campaign);
  ambiencePlayer.ensurePlayer('yt-music-frame');
}

beforeEach(() => {
  ambiencePlayer._resetForTests();
  lastPlayer = null;
  lastAudio = null;
  installYTStub();
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  ytScripts().forEach((s) => s.remove()); // jsdom head persists per-file; keep injection counts exact
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  ambiencePlayer._resetForTests();
});

describe('T1 ensurePlayer — lazy boot law', () => {
  it('registering the frame alone boots NOTHING (offline local-only tables never reach youtube.com)', () => {
    ambiencePlayer.ensurePlayer('yt-music-frame');
    expect(lastPlayer).toBeNull(); // no Player construction without a youtube row
    expect(ytScripts()).toHaveLength(0); // no SDK script either
  });

  it('a youtube queue constructs the Player once with the exact documented tuple and ignores repeat calls', () => {
    ambiencePlayer.ensurePlayer('yt-music-frame');
    ambiencePlayer.playTracks([TOWN_A]);
    expect(lastPlayer.elementId).toBe('yt-music-frame');
    // full-set playerVars pin — bytes mirrored from the module's documented autoplay-off config
    expect(lastPlayer.options.playerVars).toEqual({ autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1 });
    // events exact-of-3: no fabricated API keys
    expect(Object.keys(lastPlayer.options.events).sort()).toEqual(['onError', 'onReady', 'onStateChange']);

    const first = lastPlayer;
    ambiencePlayer.ensurePlayer('other-frame');
    expect(lastPlayer).toBe(first); // singleton: even a different id spawns no second Player
    expect(ytScripts()).toHaveLength(0); // YT preloaded => no script injection at all
  });

  it('a LOCAL-ONLY queue never boots the YouTube lane at all', () => {
    armQueue([LOCAL_ROW]);
    expect(lastPlayer).toBeNull();
    expect(ytScripts()).toHaveLength(0);
    expect(lastAudio.calls).toEqual([['src', '/campaigns/test-campaign/audio/amb-1700000000000-abcdef.mp3'], ['play']]);
  });
});

describe('ensurePlayer — script-injection chokepoint', () => {
  it('injects the official API URL exactly once, coalesces repeat calls while loading, and defers creation to the onYouTubeIframeAPIReady handshake', () => {
    delete window.YT;
    ambiencePlayer.playTracks([TOWN_A]); // boot requested pre-frame (MusicPlayer click-before-effect order)
    ambiencePlayer.ensurePlayer('yt-music-frame');
    ambiencePlayer.ensurePlayer('yt-music-frame'); // loading guard: no duplicate <script>
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
    armQueue([TOWN_A]);
    installYTStub(); // SDK is present by the time its ready callback fires
    window.onYouTubeIframeAPIReady();
    expect(order).toEqual(['previousReady', 'no-player-yet']); // delegate first, create after
    expect(lastPlayer.elementId).toBe('yt-music-frame');
  });
});

describe('T2 ready gating and pending flush', () => {
  it('buffers commands pre-ready and flushes exactly-once volume-before-track (volume 0 survives the != null guard)', () => {
    armQueue([TOWN_A, TOWN_B]);
    ambiencePlayer.setVolume(0); // falsy-trap pin: pending-volume gate is `!= null`, not truthiness (#1352-form)
    ambiencePlayer.pause();
    ambiencePlayer.resume();
    expect(lastPlayer.calls).toEqual([]); // nothing dispatched before ready

    readyPlayer();
    const first = lastPlayer;
    // exact ordered ledger: volume lands BEFORE the first load (audio starts at user volume)
    expect(first.calls).toEqual([['setVolume', 0], ['loadVideoById', TOWN_A.src]]);

    ambiencePlayer.dispose(); // ready player => destroy runs
    expect(first.calls).toEqual([['setVolume', 0], ['loadVideoById', TOWN_A.src], ['destroy']]);

    ambiencePlayer.playTracks([TOWN_A]);
    ambiencePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    const flushLedger = lastPlayer.calls.length;
    readyPlayer(); // replaying the ready event must not re-flush: pending buffers were consumed and wiped
    expect(lastPlayer.calls).toHaveLength(flushLedger);
  });

  it('last-write-wins when playTracks is called repeatedly before ready', () => {
    armQueue([TOWN_A, TOWN_B]);
    ambiencePlayer.playTracks([OUT_A, OUT_B]); // GM flips mood pre-ready: latest queue wins
    readyPlayer();
    expect(loads()).toEqual([['loadVideoById', OUT_A.src]]);
    fireState(0); // ENDED
    expect(loads()).toEqual([['loadVideoById', OUT_A.src], ['loadVideoById', OUT_B.src]]);
  });

  it('buffers tracks requested before any frame exists and delivers them on create + ready', () => {
    ambiencePlayer.playTracks([TOWN_A, TOWN_B]); // elementId === null branch: boot deferred
    ambiencePlayer.ensurePlayer('yt-music-frame');
    expect(lastPlayer.calls).toEqual([]); // creation alone is not readiness
    readyPlayer();
    expect(loads()).toEqual([['loadVideoById', TOWN_A.src]]);
  });

  it('stop before ready disarms autoplay but volume intent survives stop', () => {
    armQueue([TOWN_A]);
    ambiencePlayer.setVolume(0.5);
    ambiencePlayer.stop(); // clears the pending play; quirk pin: pendingVolumePct is NOT cleared
    readyPlayer();
    expect(lastPlayer.calls).toEqual([['setVolume', 50]]); // no loadVideoById, no stopVideo (not ready)
    fireState(0); // ENDED with intentStopped => still inert
    expect(lastPlayer.calls).toEqual([['setVolume', 50]]);
  });
});

describe('T3 queue loop and transport (raw documented numeric state codes)', () => {
  it('drives loop, wrap and transport from numeric bytes; pause does not disarm auto-advance; BUFFERING/UNSTARTED/CUED are inert; inbound arrays are copied', () => {
    armQueue([TOWN_A, TOWN_B]); // queue buffered pre-ready (ready flush happens below)
    const town = [TOWN_A, TOWN_B];
    ambiencePlayer.playTracks(town, 'test-campaign'); // latest queue wins before the single flush
    readyPlayer();
    town[1] = 'HIJACKED0'; // shared-mutation probe (#1544/#1537): wrapper copied the array, so the queue must still hold real bytes
    fireState(1); // PLAYING (documented 1)
    ambiencePlayer.pause();
    ambiencePlayer.resume();
    fireState(2); // PAUSED (documented 2) — inert branch since #1549 bookkeeping trim
    fireState(0); // ENDED advances even after PAUSED — intentStopped is set only by playTracks/stop (quirk pin)
    fireState(0); // ENDED wraps back to first — loop law
    fireState(3); fireState(-1); fireState(5); // BUFFERING/UNSTARTED/CUED inert
    // full-set ordered ledger (invocationCallOrder: create-before-cue, load-before-pause)
    expect(lastPlayer.calls).toEqual([
      ['loadVideoById', TOWN_A.src],
      ['pauseVideo'],
      ['playVideo'],
      ['loadVideoById', TOWN_B.src], // real disk bytes, not the mutation
      ['loadVideoById', TOWN_A.src],
    ]);
  });

  it('stop halts transport and late ENDED never resumes', () => {
    armQueue([TOWN_A, TOWN_B]);
    readyPlayer();
    fireState(1); // PLAYING
    ambiencePlayer.stop();
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A.src], ['stopVideo']]);
    fireState(0);
    fireState(0);
    expect(loads()).toEqual([['loadVideoById', TOWN_A.src]]); // no post-stop advance
  });

  it('onError logs exact message bytes and skips to the next track; post-stop errors log the undefined-slot quirk without advancing', () => {
    armQueue([TOWN_A, TOWN_B]);
    readyPlayer();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    lastPlayer.options.events.onError({ data: 101 }); // documented code: video not embeddable
    expect(spy).toHaveBeenCalledWith(`YouTube playback error (code 101) for video ${TOWN_A.src}. Skipping to next track.`);
    expect(loads()).toEqual([['loadVideoById', TOWN_A.src], ['loadVideoById', TOWN_B.src]]);

    ambiencePlayer.stop();
    spy.mockClear();
    lastPlayer.options.events.onError({ data: 100 }); // documented code: video not found; queue already cleared
    expect(spy).toHaveBeenCalledWith('YouTube playback error (code 100) for video undefined. Skipping to next track.'); // silent-undefined quirk pinned #1360-family
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A.src], ['loadVideoById', TOWN_B.src], ['stopVideo']]); // no advance
  });
});

describe('T4 exclusive arms + local queue law', () => {
  it('arming a local row pauses the youtube arm; arming a youtube row tears the audio element down', () => {
    armQueue([TOWN_A]);
    readyPlayer();

    ambiencePlayer.playTracks([LOCAL_ROW], 'test camp');
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A.src], ['pauseVideo']]); // silenced, not destroyed
    expect(lastAudio.calls).toEqual([['src', '/campaigns/test%20camp/audio/amb-1700000000000-abcdef.mp3'], ['play']]);

    ambiencePlayer.playTracks([TOWN_B], 'test camp'); // wrap back to the youtube arm
    expect(lastAudio.calls).toEqual([
      ['src', '/campaigns/test%20camp/audio/amb-1700000000000-abcdef.mp3'],
      ['play'],
      ['pause'],
      ['removeAttribute', 'src'],
      ['load'],
    ]);
    expect(loads()).toEqual([['loadVideoById', TOWN_A.src], ['loadVideoById', TOWN_B.src]]);
  });

  it('local ended advances and loops', () => {
    armQueue([LOCAL_ROW, { kind: 'local', src: 'audio/amb-2.wav', title: 'Rain' }]);
    expect(lastAudio.calls).toEqual([['src', '/campaigns/test-campaign/audio/amb-1700000000000-abcdef.mp3'], ['play']]);
    lastAudio.fire('ended'); // advance to row 2
    expect(lastAudio.calls).toEqual([
      ['src', '/campaigns/test-campaign/audio/amb-1700000000000-abcdef.mp3'],
      ['play'],
      ['src', '/campaigns/test-campaign/audio/amb-2.wav'],
      ['play'],
    ]);
    lastAudio.fire('ended'); // wrap back to row 1 — loop law on the local arm
    expect(lastAudio.calls.slice(-2)).toEqual([
      ['src', '/campaigns/test-campaign/audio/amb-1700000000000-abcdef.mp3'],
      ['play'],
    ]);
  });

  // Item 3b: bundled CC0 beds live at the APP origin ('/audio/…'), not under
  // any campaign folder — the queue law is unchanged, only the URL mapping.
  it('bundled-bed srcs map to the app origin inside a mixed queue', () => {
    armQueue([BUNDLED_ROW, LOCAL_ROW]);
    expect(lastAudio.calls).toEqual([['src', '/audio/dungeon-ambient.mp3'], ['play']]);
    lastAudio.fire('ended'); // advance to the campaign upload — campaign prefix returns
    expect(lastAudio.calls.slice(-2)).toEqual([
      ['src', '/campaigns/test-campaign/audio/amb-1700000000000-abcdef.mp3'],
      ['play'],
    ]);
  });

  it('a bundled bed plays with no campaign selected (repo-owned file on the app origin)', () => {
    ambiencePlayer.playTracks([BUNDLED_ROW]); // no campaign argument at all
    expect(lastAudio.calls).toEqual([['src', '/audio/dungeon-ambient.mp3'], ['play']]);
  });

  it('youtube ENDED never drives the local arm (arm guard)', () => {
    armQueue([TOWN_A]);
    readyPlayer();
    ambiencePlayer.playTracks([LOCAL_ROW, TOWN_A]); // arm flips to local
    lastAudio.calls.length = 0;
    fireState(0); // youtube ENDED lands while arm === 'local' — inert, no advance
    expect(lastAudio.calls).toEqual([]);
    expect(loads()).toEqual([['loadVideoById', TOWN_A.src]]); // never a loadVideoById of a local src
  });

  it('pause/resume drive the owning arm only', () => {
    armQueue([LOCAL_ROW]);
    lastAudio.calls.length = 0;
    ambiencePlayer.pause();
    expect(lastAudio.calls).toEqual([['pause']]);
    ambiencePlayer.resume();
    expect(lastAudio.calls).toEqual([['pause'], ['play']]);
  });
});

describe('T7 volume across arms', () => {
  it('setVolume drives a live audio element and the 0-100 percent youtube ledger with the same clamps', () => {
    armQueue([LOCAL_ROW]);
    ambiencePlayer.setVolume(0.5);
    expect(lastAudio.volume).toBe(0.5);
    ambiencePlayer.setVolume(1.5);
    expect(lastAudio.volume).toBe(1);

    armQueue([TOWN_A]); // clamped 1.5 -> 100 pending rides the youtube boot flush
    readyPlayer();
    ambiencePlayer.setVolume(-1);
    ambiencePlayer.setVolume(0.499); // Math.round(49.9) => 50
    expect(lastPlayer.calls).toEqual([['setVolume', 100], ['loadVideoById', TOWN_A.src], ['setVolume', 0], ['setVolume', 50]]);
  });
});

describe('T6 dispose and generation guard', () => {
  it('drops destroy for never-ready players, destroys ready players once, tears the audio down, and ignores late events from a destroyed generation', () => {
    ambiencePlayer.ensurePlayer('yt-music-frame');
    ambiencePlayer.playTracks([TOWN_A]);
    const neverReady = lastPlayer;
    ambiencePlayer.dispose();
    expect(neverReady.calls).toEqual([]); // destroy gated on ready

    ambiencePlayer.playTracks([TOWN_A, TOWN_B]);
    ambiencePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    ambiencePlayer.playTracks([LOCAL_ROW], 'test-campaign'); // audio element now live
    const audioBeforeDispose = lastAudio;
    const staleEvents = lastPlayer.options.events;
    ambiencePlayer.dispose();
    expect(audioBeforeDispose.calls).toEqual([
      ['src', '/campaigns/test-campaign/audio/amb-1700000000000-abcdef.mp3'],
      ['play'],
      ['pause'],
      ['removeAttribute', 'src'],
      ['load'],
    ]);

    ambiencePlayer.playTracks([OUT_A, OUT_B]);
    ambiencePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    staleEvents.onStateChange({ data: 0 }); // stale-generation ENDED must not advance new queue
    staleEvents.onError({ data: 100 }); // stale-generation error must not advance either
    expect(loads()).toEqual([['loadVideoById', OUT_A.src]]); // generation guard LIVE
  });

  it('state changes are inert when window.YT has vanished (unguarded-deref guard)', () => {
    armQueue([TOWN_A]);
    readyPlayer();
    const events = lastPlayer.options.events;
    delete window.YT;
    events.onStateChange({ data: 1 }); // without the guard this TypeErrors on PlayerState destructure
    events.onStateChange({ data: 0 }); // ENDED equally inert past the guard
    expect(lastPlayer.calls).toEqual([['loadVideoById', TOWN_A.src]]); // golden silent-return pinned: no throw, no dispatch
  });
});

describe('input guards', () => {
  it('playTracks rejects the falsy triple with console.error but passes empty-string ids raw to the SDK', () => {
    armQueue([TOWN_A]);
    readyPlayer();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ambiencePlayer.playTracks([]);
    ambiencePlayer.playTracks(null);
    ambiencePlayer.playTracks(undefined);
    expect(spy).toHaveBeenCalledTimes(3); // falsy triple each logged
    expect(spy).toHaveBeenCalledWith('playTracks called with no tracks');
    expect(loads()).toEqual([['loadVideoById', TOWN_A.src]]);
    ambiencePlayer.playTracks([{ kind: 'youtube', src: '', title: '' }]); // quirk pin: guard is length===0 only — '' passes byte-verbatim to the documented-API arg slot (id validation lives upstream in extractVideoId/MusicPlayer lanes)
    expect(loads()).toEqual([['loadVideoById', TOWN_A.src], ['loadVideoById', '']]);
    expect(spy).toHaveBeenCalledTimes(3); // '' addendum logged nothing
  });
});
