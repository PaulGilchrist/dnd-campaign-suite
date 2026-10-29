// @maintained-by-ai: 2026-10-29
/* Lane: remote music-state adoption (bug-music-player-no-remote-state-adoption).
 * The shared 'music' campaign key mirrors across tabs via SSE, but the YouTube
 * player is a per-tab singleton — so a transition committed by ANOTHER client
 * must drive this tab's module: pause on remote pause, stop+unmount on remote
 * stop AND on foreign play (only the acting tab mounts/plays, so every other
 * tab releases its frame — no double audio, no UI claiming a state the local
 * module was never commanded to). Own commits are skipped via the localMusic
 * ref guard, and mounting with a persisted state is a baseline, not a
 * transition. Remote echoes are simulated through setRuntimeObject(skipSync)
 * — the exact path the SSE apply uses. */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
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

// Server-truth stub mirroring the music route merge (see queue-exhausted test).
function stubMusicServer(initialMusic) {
  let server = {
    mood: null, playing: false, volume: 0.6, overrides: {},
    ...(initialMusic || {}),
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    if (opts.method === 'POST' && String(url).endsWith('/music')) {
      const body = JSON.parse(opts.body);
      const incoming = 'value' in body ? body.value : body;
      server = { ...server, ...incoming };
      return { ok: true, status: 200, json: async () => ({ music: server, message: 'Music saved successfully' }) };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
  return { server: () => server };
}

// Simulate the SSE echo of another tab's commit (skipSync = server already
// holds it; notifies useSyncedState listeners exactly like the SSE apply).
function remoteMusic(music) {
  act(() => {
    setRuntimeObject('campaign', { music }, 'test-campaign', true);
  });
}

const townButton = () => screen.getByTitle('Play Town ambience');
const frame = (container) => container.querySelector('.yt-music-frame');
const loggedActions = () => mockAddEntry.mock.calls.map(([, entry]) => entry.action);

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer remote-state adoption', () => {
  it('pauses the local player when another tab pauses the ambience', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton()); // this tab owns the frame
    expect(youtubePlayer.pause).not.toHaveBeenCalled();

    remoteMusic({ mood: 'town', playing: false, volume: 0.6, overrides: {} });

    expect(youtubePlayer.pause).toHaveBeenCalledTimes(1); // module actually commanded
    expect(youtubePlayer.stop).not.toHaveBeenCalled();
    expect(frame(container)).not.toBeNull(); // pause keeps the frame for resume
    // the remote echo itself logs nothing — the acting tab owns the log row
    expect(loggedActions()).toEqual(['set_ambience']);
  });

  it('never re-commands the player for this tab\'s own commits (SSE echo skip)', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Pause')); // local pause
    expect(youtubePlayer.pause).toHaveBeenCalledTimes(1); // once by handler, not twice by echo
    fireEvent.click(screen.getByTitle('Play')); // local resume
    expect(youtubePlayer.resume).toHaveBeenCalledTimes(1);
    expect(youtubePlayer.stop).not.toHaveBeenCalled();
  });

  it('releases this tab\'s frame when another tab starts ambience (no double audio)', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    expect(frame(container)).not.toBeNull();

    remoteMusic({ mood: 'combat', playing: true, volume: 0.6, overrides: {} });

    expect(youtubePlayer.stop).toHaveBeenCalledTimes(1);
    expect(frame(container)).toBeNull(); // unmounted → mount-effect cleanup disposes
    expect(youtubePlayer.dispose).toHaveBeenCalledTimes(1);
  });

  it('stops and unmounts when another tab stops the ambience', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());

    remoteMusic({ mood: null, playing: false, volume: 0.6, overrides: {} });

    expect(youtubePlayer.stop).toHaveBeenCalledTimes(1);
    expect(frame(container)).toBeNull();
  });

  it('a non-owning tab never self-mounts or self-plays on a foreign play', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    remoteMusic({ mood: 'town', playing: true, volume: 0.6, overrides: {} });

    expect(frame(container)).toBeNull();
    expect(youtubePlayer.playTracks).not.toHaveBeenCalled();
    expect(youtubePlayer.ensurePlayer).not.toHaveBeenCalled();
  });

  it('mounting on a persisted playing state is a baseline — commands nothing and mounts nothing', () => {
    stubMusicServer();
    getStore('campaign').set('music', { mood: 'town', playing: true, volume: 0.6, overrides: {} });
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    expect(youtubePlayer.stop).not.toHaveBeenCalled();
    expect(youtubePlayer.pause).not.toHaveBeenCalled();
    expect(frame(container)).toBeNull();
  });

  it('logs pause and resume rows so the audit trail shows who commanded the transport', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Pause'));
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'music', action: 'pause', mood: 'town', message: 'GM paused Town ambience'
    }));

    fireEvent.click(screen.getByTitle('Play'));
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'music', action: 'resume', mood: 'town', message: 'GM resumed Town ambience'
    }));
  });
});
