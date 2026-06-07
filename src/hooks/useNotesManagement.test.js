import { renderHook, act } from '@testing-library/react';
import useNotesManagement from './useNotesManagement.js';

const mockLoadNotes = vi.fn();
const mockSaveNotes = vi.fn();
const mockDeleteNote = vi.fn();

vi.mock('../services/campaign/notesService.js', () => ({
  loadNotes: (...args) => mockLoadNotes(...args),
  saveNotes: (...args) => mockSaveNotes(...args),
  deleteNote: (...args) => mockDeleteNote(...args),
}));

describe('useNotesManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets notes to empty array and loading to false', () => {
      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      expect(result.current.notes).toEqual([]);
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

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useNotesManagement(''));

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

    it('handles error by logging and keeping previous state', async () => {
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

    it('throws error when save fails', async () => {
      mockSaveNotes.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.saveNotesList([{ id: 'note-1' }]);
        })
      ).rejects.toThrow('Save failed');
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

    it('throws error when delete fails', async () => {
      mockDeleteNote.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useNotesManagement('test-campaign'));

      await expect(
        act(async () => {
          await result.current.deleteNoteAction('note-1');
        })
      ).rejects.toThrow('Delete failed');
    });
  });
});
