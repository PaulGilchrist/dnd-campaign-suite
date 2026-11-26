// @maintained-by-ai: 2026-11-20
/* Lane: owner-teardown release (bug-music-owner-window-gone-claims-playing-elsewhere).
 * When the ONLY tab holding the .yt-music-frame reloads or closes, React's
 * unmount lane never runs, so the shared 'music' key used to keep
 * playing:true with zero frames anywhere — every surviving tab then claimed
 * "Playing in another window" for table-wide silence, and the only recovery
 * (Pause) wrote a false `Paused <Mood> ambience` audit row. The fix mirrors
 * the savePrompt liveness precedent: `pagehide` fires keepalive POSTs that
 * release the claim with the exact unmount-lane bytes (stopCommit state +
 * the `Stopped ambience (left campaign)` row), and ONLY from the tab that
 * owns the frame while playing. These pins lock:
 *   1. owner pagehide → keepalive stop commit + honest left-campaign row;
 *   2. a stand-down tab (no frame) never releases a foreign owner's claim;
 *   3. a paused owner (playing:false) writes nothing on unload;
 *   4. after a normal SPA unmount the listener is gone — pagehide adds no
 *      second release (the unmount lane already wrote one). */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/ambiencePlayer.js', () => ({
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

// Server-truth stub mirroring the music route merge; records every /music and
// /log POST with its keepalive flag (log rows reach the server ONLY via the
// keepalive lane here — addEntry rides the mocked logService).
function stubMusicServer(initialMusic) {
  let server = {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
    ...(initialMusic || {}),
  };
  const posts = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    const isMusic = String(url).endsWith('/music');
    const isLog = String(url).endsWith('/log');
    if (opts.method === 'POST' && (isMusic || isLog)) {
      posts.push({ lane: isMusic ? 'music' : 'log', body, keepalive: opts.keepalive === true });
      if (isMusic) {
        const incoming = 'value' in body ? body.value : body;
        server = { ...server, ...incoming };
        return { ok: true, status: 200, json: async () => ({ music: server, message: 'Music saved successfully' }) };
      }
      return { ok: true, status: 200, json: async () => body };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
  return {
    server: () => server,
    keepalivePosts: () => posts.filter(p => p.keepalive),
  };
}

const pagehide = () => act(() => window.dispatchEvent(new Event('pagehide')));
const townButton = () => screen.getByTitle('Play Town ambience');

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer owner pagehide release', () => {
  it('the owning tab releases the shared claim with keepalive bytes on pagehide (reload/close)', () => {
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton()); // this tab owns the frame, playing:true

    pagehide();

    const posts = server.keepalivePosts();
    expect(posts.map(p => p.lane).sort()).toEqual(['log', 'music']);

    const stop = posts.find(p => p.lane === 'music');
    expect(stop.body.value).toMatchObject({ mood: null, playing: false });

    const row = posts.find(p => p.lane === 'log');
    expect(row.body).toEqual({
      type: 'music', action: 'stop', message: 'Stopped ambience (left campaign)'
    });

    // shared truth after teardown: stopped, not a dead playing:true
    expect(server.server()).toMatchObject({ mood: null, playing: false });
  });

  it('a stand-down tab (no local frame) never releases another window\'s live claim', () => {
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    // foreign play (SSE-echo path): store says playing, this tab holds no frame
    act(() => {
      setRuntimeObject('campaign', { music: { mood: 'town', playing: true, volume: 0.6, overrides: {}, customCategories: {} } }, 'test-campaign', true);
    });

    pagehide();

    expect(server.keepalivePosts()).toEqual([]);
  });

  it('a PAUSED owner (claim already false) writes nothing on unload', () => {
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Pause'));

    pagehide();

    expect(server.keepalivePosts()).toEqual([]);
  });

  it('after a normal SPA unmount the listener is gone — pagehide never double-releases', () => {
    const server = stubMusicServer();
    const { unmount } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());

    unmount(); // unmount lane already commits the stop + row via the normal lanes
    pagehide();

    expect(server.keepalivePosts()).toEqual([]);
  });
});
