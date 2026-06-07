import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadNotes, saveNotes, loadNote, deleteNote } from './notesService.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('notesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadNotes', () => {
    it('should return notes from API response', async () => {
      const mockNotes = [{ id: '1', content: 'Note 1' }, { id: '2', content: 'Note 2' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNotes),
      });

      const result = await loadNotes('campaign1');

      expect(result).toEqual(mockNotes);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/notes',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await loadNotes('campaign with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadNotes('campaign1')).rejects.toThrow('Campaign not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadNotes('campaign1')).rejects.toThrow('Failed to load notes');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadNotes('campaign1')).rejects.toThrow('Network error');
    });
  });

  describe('saveNotes', () => {
    it('should save notes and return response', async () => {
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

    it('should encode campaign name in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveNotes('campaign with spaces', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes',
        expect.any(Object)
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid notes data' }),
      });

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Invalid notes data');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Failed to save notes');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Network error');
    });
  });

  describe('loadNote', () => {
    it('should return a single note from API response', async () => {
      const mockNote = { id: 'note-1', content: 'Session notes' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNote),
      });

      const result = await loadNote('campaign1', 'note-1');

      expect(result).toEqual(mockNote);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/notes/note-1',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should encode campaign and note IDs in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadNote('campaign with spaces', 'note with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes/note%20with%20spaces',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Note not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Failed to load note');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Network error');
    });
  });

  describe('deleteNote', () => {
    it('should delete a note and return response', async () => {
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

    it('should encode campaign and note IDs in URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteNote('campaign with spaces', 'note with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign%20with%20spaces/notes/note%20with%20spaces',
        { method: 'DELETE' }
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Note not found');
    });

    it('should throw generic message when error is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Failed to delete note');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Network error');
    });
  });
});
