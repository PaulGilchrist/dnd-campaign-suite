// @maintained-by-ai: 2026-10-29
/* Lane: remote-ownership chip (backlog 2026-10-29-AF). Post-576be121d the
 * stand-down tab's transport WORKS (its Pause commands the owner), but its UI
 * was indistinguishable from the owning tab's. The chip is pure derived
 * render state: `playing && !playerMounted` → show "Playing in another
 * window"; the owner (frame mounted) or a stopped session never shows it.
 * Remote transitions ride the same setRuntimeObject(skipSync) SSE-echo path
 * as the adoption tests, so appear/disappear/ownership-move are exercised
 * live without a remount. */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

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

// Server-truth stub mirroring the music route merge (see adoption tests).
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
const chip = (container) => container.querySelector('.music-remote-note');

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer remote-ownership chip', () => {
  it('is absent when nothing is playing', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    expect(chip(container)).toBeNull();
  });

  it('is absent on the owning tab while it plays (frame mounted)', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    expect(frame(container)).not.toBeNull();
    expect(chip(container)).toBeNull();
  });

  it('shows on the stand-down tab when another tab starts playing, naming remote playback', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    remoteMusic({ mood: 'town', playing: true, volume: 0.6, overrides: {} });

    expect(frame(container)).toBeNull();
    const note = chip(container);
    expect(note).not.toBeNull();
    expect(note.textContent).toContain('Playing in another window');
  });

  it('disappears live when the owner pauses (playing:false, no reload)', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    remoteMusic({ mood: 'town', playing: true, volume: 0.6, overrides: {} });
    expect(chip(container)).not.toBeNull();

    remoteMusic({ mood: 'town', playing: false, volume: 0.6, overrides: {} }); // remote pause
    expect(chip(container)).toBeNull();

    remoteMusic({ mood: null, playing: false, volume: 0.6, overrides: {} }); // remote stop
    expect(chip(container)).toBeNull();
  });

  it('disappears when ownership MOVES here (remote pause, then local resume adopts)', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    remoteMusic({ mood: 'town', playing: true, volume: 0.6, overrides: {} });
    expect(chip(container)).not.toBeNull();

    remoteMusic({ mood: 'town', playing: false, volume: 0.6, overrides: {} }); // remote pause
    fireEvent.click(screen.getByTitle('Play')); // local resume adopts ownership

    expect(frame(container)).not.toBeNull();
    expect(chip(container)).toBeNull();
  });

  it('is absent on a stopped tab and never flashes on a local play click', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton()); // local commit arms the frame in the same pass
    expect(chip(container)).toBeNull();

    fireEvent.click(screen.getByTitle('Stop')); // local stop
    expect(chip(container)).toBeNull();
  });
});
