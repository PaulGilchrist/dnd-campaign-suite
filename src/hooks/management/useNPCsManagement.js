import { useCallback } from 'react';
import { useEntityManagement } from '../useEntityManagement';
import {
  loadNPCs,
  saveNPCs,
  saveNPC,
  deleteNPC,
} from '../../services/npcs/npcsService.js';

export default function useNPCsManagement(campaignName) {
  const { items, loading, loadItems, saveItems, deleteItem } = useEntityManagement(
    campaignName,
    { load: loadNPCs, save: saveNPCs, delete: deleteNPC },
    { responseKey: 'npcs', loadOnMount: false }
  );

  const saveNPCAction = useCallback(async (npc, oldName) => {
    try {
      const result = await saveNPC(campaignName, npc, oldName);
      if (result?.npc?.imagePath) {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = result.npc.imagePath;
        });
      }
      if (result?.npc) {
        await loadItems();
      }
      return result;
    } catch (error) {
      console.error('Failed to save NPC:', error);
      throw error;
    }
  }, [campaignName, loadItems]);

  return {
    npcs: items,
    loading,
    loadNPCsList: loadItems,
    saveNPCsList: saveItems,
    saveNPCAction,
    deleteNPCAction: deleteItem,
  };
}
