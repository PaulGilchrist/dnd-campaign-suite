// @maintained-by-ai: 2026-10-29
// Regression lock for improve 2026-10-29-AE (music-editor-dirty-cancel-guard):
// the inline track editor's Cancel and mood-select paths silently discarded a
// typed-but-unsaved draft. Now they pay the house NAMED discard through the
// shared useReloadGuard (six .ct-* lanes 4d4b1e69a + wizard 4569f2d67 parity),
// copy `Discard changes to the <Mood> track list?` naming the mood being LEFT.
// Dismiss is fully inert (editor + draft byte-intact, zero network); accept
// closes / re-seeds. Clean drafts stay silent, and Save/Reset keep their
// existing lanes (Reset re-baselines so the fresh defaults don't look dirty).
// Harness mirrors MusicPlayer.toast.test.jsx (server-truth fetch stub records
// POSTs so "writes nothing" is provable).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Server-truth stub: merge-only, echo { music } like campaigns-changedata's
// POST. `posts` records every write so dismiss/accept lanes prove disk-silence.
function stubMusicServer(initialMusic) {
  let server = {
    mood: null, playing: false, volume: 0.6, overrides: {},
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

// Town starter ids (musicConfig.js catalogue) — the seed the editor opens on.
const TOWN_SEED = 'q9yaKpYS9qc\no-b5nMCj5hI';
const TAVERN_SEED = 'vyg5jJrZ42s\n2P8J7Cx1plA';

const textarea = () => screen.getByPlaceholderText('One YouTube URL or video ID per line');
const moodSelect = () => screen.getByLabelText('Mood');
const cancelButton = () => screen.getByText('Cancel');

const openEditor = () => {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return textarea();
};

const typeDraft = (value) => {
  fireEvent.change(textarea(), { target: { value } });
};

describe('MusicPlayer dirty-Cancel / mood-switch named discard', () => {
  let confirmSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    getStore('campaign').delete('music');
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty draft + Cancel: exactly ONE named confirm naming the edited mood', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://www.youtube.com/watch?v=zzzzzzzzzzz');

    fireEvent.click(cancelButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to the Town track list?');
  });

  it('dirty draft + Cancel: dismiss is fully inert — editor + draft byte-intact, zero writes, zero log rows', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://www.youtube.com/watch?v=zzzzzzzzzzz');
    const postsBefore = stub.posts.length;

    fireEvent.click(cancelButton());

    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to the Town track list?');
    expect(textarea()).toBeInTheDocument();
    expect(textarea().value).toBe('https://www.youtube.com/watch?v=zzzzzzzzzzz');
    expect(stub.posts.length).toBe(postsBefore);
    expect(getStore('campaign').get('music')).toBeUndefined();
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('dirty draft + Cancel: accept closes, discards the draft, persists nothing; reopen shows the saved value', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('typed-and-abandoned');
    confirmSpy.mockReturnValue(true);

    fireEvent.click(cancelButton());

    expect(screen.queryByText('Cancel')).toBeNull();
    expect(stub.posts).toHaveLength(0);
    expect(getStore('campaign').get('music')).toBeUndefined();

    // Reopen: the abandoned draft is gone, the saved (default) value shows.
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    expect(textarea().value).toBe(TOWN_SEED);
    expect(confirmSpy).toHaveBeenCalledTimes(1); // reopen is a plain open, no confirm
  });

  it('mood switch while dirty: names the mood being LEFT; dismiss keeps the Town draft and reverts the select', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('unsaved town draft');

    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to the Town track list?');
    // Dismiss keeps the edit on the original mood: select reverts, draft intact.
    expect(moodSelect().value).toBe('town');
    expect(textarea().value).toBe('unsaved town draft');
    expect(stub.posts).toHaveLength(0);
  });

  it('mood switch while dirty: accept re-seeds the new mood, and the fresh seed cancels silently', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('unsaved town draft');
    confirmSpy.mockReturnValue(true);

    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });

    expect(moodSelect().value).toBe('tavern');
    expect(textarea().value).toBe(TAVERN_SEED);

    // Re-baselined on the new mood: Cancel from here is clean → silent.
    fireEvent.click(cancelButton());
    expect(confirmSpy).toHaveBeenCalledTimes(1); // only the switch confirm
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('clean editor: Cancel and mood switch stay silent — behavior unchanged', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();

    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });
    expect(textarea().value).toBe(TAVERN_SEED);

    fireEvent.click(cancelButton());
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Save lane unchanged: dirty save closes with NO confirm (internal close)', async () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://youtu.be/aaaaaaaaaaa');

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.queryByText('Save')).toBeNull());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(stub.server().overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa']);
  });

  it('Reset lane unchanged and re-baselines: Reset then Cancel is confirm-free', async () => {
    stubMusicServer({ overrides: { town: [{ videoId: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] } });
    getStore('campaign').set('music', {
      mood: null, playing: false, volume: 0.6,
      overrides: { town: [{ videoId: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] },
    });
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor(); // seeds the override 'aaaaaaaaaaa'
    typeDraft('dirty on top of the override');
    confirmSpy.mockReturnValue(true);

    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town overrides reset to defaults'));
    expect(textarea().value).toBe(TOWN_SEED);
    // Guard re-baselined on the defaults: closing now is a clean discard.
    fireEvent.click(cancelButton());
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('remote-adoption guard stays inert for editor lanes (576be121d parity)', () => {
    // Typing in the editor must not touch the transport or commit music.
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('draft only');
    expect(youtubePlayer.playTracks).not.toHaveBeenCalled();
    expect(youtubePlayer.stop).not.toHaveBeenCalled();
    expect(stub.posts).toHaveLength(0);
  });
});
