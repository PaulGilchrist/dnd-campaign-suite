import { useState, useCallback } from 'react';
import {
  loadNPCs,
  saveNPCs,
  saveNPC,
  deleteNPC,
} from '../services/npcsService.js';

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

  const saveNPCAction = useCallback(async (npc) => {
    try {
      const result = await saveNPC(campaignName, npc);
      await loadNPCsList();
      return result;
    } catch (error) {
      console.error('Failed to save NPC:', error);
      throw error;
    }
  }, [campaignName, loadNPCsList]);

  const deleteNPCAction = useCallback(async (npcId) => {
    try {
      await deleteNPC(campaignName, npcId);
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
