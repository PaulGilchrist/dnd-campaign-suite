// @maintained-by-ai: 2026-11-13
// Mixed-save drop warning (improve 2026-11-13 DG backlog): a track list with
// ≥1 valid entry AND ≥1 non-empty unparseable line used to save the parseable
// subset in silence (toast only) while the all-junk list was honestly refused
// — same input, two feedback laws. Now the save still lands the valid rows
// and fires the toast, but the dropped-line count surfaces on the existing
// .music-editor-error seam. The count is derived from the SAME parseTrackList
// split the live hint reads (no second parser), and blank/whitespace-only
// lines never count as dropped.
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
const warning = (n) =>
  `${n} line(s) are not valid YouTube URLs or video ids and were not saved`;

function renderPlayer() {
  return render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
}

function musicState() {
  return getStore('campaign').get('music');
}

// Mirrors the server music route's shallow merge of the { overrides } PATCH.
function stubMusicServer() {
  const posts = [];
  let serverMusic = { mood: null, playing: false, volume: 0.6, overrides: {} };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    if (opts.method === 'POST' && String(url).endsWith('/music')) {
      const body = JSON.parse(opts.body);
      posts.push(body);
      serverMusic = { ...serverMusic, ...body };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ music: serverMusic, message: 'ok' }),
      text: async () => ''
    };
  });
  return { posts, server: () => serverMusic };
}

function openEditor() {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return document.querySelector('#music-editor-urls');
}

const savedIds = (mood = 'town') =>
  (musicState()?.overrides?.[mood] || []).map(t => t.videoId);

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

describe('MusicPlayer mixed-save drop warning', () => {
  it('mixed save lands the valid rows, fires the save toast, AND warns with the exact dropped count', async () => {
    const stub = stubMusicServer();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPlayer();
    openEditor();
    fireEvent.change(document.querySelector('#music-editor-urls'), {
      target: { value: 'dQw4w9WgXcQ\nnot a youtube thing' }
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town tracks saved — keep editing'));
    expect(document.querySelector('.music-editor-error'))
      .toHaveTextContent(warning(1));
    // Only the parseable line reached the server (PATCH body and store both).
    expect(stub.posts).toHaveLength(1);
    expect(stub.posts[0].overrides.town.map(t => t.videoId)).toEqual(['dQw4w9WgXcQ']);
    expect(savedIds()).toEqual(['dQw4w9WgXcQ']);
    // Editor stays open with the draft intact (stay-open save law).
    expect(document.querySelector('.music-editor')).not.toBeNull();
    expect(document.querySelector('#music-editor-urls').value)
      .toBe('dQw4w9WgXcQ\nnot a youtube thing');
    // Bad user input is not an app fault — stays out of console.error.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('counts every dropped line (2 junk + 1 valid → "2 line(s)")', async () => {
    stubMusicServer();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    renderPlayer();
    openEditor();
    fireEvent.change(document.querySelector('#music-editor-urls'), {
      target: { value: 'garbage-not-a-url\nhttps://youtu.be/short\nbbbbbbbbbbb' }
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(document.querySelector('.music-editor-error'))
      .toHaveTextContent(warning(2)));
    expect(savedIds()).toEqual(['bbbbbbbbbbb']);
    debugSpy.mockRestore();
  });

  it('blank/whitespace-only lines never count toward the dropped total', async () => {
    const stub = stubMusicServer();
    renderPlayer();
    openEditor();
    fireEvent.change(document.querySelector('#music-editor-urls'), {
      target: { value: 'aaaaaaaaaaa\n\n   \n\t\n' }
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town tracks saved — keep editing'));
    expect(document.querySelector('.music-editor-error')).toBeNull();
    expect(stub.posts).toHaveLength(1);
    expect(savedIds()).toEqual(['aaaaaaaaaaa']);
  });

  it('fully-valid save shows no warning — behavior unchanged', async () => {
    stubMusicServer();
    renderPlayer();
    openEditor();
    fireEvent.change(document.querySelector('#music-editor-urls'), {
      target: { value: 'https://youtu.be/aaaaaaaaaaa\nbbbbbbbbbbb' }
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(document.querySelector('.music-toast'))
      .toHaveTextContent('Town tracks saved — keep editing'));
    expect(document.querySelector('.music-editor-error')).toBeNull();
    expect(savedIds()).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('all-junk save keeps the verbatim refusal, keeps the draft, and writes nothing', async () => {
    const stub = stubMusicServer();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    renderPlayer();
    openEditor();
    fireEvent.change(document.querySelector('#music-editor-urls'), {
      target: { value: 'not a youtube thing\ngarbage' }
    });

    fireEvent.click(screen.getByText('Save'));

    expect(document.querySelector('.music-editor-error'))
      .toHaveTextContent(REJECTION);
    // the drop-count warning must NOT replace the zero-valid refusal copy
    expect(document.querySelector('.music-editor-error').textContent)
      .not.toContain('line(s)');
    expect(stub.posts).toHaveLength(0);
    expect(musicState()?.overrides?.town).toBeUndefined();
    expect(document.querySelector('#music-editor-urls').value)
      .toBe('not a youtube thing\ngarbage');
    debugSpy.mockRestore();
  });
});
