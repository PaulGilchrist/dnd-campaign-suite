// @maintained-by-ai: 2026-10-29
/**
 * youtubePlayer.js — dead-track queue-exhaustion lane
 * (bug-music-dead-track-infinite-skip-loop).
 *
 * A queue whose tracks all fail back-to-back (YouTube error 150 = embedding
 * disabled — live-repro id Me9VLOSaJkg) must STOP after one full queue-pass
 * of consecutive failures — never the old infinite load → error → skip →
 * modulo-wrap loop — and dispatch 'music-queue-exhausted' exactly once (with
 * the failed ids) so MusicPlayer can un-arm the mood.
 *
 * Stub rig mirrors youtubePlayer.test.js: documented YT IFrame API boundary
 * stubs (pure recorders), manual deferreds, NO timers (repo no-game-timers
 * mandate untouched). Catalog fixtures are REAL disk bytes from
 * musicConfig.js MOODS — drift throws.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as youtubePlayer from './youtubePlayer.js';
import { MOODS } from './musicConfig.js';

const DEAD = 'Me9VLOSaJkg'; // the live-repro embedding-disabled id (error 150)
const [TOWN_A, TOWN_B] = MOODS[0].tracks.map((t) => t.videoId);

let lastPlayer;

function makeRecPlayer() {
  // exact-of-6 census of methods youtubePlayer.js calls; pure recorders.
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
  youtubePlayer._resetForTests();
  lastPlayer = null;
  installYTStub();
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
  vi.restoreAllMocks();
  youtubePlayer._resetForTests();
});

describe('dead-track exhaustion cap', () => {
  it('single dead track stops on the FIRST error: one load, one stopVideo, one event — the wrap reload is gone', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([DEAD]);

    fireError(150); // documented code: embedding disabled

    expect(errorSpy).toHaveBeenCalledWith(
      `YouTube playback error (code 150) for video ${DEAD}. No playable tracks left — stopping.`
    );
    expect(loads()).toEqual([['loadVideoById', DEAD]]); // exactly ONE cue — no modulo re-load
    expect(stopCalls()).toEqual([['stopVideo']]);
    expect(exhaustedEvents).toEqual([{ videoIds: [DEAD] }]);

    // late errors after the armed stop must never re-cue, re-stop, or re-notify
    errorSpy.mockClear();
    fireError(150);
    fireError(150);
    expect(loads()).toHaveLength(1);
    expect(stopCalls()).toHaveLength(1);
    expect(exhaustedEvents).toHaveLength(1);
  });

  it('two dead tracks skip once then stop at the queue-length cap, carrying both failed ids', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([DEAD, TOWN_A]); // both unplayable in this scenario

    fireError(150); // first failure (1 < 2) — honest skip to the NEXT track
    expect(loads()).toEqual([['loadVideoById', DEAD], ['loadVideoById', TOWN_A]]);
    expect(exhaustedEvents).toHaveLength(0);
    errorSpy.mockClear();

    fireError(101); // second consecutive failure completes the queue-pass — terminal
    expect(errorSpy).toHaveBeenCalledWith(
      `YouTube playback error (code 101) for video ${TOWN_A}. No playable tracks left — stopping.`
    );
    expect(loads()).toHaveLength(2); // no third (wrapping) load
    expect(stopCalls()).toEqual([['stopVideo']]);
    expect(exhaustedEvents).toEqual([{ videoIds: [DEAD, TOWN_A] }]);
  });

  it('a track that reaches PLAYING clears the streak — mixed queues keep cycling and never exhaust', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([DEAD, TOWN_A]); // TOWN_A is playable

    fireError(150); // DEAD fails (1 < 2) -> skip to TOWN_A
    fireState(1); // TOWN_A PLAYING -> streak reset
    fireState(0); // TOWN_A ENDED -> wrap back to DEAD
    fireError(150); // DEAD fails again — streak restarted, still (1 < 2): skip, not terminal

    expect(exhaustedEvents).toHaveLength(0);
    expect(loads()).toEqual([
      ['loadVideoById', DEAD],
      ['loadVideoById', TOWN_A],
      ['loadVideoById', DEAD],
      ['loadVideoById', TOWN_A], // the one playable track keeps its turn in the mix
    ]);
  });

  it('playTracks resets the streak — a fresh mood selection gets its full queue-pass budget', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([DEAD, TOWN_A]);
    fireError(150); // streak 1 (skip lands on TOWN_A)
    youtubePlayer.playTracks([DEAD, TOWN_B]); // GM re-picks: streak cleared, new queue

    fireError(150); // fresh streak 1 of 2 — skip, not terminal
    expect(exhaustedEvents).toHaveLength(0);
    expect(loads()).toEqual([
      ['loadVideoById', DEAD],
      ['loadVideoById', TOWN_A],
      ['loadVideoById', DEAD],
      ['loadVideoById', TOWN_B],
    ]);

    fireError(150); // fresh queue-pass completes -> terminal, once
    expect(exhaustedEvents).toEqual([{ videoIds: [DEAD, TOWN_B] }]);
  });

  it('user-pressed stop notifies nobody — only exhaustion dispatches the event', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([DEAD, TOWN_A]);
    fireError(150); // streak 1 of 2
    youtubePlayer.stop(); // GM stops mid-streak
    expect(exhaustedEvents).toHaveLength(0);

    fireError(150); // stray post-stop error — intentStopped lane, silent on the event bus
    expect(exhaustedEvents).toHaveLength(0);
    expect(stopCalls()).toEqual([['stopVideo']]); // exactly the user stop
  });
});
