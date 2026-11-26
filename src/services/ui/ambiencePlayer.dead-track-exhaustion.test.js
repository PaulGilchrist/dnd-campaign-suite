// @maintained-by-ai: 2026-11-25
/**
 * ambiencePlayer.js — dead-track queue-exhaustion lane
 * (bug-music-dead-track-infinite-skip-loop; Item 3 made the queue
 * arm-heterogeneous — failures from EITHER arm feed one ledger).
 *
 * A queue whose tracks all fail back-to-back (YouTube error 150 = embedding
 * disabled — live-repro id Me9VLOSaJkg; locally-hosted files: media error /
 * blocked play()) must STOP after one full queue-pass of consecutive failures
 * — never the old infinite load → error → skip → modulo-wrap loop — and
 * dispatch 'music-queue-exhausted' exactly once (detail { srcs }) so
 * MusicPlayer can un-arm the mood.
 *
 * Stub rig mirrors ambiencePlayer.test.js: documented YT IFrame API boundary
 * stubs (pure recorders) + FakeAudio for the local arm, manual deferreds, NO
 * timers (repo no-game-timers mandate untouched). Catalog fixtures are REAL
 * disk bytes from musicConfig.js MOODS — drift throws.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as ambiencePlayer from './ambiencePlayer.js';
import { MOODS } from './musicConfig.js';

const DEAD_ROW = { kind: 'youtube', src: 'Me9VLOSaJkg', title: 'Me9VLOSaJkg' }; // the live-repro embedding-disabled id (error 150)
const DEAD_LOCAL = { kind: 'local', src: 'audio/amb-1-broken.mp3', title: 'broken' };
// YouTube-only fixture rows: Item 3b heads the starter moods with bundled
// /audio/ beds; this file's scenarios are all about the YouTube arm.
const [TOWN_A, TOWN_B] = MOODS[0].tracks.filter((t) => t.kind === 'youtube');

let lastPlayer;

function makeRecPlayer() {
  // exact-of-6 census of methods the engine calls; pure recorders.
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
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: function (elementId, options) {
      lastPlayer = makeRecPlayer();
      lastPlayer.elementId = elementId;
      lastPlayer.options = options;
      return lastPlayer;
    },
  };
}

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
function fireError(code) {
  lastPlayer.options.events.onError({ data: code });
}

const loads = () => lastPlayer.calls.filter((c) => c[0] === 'loadVideoById');
const stopCalls = () => lastPlayer.calls.filter((c) => c[0] === 'stopVideo');

let exhaustedEvents;
let removeListener;
let errorSpy;

beforeEach(() => {
  ambiencePlayer._resetForTests();
  lastPlayer = null;
  lastAudio = null;
  installYTStub();
  vi.stubGlobal('Audio', FakeAudio);
  exhaustedEvents = [];
  removeListener = ((listener) => {
    window.addEventListener('music-queue-exhausted', listener);
    return () => window.removeEventListener('music-queue-exhausted', listener);
  })((event) => exhaustedEvents.push(event.detail));
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  removeListener();
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  ambiencePlayer._resetForTests();
});

function armQueue(rows) {
  ambiencePlayer.playTracks(rows, 'test-campaign');
  ambiencePlayer.ensurePlayer('yt-music-frame');
}

describe('dead-track exhaustion cap', () => {
  it('single dead track stops on the FIRST error: one load, one stopVideo, one event — the wrap reload is gone', () => {
    armQueue([DEAD_ROW]);
    readyPlayer();

    fireError(150); // documented code: embedding disabled

    expect(errorSpy).toHaveBeenCalledWith(
      `YouTube playback error (code 150) for video ${DEAD_ROW.src}. No playable tracks left — stopping.`
    );
    expect(loads()).toEqual([['loadVideoById', DEAD_ROW.src]]); // exactly ONE cue — no modulo re-load
    expect(stopCalls()).toEqual([['stopVideo']]);
    expect(exhaustedEvents).toEqual([{ srcs: [DEAD_ROW.src] }]);

    // late errors after the armed stop must never re-cue, re-stop, or re-notify
    errorSpy.mockClear();
    fireError(150);
    fireError(150);
    expect(loads()).toHaveLength(1);
    expect(stopCalls()).toHaveLength(1);
    expect(exhaustedEvents).toHaveLength(1);
  });

  it('two dead tracks skip once then stop at the queue-length cap, carrying both failed ids', () => {
    armQueue([DEAD_ROW, TOWN_A]); // both unplayable in this scenario
    readyPlayer();

    fireError(150); // first failure (1 < 2) — honest skip to the NEXT track
    expect(loads()).toEqual([['loadVideoById', DEAD_ROW.src], ['loadVideoById', TOWN_A.src]]);
    expect(exhaustedEvents).toHaveLength(0);
    errorSpy.mockClear();

    fireError(101); // second consecutive failure completes the queue-pass — terminal
    expect(errorSpy).toHaveBeenCalledWith(
      `YouTube playback error (code 101) for video ${TOWN_A.src}. No playable tracks left — stopping.`
    );
    expect(loads()).toHaveLength(2); // no third (wrapping) load
    expect(stopCalls()).toEqual([['stopVideo']]);
    expect(exhaustedEvents).toEqual([{ srcs: [DEAD_ROW.src, TOWN_A.src] }]);
  });

  it('a track that reaches PLAYING clears the streak — mixed queues keep cycling and never exhaust', () => {
    armQueue([DEAD_ROW, TOWN_A]); // TOWN_A is playable
    readyPlayer();

    fireError(150); // DEAD fails (1 < 2) -> skip to TOWN_A
    fireState(1); // TOWN_A PLAYING -> streak reset
    fireState(0); // TOWN_A ENDED -> wrap back to DEAD
    fireError(150); // DEAD fails again — streak restarted, still (1 < 2): skip, not terminal

    expect(exhaustedEvents).toHaveLength(0);
    expect(loads()).toEqual([
      ['loadVideoById', DEAD_ROW.src],
      ['loadVideoById', TOWN_A.src],
      ['loadVideoById', DEAD_ROW.src],
      ['loadVideoById', TOWN_A.src], // the one playable track keeps its turn in the mix
    ]);
  });

  it('playTracks resets the streak — a fresh mood selection gets its full queue-pass budget', () => {
    armQueue([DEAD_ROW, TOWN_A]);
    readyPlayer();
    fireError(150); // streak 1 (skip lands on TOWN_A)
    ambiencePlayer.playTracks([DEAD_ROW, TOWN_B], 'test-campaign'); // GM re-picks: streak cleared, new queue

    fireError(150); // fresh streak 1 of 2 — skip, not terminal
    expect(exhaustedEvents).toHaveLength(0);
    expect(loads()).toEqual([
      ['loadVideoById', DEAD_ROW.src],
      ['loadVideoById', TOWN_A.src],
      ['loadVideoById', DEAD_ROW.src],
      ['loadVideoById', TOWN_B.src],
    ]);

    fireError(150); // fresh queue-pass completes -> terminal, once
    expect(exhaustedEvents).toEqual([{ srcs: [DEAD_ROW.src, TOWN_B.src] }]);
  });

  it('user-pressed stop notifies nobody — only exhaustion dispatches the event', () => {
    armQueue([DEAD_ROW, TOWN_A]);
    readyPlayer();
    fireError(150); // streak 1 of 2
    ambiencePlayer.stop(); // GM stops mid-streak
    expect(exhaustedEvents).toHaveLength(0);

    fireError(150); // stray post-stop error — intentStopped lane, silent on the event bus
    expect(exhaustedEvents).toHaveLength(0);
    expect(stopCalls()).toEqual([['stopVideo']]); // exactly the user stop
  });

  it('local-arm failures share the one ledger: dead local + dead youtube exhaust together', () => {
    armQueue([DEAD_LOCAL, DEAD_ROW]);

    // local media error (404/undecodable) — failure 1 of 2, skip to the youtube row
    lastAudio.fire('error');
    expect(exhaustedEvents).toHaveLength(0);
    readyPlayer(); // the youtube boot the skip requested flushes the current row
    expect(loads()).toEqual([['loadVideoById', DEAD_ROW.src]]); // skipped onto the youtube row
    errorSpy.mockClear();

    fireError(150); // failure 2 of 2 across BOTH arms — terminal, event carries both srcs
    expect(errorSpy).toHaveBeenCalledWith(
      `YouTube playback error (code 150) for video ${DEAD_ROW.src}. No playable tracks left — stopping.`
    );
    expect(exhaustedEvents).toEqual([{ srcs: [DEAD_LOCAL.src, DEAD_ROW.src] }]);
  });
});
