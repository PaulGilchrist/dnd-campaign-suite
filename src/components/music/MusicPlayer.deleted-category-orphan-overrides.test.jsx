// @maintained-by-ai: 2026-11-13
// Regression lock for bug-music-deleted-category-orphan-overrides: deleting a
// custom category while its editor lane held `editMood` never reset the mood,
// so reopening the editor re-seeded the dangling key — the controlled mood
// select silently rendered its FIRST option (displayed `Combat`) while Save
// wrote overrides under the invisible `custom-…` key, persisting an orphan
// track list for a deleted category. The fix resets editMood to the catalogue
// default in the delete commit (display and write target agree again) and
// refuses Save/Reset whenever the editor mood is missing from the merged
// catalogue (covers remote deletes from another tab). Harness mirrors
// MusicPlayer.custom-categories.test.jsx; remote echoes ride
// setRuntimeObject(skipSync) like the remote-adoption test.
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
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

// Server-truth stub: merge-only (like campaigns-changedata), echo { music }.
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

const musicState = () => getStore('campaign').get('music');
const textarea = () => screen.getByPlaceholderText('One YouTube URL or video ID per line');
const moodSelect = () => screen.getByLabelText('Tracks mood');
const deleteDialog = () => screen.getByRole('dialog', { name: 'Delete Music Category' });

function mount(initialMusic) {
  const stub = stubMusicServer(initialMusic);
  getStore('campaign').set('music', {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
    ...(initialMusic || {}),
  });
  render(<MusicPlayer campaignName="test-campaign" />);
  return stub;
}

// Empty-category shortcut: chip click opens the editor seeded on that mood.
const openEditorOnCrypt = () => fireEvent.click(screen.getByTitle('Add Crypt tracks'));

const confirmCategoryDelete = async (trigger) => {
  fireEvent.click(trigger());
  fireEvent.click(within(deleteDialog()).getByRole('button', { name: 'Yes, Delete Category' }));
  await waitFor(() => expect(musicState().customCategories['custom-crypt']).toBeUndefined());
};

const chipDelete = () => screen.getByLabelText('Delete Crypt category');
const editorDelete = () => document.querySelector('.music-editor-actions [title="Delete Crypt category"]');

// Tracks typed into the reopened editor must land under the mood the select
// DISPLAYS (catalogue default 'town'), never the deleted category's key.
const typeAndSave = async (videoId) => {
  fireEvent.change(textarea(), { target: { value: videoId } });
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(document.querySelector('.music-toast'))
    .toHaveTextContent('tracks saved'));
};

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer deleted-category editor-mood reset', () => {
  it('reopened editor after in-editor delete seeds a real mood and saves there — no orphan override', async () => {
    const { posts, server } = mount({ customCategories: { 'custom-crypt': { label: 'Crypt' } } });

    openEditorOnCrypt();
    expect(moodSelect().value).toBe('custom-crypt');
    fireEvent.change(textarea(), { target: { value: 'dQw4w9WgXcQ' } }); // typed, NOT saved
    await confirmCategoryDelete(editorDelete);

    // Editor closed with the delete.
    expect(screen.queryByPlaceholderText('One YouTube URL or video ID per line')).toBeNull();

    // Reopen: the select must show a mood that exists (no dangling value
    // rendering the first option while the state stays on the deleted key).
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    const select = moodSelect();
    expect(select.value).toBe('town');
    expect(select.querySelector('option[value="custom-crypt"]')).toBeNull();

    await typeAndSave('dQw4w9WgXcQ');

    // Write lands under the DISPLAYED mood; the deleted key never appears.
    expect(document.querySelector('.music-toast').textContent).toContain('Town tracks saved');
    const savePatch = posts[posts.length - 1];
    expect(savePatch.overrides).toEqual({ town: [{ videoId: 'dQw4w9WgXcQ', title: 'dQw4w9WgXcQ' }] });
    expect(server().overrides['custom-crypt']).toBeUndefined();
    expect(musicState().overrides['custom-crypt']).toBeUndefined();
    expect(server().overrides.town).toHaveLength(1);
  });

  it('chip-× delete with the editor CLOSED still resets a previously selected mood', async () => {
    mount({
      overrides: { 'custom-crypt': [{ videoId: 'aAAAAAAAAAA', title: 'a' }] },
      customCategories: { 'custom-crypt': { label: 'Crypt' } },
    });

    // Select the category in the editor, leave cleanly (clean draft = silent close).
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    fireEvent.change(moodSelect(), { target: { value: 'custom-crypt' } });
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('One YouTube URL or video ID per line')).toBeNull();

    await confirmCategoryDelete(chipDelete);

    // Reopen: falls back to the reset catalogue default, not the dangling key.
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    expect(moodSelect().value).toBe('town');
    expect(textarea().value).toBe('q9yaKpYS9qc\no-b5nMCj5hI'); // Town starter seed
  });

  it('discards-after-delete dialog names a real label, never the raw deleted key', async () => {
    mount({ customCategories: { 'custom-crypt': { label: 'Crypt' } } });

    openEditorOnCrypt();
    await confirmCategoryDelete(editorDelete);

    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    fireEvent.change(textarea(), { target: { value: 'dirty' } });
    fireEvent.change(moodSelect(), { target: { value: 'tavern' } });

    const dialog = screen.getByRole('dialog', { name: 'Discard Changes?' });
    expect(within(dialog).getByText('Discard changes to the Town track list?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  });

  describe('defense-in-depth: writes refused for a mood missing from the catalogue', () => {
    // The delete happened in ANOTHER tab — this tab's editMood stays on the
    // gone key because only THIS tab's delete lane resets it.
    const dangleCrypt = () => {
      const stub = mount({ customCategories: { 'custom-crypt': { label: 'Crypt' } } });
      openEditorOnCrypt();
      expect(moodSelect().value).toBe('custom-crypt');
      act(() => {
        setRuntimeObject('campaign', {
          music: { mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {} },
        }, 'test-campaign', true);
      });
      return stub;
    };

    it('Save refuses with inline copy and writes zero — no orphan override row', async () => {
      const { posts, server } = dangleCrypt();
      const postsBefore = posts.length;

      fireEvent.change(textarea(), { target: { value: 'dQw4w9WgXcQ' } });
      fireEvent.click(screen.getByText('Save'));

      expect(await screen.findByText('Mood "custom-crypt" no longer exists — pick a mood before saving')).toBeInTheDocument();
      expect(posts).toHaveLength(postsBefore); // zero PATCHes left the tab
      expect(server().overrides['custom-crypt']).toBeUndefined();
      expect(musicState().overrides['custom-crypt']).toBeUndefined();
      expect(document.querySelector('.music-toast')).toBeNull();
    });

    it('Reset refuses with the same inline copy and writes zero', async () => {
      const { posts, server } = dangleCrypt();
      const postsBefore = posts.length;

      fireEvent.click(screen.getByTitle('Restore starter tracks'));

      expect(await screen.findByText('Mood "custom-crypt" no longer exists — pick a mood before saving')).toBeInTheDocument();
      expect(posts).toHaveLength(postsBefore);
      expect(server().overrides['custom-crypt']).toBeUndefined();
    });
  });
});
