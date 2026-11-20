// @maintained-by-ai: 2026-11-20
/* Lane: local-stop frame unmount (improve 2026-11-20 backlog).
 * The remote-adoption lane has always torn the frame down on a FOREIGN stop
 * (youtubePlayer.stop + setPlayerMounted(false) → mount-effect cleanup
 * disposes), but this tab's OWN Stop click and delete-active-category lane
 * committed the same bytes while leaving the silent .yt-music-frame mounted —
 * frame-count lied about ownership on the last actor tab and a dead embed
 * lived until the next remote arm. These pins lock the mirrored unmount:
 *   1. local Stop unmounts + disposes while the shared bytes and the single
 *      `Stopped ambience` row land EXACTLY as before;
 *   2. delete-while-playing keeps the evict chain byte-identical (stopCommit
 *      POST, single PATCH evicting both maps, delete row) AND unmounts;
 *   3. a re-arm after a local stop freshly re-mounts exactly one frame
 *      (lazy-mount path after unmount, no stale second frame);
 *   4. the pagehide guard (playerMounted && playing) writes NOTHING after a
 *      local stop — the claim was already released by the Stop click. */
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
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

// Server-truth stub mirroring the music route merge (remote-adoption harness);
// records every /music POST body so the commit sequence stays byte-pinned.
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

// Store hydration mirror of the stub's initial doc (custom-categories harness).
function seedStore(initialMusic) {
  getStore('campaign').set('music', {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
    ...(initialMusic || {}),
  });
}

function mount(initialMusic) {
  const stub = stubMusicServer(initialMusic);
  seedStore(initialMusic);
  const result = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
  return { ...result, ...stub };
}

const townButton = () => screen.getByTitle('Play Town ambience');
const stopButton = () => screen.getByTitle('Stop');
const frameCount = (container) => container.querySelectorAll('.yt-music-frame').length;
const loggedActions = () => mockAddEntry.mock.calls.map(([, entry]) => entry.action);
const pagehide = () => act(() => window.dispatchEvent(new Event('pagehide')));

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer local Stop unmounts the frame', () => {
  it('Stop releases this tab\'s frame exactly like the remote lane, bytes and row unchanged', () => {
    const { container, posts, server } = mount();
    fireEvent.click(townButton());
    expect(frameCount(container)).toBe(1);

    fireEvent.click(stopButton());

    // unmount mirrors the remote-release bytes: stop + setPlayerMounted(false)
    // → mount-effect cleanup disposes the embed
    expect(youtubePlayer.stop).toHaveBeenCalledTimes(1);
    expect(frameCount(container)).toBe(0);
    expect(youtubePlayer.dispose).toHaveBeenCalledTimes(1);

    // shared bytes land exactly as before: arm POST then the stopCommit POST
    expect(posts).toHaveLength(2);
    expect(posts[1]).toMatchObject({ mood: null, playing: false });
    expect(server()).toMatchObject({ mood: null, playing: false });

    // exactly one honest audit row, byte-identical message
    expect(loggedActions()).toEqual(['set_ambience', 'stop']);
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'music', action: 'stop', message: 'Stopped ambience'
    }));
  });

  it('re-arming a mood chip after a local stop freshly mounts exactly one frame', () => {
    const { container, server } = mount();
    fireEvent.click(townButton());
    fireEvent.click(stopButton());
    expect(frameCount(container)).toBe(0);

    fireEvent.click(townButton()); // lazy-mount path works after unmount

    expect(frameCount(container)).toBe(1); // no stale second frame
    expect(youtubePlayer.ensurePlayer).toHaveBeenCalledTimes(2); // fresh embed
    expect(youtubePlayer.playTracks).toHaveBeenLastCalledWith(expect.any(Array));
    expect(server()).toMatchObject({ mood: 'town', playing: true });
    expect(loggedActions()).toEqual(['set_ambience', 'stop', 'set_ambience']);
  });

  it('a reload after a local stop writes nothing — the claim was already released', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(townButton());
    fireEvent.click(stopButton());

    pagehide(); // guard reads playerMounted && playing — both false now

    const fetchCalls = globalThis.fetch.mock.calls.filter(
      ([, opts]) => opts?.method === 'POST' && opts.keepalive === true
    );
    expect(fetchCalls).toEqual([]);
    // the only POSTs remain the arm + stop commits from the click lane
    expect(stub.posts).toHaveLength(2);
  });
});

