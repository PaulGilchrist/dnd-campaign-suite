// @maintained-by-ai: 2026-11-08
/* Lane: TV tracker music transport (improve 2026-11-08 EM backlog). While the
 * full-screen tracker is up, the header shows a minimal Pause/Stop transport
 * whenever a mood is armed — driven through the SAME lanes as the sidebar
 * MusicPlayer (top-level `music` change-data writes + type:'music' audit
 * rows, bytes shared via musicTransport.js). Stopped = zero chrome; a
 * read-only LAN visitor (non-localhost) gets the chip-only face. */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TvMusicTransport from './TvMusicTransport.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

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
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    if (opts.method === 'POST' && String(url).endsWith('/music')) {
      const body = JSON.parse(opts.body);
      const incoming = 'value' in body ? body.value : body;
      server = { ...server, ...incoming };
      return { ok: true, status: 200, json: async () => ({ music: server, message: 'Music saved successfully' }) };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
  return () => server;
}

// Simulate the SSE echo of another window's commit (skipSync).
function remoteMusic(music) {
  act(() => {
    setRuntimeObject('campaign', { music }, 'test-campaign', true);
  });
}

const transport = (container) => container.querySelector('.tv-music-transport');

function renderTransport(props = {}) {
  return render(<TvMusicTransport campaignName="test-campaign" isLocalhost {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TvMusicTransport conditional faces', () => {
  it('shows nothing while no mood is armed (minimal footprint)', () => {
    stubMusicServer();
    const { container } = renderTransport();
    expect(transport(container)).toBeNull();

    remoteMusic({ mood: null, playing: false, volume: 0.6, overrides: {} });
    expect(transport(container)).toBeNull();
  });

  it('playing face: mood chip + Pause + Stop, no resume button', () => {
    stubMusicServer();
    const { container } = renderTransport();
    remoteMusic({ mood: 'tavern', playing: true, volume: 0.6, overrides: {} });

    expect(transport(container)).not.toBeNull();
    expect(screen.getByTitle('Pause')).not.toBeNull();
    expect(screen.getByTitle('Stop')).not.toBeNull();
    expect(screen.queryByTitle('Play')).toBeNull();
    expect(screen.getByTitle('Pause').querySelector('i')).toHaveClass('fa-pause');
    expect(container.textContent).toContain('Tavern');
  });

  it('paused face: Stop only (no Pause/resume control)', () => {
    stubMusicServer();
    const { container } = renderTransport();
    remoteMusic({ mood: 'tavern', playing: false, volume: 0.6, overrides: {} });

    expect(transport(container)).not.toBeNull();
    expect(screen.queryByTitle('Pause')).toBeNull();
    expect(screen.queryByTitle('Play')).toBeNull();
    expect(screen.getByTitle('Stop')).not.toBeNull();
    expect(container.textContent).toContain('Tavern (paused)');
  });

  it('read-only visitor face: chip-only mood indicator, no operable buttons', () => {
    stubMusicServer();
    const { container } = renderTransport({ isLocalhost: false });
    remoteMusic({ mood: 'tavern', playing: true, volume: 0.6, overrides: {} });

    const chip = container.querySelector('.music-remote-note');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('Tavern ambience playing');
    expect(container.querySelectorAll('button')).toHaveLength(0);

    remoteMusic({ mood: 'tavern', playing: false, volume: 0.6, overrides: {} });
    expect(chip.textContent).toContain('Tavern ambience paused');
  });

  it('labels custom categories from the merged catalogue', () => {
    stubMusicServer();
    const { container } = renderTransport();
    remoteMusic({
      mood: 'custom-boss-fight',
      playing: true,
      volume: 0.6,
      overrides: {},
      customCategories: { 'custom-boss-fight': { label: 'Boss Fight', icon: 'fa-khanda' } },
    });
    expect(container.textContent).toContain('Boss Fight');
  });
});

describe('TvMusicTransport shared lanes (byte-consistent with the sidebar)', () => {
  it('header Pause writes {mood kept, playing:false} + the Paused audit row', async () => {
    const server = stubMusicServer({ mood: 'tavern', playing: true });
    renderTransport();
    remoteMusic({ mood: 'tavern', playing: true, volume: 0.6, overrides: {} });
    fireEvent.click(screen.getByTitle('Pause'));

    await vi.waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    expect(server()).toMatchObject({ mood: 'tavern', playing: false });
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'music',
      action: 'pause',
      mood: 'tavern',
      message: 'Paused Tavern ambience',
    });
  });

  it('header Stop un-arms the mood + logs "Stopped ambience", collapsing the chrome', async () => {
    const server = stubMusicServer({ mood: 'tavern', playing: true });
    const { container } = renderTransport();
    remoteMusic({ mood: 'tavern', playing: true, volume: 0.6, overrides: {} });
    fireEvent.click(screen.getByTitle('Stop'));

    await vi.waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    expect(server()).toMatchObject({ mood: null, playing: false });
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'music',
      action: 'stop',
      message: 'Stopped ambience',
    });
    expect(transport(container)).toBeNull(); // live collapse — no reload
  });

  it('adopts remote transitions live: a paused session never shows a Pause button', () => {
    stubMusicServer();
    const { container } = renderTransport();
    remoteMusic({ mood: 'tavern', playing: true, volume: 0.6, overrides: {} });
    expect(screen.getByTitle('Pause')).not.toBeNull();

    remoteMusic({ mood: 'tavern', playing: false, volume: 0.6, overrides: {} }); // remote pause
    expect(screen.queryByTitle('Pause')).toBeNull();
    expect(screen.getByTitle('Stop')).not.toBeNull();

    remoteMusic({ mood: null, playing: false, volume: 0.6, overrides: {} }); // remote stop
    expect(transport(container)).toBeNull();
  });
});
