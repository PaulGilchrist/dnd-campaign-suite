// @maintained-by-ai: 2026-11-06
/* Lane: continuous playback across view navigation (owner ruling 2026-11-06).
 * Music must NOT stop when the user leaves the Music view — the component is
 * persistent-mounted in App and only the PANEL hides (visible=false). Leaving
 * the view must never command the transport: no stop/dispose, no disarm POST,
 * no log row. Only the Pause/Stop buttons (or a real unmount, covered in
 * MusicPlayer.queue-exhausted.test.jsx) silence the audio. The fetch stub
 * mirrors the server music route's merge like the sibling lanes. */
import { render, screen, fireEvent } from '@testing-library/react';
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

function musicState() {
  return getStore('campaign').get('music');
}

const townButton = () => screen.queryByTitle('Play Town ambience');
const frame = (container) => container.querySelector('.yt-music-frame');

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MusicPlayer continuous playback across views', () => {
  it('hiding the panel (visible=false) keeps the frame mounted and never touches the transport', () => {
    const stub = stubMusicServer();
    const { rerender } = render(<MusicPlayer campaignName="test-campaign" visible />);
    fireEvent.click(townButton());
    expect(musicState()).toMatchObject({ mood: 'town', playing: true });
    const postsAfterPlay = stub.posts.length;

    // Navigate to another view: App keeps the component mounted and only
    // flips visible=false. The panel unmounts; the player must not.
    rerender(<MusicPlayer campaignName="test-campaign" visible={false} />);

    expect(townButton()).toBeNull(); // panel hidden
    expect(frame(document.body)).not.toBeNull(); // iframe survives
    expect(youtubePlayer.stop).not.toHaveBeenCalled();
    expect(youtubePlayer.dispose).not.toHaveBeenCalled();
    expect(stub.posts).toHaveLength(postsAfterPlay); // no disarm POST
    expect(musicState()).toMatchObject({ mood: 'town', playing: true }); // still armed
    expect(mockAddEntry).not.toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'music', action: 'stop' })
    );
  });

  it('returning to the Music view re-renders the live transport state without re-commanding playback', () => {
    const stub = stubMusicServer();
    const { rerender } = render(<MusicPlayer campaignName="test-campaign" visible />);
    fireEvent.click(townButton());
    const postsAfterPlay = stub.posts.length;
    rerender(<MusicPlayer campaignName="test-campaign" visible={false} />);

    // Navigate back.
    rerender(<MusicPlayer campaignName="test-campaign" visible />);

    expect(townButton()).toHaveClass('active'); // honest live state on return
    expect(frame(document.body)).not.toBeNull();
    expect(youtubePlayer.playTracks).toHaveBeenCalledTimes(1); // no replay on return
    expect(youtubePlayer.stop).not.toHaveBeenCalled();
    expect(youtubePlayer.dispose).not.toHaveBeenCalled();
    expect(stub.posts).toHaveLength(postsAfterPlay);
  });

  it('Stop from the panel is the seam that silences and disarms', () => {
    const stub = stubMusicServer();
    const { rerender } = render(<MusicPlayer campaignName="test-campaign" visible />);
    fireEvent.click(townButton());
    fireEvent.click(screen.getByTitle('Stop'));
    expect(youtubePlayer.stop).toHaveBeenCalledTimes(1);
    expect(musicState()).toMatchObject({ mood: null, playing: false });

    // A later view switch with nothing playing writes nothing extra.
    const postsAfterStop = stub.posts.length;
    rerender(<MusicPlayer campaignName="test-campaign" visible={false} />);
    expect(stub.posts).toHaveLength(postsAfterStop);
  });
});
