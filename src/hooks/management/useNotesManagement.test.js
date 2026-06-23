// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import useNotesManagement from './useNotesManagement.js';

const mockLoadNotes = vi.fn();
const mockSaveNotes = vi.fn();
const mockDeleteNote = vi.fn();

vi.mock('../../services/campaign/notesService.js', () => ({
  loadNotes: (...args) => mockLoadNotes(...args),
  saveNotes: (...args) => mockSaveNotes(...args),
  deleteNote: (...args) => mockDeleteNote(...args),
}));

describe('useNotesManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets notes to empty array', () => {
      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      expect(result.current.notes).toEqual([]);
    });

    it('sets loading to false', () => {
      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      expect(result.current.loading).toBe(false);
    });
  });

  describe('loadNotesList', () => {
    it('loads and sets notes from service', async () => {
      const notesData = [
        { id: 'note-1', title: 'Session 1 Recap', content: 'The party...' },
        { id: 'note-2', title: 'NPC Backstory', content: 'Secret past...' },
      ];
      mockLoadNotes.mockResolvedValue({ notes: notesData });

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(mockLoadNotes).toHaveBeenCalledWith('test-campaign');
      expect(result.current.notes).toEqual(notesData);
    });

    it('does nothing when campaignName is empty string', async () => {
      const { result } = renderHook(() => useNotesManagement(''));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(mockLoadNotes).not.toHaveBeenCalled();
      expect(result.current.notes).toEqual([]);
    });

    it('does nothing when campaignName is null', async () => {
      const { result } = renderHook(() => useNotesManagement(null));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(mockLoadNotes).not.toHaveBeenCalled();
      expect(result.current.notes).toEqual([]);
    });

    it('does nothing when campaignName is undefined', async () => {
      const { result } = renderHook(() => useNotesManagement(undefined));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(mockLoadNotes).not.toHaveBeenCalled();
      expect(result.current.notes).toEqual([]);
    });

    it('defaults to empty array when response has no notes field', async () => {
      mockLoadNotes.mockResolvedValue({});

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(result.current.notes).toEqual([]);
    });

    it('defaults to empty array when response.notes is null', async () => {
      mockLoadNotes.mockResolvedValue({ notes: null });

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(result.current.notes).toEqual([]);
    });

    it('defaults to empty array when response.notes is undefined', async () => {
      mockLoadNotes.mockResolvedValue({ notes: undefined });

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(result.current.notes).toEqual([]);
    });

    it('defaults to empty array when response is null', async () => {
      mockLoadNotes.mockResolvedValue(null);

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(result.current.notes).toEqual([]);
    });

    it('handles error by logging and keeping previous empty state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadNotes.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load notes list:',
        expect.any(Error)
      );
      expect(result.current.notes).toEqual([]);
    });

    it('handles error and keeps previous state when notes were already loaded', async () => {
      const existingNotes = [{ id: 'note-1', title: 'Existing' }];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // First successful load
      mockLoadNotes.mockResolvedValueOnce({ notes: existingNotes });
      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.loadNotesList();
      });
      expect(result.current.notes).toEqual(existingNotes);

      // Then a failed load should preserve existing state
      mockLoadNotes.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.loadNotesList();
      });

      expect(result.current.notes).toEqual(existingNotes);
      consoleSpy.mockRestore();
    });
  });

  describe('saveNotesList', () => {
    it('saves notes and reloads the list', async () => {
      const notesToSave = [{ id: 'note-1', title: 'Session 1', content: 'Done' }];
      mockSaveNotes.mockResolvedValue({ success: true });
      mockLoadNotes.mockResolvedValue({ notes: notesToSave });

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.saveNotesList(notesToSave);
      });

      expect(mockSaveNotes).toHaveBeenCalledWith('test-campaign', notesToSave);
      expect(mockLoadNotes).toHaveBeenCalled();
      expect(result.current.notes).toEqual(notesToSave);
    });

    it('reloads notes from service after successful save', async () => {
      const notesToSave = [{ id: 'note-1', title: 'Session 1' }];
      const refreshedNotes = [{ id: 'note-1', title: 'Session 1', updated: true }];
      mockSaveNotes.mockResolvedValue({ success: true });
      mockLoadNotes.mockResolvedValue({ notes: refreshedNotes });

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.saveNotesList(notesToSave);
      });

      // The UI should reflect what the server returned, not what we sent
      expect(result.current.notes).toEqual(refreshedNotes);
    });

    it('throws error when save fails', async () => {
      mockSaveNotes.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveNotesList([{ id: 'note-1' }]);
        })
      ).rejects.toThrow('Save failed');
    });

    it('does not reload notes when save fails', async () => {
      const existingNotes = [{ id: 'note-1', title: 'Existing' }];
      mockLoadNotes.mockResolvedValue({ notes: existingNotes });
      mockSaveNotes.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      // Pre-populate notes
      await act(async () => {
        await result.current.loadNotesList();
      });
      expect(result.current.notes).toEqual(existingNotes);

      // Clear the load mock to detect if it's called during the failed save
      mockLoadNotes.mockClear();

      await expect(
        act(async () => {
          await result.current.saveNotesList([{ id: 'note-2' }]);
        })
      ).rejects.toThrow('Save failed');

      // loadNotes should NOT have been called after a failed save
      expect(mockLoadNotes).not.toHaveBeenCalled();
      // Notes should remain unchanged
      expect(result.current.notes).toEqual(existingNotes);
    });

    it('throws error with correct message when save throws generic error', async () => {
      mockSaveNotes.mockRejectedValue(new Error('Connection refused'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveNotesList([]);
        })
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('deleteNoteAction', () => {
    it('deletes a note and reloads the list', async () => {
      mockDeleteNote.mockResolvedValue({ success: true });
      mockLoadNotes.mockResolvedValue({ notes: [] });

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.deleteNoteAction('note-1');
      });

      expect(mockDeleteNote).toHaveBeenCalledWith('test-campaign', 'note-1');
      expect(mockLoadNotes).toHaveBeenCalled();
      expect(result.current.notes).toEqual([]);
    });

    it('reloads notes from service after successful delete', async () => {
      const remainingNotes = [{ id: 'note-2', title: 'Still Here' }];
      mockDeleteNote.mockResolvedValue({ success: true });
      mockLoadNotes.mockResolvedValue({ notes: remainingNotes });

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await act(async () => {
        await result.current.deleteNoteAction('note-1');
      });

      expect(result.current.notes).toEqual(remainingNotes);
    });

    it('throws error when delete fails', async () => {
      mockDeleteNote.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.deleteNoteAction('note-1');
        })
      ).rejects.toThrow('Delete failed');
    });

    it('does not reload notes when delete fails', async () => {
      const existingNotes = [
        { id: 'note-1', title: 'To Delete' },
        { id: 'note-2', title: 'Kept' },
      ];
      mockLoadNotes.mockResolvedValue({ notes: existingNotes });
      mockDeleteNote.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      // Pre-populate notes
      await act(async () => {
        await result.current.loadNotesList();
      });
      expect(result.current.notes).toEqual(existingNotes);

      // Clear the load mock to detect if it's called during the failed delete
      mockLoadNotes.mockClear();

      await expect(
        act(async () => {
          await result.current.deleteNoteAction('note-1');
        })
      ).rejects.toThrow('Delete failed');

      // loadNotes should NOT have been called after a failed delete
      expect(mockLoadNotes).not.toHaveBeenCalled();
      // Notes should remain unchanged
      expect(result.current.notes).toEqual(existingNotes);
    });
  });
});
