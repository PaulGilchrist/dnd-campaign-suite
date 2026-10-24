// @maintained-by-ai: 2026-10-24
// Regression: saving the track editor with unparseable input must show a visible
// inline error (previously a console-only silent no-op), and that error must
// clear on the next keystroke / mood switch / successful save.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';

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

const REJECTION = 'No valid YouTube URLs or video ids entered';

function renderPlayer() {
  return render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
}

function musicState() {
  return getStore('campaign').get('music');
}

function openEditor(container) {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return container.querySelector('#music-editor-urls');
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

describe('MusicPlayer invalid-save inline error', () => {
  it('shows a visible inline error when Save rejects unparseable input', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(textarea, { target: { value: 'not a youtube thing' } });
    fireEvent.click(screen.getByText('Save'));

    // console.error is kept, but there is now user-visible feedback too
    expect(spy).toHaveBeenCalledWith(REJECTION);
    spy.mockRestore();

    const errorEl = container.querySelector('.music-editor-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl).toHaveTextContent(REJECTION);
    // rejection is still a no-op for stored data, and the editor stays open
    expect(musicState()?.overrides?.town).toBeUndefined();
    expect(container.querySelector('.music-editor')).not.toBeNull();
    expect(container.querySelector('#music-editor-urls').value).toBe('not a youtube thing');
  });

  it('clears the inline error on the next keystroke', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(textarea, { target: { value: 'junk' } });
    fireEvent.click(screen.getByText('Save'));
    expect(container.querySelector('.music-editor-error')).not.toBeNull();
    spy.mockRestore();

    fireEvent.change(container.querySelector('#music-editor-urls'), { target: { value: 'j' } });
    expect(container.querySelector('.music-editor-error')).toBeNull();
  });

  it('clears the inline error when the editor is closed and reopened', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(textarea, { target: { value: 'junk' } });
    fireEvent.click(screen.getByText('Save'));
    expect(container.querySelector('.music-editor-error')).not.toBeNull();
    spy.mockRestore();

    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    expect(container.querySelector('.music-editor-error')).toBeNull();
  });

  it('successful save after a rejected one closes the editor with no error and persists tracks', async () => {
    // Editor save PATCHes { overrides } only; stub mirrors the server music route merge.
    let serverMusic = { mood: null, playing: false, volume: 0.6, overrides: {} };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
      if (opts.method === 'POST' && String(url).endsWith('/music')) {
        const body = JSON.parse(opts.body);
        serverMusic = { ...serverMusic, ...('value' in body ? body.value : body) };
      }
      return { ok: true, status: 200, json: async () => ({ music: serverMusic, message: 'ok' }), text: async () => '' };
    });
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(textarea, { target: { value: 'junk' } });
    fireEvent.click(screen.getByText('Save'));
    expect(container.querySelector('.music-editor-error')).not.toBeNull();
    spy.mockRestore();

    fireEvent.change(container.querySelector('#music-editor-urls'), {
      target: { value: 'https://youtu.be/aaaaaaaaaaa' }
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(container.querySelector('.music-editor')).toBeNull());
    expect(musicState().overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa']);
    globalThis.fetch.mockRestore();
  });
});
