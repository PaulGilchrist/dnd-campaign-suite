// @maintained-by-ai: 2026-10-29
/* Lane: mood un-arm on 'music-queue-exhausted' (bug-music-dead-track-infinite-skip-loop).
 * When youtubePlayer reports every track failed back-to-back, the component
 * must flip the synced 'music' key to { mood:null, playing:false } (honest
 * server-first write, not a local lie), toast naming the mood, and log a
 * no_playable_tracks campaign row. The fetch stub mirrors the server music
 * route's intent-split merge (see MusicPlayer.toast.test.jsx). */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import * as youtubePlayer from '../../services/ui/youtubePlayer.js';

vi.mock('../../services/ui/youtubePlayer.js', () => ({
  ensurePlayer: vi.fn(),
  playTracks: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  setVolume: vi.fn(),
  dispose: vi.fn(),
}));

const mockAddEntry = vi.fn().mockResolvedValue({});
vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: (...args) => mockAddEntry(...args),
}));

// Server-truth stub: merge-only, echo { music } like campaigns-changedata's POST.
function stubMusicServer(initialMusic) {
  let server = {
    mood: null, playing: false, volume: 0.6, overrides: {},
    ...(initialMusic || {}),
  };
  const posts = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    if (opts.method === 'POST' && String(url).endsWith('/music')) {
      const body = JSON.parse(opts.body);
      const incoming = 'value' in body ? body.value : body;
      posts.push(incoming);
      server = { ...server, ...incoming };
      return { ok: true, status: 200, json: async () => ({ music: server, message: 'Music saved successfully' }) };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
  return { posts, server: () => server };
}

function musicState() {
  return getStore('campaign').get('music');
}

const townButton = () => screen.getByTitle('Play Town ambience');
const toastNode = () => document.querySelector('.music-toast');

function dispatchExhausted(videoIds) {
  act(() => {
    window.dispatchEvent(new CustomEvent('music-queue-exhausted', { detail: { videoIds } }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer queue-exhaustion un-arm', () => {
  it('un-arms the mood server-first, toasts the failure naming the mood, and logs a no_playable_tracks row', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    expect(musicState()).toMatchObject({ mood: 'town', playing: true });

    dispatchExhausted(['Me9VLOSaJkg']);

    // honest UI: error toast naming the mood
    expect(toastNode()).toHaveTextContent('No playable tracks for Town ambience');
    expect(toastNode()).toHaveClass('music-toast-error');
    // mood un-armed locally AND on the server (the lying "playing" state is gone)
    expect(musicState()).toMatchObject({ mood: null, playing: false });
    expect(stub.posts.at(-1)).toMatchObject({ mood: null, playing: false });
    expect(stub.server()).toMatchObject({ mood: null, playing: false });
    expect(townButton()).not.toHaveClass('active');
    // campaign log records the exhaustion with the failed ids
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'music',
      action: 'no_playable_tracks',
      mood: 'town',
      message: 'GM ambience stopped — no playable tracks for Town (Me9VLOSaJkg)'
    }));
  });

  it('a fresh mood click after exhaustion re-arms and replays the queue normally', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    dispatchExhausted(['Me9VLOSaJkg']);
    expect(musicState()).toMatchObject({ mood: null, playing: false });

    fireEvent.click(townButton());

    expect(youtubePlayer.playTracks).toHaveBeenCalledTimes(2);
    expect(musicState()).toMatchObject({ mood: 'town', playing: true });
    expect(townButton()).toHaveClass('active');
  });

  it('unmount removes the listener — a late exhaustion event writes nothing', () => {
    const stub = stubMusicServer();
    const { unmount } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    const postsAfterPlay = stub.posts.length;
    unmount();

    dispatchExhausted(['Me9VLOSaJkg']);

    expect(stub.posts).toHaveLength(postsAfterPlay); // no orphan server write
    expect(toastNode()).toBeNull();
  });
});
