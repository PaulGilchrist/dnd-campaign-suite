// @maintained-by-ai 2026-11-26
// Owns the CLEAR lanes of the track editor's invalid-save inline error: once a
// zero-valid Save paints .music-editor-error, it must clear on the next
// keystroke, on a discard-close + reopen, and on a later successful save.
// The error-APPEARS lane (verbatim refusal copy, draft kept, zero writes, the
// console.debug drop with console.error reserved for faults) is pinned by the
// siblings "ignores unparseable editor input" (MusicPlayer.test.jsx), the
// save-time lane in live-validation, and "all-junk save ..." in
// mixed-save-warning — not re-pinned here.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function renderPlayer() {
  return render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
}

function musicState() {
  return getStore('campaign').get('music');
}

function openEditor() {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
}

// Item 3b: starter moods seed bundled /audio/ beds — the zero-valid rejection
// lanes only fire when NOTHING is queued, so remove the seeded local rows first.
function clearLocalRows(container) {
  let btn;
  while ((btn = container.querySelector('.music-editor-local-tracks button'))) {
    fireEvent.click(btn);
  }
}

// Re-fire the refusal and return its element, so each clear lane starts from a
// painted error.
function fireRejection(container, value) {
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  fireEvent.change(container.querySelector('#music-editor-urls'), { target: { value } });
  fireEvent.click(screen.getByText('Save'));
  expect(container.querySelector('.music-editor-error')).not.toBeNull();
  debugSpy.mockRestore();
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

describe('MusicPlayer invalid-save inline error', () => {
  it('clears the error on the next keystroke and on a discard-close then reopen', () => {
    const { container } = renderPlayer();
    openEditor();
    clearLocalRows(container);

    // Lane 1: any keystroke in the textarea wipes the stale refusal.
    fireRejection(container, 'junk');
    fireEvent.change(container.querySelector('#music-editor-urls'), { target: { value: 'j' } });
    expect(container.querySelector('.music-editor-error')).toBeNull();

    // Lane 2: the error does not leak into a later mount. The draft is dirty,
    // so Cancel routes through the named-discard role=dialog modal — its
    // mechanics are owned by close-discard-confirm.test.jsx; here it is just
    // the route to closing and reopening the editor.
    fireRejection(container, 'junk');
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Discard Changes?' }))
        .getByRole('button', { name: 'Yes, Discard' })
    );
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    expect(container.querySelector('.music-editor-error')).toBeNull();
  });

  it('a successful save after a rejected one clears the error, stays open, and persists the track', async () => {
    // Editor save PATCHes { overrides } only; stub mirrors the server music route merge.
    let serverMusic = { mood: null, playing: false, volume: 0.6, overrides: {} };
    const posts = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
      if (opts.method === 'POST' && String(url).endsWith('/music')) {
        const body = JSON.parse(opts.body);
        posts.push(body);
        serverMusic = { ...serverMusic, ...('value' in body ? body.value : body) };
      }
      return { ok: true, status: 200, json: async () => ({ music: serverMusic, message: 'ok' }), text: async () => '' };
    });
    const { container } = renderPlayer();
    openEditor();
    clearLocalRows(container);

    // Rejection: error painted and NOTHING reached the server.
    fireRejection(container, 'junk');
    expect(posts).toHaveLength(0);

    fireEvent.change(container.querySelector('#music-editor-urls'), {
      target: { value: 'https://youtu.be/aaaaaaaaaaa' }
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(container.querySelector('.music-editor-error')).toBeNull());
    // Stay-open save law: editor holds, draft intact, exactly one write lands
    // with the parsed id on both store and wire.
    expect(container.querySelector('.music-editor')).not.toBeNull();
    expect(container.querySelector('#music-editor-urls').value).toBe('https://youtu.be/aaaaaaaaaaa');
    expect(musicState().overrides.town.map(t => t.src)).toEqual(['aaaaaaaaaaa']);
    expect(posts).toHaveLength(1);
    expect(posts[0].overrides.town.map(t => t.src)).toEqual(['aaaaaaaaaaa']);
    globalThis.fetch.mockRestore();
  });
});
