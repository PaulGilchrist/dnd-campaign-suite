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
    it('returns the full API response on success', async () => {
      const mockNotes = [
        { id: '1', description: 'Note 1', isPrivate: false },
        { id: '2', description: 'Note 2', isPrivate: true },
      ];
      const responseData = { notes: mockNotes };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await loadNotes('campaign1');

      expect(result).toEqual(responseData);
    });

    it('returns response with empty notes array when API returns no notes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      });

      const result = await loadNotes('campaign1');

      expect(result).toEqual({ notes: [] });
    });

    it('URL-encodes the campaign name and includes GET options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      });

      await loadNotes('my campaign/1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/notes',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Campaign not found' }),
      });

      await expect(loadNotes('campaign1')).rejects.toThrow('Campaign not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadNotes('campaign1')).rejects.toThrow('Failed to load notes');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadNotes('campaign1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('saveNotes', () => {
    it('sends POST with notes array on success', async () => {
      const notes = [
        { id: 'note-1', description: 'First note', isPrivate: false },
        { id: 'note-2', description: 'GM secret', isPrivate: true },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveNotes('campaign1', notes);

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

    it('URL-encodes the campaign name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await saveNotes('my campaign/1', []);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/notes',
        expect.any(Object)
      );
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid notes data' }),
      });

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Invalid notes data');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(saveNotes('campaign1', [])).rejects.toThrow('Failed to save notes');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(saveNotes('campaign1', [])).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('loadNote', () => {
    it('returns the full API response on success', async () => {
      const mockNote = { id: 'note-1', description: 'Session notes', isPrivate: false };
      const responseData = { note: mockNote };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await loadNote('campaign1', 'note-1');

      expect(result).toEqual(responseData);
    });

    it('URL-encodes both campaign name and note ID and includes GET options', async () => {
      const mockNote = { id: 'note-1', description: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ note: mockNote }),
      });

      await loadNote('my campaign/1', 'note%2Fwith%2Fslashes');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/notes/note%252Fwith%252Fslashes',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Note not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('Failed to load note');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(loadNote('campaign1', 'note-1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('deleteNote', () => {
    it('sends DELETE request on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteNote('campaign1', 'note-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/campaign1/notes/note-1',
        { method: 'DELETE' }
      );
    });

    it('URL-encodes both campaign name and note ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteNote('my campaign/1', 'note%2Fwith%2Fslashes');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign%2F1/notes/note%252Fwith%252Fslashes',
        { method: 'DELETE' }
      );
    });

    it('throws with custom error message on API error, generic fallback on network failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Note not found' }),
      });

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Note not found');

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('Failed to delete note');

      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(deleteNote('campaign1', 'note-1')).rejects.toThrow('ENOTFOUND');
    });
  });
});
