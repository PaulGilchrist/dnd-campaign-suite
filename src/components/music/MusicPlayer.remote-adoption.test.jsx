// @maintained-by-ai 2026-11-26
/* Lane: remote music-state adoption (bug-music-player-no-remote-state-adoption).
 * The shared 'music' campaign key mirrors across tabs via SSE, but the YouTube
 * player is a per-tab singleton — so a transition committed by ANOTHER client
 * must drive this tab's module: pause on remote pause, stop+unmount on remote
 * stop AND on foreign play (only the acting tab mounts/plays, so every other
 * tab releases its frame — no double audio, no UI claiming a state the local
 * module was never commanded to). Own commits are skipped via the localMusic
 * ref guard, and mounting with a persisted state is a baseline, not a
 * transition. Remote echoes are simulated through setRuntimeObject(skipSync)
 * — the exact path the SSE apply uses.
 * Volume lane (bug-music-volume-no-cross-tab-adoption): the same adoption
 * doctrine extended to the slider — remote volume live-mirrors into every
 * tab (and drives the owner's iframe via the existing setVolume effect), a
 * fresh mount/hydration seeds from the persisted value, and the echo of this
 * tab's own commit never clobbers its in-flight slider state. */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
import * as ambiencePlayer from '../../services/ui/ambiencePlayer.js';

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
    expect(ambiencePlayer.pause).not.toHaveBeenCalled();

    remoteMusic({ mood: 'town', playing: false, volume: 0.6, overrides: {} });

    expect(ambiencePlayer.pause).toHaveBeenCalledTimes(1); // module actually commanded
    expect(ambiencePlayer.stop).not.toHaveBeenCalled();
    expect(frame(container)).not.toBeNull(); // pause keeps the frame for resume
    // the remote echo itself logs nothing — the acting tab owns the log row
    expect(loggedActions()).toEqual(['set_ambience']);
  });

  it('commands the transport exactly once per own commit and logs the audit rows', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Pause')); // local pause
    expect(ambiencePlayer.pause).toHaveBeenCalledTimes(1); // once by handler, not twice by echo
    fireEvent.click(screen.getByTitle('Play')); // local resume
    expect(ambiencePlayer.resume).toHaveBeenCalledTimes(1);
    expect(ambiencePlayer.stop).not.toHaveBeenCalled();
    // own SSE echoes append no extra rows either — exactly one per command
    expect(loggedActions()).toEqual(['set_ambience', 'pause', 'resume']);
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'music', action: 'pause', mood: 'town', message: 'Paused Town ambience'
    }));
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'music', action: 'resume', mood: 'town', message: 'Resumed Town ambience'
    }));
  });

  it('releases this tab\'s frame when another tab starts ambience (no double audio)', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    expect(frame(container)).not.toBeNull();

    remoteMusic({ mood: 'combat', playing: true, volume: 0.6, overrides: {} });

    expect(ambiencePlayer.stop).toHaveBeenCalledTimes(1);
    expect(frame(container)).toBeNull(); // unmounted → mount-effect cleanup disposes
    expect(ambiencePlayer.dispose).toHaveBeenCalledTimes(1);
  });

  it('stops and unmounts when another tab stops the ambience', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());

    remoteMusic({ mood: null, playing: false, volume: 0.6, overrides: {} });

    expect(ambiencePlayer.stop).toHaveBeenCalledTimes(1);
    expect(frame(container)).toBeNull();
  });

  it('a non-owning tab never self-mounts or self-plays on a foreign play', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    remoteMusic({ mood: 'town', playing: true, volume: 0.6, overrides: {} });

    expect(frame(container)).toBeNull();
    expect(ambiencePlayer.playTracks).not.toHaveBeenCalled();
    expect(ambiencePlayer.ensurePlayer).not.toHaveBeenCalled();
  });

  it('mounting on a persisted playing state is a baseline — commands nothing and mounts nothing', () => {
    stubMusicServer();
    getStore('campaign').set('music', { mood: 'town', playing: true, volume: 0.6, overrides: {} });
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    expect(ambiencePlayer.stop).not.toHaveBeenCalled();
    expect(ambiencePlayer.pause).not.toHaveBeenCalled();
    expect(frame(container)).toBeNull();
  });
});

// bug-music-volume-no-cross-tab-adoption: volume was the write-only zombie
// field of the shared music key — a mount-time useState seed lost the async
// hydration race (and nothing re-seeded it), so remote writes AND fresh
// reloads ignored the persisted volume. These pin the adopt lane.
describe('MusicPlayer volume adoption', () => {
  const volumeInput = () => screen.getByTitle('Volume');

  it('seeds the slider from the persisted volume whether it arrives before or after mount', () => {
    stubMusicServer();
    getStore('campaign').set('music', { mood: null, playing: false, volume: 0.7, overrides: {} });
    const owned = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    expect(volumeInput().value).toBe('70'); // synchronous mount seed
    owned.unmount();

    getStore('campaign').delete('music');
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    expect(volumeInput().value).toBe('60'); // default before hydration arrives

    remoteMusic({ mood: null, playing: false, volume: 0.2, overrides: {} }); // hydration/SSE

    expect(volumeInput().value).toBe('20'); // re-seeded, not stuck at 60
  });

  it('mirrors remote volume into the owner\'s slider and iframe, and never re-commands on its own echo', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());

    fireEvent.change(volumeInput(), { target: { value: '30' } }); // local commit → 0.3
    expect(ambiencePlayer.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.3));
    ambiencePlayer.setVolume.mockClear();

    remoteMusic({ mood: 'town', playing: true, volume: 0.3, overrides: {} }); // self echo
    expect(ambiencePlayer.setVolume).not.toHaveBeenCalled(); // echo skipped, in-flight state intact

    remoteMusic({ mood: 'town', playing: true, volume: 0.45, overrides: {} }); // foreign change
    expect(volumeInput().value).toBe('45'); // live-mirrored into the slider...
    expect(ambiencePlayer.setVolume).toHaveBeenCalledTimes(1); // ...and the owner's iframe
    expect(ambiencePlayer.setVolume).toHaveBeenCalledWith(expect.closeTo(0.45));
  });
});
