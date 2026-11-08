// @maintained-by-ai: 2026-11-08
// Regression lock for improve 2026-10-29-AE (music-editor-dirty-cancel-guard),
// migrated off native window.confirm onto the shared DeleteConfirmModal
// role="dialog" tier by backlog 2026-11-08 EK (friendly-fire precedent).
// The inline track editor's Cancel and mood-select paths silently discarded a
// typed-but-unsaved draft; now they pay the house NAMED discard through the
// shared useReloadGuard dirty check (six .ct-* lanes 4d4b1e69a + wizard
// 4569f2d67 parity), copy `Discard changes to the <Mood> track list?` naming
// the mood being LEFT, rendered VERBATIM inside the role=dialog. Cancel is
// fully inert (editor + draft byte-intact, zero network, zero log rows);
// accept closes / re-seeds. Clean drafts stay silent, and Save/Reset keep
// their existing lanes — since backlog 2026-11-08 EM BOTH stay open and
// re-baseline the guard (saved/seeded text never looks dirty). Harness mirrors MusicPlayer.toast.test.jsx (server-truth fetch stub
// records POSTs so "writes nothing" is provable).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
// The editor's own Cancel (outside any dialog). While the discard modal is
// open there are TWO "Cancel" buttons — always scope dialog clicks via
// dialogCancel below.
const cancelButton = () => screen.getByText('Cancel');
const discardDialog = () => screen.getByRole('dialog', { name: 'Discard Changes?' });
const dialogConfirm = () => within(discardDialog()).getByRole('button', { name: 'Yes, Discard' });
const dialogCancel = () => within(discardDialog()).getByRole('button', { name: 'Cancel' });

const openEditor = () => {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return textarea();
};

const typeDraft = (value) => {
  fireEvent.change(textarea(), { target: { value } });
};

describe('MusicPlayer dirty-Cancel / mood-switch named discard (role=dialog)', () => {
  let confirmSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    getStore('campaign').delete('music');
    // The migrated lane must never touch a native dialog (criterion 4).
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty draft + Cancel: opens the role=dialog discard modal naming the edited mood; native confirm never fires', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://www.youtube.com/watch?v=zzzzzzzzzzz');

    fireEvent.click(cancelButton());

    const dialog = discardDialog();
    expect(within(dialog).getByText('Discard changes to the Town track list?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Yes, Discard' })).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('dirty draft + Cancel: modal Cancel is fully inert — editor + draft byte-intact, zero writes, zero log rows', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://www.youtube.com/watch?v=zzzzzzzzzzz');
    const postsBefore = stub.posts.length;

    fireEvent.click(cancelButton());
    fireEvent.click(dialogCancel());

    expect(dialogExists()).toBe(false);
    expect(textarea()).toBeInTheDocument();
    expect(textarea().value).toBe('https://www.youtube.com/watch?v=zzzzzzzzzzz');
    expect(stub.posts.length).toBe(postsBefore);
    expect(getStore('campaign').get('music')).toBeUndefined();
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('dirty draft + Cancel: accept closes, discards the draft, persists nothing; reopen shows the saved value', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('typed-and-abandoned');

    fireEvent.click(cancelButton());
    fireEvent.click(dialogConfirm());

    expect(screen.queryByText('Cancel')).toBeNull();
    expect(stub.posts).toHaveLength(0);
    expect(getStore('campaign').get('music')).toBeUndefined();

    // Reopen: the abandoned draft is gone, the saved (default) value shows.
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    expect(textarea().value).toBe(TOWN_SEED);
    expect(confirmSpy).not.toHaveBeenCalled(); // reopen is a plain open, no prompt
  });

  it('mood switch while dirty: names the mood being LEFT; modal Cancel keeps the Town draft and leaves the reverted select', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('unsaved town draft');

    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });

    const dialog = discardDialog();
    expect(within(dialog).getByText('Discard changes to the Town track list?')).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    // The select value reverted the moment the prompt armed; dismiss keeps
    // the edit on the original mood: select stays, draft intact.
    expect(moodSelect().value).toBe('town');
    fireEvent.click(dialogCancel());
    expect(moodSelect().value).toBe('town');
    expect(textarea().value).toBe('unsaved town draft');
    expect(stub.posts).toHaveLength(0);
  });

  it('mood switch while dirty: accept re-seeds the new mood, and the fresh seed cancels silently', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('unsaved town draft');

    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });
    fireEvent.click(dialogConfirm());

    expect(moodSelect().value).toBe('tavern');
    expect(textarea().value).toBe(TAVERN_SEED);

    // Re-baselined on the new mood: Cancel from here is clean → silent.
    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('clean editor: Cancel and mood switch stay silent — no dialog, behavior unchanged', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();

    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });
    expect(textarea().value).toBe(TAVERN_SEED);

    fireEvent.click(cancelButton());
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Save lane stays open: dirty save fires NO dialog, keeps the textarea, and re-baselines the guard', async () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://youtu.be/aaaaaaaaaaa');

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town tracks saved — keep editing'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(stub.server().overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa']);
    // Editor mounted, content persisted (backlog 2026-11-08 EM).
    expect(textarea()).toBeInTheDocument();
    expect(textarea().value).toBe('https://youtu.be/aaaaaaaaaaa');
  });

  it('saved text counts as SAVED: Cancel right after a successful Save closes silently (no discard prompt)', async () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://youtu.be/aaaaaaaaaaa');
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town tracks saved'));

    // Guard re-baselined on the saved draft: nothing is dirty, Cancel is clean.
    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
    // Write landed exactly once; nothing was discarded on close.
    expect(stub.posts).toHaveLength(1);
    expect(stub.server().overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa']);
  });

  it('re-saving the SAME content in the still-open editor succeeds with an idempotent second write', async () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('aaaaaaaaaaa');
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town tracks saved'));

    // Second Save of byte-identical content: no ghost-dirty state, no error,
    // editor still open, server row unchanged.
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(stub.posts).toHaveLength(2));
    expect(document.querySelector('.music-editor-error')).toBeNull();
    expect(textarea()).toBeInTheDocument();
    expect(textarea().value).toBe('aaaaaaaaaaa');
    expect(stub.server().overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa']);

    // And the re-baseline held through the second save: Cancel stays silent.
    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('Reset lane unchanged and re-baselines: Reset then Cancel is dialog-free', async () => {
    stubMusicServer({ overrides: { town: [{ videoId: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] } });
    getStore('campaign').set('music', {
      mood: null, playing: false, volume: 0.6,
      overrides: { town: [{ videoId: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] },
    });
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor(); // seeds the override 'aaaaaaaaaaa'
    typeDraft('dirty on top of the override');

    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town overrides reset to defaults'));
    expect(textarea().value).toBe(TOWN_SEED);
    // Guard re-baselined on the defaults: closing now is a clean discard.
    fireEvent.click(cancelButton());
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
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

function dialogExists() {
  return document.querySelector('[role="dialog"]') !== null;
}
