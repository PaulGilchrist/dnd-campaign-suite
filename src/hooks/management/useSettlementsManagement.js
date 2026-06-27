import { useCallback } from 'react';
import { useEntityManagement } from '../useEntityManagement';
import {
  loadSettlements,
  saveSettlements,
  saveSettlement,
  deleteSettlement,
} from '../../services/campaign/settlementsService.js';

export default function useSettlementsManagement(campaignName) {
  const { items, loading, loadItems, saveItems, deleteItem } = useEntityManagement(
    campaignName,
    { load: loadSettlements, save: saveSettlements, delete: deleteSettlement },
    { responseKey: 'settlements', loadOnMount: false }
  );

  const saveSettlementAction = useCallback(async (settlement, oldName) => {
    try {
      const result = await saveSettlement(campaignName, settlement, oldName);
      if (result?.settlement) {
        await loadItems();
      }
      return result;
    } catch (error) {
      console.error('Failed to save settlement:', error);
      throw error;
    }
  }, [campaignName, loadItems]);

  return {
    settlements: items,
    loading,
    loadSettlementsList: loadItems,
    saveSettlementsList: saveItems,
    saveSettlementAction,
    deleteSettlementAction: deleteItem,
  };
}
