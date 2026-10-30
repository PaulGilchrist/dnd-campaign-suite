// @maintained-by-ai: 2026-10-29
// Live-validation parity with the .ct-* lanes' typed-while-live banners
// (improve 2026-10-29-AF backlog): the editor derives its "N valid tracks"
// count (or zero-valid warning) from the SAME parseTrackList Save uses,
// updating on every keystroke with no Save click and no store writes.
import { render, screen, fireEvent } from '@testing-library/react';
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

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

describe('MusicPlayer live track-count validation', () => {
  it('counts the seeded starter tracks live when the editor opens', () => {
    const { container } = renderPlayer();
    openEditor(container);
    // Town starter catalogue has 2 tracks — the hint reflects the seeded
    // textarea without any Save.
    expect(hintText(container)).toContain('2 valid tracks');
    expect(container.querySelector('.music-editor-hint-warn')).toBeNull();
  });

  it('updates the count as valid ids are typed, without pressing Save', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    fireEvent.change(textarea, {
      target: { value: 'https://youtu.be/aaaaaaaaaaa\nbbbbbbbbbbb' }
    });
    expect(hintText(container)).toContain('2 valid tracks');

    fireEvent.change(textarea, { target: { value: 'ccccccccccc' } });
    expect(hintText(container)).toContain('1 valid track');
    // still singular — one line, one id
    expect(hintText(container)).not.toContain('1 valid tracks');

    // No Save was clicked; nothing was persisted.
    expect(getStore('campaign').get('music')?.overrides?.town).toBeUndefined();
  });

  it('shows a warning hint (not just 0) for fully garbled input', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    fireEvent.change(textarea, { target: { value: 'asdf qwer' } });
    const warn = container.querySelector('.music-editor-hint-warn');
    expect(warn).not.toBeNull();
    expect(warn).toHaveTextContent('No valid tracks yet');
    expect(warn.textContent).not.toMatch(/\d+ valid track/);
    expect(hintText(container)).toContain('No valid tracks yet');
  });

  it('shows the warning hint when the draft is wiped empty', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    fireEvent.change(textarea, { target: { value: '' } });
    expect(container.querySelector('.music-editor-hint-warn')).not.toBeNull();
    expect(hintText(container)).toContain('No valid tracks yet');
  });

  it('valid input clears the warning and restores the count line', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    fireEvent.change(textarea, { target: { value: 'total junk' } });
    expect(container.querySelector('.music-editor-hint-warn')).not.toBeNull();

    fireEvent.change(textarea, { target: { value: 'q9yaKpYS9qc' } });
    expect(container.querySelector('.music-editor-hint-warn')).toBeNull();
    expect(hintText(container)).toContain('1 valid track');
  });

  it('the live hint is display-only: typing never touches the music store', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    fireEvent.change(textarea, { target: { value: 'aaaaaaaaaaa\nbbbbbbbbbbb' } });
    fireEvent.change(textarea, { target: { value: 'asdf qwer' } });
    expect(getStore('campaign').get('music')).toBeUndefined();
  });

  it('save-time leaf-inline error lane still fires alongside the hint', () => {
    const { container } = renderPlayer();
    const textarea = openEditor(container);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(textarea, { target: { value: 'asdf qwer' } });
    fireEvent.click(screen.getByText('Save'));
    spy.mockRestore();

    expect(container.querySelector('.music-editor-error'))
      .toHaveTextContent('No valid YouTube URLs or video ids entered');
    // and the live warning was already there while typing (no Save needed)
    expect(container.querySelector('.music-editor-hint-warn')).not.toBeNull();
    expect(container.querySelector('.music-editor')).not.toBeNull();
  });
});
