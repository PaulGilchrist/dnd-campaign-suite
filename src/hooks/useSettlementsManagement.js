import { useState, useCallback } from 'react';
import {
  loadSettlements,
  saveSettlements,
  saveSettlement,
  deleteSettlement,
} from '../services/settlementsService.js';

function useSettlementsManagement(campaignName) {
  const [settlements, setSettlements] = useState([]);
  const [loading] = useState(false);

  const loadSettlementsList = useCallback(async () => {
    if (!campaignName) return;
    try {
      const response = await loadSettlements(campaignName);
      setSettlements(response.settlements || []);
    } catch (error) {
      console.error('Failed to load settlements list:', error);
    }
  }, [campaignName]);

  const saveSettlementsList = useCallback(async (settlementsArray) => {
    try {
      await saveSettlements(campaignName, settlementsArray);
      await loadSettlementsList();
    } catch (error) {
      console.error('Failed to save settlements:', error);
      throw error;
    }
  }, [campaignName, loadSettlementsList]);

  const saveSettlementAction = useCallback(async (settlement, oldName) => {
    try {
      const result = await saveSettlement(campaignName, settlement, oldName);
      if (result?.settlement) {
        setSettlements((prev) => {
          const name = oldName || result.settlement.name;
          const index = prev.findIndex((s) => s.name === name);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = result.settlement;
            return updated;
          }
          return [...prev, result.settlement];
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to save settlement:', error);
      throw error;
    }
  }, [campaignName]);

  const deleteSettlementAction = useCallback(async (settlementName) => {
    try {
      await deleteSettlement(campaignName, settlementName);
      await loadSettlementsList();
    } catch (error) {
      console.error('Failed to delete settlement:', error);
      throw error;
    }
  }, [campaignName, loadSettlementsList]);

  return {
    settlements,
    loading,
    loadSettlementsList,
    saveSettlementsList,
    saveSettlementAction,
    deleteSettlementAction,
  };
}

export default useSettlementsManagement;
