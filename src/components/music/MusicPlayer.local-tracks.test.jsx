// @maintained-by-ai 2026-11-25: 2026-11-25
// Lane: locally-hosted ambience in the per-mood track editor (offline-
// ambience backlog Item 3). Uploads become canonical { kind:'local' } draft
// rows beside the YouTube textarea, save through the SAME overrides PATCH,
// and never strand files on disk: an unsaved-draft upload is unlinked when
// the row is removed or the draft discarded, while files a SAVE drops are
// left to the server supersede prune (zero client DELETE on that lane).
// Harness mirrors MusicPlayer.custom-categories.test.jsx; the ambience engine
// is mocked, upload/DELETE fetches ride a stub server (real musicService).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import * as ambiencePlayer from '../../services/ui/ambiencePlayer.js';

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

let uploads; // every POST /audio body + scripted reply queue
let deletes; // every DELETE /audio/<file>
let postReplies;

// Server-truth stub: /music merges like campaigns-changedata; /audio answers
// from postReplies; DELETE tracks unlinks.
function stubServers(initialMusic) {
  let server = {
    mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {},
    ...(initialMusic || {}),
  };
  const posts = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'POST' && String(url).endsWith('/music')) {
      const body = JSON.parse(opts.body);
      const incoming = 'value' in body ? body.value : body;
      posts.push(incoming);
      server = { ...server, ...incoming };
      return { ok: true, status: 200, json: async () => ({ music: server, message: 'ok' }) };
    }
    if (method === 'POST' && String(url).includes('/audio')) {
      uploads.push(JSON.parse(opts.body));
      const reply = postReplies.shift();
      if (reply.status !== 200) {
        return { ok: false, status: reply.status, json: async () => ({ error: reply.error }) };
      }
      return { ok: true, status: 200, json: async () => reply.body };
    }
    if (method === 'DELETE' && String(url).includes('/audio/')) {
      deletes.push(String(url).split('/audio/')[1]);
      return { ok: true, status: 200, json: async () => ({ deleted: true }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  // In tests the runtime store IS the hydration (useSyncedState seeds from it,
  // like a live SSE-synced tab) — seed it so the editor reads the mood's rows.
  if (initialMusic) getStore('campaign').set('music', server);
  return { posts, server: () => server };
}

const UPLOADED_FILE = 'amb-1700000000000-abcdef.mp3';
const audioFile = (name = 'Camp Fire.mp3', type = 'audio/mpeg') => new File([new Uint8Array([1, 2, 3])], name, { type });
const okUpload = { status: 200, body: { src: `audio/${UPLOADED_FILE}`, title: 'Camp Fire' } };

const musicState = () => getStore('campaign').get('music');
const textarea = () => screen.getByPlaceholderText('One YouTube URL or video ID per line');
const openEditor = () => {
  fireEvent.click(screen.getByTitle('Edit tracks for this mood'));
  return textarea();
};
const localList = () => [...document.querySelectorAll('.music-editor-local-tracks li')];

// Item 3b: the starter catalogue heads every mood with bundled /audio/ beds.
// Scenarios that count UPLOAD rows clear the seeded ones first — removing a
// stored catalogue row is a draft-only edit (never a client DELETE), so the
// upload-lane deletion laws below stay isolated.
const clearSeededRows = () => {
  let btn;
  while ((btn = document.querySelector('.music-editor-local-tracks button'))) {
    fireEvent.click(btn);
  }
};

function renderPlayer() {
  return render(<MusicPlayer campaignName="test-campaign" isLocalhost />);
}

beforeEach(() => {
  vi.clearAllMocks();
  getStore('campaign').delete('music');
  uploads = [];
  deletes = [];
  postReplies = [okUpload];
});
afterEach(() => {
  globalThis.fetch.mockRestore();
});

describe('MusicPlayer local-audio editor lane', () => {
  it('the editor carries the upload control (kit primary button + hidden file input)', () => {
    stubServers();
    renderPlayer();
    openEditor();
    const button = screen.getByTitle('Upload a locally-hosted audio file (offline ambience)');
    expect(button.className).toContain('ct-btn-primary');
    const input = screen.getByLabelText('Upload local audio file');
    expect(input.type).toBe('file');
  });

  it('a successful upload lands a draft local row and Save stores the canonical mixed override', async () => {
    const stub = stubServers();
    renderPlayer();
    openEditor();
    clearSeededRows();
    fireEvent.change(textarea(), { target: { value: 'dQw4w9WgXcQ' } });
    fireEvent.change(screen.getByLabelText('Upload local audio file'), {
      target: { files: [audioFile()] }
    });

    await waitFor(() => expect(localList()).toHaveLength(1));
    expect(localList()[0].textContent).toContain('Camp Fire');

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(stub.posts.length).toBe(1));
    expect(stub.posts[0]).toEqual({
      overrides: {
        town: [
          { kind: 'youtube', src: 'dQw4w9WgXcQ', title: 'dQw4w9WgXcQ' },
          { kind: 'local', src: 'audio/amb-1700000000000-abcdef.mp3', title: 'Camp Fire' }
        ]
      }
    });
    // Saved uploads belong to the server prune lane — zero client DELETE.
    expect(deletes).toEqual([]);
  });

  it('local-only drafts save: the zero-valid refusal only fires when NOTHING is queued', async () => {
    const stub = stubServers();
    renderPlayer();
    openEditor();
    clearSeededRows();
    fireEvent.change(textarea(), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Upload local audio file'), {
      target: { files: [audioFile()] }
    });
    await waitFor(() => expect(localList()).toHaveLength(1));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(stub.posts.length).toBe(1));
    expect(stub.posts[0].overrides.town).toEqual([
      { kind: 'local', src: 'audio/amb-1700000000000-abcdef.mp3', title: 'Camp Fire' }
    ]);
    expect(document.querySelector('.music-editor-error')).toBeNull();
  });

  it('a server refusal (bad file type) surfaces the named copy in-app, no row lands', async () => {
    postReplies = [{ status: 400, error: '"notes.txt" is not a supported audio file — mp3/ogg/oga/m4a/wav only' }];
    const stub = stubServers();
    renderPlayer();
    openEditor();
    clearSeededRows(); // Item 3b: 'no row lands' means no row AT ALL
    fireEvent.change(screen.getByLabelText('Upload local audio file'), {
      target: { files: [audioFile('notes.txt', 'text/plain')] }
    });
    await waitFor(() => expect(document.querySelector('.music-editor-error'))
      .toHaveTextContent('is not a supported audio file'));
    expect(localList()).toHaveLength(0);
    expect(stub.posts).toHaveLength(0); // nothing persisted
  });

  it('the client refuses a wrong extension WITHOUT touching the wire', async () => {
    stubServers();
    renderPlayer();
    openEditor();
    fireEvent.change(screen.getByLabelText('Upload local audio file'), {
      target: { files: [audioFile('cheat.exe')] }
    });
    await waitFor(() => expect(document.querySelector('.music-editor-error'))
      .toHaveTextContent(/cheat\.exe.*is not a supported audio file/));
    expect(uploads).toHaveLength(0);
  });

  it('an oversized file is refused by name up front (5 MB body-limit hygiene)', async () => {
    stubServers();
    renderPlayer();
    openEditor();
    const big = audioFile('opera.mp3');
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText('Upload local audio file'), { target: { files: [big] } });
    await waitFor(() => expect(document.querySelector('.music-editor-error'))
      .toHaveTextContent(/opera\.mp3.*10\.0 MB/));
    expect(uploads).toHaveLength(0);
  });

  it('removing an UNSAVED upload unlinks it immediately; a stored row removal rides the save minus-row law instead', async () => {
    const stub = stubServers({
      overrides: { town: [{ kind: 'local', src: 'audio/amb-1600000000000-stored.mp3', title: 'Stored Rain' }] },
    });
    renderPlayer();
    openEditor(); // seeds the stored local row
    expect(localList().map(li => li.textContent)).toEqual([expect.stringContaining('Stored Rain')]);

    // Fresh upload + immediate remove → client DELETE (never saved).
    fireEvent.change(screen.getByLabelText('Upload local audio file'), {
      target: { files: [audioFile()] }
    });
    await waitFor(() => expect(localList()).toHaveLength(2));
    fireEvent.click(screen.getByLabelText('Remove Camp Fire'));
    await waitFor(() => expect(deletes).toEqual([UPLOADED_FILE]));
    expect(localList()).toHaveLength(1);

    // Drop the STORED row and save (with a YouTube row kept — an empty mood
    // is Reset's job, not Save's) → overrides minus the row, NO client DELETE
    // (the server supersede prune owns stored files).
    fireEvent.change(textarea(), { target: { value: 'dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByLabelText('Remove Stored Rain'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(stub.posts.length).toBe(1));
    expect(stub.posts[0].overrides.town).toEqual([{ kind: 'youtube', src: 'dQw4w9WgXcQ', title: 'dQw4w9WgXcQ' }]);
    await new Promise(res => setTimeout(res, 0));
    expect(deletes).toEqual([UPLOADED_FILE]); // still only the unsaved sweep
  });

  it('discarding the draft (Cancel → named discard) sweeps the unsaved upload', async () => {
    stubServers();
    renderPlayer();
    openEditor();
    clearSeededRows(); // Item 3b: bundled catalogue rows are never draft uploads — keep the sweep isolated
    fireEvent.change(screen.getByLabelText('Upload local audio file'), {
      target: { files: [audioFile()] }
    });
    await waitFor(() => expect(localList()).toHaveLength(1));

    fireEvent.click(screen.getByText('Cancel'));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByText('Yes, Discard'));

    await waitFor(() => expect(deletes).toEqual([UPLOADED_FILE]));
    expect(screen.queryByText('Cancel')).toBeNull(); // editor closed
  });

  it('seeding a mood shows ONLY its local rows and YouTube rows (no cross-mood bleed)', async () => {
    stubServers({
      overrides: {
        town: [
          { kind: 'youtube', src: 'dQw4w9WgXcQ', title: 'Never Gonna' },
          { kind: 'local', src: 'audio/amb-1600000000000-towntown.mp3', title: 'Town Bell' }
        ],
        tavern: [{ kind: 'local', src: 'audio/amb-1600000000001-tavernt.mp3', title: 'Harp' }]
      },
    });
    renderPlayer();
    openEditor();
    expect(textarea().value).toBe('dQw4w9WgXcQ');
    expect(localList().map(li => li.textContent)).toEqual([expect.stringContaining('Town Bell')]);

    fireEvent.change(screen.getByLabelText('Tracks mood'), { target: { value: 'tavern' } });
    expect(textarea().value).toBe('');
    expect(localList().map(li => li.textContent)).toEqual([expect.stringContaining('Harp')]);
  });

  it('playback arms the unified engine with the mixed canonical queue + campaign', () => {
    stubServers({
      overrides: {
        tavern: [
          { kind: 'local', src: 'audio/amb-1700000000000-abcdef.mp3', title: 'Camp' },
          { kind: 'youtube', src: 'dQw4w9WgXcQ', title: 'Video' }
        ]
      },
    });
    renderPlayer();
    fireEvent.click(screen.getByTitle('Play Tavern ambience'));
    expect(ambiencePlayer.playTracks).toHaveBeenCalledWith(
      [
        { kind: 'local', src: 'audio/amb-1700000000000-abcdef.mp3', title: 'Camp' },
        { kind: 'youtube', src: 'dQw4w9WgXcQ', title: 'Video' }
      ],
      'test-campaign'
    );
    expect(musicState()).toMatchObject({ mood: 'tavern', playing: true });
  });
});
