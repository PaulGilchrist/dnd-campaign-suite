import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as youtubePlayer from './youtubePlayer.js';

function makeMockPlayer() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  const player = {
    calls,
    loadVideoById: record('loadVideoById'),
    pauseVideo: record('pauseVideo'),
    playVideo: record('playVideo'),
    stopVideo: record('stopVideo'),
    setVolume: record('setVolume'),
    destroy: record('destroy'),
  };
  return player;
}

let lastPlayer;

function readyPlayer() {
  lastPlayer.options.events.onReady();
}

function fireState(state) {
  lastPlayer.options.events.onStateChange({ data: state });
}

beforeEach(() => {
  youtubePlayer._resetForTests();
  lastPlayer = null;
  window.YT = {
    PlayerState: { UNSTARTED: -1, PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 },
    Player: function (elementId, options) {
      lastPlayer = makeMockPlayer();
      lastPlayer.elementId = elementId;
      lastPlayer.options = options;
      return lastPlayer;
    },
  };
});

afterEach(() => {
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  youtubePlayer._resetForTests();
});

describe('ensurePlayer', () => {
  it('creates the player immediately when the API is already loaded', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    expect(lastPlayer).toBeTruthy();
    expect(lastPlayer.elementId).toBe('yt-music-frame');
  });

  it('does not create a second player on repeat calls', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    const first = lastPlayer;
    youtubePlayer.ensurePlayer('yt-music-frame');
    expect(lastPlayer).toBe(first);
  });

  it('loads the API script and defers creation until onYouTubeIframeAPIReady', () => {
    delete window.YT;
    youtubePlayer.ensurePlayer('yt-music-frame');
    const scripts = [...document.head.querySelectorAll('script')].filter(s => s.src.includes('youtube.com/iframe_api'));
    expect(scripts.length).toBe(1);
    expect(lastPlayer).toBeFalsy();
    window.YT = {
      PlayerState: { UNSTARTED: -1, PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 },
      Player: function (elementId, options) {
        lastPlayer = makeMockPlayer();
        lastPlayer.elementId = elementId;
        lastPlayer.options = options;
        return lastPlayer;
      },
    };
    window.onYouTubeIframeAPIReady();
    expect(lastPlayer.elementId).toBe('yt-music-frame');
  });
});

describe('ready gating', () => {
  it('does not send commands to the player before it is ready', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    youtubePlayer.playTracks(['aaaaaaaaaaa']);
    youtubePlayer.setVolume(0.5);
    youtubePlayer.pause();
    youtubePlayer.resume();
    expect(lastPlayer.calls.length).toBe(0);

    readyPlayer();
    expect(lastPlayer.calls).toContainEqual(['loadVideoById', 'aaaaaaaaaaa']);
    expect(lastPlayer.calls).toContainEqual(['setVolume', 50]);
  });

  it('stop before ready clears intent so nothing auto-plays', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    youtubePlayer.playTracks(['aaaaaaaaaaa']);
    youtubePlayer.stop();
    readyPlayer();
    expect(lastPlayer.calls).not.toContainEqual(['loadVideoById', 'aaaaaaaaaaa']);
    expect(lastPlayer.calls).not.toContainEqual(['stopVideo']);
  });

  it('buffers tracks requested before the player exists', () => {
    youtubePlayer.playTracks(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    youtubePlayer.ensurePlayer('yt-music-frame');
    expect(lastPlayer.calls.length).toBe(0);
    readyPlayer();
    expect(lastPlayer.calls).toContainEqual(['loadVideoById', 'aaaaaaaaaaa']);
  });

  it('drops destroy requests for a player that never became ready', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    youtubePlayer.dispose();
    expect(lastPlayer.calls).not.toContainEqual(['destroy']);
  });
});

describe('playTracks', () => {
  it('loads the first track by id', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(lastPlayer.calls).toEqual([['loadVideoById', 'aaaaaaaaaaa']]);
  });

  it('logs an error and does nothing with an empty list', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks([]);
    expect(spy).toHaveBeenCalled();
    expect(lastPlayer.calls.length).toBe(0);
    spy.mockRestore();
  });
});

describe('queue looping', () => {
  beforeEach(() => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    youtubePlayer.playTracks(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('advances to the next track when a track ends', () => {
    fireState(window.YT.PlayerState.ENDED);
    expect(lastPlayer.calls).toContainEqual(['loadVideoById', 'bbbbbbbbbbb']);
  });

  it('loops back to the first track after the last one ends', () => {
    fireState(window.YT.PlayerState.ENDED);
    fireState(window.YT.PlayerState.ENDED);
    fireState(window.YT.PlayerState.ENDED);
    const loads = lastPlayer.calls.filter(c => c[0] === 'loadVideoById').map(c => c[1]);
    expect(loads).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('does not advance after stop', () => {
    youtubePlayer.stop();
    fireState(window.YT.PlayerState.ENDED);
    expect(lastPlayer.calls.filter(c => c[0] === 'loadVideoById')).toEqual([['loadVideoById', 'aaaaaaaaaaa']]);
    expect(lastPlayer.calls).toContainEqual(['stopVideo']);
  });

  it('skips to the next track on playback error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    lastPlayer.options.events.onError({ data: 101 });
    expect(lastPlayer.calls).toContainEqual(['loadVideoById', 'bbbbbbbbbbb']);
    spy.mockRestore();
  });
});

describe('controls', () => {
  beforeEach(() => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
  });

  it('forward pause/resume to the player', () => {
    youtubePlayer.pause();
    youtubePlayer.resume();
    expect(lastPlayer.calls).toContainEqual(['pauseVideo']);
    expect(lastPlayer.calls).toContainEqual(['playVideo']);
  });

  it('sets volume as a clamped percentage', () => {
    youtubePlayer.setVolume(0.5);
    youtubePlayer.setVolume(1.5);
    youtubePlayer.setVolume(-1);
    expect(lastPlayer.calls).toContainEqual(['setVolume', 50]);
    expect(lastPlayer.calls).toContainEqual(['setVolume', 100]);
    expect(lastPlayer.calls).toContainEqual(['setVolume', 0]);
  });
});

describe('subscribe', () => {
  it('notifies listeners of playing state changes and honours unsubscribe', () => {
    youtubePlayer.ensurePlayer('yt-music-frame');
    readyPlayer();
    const seen = [];
    const off = youtubePlayer.subscribe(s => seen.push(s));
    youtubePlayer.playTracks(['aaaaaaaaaaa']);
    fireState(window.YT.PlayerState.PLAYING);
    expect(youtubePlayer.isPlayingNow()).toBe(true);
    expect(seen).toEqual([{ playing: true }]);
    off();
    youtubePlayer.stop();
    expect(seen.length).toBe(1);
    expect(youtubePlayer.isPlayingNow()).toBe(false);
  });
});
