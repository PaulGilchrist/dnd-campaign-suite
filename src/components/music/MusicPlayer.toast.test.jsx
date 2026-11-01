// @maintained-by-ai: 2026-10-24
/* Lane: editor save/reset confirmation toasts + playing-state untouched by editor
 * saves (backlog 2026-10-24 — silent Save/Reset + surprise-autoplay risk).
 * Toasts name the mood and follow the .sessions-toast/.encounter-toast pattern
 * (auto-hide display-only timer). The fetch stub mirrors the server music route's
 * intent-split merge: editor PATCHes carry { overrides } only, so `playing` survives
 * from server truth; transport writes carry the full music object. */
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

vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: vi.fn().mockResolvedValue({}),
}));

function openEditor() {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return screen.getByPlaceholderText('One YouTube URL or video ID per line');
}

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
  return {
    posts,
    server: () => server,
  };
}

const toastNode = () => document.querySelector('.music-toast');

function musicState() {
  return getStore('campaign').get('music');
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  
  vi.restoreAllMocks();
});

describe('MusicPlayer editor save/reset toasts', () => {
  it('toasts "Town tracks saved" (naming the mood) after a successful Save', async () => {
    const stub = stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.change(openEditor(), { target: { value: 'https://youtu.be/aaaaaaaaaaa' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(toastNode()).toHaveTextContent('Town tracks saved'));
    expect(toastNode()).not.toHaveClass('music-toast-error');
    // overrides persisted, editor closed
    expect(stub.server().overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa']);
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('Save while stopped PATCHes overrides only and leaves playing:false server-side', async () => {
    const stub = stubMusicServer({ mood: null, playing: false });
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.change(openEditor(), { target: { value: 'aaaaaaaaaaa' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(toastNode()).toHaveTextContent('Town tracks saved'));

    const patch = stub.posts.at(-1);
    expect('playing' in patch).toBe(false);
    expect('mood' in patch).toBe(false);
    expect(patch.overrides.town).toHaveLength(1);
    expect(stub.server().playing).toBe(false);
    expect(musicState().playing).toBe(false);
  });

  it('saving while playing keeps playing:true and does not restart the transport', async () => {
    const stub = stubMusicServer({ mood: 'tavern', playing: true });
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.change(openEditor(), { target: { value: 'aaaaaaaaaaa' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(toastNode()).toHaveTextContent('Town tracks saved'));

    expect('playing' in stub.posts.at(-1)).toBe(false);
    expect(stub.server().playing).toBe(true);
    // editing town while tavern plays — the transport is never touched
    expect(youtubePlayer.playTracks).not.toHaveBeenCalled();
  });

  it('toasts "Tavern overrides reset to defaults" (naming the mood) after Reset', async () => {
    const stub = stubMusicServer({ overrides: { tavern: [{ videoId: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] } });
    getStore('campaign').set('music', { mood: null, playing: false, volume: 0.6, overrides: { tavern: [{ videoId: 'aaaaaaaaaaa', title: 'aaaaaaaaaaa' }] } });
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    openEditor();
    fireEvent.change(document.querySelector('.music-editor select'), { target: { value: 'tavern' } });
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => expect(toastNode()).toHaveTextContent('Tavern overrides reset to defaults'));
    expect('playing' in stub.posts.at(-1)).toBe(false);
    expect(stub.server().overrides.tavern).toBeUndefined();
    expect(musicState().overrides.tavern).toBeUndefined();
    // textarea refilled with the mood's starter defaults
    expect(screen.getByPlaceholderText('One YouTube URL or video ID per line').value)
      .toBe('vyg5jJrZ42s\n2P8J7Cx1plA');
  });

  it('toasts an error instead of silence when the save POST fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({ ok: false, status: 500, statusText: 'boom', json: async () => ({}) }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.change(openEditor(), { target: { value: 'aaaaaaaaaaa' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(toastNode()).toHaveTextContent('Failed to save Town tracks'));
    expect(toastNode()).toHaveClass('music-toast-error');
    // editor stays open for retry
    expect(screen.getByText('Save')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('auto-hides the toast after ~2.5s without interaction', async () => {
    stubMusicServer();
    render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
    fireEvent.change(openEditor(), { target: { value: 'aaaaaaaaaaa' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(toastNode()).toHaveTextContent('Town tracks saved'));

    await waitFor(() => expect(toastNode()).not.toBeInTheDocument(), { timeout: 3500 });
  });
});
