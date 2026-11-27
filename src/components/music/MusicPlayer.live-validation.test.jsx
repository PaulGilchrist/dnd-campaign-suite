// @maintained-by-ai 2026-11-26
// Live-validation parity with the .ct-* lanes' typed-while-live banners
// (improve 2026-10-29-AF backlog): the editor derives its "N valid tracks"
// count (or zero-valid warning) from the SAME parseTrackList Save uses,
// updating on every keystroke with no Save click and no store writes. This
// file is the strongest home for the typing-never-writes seam and the
// save-time visible refusal copy / editor-stays-open / no-console.error lane
// (invalid-save-error owns only the error-CLEAR lanes; mixed-save-warning
// owns the mixed-list drop-count + zero-posts lanes).
import { render, screen, fireEvent } from '@testing-library/react';
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

function openEditor(container) {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return container.querySelector('#music-editor-urls');
}

function hintText(container) {
  const el = container.querySelector('.music-editor-hint');
  return el ? el.textContent : null;
}

// Item 3b: every starter mood now HEADS with bundled /audio/ beds — scenarios
// that exercise the zero-valid lanes must first remove the seeded local rows
// (the mixed queue law: local rows alone keep a draft saveable). Removal is
// draft-only; it never writes the music store.
function clearLocalRows(container) {
  let btn;
  while ((btn = container.querySelector('.music-editor-local-tracks button'))) {
    fireEvent.click(btn);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

describe('MusicPlayer live track-count validation', () => {
  it('counts the seeded starter tracks live when the editor opens, with no Save', () => {
    const { container } = renderPlayer();
    openEditor(container);
    // Town starter catalogue is 2 bundled beds + 2 YouTube tracks (Item 3b) —
    // the hint reflects the seeded draft without any Save.
    expect(hintText(container)).toContain('4 valid tracks');
    expect(container.querySelector('.music-editor-hint-warn')).toBeNull();
    // Opening the editor is read-only: nothing was persisted.
    expect(getStore('campaign').get('music')).toBeUndefined();
  });

  it('counts typed ids on every keystroke and never writes the music store', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);
    clearLocalRows(container);

    fireEvent.change(textarea, {
      target: { value: 'https://youtu.be/aaaaaaaaaaa\nbbbbbbbbbbb' }
    });
    expect(hintText(container)).toContain('2 valid tracks');

    fireEvent.change(textarea, { target: { value: 'ccccccccccc' } });
    expect(hintText(container)).toContain('1 valid track');
    // singular — one line, one id
    expect(hintText(container)).not.toContain('1 valid tracks');

    // Junk typing after valid ids: the hint flips but the store still doesn't
    // exist — no Save was clicked, so the whole session touched nothing.
    fireEvent.change(textarea, { target: { value: 'asdf qwer' } });
    expect(getStore('campaign').get('music')).toBeUndefined();
  });

  it('shows the zero-valid warning (not a bare count) for garbled or wiped input', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);
    clearLocalRows(container);

    fireEvent.change(textarea, { target: { value: 'asdf qwer' } });
    const warn = container.querySelector('.music-editor-hint-warn');
    expect(warn).not.toBeNull();
    expect(warn).toHaveTextContent('No valid tracks yet');
    // the count line is replaced, not shown as "0 valid tracks"
    expect(warn.textContent).not.toMatch(/\d+ valid track/);

    // An emptied draft hits the same zero-valid branch.
    fireEvent.change(textarea, { target: { value: '' } });
    expect(container.querySelector('.music-editor-hint-warn'))
      .toHaveTextContent('No valid tracks yet');
  });

  it('valid input clears the warning and restores the count line', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);
    clearLocalRows(container);

    fireEvent.change(textarea, { target: { value: 'total junk' } });
    expect(container.querySelector('.music-editor-hint-warn')).not.toBeNull();

    fireEvent.change(textarea, { target: { value: 'q9yaKpYS9qc' } });
    expect(container.querySelector('.music-editor-hint-warn')).toBeNull();
    expect(hintText(container)).toContain('1 valid track');
  });

  it('a zero-valid Save still paints the refusal alongside the live hint, keeps the editor open, and stays out of console.error', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);
    clearLocalRows(container);

    // The rejection drops at console.debug (backlog 2026-11-08 EK): pin that
    // the whole invalid-save attempt stays out of console.error.
    const errorSpy = vi.spyOn(console, 'error');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    fireEvent.change(textarea, { target: { value: 'asdf qwer' } });
    fireEvent.click(screen.getByText('Save'));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    debugSpy.mockRestore();

    expect(container.querySelector('.music-editor-error'))
      .toHaveTextContent('No valid YouTube URLs or video ids entered');
    // the live warning was already there while typing (no Save needed)
    expect(container.querySelector('.music-editor-hint-warn')).not.toBeNull();
    // stay-open law: the editor holds the refusal instead of closing
    expect(container.querySelector('.music-editor')).not.toBeNull();
    expect(container.querySelector('#music-editor-urls').value).toBe('asdf qwer');
  });
});
