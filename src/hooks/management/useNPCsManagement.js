import { useState, useCallback } from 'react';
import {
  loadNPCs,
  saveNPCs,
  saveNPC,
  deleteNPC,
} from '../../services/npcs/npcsService.js';

function useNPCsManagement(campaignName) {
  const [npcs, setNpcs] = useState([]);
  const [loading] = useState(false);

  const loadNPCsList = useCallback(async () => {
    if (!campaignName) return;
    try {
      const response = await loadNPCs(campaignName);
      setNpcs(response.npcs || []);
    } catch (error) {
      console.error('Failed to load NPCs list:', error);
    }
  }, [campaignName]);

  const saveNPCsList = useCallback(async (npcsArray) => {
    try {
      await saveNPCs(campaignName, npcsArray);
      await loadNPCsList();
    } catch (error) {
      console.error('Failed to save NPCs:', error);
      throw error;
    }
  }, [campaignName, loadNPCsList]);

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
        setNpcs((prev) => {
          const name = oldName || result.npc.name;
          const index = prev.findIndex((n) => n.name === name);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = result.npc;
            return updated;
          }
          return [...prev, result.npc];
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to save NPC:', error);
      throw error;
    }
  }, [campaignName]);

  const deleteNPCAction = useCallback(async (npcName) => {
    try {
      await deleteNPC(campaignName, npcName);
      await loadNPCsList();
    } catch (error) {
      console.error('Failed to delete NPC:', error);
      throw error;
    }
  }, [campaignName, loadNPCsList]);

  return {
    npcs,
    loading,
    loadNPCsList,
    saveNPCsList,
    saveNPCAction,
    deleteNPCAction,
  };
}

export default useNPCsManagement;
