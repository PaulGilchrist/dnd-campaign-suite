// @maintained-by-ai: 2026-11-07
// Lane: campaign-specific music categories (improve 2026-11-07). DJs (GM or
// delegated player) can create custom categories that start EMPTY and gain
// YouTube tracks via the existing editor; custom categories (and only they —
// the five built-ins are permanent) can be deleted along with their track
// lists. Categories PATCH { customCategories } through the same intent-split
// /music lane as overrides, so a create/delete never touches transport
// fields. Harness mirrors MusicPlayer.active-mood-editor.test.jsx.
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
const categoryForm = () => document.querySelector('.music-category-form');

// Store hydration mirror of the stub's initial doc — in tests the runtime
// store IS the hydration (useSyncedState seeds from it, like a live SSE-synced
// tab), matching the setActiveMood idiom in active-mood-editor.test.jsx.
function seedStore(initialMusic) {
  getStore('campaign').set('music', {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
    ...(initialMusic || {}),
  });
}

function mount(initialMusic) {
  const stub = stubMusicServer(initialMusic);
  seedStore(initialMusic);
  render(<MusicPlayer campaignName="test-campaign" />);
  return stub;
}

const openCreateForm = () => fireEvent.click(screen.getByTitle('Add music category'));

const createCategory = async (label) => {
  openCreateForm();
  fireEvent.change(screen.getByLabelText('Category name'), { target: { value: label } });
  fireEvent.click(screen.getByText('Create'));
  await waitFor(() => expect(categoryForm()).toBeNull());
};

