// @maintained-by-ai: 2026-11-20
/* Lane: no-op re-click guard (improve 2026-11-20 backlog). Clicking the chip
 * of an ALREADY-PLAYING mood used to re-run selectMood wholesale — a second
 * POST /music with identical bytes, a second byte-identical `Set ambience: …`
 * log row, and a playTracks restart from track 1 (observed live as two
 * identical Dungeon rows from two clicks on one visitor tab). selectMood now
 * returns early while `music.mood === moodKey && music.playing`. These pins
 * lock the guard and its regressions:
 *   1. active-chip re-click while PLAYING → zero writes, zero rows, no
 *      playTracks (the playlist is never restarted);
 *   2. clicking a DIFFERENT chip while something plays still arms it —
 *      exactly one write + one `Set ambience:` row;
 *   3. clicking the SAME chip while PAUSED is still a real restart — state
 *      genuinely flips playing:false→true, one write + one row;
 *   4. rapid double-click on an UNARMED mood: first click writes + logs,
 *      second is inert — including back-to-back clicks in ONE tick, where
 *      React has not re-rendered yet and the guard must read the ref that
 *      commitMusic stamps synchronously (zero extra writes/rows). */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import * as ambiencePlayer from '../../services/ui/ambiencePlayer.js';
import { MOODS } from '../../services/ui/musicConfig.js';

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

// Server-truth stub mirroring the music route merge; records every /music
// POST (the write lane) so a no-op click is proven by wire absence, not just
// by local state. Log rows ride the mocked logService (mockAddEntry).
function stubMusicServer() {
  let server = { mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {} };
  const musicPosts = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    if (opts.method === 'POST' && String(url).endsWith('/music')) {
      const body = JSON.parse(opts.body);
      musicPosts.push(body);
      server = { ...server, ...('value' in body ? body.value : body) };
      return { ok: true, status: 200, json: async () => ({ music: server, message: 'Music saved successfully' }) };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
  return { server: () => server, musicPosts: () => musicPosts };
}

const trackRows = (moodKey) => MOODS.find(m => m.key === moodKey).tracks;
const setAmbienceRows = () => mockAddEntry.mock.calls
  .map(([, entry]) => entry)
  .filter(entry => entry.action === 'set_ambience');

const townButton = () => screen.getByTitle('Play Town ambience');
const combatButton = () => screen.getByTitle('Play Combat ambience');

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer no-op re-click guard', () => {
  it('re-clicking the active chip while PLAYING writes nothing, logs nothing, and never restarts the playlist', () => {
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    expect(server.musicPosts()).toHaveLength(1);
    expect(setAmbienceRows()).toHaveLength(1);
    expect(ambiencePlayer.playTracks).toHaveBeenCalledTimes(1);

    fireEvent.click(townButton());
    expect(ambiencePlayer.playTracks).toHaveBeenCalledTimes(1);
    fireEvent.click(townButton());

    expect(server.musicPosts()).toHaveLength(1); // no second POST — the arm write stays the only one
    expect(setAmbienceRows()).toHaveLength(1);   // no duplicate `Set ambience: …` row
    expect(ambiencePlayer.playTracks).toHaveBeenCalledTimes(1); // playlist never restarts
    expect(ambiencePlayer.stop).not.toHaveBeenCalled();
    expect(ambiencePlayer.pause).not.toHaveBeenCalled();
    expect(getStore('campaign').get('music')).toMatchObject({ mood: 'town', playing: true });
  });

  it('clicking a DIFFERENT chip while something plays still arms it (one write, one row)', () => {
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());

    fireEvent.click(combatButton());

    expect(server.musicPosts()).toHaveLength(2);
    expect(setAmbienceRows()).toHaveLength(2);
    expect(setAmbienceRows()[1]).toMatchObject({ mood: 'combat' });
    expect(ambiencePlayer.playTracks).toHaveBeenLastCalledWith(trackRows('combat'), 'test-campaign');
    expect(getStore('campaign').get('music')).toMatchObject({ mood: 'combat', playing: true });
  });

  it('clicking the SAME chip while PAUSED is still a real restart (playing:false→true)', () => {
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Pause'));

    fireEvent.click(townButton());

    expect(server.musicPosts()).toHaveLength(3); // arm + pause + re-arm all ride the /music lane
    expect(setAmbienceRows()).toHaveLength(2);
    expect(ambiencePlayer.playTracks).toHaveBeenCalledTimes(2);
    expect(ambiencePlayer.playTracks).toHaveBeenLastCalledWith(trackRows('town'), 'test-campaign');
    expect(getStore('campaign').get('music')).toMatchObject({ mood: 'town', playing: true });
  });

  it('rapid double-click on an UNARMED mood: first click arms, second is inert', () => {
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    fireEvent.click(townButton());
    fireEvent.click(townButton());

    expect(server.musicPosts()).toHaveLength(1);
    expect(setAmbienceRows()).toHaveLength(1);
    expect(ambiencePlayer.playTracks).toHaveBeenCalledTimes(1);
  });

  it('back-to-back clicks in ONE tick (no React flush between them) still arm exactly once', () => {
    // Live 2026-11-20 improve: two el.click() dispatches in the same task run
    // their handlers before React re-renders — the second handler's `music`
    // closure is stale, so a byte-only guard double-logs (this exact shape
    // produced the two identical Dungeon rows). The guard reads localMusicRef,
    // which commitMusic stamps synchronously, and must stay inert.
    const server = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    act(() => {
      const first = townButton();
      first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(server.musicPosts()).toHaveLength(1);
    expect(setAmbienceRows()).toHaveLength(1);
    expect(ambiencePlayer.playTracks).toHaveBeenCalledTimes(1);
  });
});
