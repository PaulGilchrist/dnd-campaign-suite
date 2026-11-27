// @maintained-by-ai 2026-11-26
// Regression lock for the music editor's dirty Cancel / mood-switch guard
// (improve 2026-10-29-AE, migrated off native window.confirm onto the shared
// DeleteConfirmModal role="dialog" tier). The dirty check itself lives in
// useReloadGuard; per-mood naming is also pinned in the sibling files
// (active-mood-editor: Tavern, custom-categories: custom moods). This file
// owns the two decision lanes: modal Cancel is fully inert (editor + draft
// byte-intact, zero network, zero log rows) and accept closes / re-seeds.
// Clean, saved and reset drafts never prompt (backlog 2026-11-08 EM: Save and
// Reset stay open and re-baseline the guard). Harness mirrors
// MusicPlayer.toast.test.jsx (server-truth fetch stub records POSTs so
// "writes nothing" is provable).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
    // The migrated lane must never touch a native dialog.
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty draft + Cancel: modal names the edited mood; modal Cancel is fully inert — draft byte-intact, zero writes, zero log rows', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://www.youtube.com/watch?v=zzzzzzzzzzz');
    const postsBefore = stub.posts.length;

    fireEvent.click(cancelButton());

    const dialog = discardDialog();
    expect(within(dialog).getByText('Discard changes to the Town track list?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Yes, Discard' })).toBeInTheDocument();

    fireEvent.click(dialogCancel());

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(textarea()).toBeInTheDocument();
    expect(textarea().value).toBe('https://www.youtube.com/watch?v=zzzzzzzzzzz');
    expect(stub.posts.length).toBe(postsBefore);
    expect(getStore('campaign').get('music')).toBeUndefined();
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('dirty draft + Cancel: accept closes the editor, discards the draft, persists nothing; reopen shows the saved seed', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('typed-and-abandoned');

    fireEvent.click(cancelButton());
    fireEvent.click(dialogConfirm());

    expect(screen.queryByText('Cancel')).toBeNull();
    expect(stub.posts).toHaveLength(0);
    expect(getStore('campaign').get('music')).toBeUndefined();

    // Reopen: the abandoned draft is gone, the saved (default) value shows,
    // and the reopen itself is a plain open — no prompt.
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    expect(textarea().value).toBe(TOWN_SEED);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('mood switch while dirty: names the mood being LEFT; modal Cancel keeps the Town draft and leaves the reverted select', () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('unsaved town draft');

    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });

    const dialog = discardDialog();
    expect(within(dialog).getByText('Discard changes to the Town track list?')).toBeInTheDocument();
    // The select value reverted the moment the prompt armed.
    expect(moodSelect().value).toBe('town');

    fireEvent.click(dialogCancel());
    expect(moodSelect().value).toBe('town');
    expect(textarea().value).toBe('unsaved town draft');
    expect(stub.posts).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
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

  it('clean editor: mood switch and Cancel stay silent — no dialog, behavior unchanged', () => {
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

  it('Save stays open with no dialog, then Cancel closes silently — guard re-baselined on the saved draft, exactly one write', async () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    typeDraft('https://youtu.be/aaaaaaaaaaa');

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town tracks saved — keep editing'));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Editor mounted, content persisted (backlog 2026-11-08 EM); bundled
    // beds ride the whole-draft save.
    expect(textarea()).toBeInTheDocument();
    expect(textarea().value).toBe('https://youtu.be/aaaaaaaaaaa');
    expect(stub.server().overrides.town.map(t => t.src))
      .toEqual(['aaaaaaaaaaa', '/audio/town-theme.mp3', '/audio/fishing-village.mp3']);

    // Guard re-baselined on the saved draft: nothing is dirty, Cancel is
    // clean, and the close adds nothing to the single save write.
    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(stub.posts).toHaveLength(1);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Reset lane stays open and re-baselines: Reset then Cancel is dialog-free', async () => {
    stubMusicServer({ overrides: { town: [{ kind: 'youtube', src: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] } });
    getStore('campaign').set('music', {
      mood: null, playing: false, volume: 0.6,
      overrides: { town: [{ kind: 'youtube', src: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] },
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
});
