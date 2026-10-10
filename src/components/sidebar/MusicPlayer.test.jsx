import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  subscribe: vi.fn(() => vi.fn()),
  isPlayingNow: vi.fn(() => false),
  dispose: vi.fn(),
}));

const mockAddEntry = vi.fn().mockResolvedValue({});
vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: (...args) => mockAddEntry(...args),
}));

function renderPlayer(overrides = {}) {
  const props = { campaignName: 'test-campaign', isLocalhost: true, ...overrides };
  return { props, ...render(<MusicPlayer {...props} />) };
}

function musicState() {
  return getStore('campaign').get('music');
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  getStore('campaign').delete('music');
});

describe('MusicPlayer', () => {
  it('renders nothing for non-localhost clients', () => {
    const { container } = renderPlayer({ isLocalhost: false });
    expect(container.querySelector('.music-player')).toBeNull();
  });

  it('renders the mood buttons and transport controls on localhost', () => {
    renderPlayer();
    expect(screen.getByText('Music')).toBeInTheDocument();
    for (const mood of MOODS) {
      expect(screen.getByTitle(`Play ${mood.label} ambience`)).toBeInTheDocument();
    }
    expect(screen.getByTitle('Volume')).toBeInTheDocument();
  });

  it('does not mount the YouTube iframe while idle', () => {
    const { container } = renderPlayer();
    expect(container.querySelector('.yt-music-frame')).toBeNull();
    expect(container.querySelector('#yt-music-frame')).toBeNull();
    expect(youtubePlayer.ensurePlayer).not.toHaveBeenCalled();
  });

  it('lazy-mounts the YouTube iframe on first mood play', () => {
    const { container } = renderPlayer();
    fireEvent.click(screen.getByTitle('Play Town ambience'));
    expect(youtubePlayer.ensurePlayer).toHaveBeenCalledWith('yt-music-frame');
    expect(container.querySelector('#yt-music-frame')).not.toBeNull();
  });

  it('lazy-mounts the iframe and queues tracks when resuming after reload', () => {
    getStore('campaign').set('music', { mood: 'town', playing: false, volume: 0.7, overrides: {} });
    const { container } = renderPlayer();
    expect(container.querySelector('.yt-music-frame')).toBeNull();
    expect(youtubePlayer.ensurePlayer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Play'));
    expect(youtubePlayer.ensurePlayer).toHaveBeenCalledWith('yt-music-frame');
    expect(container.querySelector('#yt-music-frame')).not.toBeNull();
    const town = MOODS.find(m => m.key === 'town');
    expect(youtubePlayer.playTracks).toHaveBeenCalledWith(town.tracks.map(t => t.videoId));
    expect(youtubePlayer.resume).not.toHaveBeenCalled();
  });

  it('keeps the same iframe node across pause/play and mood switches', () => {
    const { container } = renderPlayer();
    fireEvent.click(screen.getByTitle('Play Town ambience'));
    const frame = container.querySelector('.yt-music-frame');
    fireEvent.click(screen.getByTitle('Pause'));
    fireEvent.click(screen.getByTitle('Play'));
    expect(container.querySelector('.yt-music-frame')).toBe(frame);
    expect(youtubePlayer.resume).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Play Combat ambience'));
    expect(container.querySelector('.yt-music-frame')).toBe(frame);
    expect(youtubePlayer.ensurePlayer).toHaveBeenCalledTimes(1);
    const combat = MOODS.find(m => m.key === 'combat');
    expect(youtubePlayer.playTracks).toHaveBeenLastCalledWith(combat.tracks.map(t => t.videoId));
  });

  it('plays a mood, stores state, and logs the ambience change', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Town ambience'));

    const town = MOODS.find(m => m.key === 'town');
    expect(youtubePlayer.playTracks).toHaveBeenCalledWith(town.tracks.map(t => t.videoId));
    const state = musicState();
    expect(state.mood).toBe('town');
    expect(state.playing).toBe(true);
    expect(mockAddEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'music', action: 'set_ambience', mood: 'town' })
    );
  });

  it('highlights the active mood button while playing', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Combat ambience'));
    expect(screen.getByTitle('Play Combat ambience').className).toContain('active');
    expect(screen.getByTitle('Play Town ambience').className).not.toContain('active');
  });

  it('toggles pause and resume', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Tavern ambience'));
    fireEvent.click(screen.getByTitle('Pause'));
    expect(youtubePlayer.pause).toHaveBeenCalled();
    expect(musicState().playing).toBe(false);
    fireEvent.click(screen.getByTitle('Play'));
    expect(youtubePlayer.resume).toHaveBeenCalled();
    expect(musicState().playing).toBe(true);
  });

  it('stops playback and logs the stop', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Dungeon ambience'));
    fireEvent.click(screen.getByTitle('Stop'));
    expect(youtubePlayer.stop).toHaveBeenCalled();
    const state = musicState();
    expect(state.mood).toBeNull();
    expect(state.playing).toBe(false);
    expect(mockAddEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'music', action: 'stop' })
    );
  });

  it('forwards volume changes to the player', () => {
    renderPlayer();
    fireEvent.change(screen.getByTitle('Volume'), { target: { value: '40' } });
    expect(youtubePlayer.setVolume).toHaveBeenCalledWith(expect.closeTo(0.4));
    expect(musicState().volume).toBeCloseTo(0.4);
  });

  it('lets the GM override a mood with pasted YouTube URLs', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    const textarea = screen.getByPlaceholderText('One YouTube URL or video ID per line');
    fireEvent.change(textarea, { target: { value: 'https://youtu.be/aaaaaaaaaaa\nhttps://www.youtube.com/watch?v=bbbbbbbbbbb' } });
    fireEvent.click(screen.getByText('Save'));

    const state = musicState();
    expect(state.overrides.town.map(t => t.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);

    fireEvent.click(screen.getByTitle('Play Town ambience'));
    expect(youtubePlayer.playTracks).toHaveBeenCalledWith(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('ignores unparseable editor input', () => {
    renderPlayer();
    fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
    fireEvent.change(screen.getByPlaceholderText('One YouTube URL or video ID per line'), { target: { value: 'not a url' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByText('Save'));
    expect(musicState()).toBeUndefined();
    spy.mockRestore();
  });
});
