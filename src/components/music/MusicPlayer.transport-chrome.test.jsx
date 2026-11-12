// @maintained-by-ai: 2026-11-12
/* Lane: stop-retires-chrome law (backlog 2026-11-12 NN). With no mood armed
 * the sidebar transport must render NO Play/Pause or Stop button in
 * .music-controls — the sidebar face of TvMusicTransport's conditional
 * ("nothing on the header while stopped"). Previously the pair lingered as
 * visible disabled buttons (a silent no-op since disabled never fires
 * onClick). Armed faces are unchanged: playing = Pause + Stop; paused =
 * Play (resume) + Stop; the volume slider + track editor stay in every
 * state. Commit/log bytes are untouched by the law — pinned here byte-exact
 * — and the conditional reacts live to both a local Stop and a remote
 * (SSE-echo) stop adoption, no remount. */
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

// Server-truth stub mirroring the music route merge (sidebar-test idiom).
function stubMusicServer(initialMusic) {
  let server = {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
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

// Simulate the SSE echo of another window's commit (skipSync = server already
// holds it; notifies useSyncedState listeners exactly like the SSE apply).
function remoteMusic(music) {
  act(() => {
    setRuntimeObject('campaign', { music }, 'test-campaign', true);
  });
}

const controls = (container) => container.querySelector('.music-controls');
const transportButtons = (container) =>
  [...controls(container).querySelectorAll('button')].map(b => b.title);
const townButton = () => screen.getByTitle('Play Town ambience');

function renderPlayer() {
  return render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer stop-retires-chrome law', () => {
  it('cold stop (no music stored): no Play/Pause/Stop in .music-controls, non-transport chrome stays', () => {
    stubMusicServer();
    const { container } = renderPlayer();

    expect(controls(container)).not.toBeNull();
    expect(transportButtons(container)).toEqual(['Edit tracks for this mood']);
    expect(screen.queryByTitle('Pause')).toBeNull();
    expect(screen.queryByTitle('Stop')).toBeNull();
    expect(screen.queryByTitle('Play')).toBeNull();
    expect(screen.getByTitle('Volume')).toBeInTheDocument();
    expect(screen.getByTitle('Edit tracks for this mood')).toBeInTheDocument();
  });

  it('a remote stop echo retires the chrome live (no remount)', () => {
    stubMusicServer();
    const { container } = renderPlayer();
    remoteMusic({ mood: 'town', playing: true, volume: 0.6, overrides: {} });
    expect(screen.getByTitle('Pause')).toBeInTheDocument();
    expect(screen.getByTitle('Stop')).toBeInTheDocument();

    remoteMusic({ mood: null, playing: false, volume: 0.6, overrides: {} }); // remote stop

    expect(transportButtons(container)).toEqual(['Edit tracks for this mood']);
    expect(screen.queryByTitle('Pause')).toBeNull();
    expect(screen.queryByTitle('Stop')).toBeNull();
  });

  it('playing face is unchanged: Pause + Stop render armed', () => {
    stubMusicServer();
    const { container } = renderPlayer();
    fireEvent.click(townButton());

    expect(transportButtons(container)).toEqual(['Pause', 'Stop', 'Edit tracks for this mood']);
    expect(screen.getByTitle('Pause').querySelector('i')).toHaveClass('fa-pause');
    expect(screen.getByTitle('Stop').querySelector('i')).toHaveClass('fa-stop');
    expect(screen.getByTitle('Pause')).toBeEnabled();
    expect(screen.getByTitle('Stop')).toBeEnabled();
  });

  it('paused face is unchanged: Play (resume) + Stop stay armed (Pause hides only while stopped)', () => {
    stubMusicServer();
    const { container } = renderPlayer();
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Pause')); // pause keeps the mood armed

    expect(transportButtons(container)).toEqual(['Play', 'Stop', 'Edit tracks for this mood']);
    expect(screen.getByTitle('Play').querySelector('i')).toHaveClass('fa-play');
    expect(screen.getByTitle('Stop')).toBeInTheDocument();
  });

  it('local Stop retires the chrome live and writes byte-identical commit + audit rows', async () => {
    const stub = stubMusicServer();
    const { container } = renderPlayer();
    fireEvent.click(townButton());
    expect(screen.getByTitle('Stop')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Stop'));

    expect(screen.queryByTitle('Stop')).toBeNull(); // live collapse — no reload
    expect(screen.queryByTitle('Pause')).toBeNull();
    expect(transportButtons(container)).toEqual(['Edit tracks for this mood']);

    // Unchanged music bucket + audit bytes (the law is chrome-only).
    await vi.waitFor(() => expect(stub.server()).toMatchObject({ mood: null, playing: false }));
    expect(mockAddEntry).toHaveBeenCalledTimes(2); // arm row + exactly one stop row
    expect(mockAddEntry).toHaveBeenNthCalledWith(1, 'test-campaign',
      expect.objectContaining({ type: 'music', action: 'set_ambience', mood: 'town' }));
    expect(mockAddEntry).toHaveBeenNthCalledWith(2, 'test-campaign', {
      type: 'music',
      action: 'stop',
      message: 'Stopped ambience',
    });
  });
});