describe('MusicPlayer delete-active-category unmounts the frame', () => {
  const CRYPT = {
    overrides: { 'custom-crypt': [{ videoId: 'aAAAAAAAAAA', title: 'a' }], tavern: [{ videoId: 'b', title: 'b' }] },
    customCategories: { 'custom-crypt': { label: 'Crypt' } },
  };

  it('evict chain byte-identical AND the acting tab drops its frame', async () => {
    const { container, posts, server } = mount(CRYPT);
    fireEvent.click(screen.getByTitle('Play Crypt ambience')); // this tab owns the frame
    expect(frameCount(container)).toBe(1);

    fireEvent.click(screen.getByLabelText('Delete Crypt category'));
    const dialog = screen.getByRole('dialog', { name: 'Delete Music Category' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Delete Category' }));

    await waitFor(() => expect(getStore('campaign').get('music').customCategories['custom-crypt']).toBeUndefined());

    // existing evict chain untouched: stopCommit POST precedes the single
    // PATCH carrying BOTH maps, and NO stop row (the delete lane owns the row)
    expect(posts).toHaveLength(3);
    expect(posts[1]).toMatchObject({ mood: null, playing: false });
    const patch = posts[2];
    expect(patch.customCategories).toEqual({});
    expect(patch.overrides).toEqual({ tavern: [{ videoId: 'b', title: 'b' }] });
    expect(server()).toMatchObject({ mood: null, playing: false });
    expect(server().customCategories).toEqual({});
    expect(loggedActions()).toEqual(['set_ambience', 'delete_category']);
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'music', action: 'delete_category', mood: 'custom-crypt',
      message: 'Deleted music category Crypt'
    }));
    await waitFor(() => expect(document.querySelector('.music-toast')).toHaveTextContent('Category Crypt deleted'));

    // NEW: the acting tab releases its frame exactly like the remote lane
    expect(youtubePlayer.stop).toHaveBeenCalledTimes(1);
    expect(frameCount(container)).toBe(0);
    expect(youtubePlayer.dispose).toHaveBeenCalledTimes(1);
  });

  it('serializes the evict: the stop POST resolves BEFORE the PATCH dispatches (no overwrite race)', async () => {
    // Live 2026-11-20 race witness: replaying the two lane bytes as CONCURRENT
    // posts resurrected the deleted category 6/6 (the full transport POST
    // carries the stale maps and the /music merge is last-write-wins). The
    // chain must stay the documented ORDER, not just the documented bytes.
    const timeline = [];
    let server = { mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {}, ...CRYPT };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
      if (opts.method === 'POST' && String(url).endsWith('/music')) {
        const body = JSON.parse(opts.body);
        const incoming = 'value' in body ? body.value : body;
        const kind = 'value' in body ? (body.value.playing ? 'arm-FULL' : 'stop-FULL') : 'evict-PATCH';
        timeline.push(`dispatch:${kind}`);
        if (kind === 'stop-FULL') {
          // a SLOW stop response: if the PATCH raced instead of serialized,
          // it would dispatch (and land) before this write finished
          await new Promise((res) => setTimeout(res, 50));
        }
        server = { ...server, ...incoming };
        if (kind !== 'arm-FULL') timeline.push(`landed:${kind}`);
        return { ok: true, status: 200, json: async () => ({ music: server, message: 'Music saved successfully' }) };
      }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    });
    seedStore(CRYPT);
    const { container } = render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.click(screen.getByTitle('Play Crypt ambience'));
    fireEvent.click(screen.getByLabelText('Delete Crypt category'));
    timeline.length = 0; // drop the arm POST records
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Music Category' })).getByRole('button', { name: 'Yes, Delete Category' }));

    await waitFor(() => expect(timeline).toContain('landed:evict-PATCH'));
    expect(timeline).toEqual([
      'dispatch:stop-FULL', 'landed:stop-FULL', 'dispatch:evict-PATCH', 'landed:evict-PATCH'
    ]);
    expect(server.customCategories).toEqual({});
    expect(frameCount(container)).toBe(0);
  });

  it('deleting an INACTIVE category keeps the frame of the mood still playing', async () => {
    const { container } = mount(CRYPT);
    fireEvent.click(townButton()); // owner frame on Town, Crypt is inactive

    fireEvent.click(screen.getByLabelText('Delete Crypt category'));
    const dialog = screen.getByRole('dialog', { name: 'Delete Music Category' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Delete Category' }));

    await waitFor(() => expect(getStore('campaign').get('music').customCategories['custom-crypt']).toBeUndefined());

    // Town keeps playing — the unmount belongs to the ACTIVE-mood arm only
    expect(frameCount(container)).toBe(1);
    expect(youtubePlayer.stop).not.toHaveBeenCalled();
  });
});
