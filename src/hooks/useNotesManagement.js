import { useState, useCallback } from 'react';
import {
  loadNotes,
  saveNotes,
  deleteNote,
} from '../services/notesService.js';

function useNotesManagement(campaignName) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadNotesList = useCallback(async () => {
    if (!campaignName) return;
    try {
      const response = await loadNotes(campaignName);
      setNotes(response.notes || []);
    } catch (error) {
      console.error('Failed to load notes list:', error);
    }
  }, [campaignName]);

  const saveNotesList = useCallback(async (notesArray) => {
    try {
      await saveNotes(campaignName, notesArray);
      await loadNotesList();
    } catch (error) {
      console.error('Failed to save notes:', error);
      throw error;
    }
  }, [campaignName, loadNotesList]);

  const deleteNoteAction = useCallback(async (noteId) => {
    try {
      await deleteNote(campaignName, noteId);
      await loadNotesList();
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error;
    }
  }, [campaignName, loadNotesList]);

  return {
    notes,
    loading,
    loadNotesList,
    saveNotesList,
    deleteNoteAction,
  };
}

export default useNotesManagement;
