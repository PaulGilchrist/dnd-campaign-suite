// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import * as youtubePlayer from '../../services/ui/youtubePlayer.js';
import { MOODS } from '../../services/ui/musicConfig.js';

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

function renderPlayer(overrides = {}) {
  return render(<MusicPlayer campaignName="test-campaign" isLocalhost {...overrides} />);
}

function musicState() {
  return getStore('campaign').get('music');
}

function trackIds(moodKey) {
  return MOODS.find(m => m.key === moodKey).tracks.map(t => t.videoId);
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

describe('MusicPlayer', () => {
  it('renders nothing for non-localhost clients', () => {
    const { container } = renderPlayer({ isLocalhost: false });
    expect(container.querySelector('.music-player')).toBeNull();
  });

  it('renders mood buttons and transport controls on localhost', () => {
    renderPlayer();
    expect(screen.getByText('Music')).toBeInTheDocument();
    for (const mood of MOODS) {
      expect(screen.getByTitle(`Play ${mood.label} ambience`)).toBeInTheDocument();
    }
    expect(screen.getByTitle('Volume')).toBeInTheDocument();
  });

  it('lazy-mounts the iframe on first mood play, queues tracks, stores state, and logs', () => {
    const { container } = renderPlayer();
    expect(container.querySelector('.yt-music-frame')).toBeNull();
    expect(youtubePlayer.ensurePlayer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Play Town ambience'));

    expect(youtubePlayer.ensurePlayer).toHaveBeenCalledWith('yt-music-frame');
    expect(container.querySelector('#yt-music-frame')).not.toBeNull();
    expect(youtubePlayer.playTracks).toHaveBeenCalledWith(trackIds('town'));
    expect(musicState()).toMatchObject({ mood: 'town', playing: true });
    expect(mockAddEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'music', action: 'set_ambience', mood: 'town' })
    );
  });

  it('re-queues persisted tracks when resuming after reload', () => {
    getStore('campaign').set('music', { mood: 'town', playing: false, volume: 0.7, overrides: {} });
    const { container } = renderPlayer();
    expect(container.querySelector('.yt-music-frame')).toBeNull();

    fireEvent.click(screen.getByTitle('Play'));

    expect(youtubePlayer.ensurePlayer).toHaveBeenCalledWith('yt-music-frame');
    expect(container.querySelector('#yt-music-frame')).not.toBeNull();
    expect(youtubePlayer.playTracks).toHaveBeenCalledWith(trackIds('town'));
    expect(youtubePlayer.resume).not.toHaveBeenCalled();
    expect(musicState().playing).toBe(true);
  });

  it('reuses the iframe across pause, resume, and mood switches', () => {
    const { container } = renderPlayer();
    fireEvent.click(screen.getByTitle('Play Town ambience'));
    const frame = container.querySelector('.yt-music-frame');

    fireEvent.click(screen.getByTitle('Pause'));
    expect(youtubePlayer.pause).toHaveBeenCalled();
    expect(musicState().playing).toBe(false);

    fireEvent.click(screen.getByTitle('Play'));
    expect(youtubePlayer.resume).toHaveBeenCalled();
    expect(musicState().playing).toBe(true);
    expect(container.querySelector('.yt-music-frame')).toBe(frame);

    fireEvent.click(screen.getByTitle('Play Combat ambience'));
    expect(container.querySelector('.yt-music-frame')).toBe(frame);
    expect(youtubePlayer.ensurePlayer).toHaveBeenCalledTimes(1);
    expect(youtubePlayer.playTracks).toHaveBeenLastCalledWith(trackIds('combat'));
  });

  it('highlights the active mood button only while playing', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Combat ambience'));
    expect(screen.getByTitle('Play Combat ambience').className).toContain('active');
    expect(screen.getByTitle('Play Town ambience').className).not.toContain('active');
    fireEvent.click(screen.getByTitle('Pause'));
    expect(screen.getByTitle('Play Combat ambience').className).not.toContain('active');
  });

  it('stops playback and logs the stop', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Dungeon ambience'));
    fireEvent.click(screen.getByTitle('Stop'));
    expect(youtubePlayer.stop).toHaveBeenCalled();
    expect(musicState()).toMatchObject({ mood: null, playing: false });
    expect(mockAddEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'music', action: 'stop' })
    );
  });

  it('forwards volume changes to the player and store', () => {
    renderPlayer();
    fireEvent.change(screen.getByTitle('Volume'), { target: { value: '40' } });
    expect(youtubePlayer.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.4));
    expect(musicState().volume).toBeCloseTo(0.4);
  });

  it('lets the GM override a mood with pasted YouTube URLs', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    fireEvent.change(screen.getByPlaceholderText('One YouTube URL or video ID per line'), {
      target: { value: 'https://youtu.be/aaaaaaaaaaa\nhttps://www.youtube.com/watch?v=bbbbbbbbbbb' }
    });
    fireEvent.click(screen.getByText('Save'));

    expect(musicState().overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);

    fireEvent.click(screen.getByTitle('Play Town ambience'));
    expect(youtubePlayer.playTracks).toHaveBeenCalledWith(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('ignores unparseable editor input', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    fireEvent.change(screen.getByPlaceholderText('One YouTube URL or video ID per line'), { target: { value: 'not a url' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByText('Save'));
    expect(spy).toHaveBeenCalledWith('No valid YouTube URLs or video ids entered');
    expect(musicState()).toBeUndefined();
    spy.mockRestore();
  });
});
