// @maintained-by-ai: 2026-11-01
// Regression lock for bug-music-editor-wrong-mood-default: the pencil button
// promises "Edit tracks for this mood", but openEditor always seeded
// MOODS[0] ('town') regardless of the active mood — misfiling typed tracks
// into overrides.town while another mood played, and naming Town in the
// discard confirm/toasts. Now the editor opens on music.mood when one is
// active (seed, select value, confirm/toast copy, and the override bucket all
// follow it); with no active mood it falls back to the catalogue-first mood
// as before. The mood <select> keeps working as the manual chooser and gains
// an aria-label for discoverability. Harness mirrors
// MusicPlayer.close-discard-confirm.test.jsx.
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

// Server-truth stub: merge-only, echo { music } like campaigns-changedata's POST.
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

// Tavern starter ids (musicConfig.js catalogue).
const TAVERN_SEED = 'vyg5jJrZ42s\n2P8J7Cx1plA';
const TOWN_SEED = 'q9yaKpYS9qc\no-b5nMCj5hI';

const textarea = () => screen.getByPlaceholderText('One YouTube URL or video ID per line');
const moodSelect = () => screen.getByLabelText('Tracks mood');
const toastNode = () => document.querySelector('.music-toast');

// Store-seeded active mood — the shape the live app reaches when the GM
// clicks a mood chip (server is the transport, the store is the hydration).
function setActiveMood(moodKey, overrides = {}) {
  getStore('campaign').set('music', {
    mood: moodKey, playing: !!moodKey, volume: 0.6, overrides,
  });
}

const openEditor = () => {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return textarea();
};

describe('MusicPlayer editor opens on the active mood', () => {
  let confirmSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    getStore('campaign').delete('music');
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('active Tavern: editor selects tavern and seeds Tavern starter tracks', () => {
    stubMusicServer();
    setActiveMood('tavern');
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();

    expect(moodSelect().value).toBe('tavern');
    expect(textarea().value).toBe(TAVERN_SEED);
  });

  it('active Tavern: an existing Tavern override seeds instead of the starter list', () => {
    stubMusicServer();
    setActiveMood('tavern', { tavern: [{ videoId: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] });
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();

    expect(moodSelect().value).toBe('tavern');
    expect(textarea().value).toBe('aaaaaaaaaaa');
  });

  it('active Tavern: Save writes overrides.tavern, toasts Tavern, leaves town untouched', async () => {
    // Server starts holding the transport the live app would have (mood click
    // writes the full music object), so the save-echo matches live truth.
    const stub = stubMusicServer({ mood: 'tavern', playing: true });
    setActiveMood('tavern');
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    fireEvent.change(textarea(), { target: { value: 'dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(toastNode()).toHaveTextContent('Tavern tracks saved'));
    expect(stub.server().overrides.tavern.map(t => t.videoId)).toEqual(['dQw4w9WgXcQ']);
    expect(stub.server().overrides.town).toBeUndefined();
    // The misfiled bucket from the old defect stays empty on disk.
    expect(stub.posts.at(-1).overrides.town).toBeUndefined();
    // Saved into the mood IN PLAY, so the fresh track takes over immediately
    // (saveTracks' saved.mood === editMood && playing lane).
    expect(youtubePlayer.playTracks).toHaveBeenCalledWith(['dQw4w9WgXcQ']);
  });

  it('active Tavern: dirty Cancel names Tavern in the discard modal (role=dialog, no native confirm)', () => {
    stubMusicServer();
    setActiveMood('tavern');
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    fireEvent.change(textarea(), { target: { value: 'garbage-not-a-url' } });
    fireEvent.click(screen.getByText('Cancel'));

    const dialog = screen.getByRole('dialog', { name: 'Discard Changes?' });
    expect(within(dialog).getByText('Discard changes to the Tavern track list?')).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('no active mood: editor keeps the catalogue-first fallback (Town)', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();

    expect(moodSelect().value).toBe('town');
    expect(textarea().value).toBe(TOWN_SEED);
  });

  it('select still re-seeds manually: tavern active, switch to Town, save files into town', async () => {
    const stub = stubMusicServer();
    setActiveMood('tavern');
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();

    fireEvent.change(moodSelect(), { target: { value: 'town' } });
    expect(moodSelect().value).toBe('town');
    expect(textarea().value).toBe(TOWN_SEED);
    fireEvent.change(textarea(), { target: { value: 'dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(toastNode()).toHaveTextContent('Town tracks saved'));
    expect(stub.server().overrides.town.map(t => t.videoId)).toEqual(['dQw4w9WgXcQ']);
    expect(stub.server().overrides.tavern).toBeUndefined();
  });

  it('mood <select> is discoverable: aria-label "Tracks mood"', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();

    expect(moodSelect()).toBeInTheDocument();
    expect(moodSelect()).toHaveAttribute('aria-label', 'Tracks mood');
  });

  it('Edit-tracks button is discoverable by accessible name (aria-label parity)', () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);

    // a11y parity with the 7c547abdc select: icon-only button must expose its
    // name via aria-label, not just the title tooltip.
    const button = screen.getByRole('button', { name: 'Edit tracks for this mood' });
    expect(button).toHaveAttribute('aria-label', 'Edit tracks for this mood');
    // Title kept for the hover tooltip and the legacy getByTitle locators.
    expect(button).toHaveAttribute('title', 'Edit tracks for this mood');
    expect(screen.getByTitle('Edit tracks for this mood')).toBe(button);
  });
});
