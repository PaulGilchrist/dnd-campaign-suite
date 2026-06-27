import { useEntityManagement } from '../useEntityManagement';
import {
  loadNotes,
  saveNotes,
  deleteNote,
} from '../../services/campaign/notesService.js';

export default function useNotesManagement(campaignName) {
  const { items, loading, loadItems, saveItems, deleteItem } = useEntityManagement(
    campaignName,
    { load: loadNotes, save: saveNotes, delete: deleteNote },
    { responseKey: 'notes', loadOnMount: false }
  );

  return {
    notes: items,
    loading,
    loadNotesList: loadItems,
    saveNotesList: saveItems,
    deleteNoteAction: deleteItem,
  };
}
