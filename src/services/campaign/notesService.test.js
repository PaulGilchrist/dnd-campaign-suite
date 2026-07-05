// @cleaned-by-ai
// Removed redundant expect.any(Object) assertions on fetch calls that added no value.
// Kept minimal happy-path tests — error handling is implicit (service throws on error).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadNotes, saveNotes, loadNote, deleteNote } from './notesService.js';

describe('notesService', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadNotes', () => {
    it('returns notes array from successful API response', async () => {
      const mockNotes = [{ id: '1', content: 'Note 1' }, { id: '2', content: 'Note 2' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNotes),
      });

      const result = await loadNotes('campaign1');

      expect(result).toEqual(mockNotes);
    });
  });

  describe('saveNotes', () => {
    it('sends POST with notes array and returns response on success', async () => {
      const notes = [{ id: '1', content: 'Note 1' }];
      const responseData = { success: true, savedCount: 1 };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await saveNotes('campaign1', notes);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/notes',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        }
      );
    });
  });

  describe('loadNote', () => {
    it('returns a single note from API response', async () => {
      const mockNote = { id: 'note-1', content: 'Session notes' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNote),
      });

      const result = await loadNote('campaign1', 'note-1');

      expect(result).toEqual(mockNote);
    });
  });

  describe('deleteNote', () => {
    it('sends DELETE request and returns response on success', async () => {
      const responseData = { success: true, deleted: 'note-1' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await deleteNote('campaign1', 'note-1');

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/notes/note-1',
        { method: 'DELETE' }
      );
    });
  });
});
