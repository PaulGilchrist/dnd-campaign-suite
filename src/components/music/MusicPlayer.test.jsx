// @maintained-by-ai 2026-11-26
// Lane: local mount/resume/re-queue mechanics (lazy iframe, pause/resume reuse,
// persisted re-queue, active-mood highlight, volume forwarding) + the
// unparseable-editor-input no-op. Stop/commit/audit rows live in
// local-stop-unmount + transport-chrome; paste-parse-on-save lives in
// mixed-save-warning; override-driven play queue lives in local-tracks.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import * as ambiencePlayer from '../../services/ui/ambiencePlayer.js';
import { MOODS } from '../../services/ui/musicConfig.js';

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

function renderPlayer(overrides = {}) {
  return render(<MusicPlayer campaignName="test-campaign" isLocalhost {...overrides} />);
}

function musicState() {
  return getStore('campaign').get('music');
}

function trackIds(moodKey) {
  return MOODS.find(m => m.key === moodKey).tracks;
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

describe('MusicPlayer', () => {
  it('renders every mood chip and the volume slider for GM and player tabs alike (ambience duty is delegable to players)', () => {
    for (const isLocalhost of [true, false]) {
      const { container, unmount } = render(
        <MusicPlayer campaignName="test-campaign" isLocalhost={isLocalhost} />
      );
      expect(container.querySelector('.music-player')).not.toBeNull();
      for (const mood of MOODS) {
        expect(screen.getByTitle(`Play ${mood.label} ambience`)).toBeInTheDocument();
      }
      expect(screen.getByTitle('Volume')).toBeInTheDocument();
      unmount();
    }
  });

  it('lazy-mounts the iframe on first mood play, queues tracks, stores state, and logs', () => {
    const { container } = renderPlayer();
    expect(container.querySelector('.yt-music-frame')).toBeNull();
    expect(ambiencePlayer.ensurePlayer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Play Town ambience'));

    expect(ambiencePlayer.ensurePlayer).toHaveBeenCalledWith('yt-music-frame');
    expect(container.querySelector('#yt-music-frame')).not.toBeNull();
    expect(ambiencePlayer.playTracks).toHaveBeenCalledWith(trackIds('town'), 'test-campaign');
    expect(musicState()).toMatchObject({ mood: 'town', playing: true });
    expect(mockAddEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'music', action: 'set_ambience', mood: 'town' })
    );
  });

  it('re-queues persisted tracks when resuming after reload (never a bare resume)', () => {
    getStore('campaign').set('music', { mood: 'town', playing: false, volume: 0.7, overrides: {} });
    const { container } = renderPlayer();
    expect(container.querySelector('.yt-music-frame')).toBeNull();

    fireEvent.click(screen.getByTitle('Play'));

    expect(ambiencePlayer.ensurePlayer).toHaveBeenCalledWith('yt-music-frame');
    expect(container.querySelector('#yt-music-frame')).not.toBeNull();
    expect(ambiencePlayer.playTracks).toHaveBeenCalledWith(trackIds('town'), 'test-campaign');
    expect(ambiencePlayer.resume).not.toHaveBeenCalled();
    expect(musicState().playing).toBe(true);
  });

  it('reuses the one iframe across pause, resume, and mood switches (audio continuity)', () => {
    const { container } = renderPlayer();
    fireEvent.click(screen.getByTitle('Play Town ambience'));
    const frame = container.querySelector('.yt-music-frame');

    fireEvent.click(screen.getByTitle('Pause'));
    expect(ambiencePlayer.pause).toHaveBeenCalled();
    expect(musicState().playing).toBe(false);

    fireEvent.click(screen.getByTitle('Play'));
    expect(ambiencePlayer.resume).toHaveBeenCalled();
    expect(musicState().playing).toBe(true);
    expect(container.querySelector('.yt-music-frame')).toBe(frame);

    fireEvent.click(screen.getByTitle('Play Combat ambience'));
    expect(container.querySelector('.yt-music-frame')).toBe(frame);
    expect(ambiencePlayer.ensurePlayer).toHaveBeenCalledTimes(1);
    expect(ambiencePlayer.playTracks).toHaveBeenLastCalledWith(trackIds('combat'), 'test-campaign');
  });

  it('highlights the active mood chip only while playing', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Combat ambience'));
    expect(screen.getByTitle('Play Combat ambience').className).toContain('active');
    expect(screen.getByTitle('Play Town ambience').className).not.toContain('active');

    fireEvent.click(screen.getByTitle('Pause'));
    expect(screen.getByTitle('Play Combat ambience').className).not.toContain('active');
  });

  it('forwards volume changes to the player and the store', () => {
    renderPlayer();
    fireEvent.change(screen.getByTitle('Volume'), { target: { value: '40' } });
    expect(ambiencePlayer.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.4));
    expect(musicState().volume).toBeCloseTo(0.4);
  });

  it('ignores unparseable editor input: console.debug trace, zero writes', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    // Drop the seeded bundled beds so the draft is truly empty and the only
    // input is the junk line.
    let removeBtn;
    while ((removeBtn = document.querySelector('.music-editor-local-tracks button'))) {
      fireEvent.click(removeBtn);
    }
    fireEvent.change(screen.getByPlaceholderText('One YouTube URL or video ID per line'), {
      target: { value: 'not a url' }
    });
    // Invalid input drops at console.debug (backlog 2026-11-08 EK: user-input
    // validation is not console-noise); console.error stays reserved for
    // genuine faults. The refusal UI itself is pinned in live-validation.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    fireEvent.click(screen.getByText('Save'));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      '[MusicPlayer] No valid YouTube URLs or video ids entered'
    );
    expect(musicState()).toBeUndefined();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
