// @improved-by-ai
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

    it('returns empty array when no notes exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await loadNotes('campaign1');

      expect(result).toEqual([]);
    });

    it('encodes campaign name with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadNotes('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes',
        expect.any(Object)
      );
    });

    it('encodes campaign name with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadNotes('campaign/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%2Fslashes/notes',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadNotes('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadNotes('campaign1')).rejects.toThrow('Failed to load notes');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadNotes('campaign1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadNotes('campaign1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading notes:', expect.any(Error));
      consoleSpy.mockRestore();
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

    it('sends empty array when notes is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveNotes('campaign1', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ notes: [] }),
        })
      );
    });

    it('encodes campaign name with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await saveNotes('campaign with spaces', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes',
        expect.any(Object)
      );
    });

    it('encodes campaign name with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await saveNotes('campaign/with/slashes', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2Fwith%2Fslashes/notes',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid notes data' }),
      });

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Invalid notes data');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Failed to save notes');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveNotes('campaign1', [])).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error saving notes:', expect.any(Error));
      consoleSpy.mockRestore();
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

    it('encodes campaign and note IDs with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadNote('campaign with spaces', 'note with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes/note%20with%20spaces',
        expect.any(Object)
      );
    });

    it('encodes campaign and note IDs with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadNote('campaign/1', 'note/abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/notes/note%2Fabc',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Note not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Failed to load note');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error loading note:', expect.any(Error));
      consoleSpy.mockRestore();
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

    it('encodes campaign and note IDs with spaces in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await deleteNote('campaign with spaces', 'note with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes/note%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('encodes campaign and note IDs with special characters in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await deleteNote('campaign/1', 'note/abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%2F1/notes/note%2Fabc',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error message on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Note not found');
    });

    it('throws generic message when API error has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Failed to delete note');
    });

    it('throws the original error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('ENOTFOUND');
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error deleting note:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