describe('MusicPlayer campaign-specific categories', () => {
  let confirmSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    getStore('campaign').delete('music');
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('creates an empty category: PATCH carries customCategories only, chip appears, log row written', async () => {
      const { posts, server } = mount();

      await createCategory('Crypt Keeper');

      // Intent-split PATCH: no mood/playing/volume in the body.
      const patch = posts.find(p => 'customCategories' in p);
      expect(patch).toBeDefined();
      expect(Object.keys(patch)).toEqual(['customCategories']);
      expect(patch.customCategories['custom-crypt-keeper']).toEqual({ label: 'Crypt Keeper', icon: 'fa-music' });
      expect(server().customCategories['custom-crypt-keeper'].label).toBe('Crypt Keeper');

      // Sidebar chip (empty category promises track-adding, not playback).
      expect(screen.getByTitle('Add Crypt Keeper tracks')).toBeInTheDocument();
      expect(musicState().customCategories['custom-crypt-keeper']).toBeDefined();
      expect(mockAddEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({ type: 'music', action: 'add_category', mood: 'custom-crypt-keeper' })
      );
    });

    it('rejects a label that slugs to nothing and keeps the form open', async () => {
      const { posts } = mount();

      openCreateForm();
      fireEvent.change(screen.getByLabelText('Category name'), { target: { value: '!!' } });
      fireEvent.click(screen.getByText('Create'));

      expect(await screen.findByText('Category name must include letters or numbers')).toBeInTheDocument();
      expect(categoryForm()).not.toBeNull();
      expect(posts.filter(p => 'customCategories' in p)).toHaveLength(0);
    });

    // Duplicate-label guard (improve 2026-11-08 backlog): a twin label used to
    // resolve silently to custom-<slug>-2 and render an IDENTICAL chip. The
    // form now blocks it in place — custom-magic-items lane copy style.
    describe('duplicate labels blocked in-form', () => {
      const seed = { customCategories: { 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } } };

      const expectBlocked = async (typed, named) => {
        const { posts, server } = mount(seed);

        openCreateForm();
        fireEvent.change(screen.getByLabelText('Category name'), { target: { value: typed } });
        fireEvent.click(screen.getByText('Create'));

        expect(await screen.findByText(`A category named "${named}" already exists.`)).toBeInTheDocument();
        // form stays open with the typed value preserved
        expect(categoryForm()).not.toBeNull();
        expect(screen.getByLabelText('Category name').value).toBe(typed);
        // zero writes: no PATCH, server + store customCategories untouched
        expect(posts.filter(p => 'customCategories' in p)).toHaveLength(0);
        expect(server().customCategories).toEqual(seed.customCategories);
        expect(musicState().customCategories).toEqual(seed.customCategories);
        // no twin chip rendered
        expect(screen.queryAllByTitle('Add Crypt tracks')).toHaveLength(1);
      };

      it('blocks an exact duplicate with inline error and no write', async () => {
        await expectBlocked('Crypt', 'Crypt');
      });

      it('blocks case-insensitively and ignores surrounding whitespace', async () => {
        await expectBlocked('  cRyPt ', 'cRyPt');
      });

      it('does NOT block a label matching a BUILT-IN mood (out of scope — only custom labels collide)', async () => {
        const { posts } = mount(seed);

        openCreateForm();
        fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Town' } });
        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => expect(categoryForm()).toBeNull());
        expect(posts.filter(p => 'customCategories' in p)).toHaveLength(1);
        expect(musicState().customCategories['custom-town']).toEqual({ label: 'Town', icon: 'fa-music' });
      });

      it('typing after a block clears the error and a distinct label still creates', async () => {
        mount(seed);

        openCreateForm();
        fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Crypt' } });
        fireEvent.click(screen.getByText('Create'));
        expect(await screen.findByText('A category named "Crypt" already exists.')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Underdark' } });
        expect(screen.queryByText('A category named "Crypt" already exists.')).toBeNull();
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => expect(categoryForm()).toBeNull());

        expect(screen.getByTitle('Add Underdark tracks')).toBeInTheDocument();
        expect(musicState().customCategories['custom-underdark']).toEqual({ label: 'Underdark', icon: 'fa-music' });
        expect(mockAddEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({ type: 'music', action: 'add_category', mood: 'custom-underdark' })
        );
      });
    });

    it('built-in moods gain no delete affordance; custom ones do', () => {
      mount({ customCategories: { 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } } });

      expect(screen.getByLabelText('Delete Crypt category')).toBeInTheDocument();
      for (const builtIn of ['Town', 'Outdoors', 'Combat', 'Dungeon', 'Tavern']) {
        expect(screen.queryByLabelText(`Delete ${builtIn} category`)).toBeNull();
      }
    });
  });

  describe('empty category lifecycle', () => {
    it('clicking an empty custom category opens the editor seeded empty on that mood', () => {
      mount({ customCategories: { 'custom-crypt': { label: 'Crypt' } } });

      fireEvent.click(screen.getByTitle('Add Crypt tracks'));

      const textarea = screen.getByPlaceholderText('One YouTube URL or video ID per line');
      expect(textarea.value).toBe('');
      expect(screen.getByLabelText('Tracks mood').value).toBe('custom-crypt');
      // Custom categories have no starter defaults to Reset to —
      // the editor offers Delete (category + tracks) instead. (The sidebar ×
      // shares the title; grab this one from the editor actions row.)
      expect(screen.queryByTitle('Restore starter tracks')).toBeNull();
      expect(document.querySelector('.music-editor-actions [title="Delete Crypt category"]')).not.toBeNull();
    });

    it('saved tracks make the chip playable and play queues them', async () => {
      mount({ customCategories: { 'custom-crypt': { label: 'Crypt' } } });

      fireEvent.click(screen.getByTitle('Add Crypt tracks'));
      const textarea = screen.getByPlaceholderText('One YouTube URL or video ID per line');
      fireEvent.change(textarea, { target: { value: 'https://youtu.be/vyg5jJrZ42s' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(screen.queryByPlaceholderText('One YouTube URL or video ID per line')).toBeNull());

      // Editor save PATCHes overrides only (title lane untouched by this feature).
      fireEvent.click(screen.getByTitle('Play Crypt ambience'));
      expect(youtubePlayer.playTracks).toHaveBeenCalledWith(['vyg5jJrZ42s']);
      expect(musicState()).toMatchObject({ mood: 'custom-crypt', playing: true });
      expect(mockAddEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({ type: 'music', action: 'set_ambience', mood: 'custom-crypt' })
      );
    });
  });

  describe('delete', () => {
    it('removes category and tracks in one PATCH after confirm', async () => {
      const { posts, server } = mount({
        overrides: { 'custom-crypt': [{ videoId: 'aAAAAAAAAAA', title: 'a' }], tavern: [{ videoId: 'b', title: 'b' }] },
        customCategories: { 'custom-crypt': { label: 'Crypt' } },
      });

      fireEvent.click(screen.getByLabelText('Delete Crypt category'));
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Crypt'));
      await waitFor(() => expect(musicState().customCategories['custom-crypt']).toBeUndefined());

      const patch = posts[posts.length - 1];
      expect(patch.customCategories).toEqual({});
      expect(patch.overrides).toEqual({ tavern: [{ videoId: 'b', title: 'b' }] });
      expect(server().overrides).toEqual({ tavern: [{ videoId: 'b', title: 'b' }] });
      expect(screen.queryByTitle('Play Crypt ambience')).toBeNull();
      expect(mockAddEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({ type: 'music', action: 'delete_category', mood: 'custom-crypt' })
      );
    });

    it('declined confirm is a no-op', () => {
      confirmSpy.mockReturnValue(false);
      const { posts } = mount({ customCategories: { 'custom-crypt': { label: 'Crypt' } } });

      fireEvent.click(screen.getByLabelText('Delete Crypt category'));

      expect(screen.getByLabelText('Delete Crypt category')).toBeInTheDocument();
      expect(posts.filter(p => 'customCategories' in p)).toHaveLength(0);
    });

    it('deleting the ACTIVE mood stops playback and un-arms the transport first', async () => {
      const { server } = mount({
        mood: 'custom-crypt', playing: true,
        overrides: { 'custom-crypt': [{ videoId: 'aAAAAAAAAAA', title: 'a' }] },
        customCategories: { 'custom-crypt': { label: 'Crypt' } },
      });

      fireEvent.click(screen.getByLabelText('Delete Crypt category'));
      await waitFor(() => expect(musicState().mood).toBeNull());

      expect(youtubePlayer.stop).toHaveBeenCalled();
      // transport un-arm write precedes the config PATCH; server truth agrees
      expect(server()).toMatchObject({ mood: null, playing: false });
      expect(server().customCategories).toEqual({});
      expect(mockAddEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({ type: 'music', action: 'delete_category', mood: 'custom-crypt' })
      );
    });
  });

  it('editor select offers custom categories and the discard confirm names them', async () => {
    confirmSpy.mockReturnValue(false); // Cancel dismisses → draft survives
    mount({ customCategories: { 'custom-crypt': { label: 'Crypt' } } });

    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    const select = screen.getByLabelText('Tracks mood');
    expect(select.querySelector('option[value="custom-crypt"]')).not.toBeNull();

    fireEvent.change(select, { target: { value: 'custom-crypt' } });
    fireEvent.change(screen.getByPlaceholderText('One YouTube URL or video ID per line'), { target: { value: 'dirty draft' } });
    fireEvent.click(screen.getByText('Cancel'));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Crypt'));
    // dismissed → editor stays open with the draft intact
    expect(screen.getByPlaceholderText('One YouTube URL or video ID per line').value).toBe('dirty draft');
  });
});
