import { useEntityManagement } from '../useEntityManagement';
import {
  loadFactions,
  saveFactions,
  deleteFaction,
} from '../../services/campaign/factionsService.js';

export default function useFactionsManagement(campaignName) {
  const { items, loading, loadItems, saveItems, deleteItem } = useEntityManagement(
    campaignName,
    { load: loadFactions, save: saveFactions, delete: deleteFaction },
    { responseKey: 'factions', loadOnMount: false }
  );

  return {
    factions: items,
    loading,
    loadFactionsList: loadItems,
    saveFactionsList: saveItems,
    deleteFactionAction: deleteItem,
  };
}
