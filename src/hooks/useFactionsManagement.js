import { useState, useCallback } from 'react';
import {
  loadFactions,
  saveFactions,
  deleteFaction,
} from '../services/factionsService.js';

function useFactionsManagement(campaignName) {
  const [factions, setFactions] = useState([]);
  const [loading] = useState(false);

  const loadFactionsList = useCallback(async () => {
    if (!campaignName) return;
    try {
      const response = await loadFactions(campaignName);
      setFactions(response.factions || []);
    } catch (error) {
      console.error('Failed to load Factions list:', error);
    }
  }, [campaignName]);

  const saveFactionsList = useCallback(async (factionsArray) => {
    try {
      await saveFactions(campaignName, factionsArray);
      await loadFactionsList();
    } catch (error) {
      console.error('Failed to save Factions:', error);
      throw error;
    }
  }, [campaignName, loadFactionsList]);

  const deleteFactionAction = useCallback(async (factionId) => {
    try {
      await deleteFaction(campaignName, factionId);
      await loadFactionsList();
    } catch (error) {
      console.error('Failed to delete Faction:', error);
      throw error;
    }
  }, [campaignName, loadFactionsList]);

  return {
    factions,
    loading,
    loadFactionsList,
    saveFactionsList,
    deleteFactionAction,
  };
}

export default useFactionsManagement;
