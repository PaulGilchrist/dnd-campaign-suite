// @maintained-by-ai 2026-11-25
/* Lane: Music empty face (Item 7, audit F14). The mood chip row + transport
 * row left a big dead canvas with zero hint that ＋/pencil build tracks —
 * the audit's only "no empty state at all" view. The stop face now rides the
 * kit .ct-empty-state (icon + guidance, Sessions twin). The stop-retires-
 * chrome law (NN) is untouched: the chrome buttons stay, this is additive. */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/ambiencePlayer.js', () => ({
  ensurePlayer: vi.fn(),
  playTracks: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  setVolume: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: vi.fn().mockResolvedValue({}),
}));

function stubMusicServer() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
    ok: true, status: 200, json: async () => ({}), text: async () => '',
  }));
}

describe('MusicPlayer empty face (F14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStore('campaign').delete('music');
    stubMusicServer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stopped state shows the icon+guidance empty face naming the affordances', () => {
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    const empty = container.querySelector('.music-empty.ct-empty-state');
    expect(empty).not.toBeNull();
    expect(empty.querySelector('i')).not.toBeNull();
    expect(empty.textContent).toMatch(/pick a mood/i);
    expect(empty.textContent).toMatch(/pencil/i);
  });
});
