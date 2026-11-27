// @maintained-by-ai 2026-11-26
/* Lane: remote-ownership chip (backlog 2026-10-29-AF). Post-576be121d the
 * stand-down tab's transport WORKS (its Pause commands the owner), but its UI
 * was indistinguishable from the owning tab's. The chip is pure derived
 * render state: `playing && !playerMounted` → show "Playing in another
 * window"; the owner (frame mounted) or a stopped session never shows it.
 * Remote transitions ride the same setRuntimeObject(skipSync) SSE-echo path
 * as the adoption tests, so appear/disappear/ownership-move are exercised
 * live without a remount. Transport COMMANDS on these transitions belong to
 * MusicPlayer.remote-adoption.test.jsx — this file asserts only the chip. */
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
  it('never shows on the owning tab: absent at rest, absent while its mounted frame plays (no flash on the play click)', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    expect(chip(container)).toBeNull(); // at rest (nothing playing)

    fireEvent.click(townButton()); // local commit arms the frame in the same pass
    expect(frame(container)).not.toBeNull();
    expect(chip(container)).toBeNull(); // frame mounted → we are the owner
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

  it('disappears live when the owner pauses, and stays gone through a remote stop (no reload)', () => {
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
    expect(chip(container)).toBeNull(); // adoption echo must not re-show the chip
  });

  it('never flashes when the local tab stops (frame unmounts while music clears)', () => {
    stubMusicServer();
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Stop')); // local stop

    expect(frame(container)).toBeNull();
    expect(chip(container)).toBeNull(); // unmount ordering must not expose playing && !frame
  });
});
