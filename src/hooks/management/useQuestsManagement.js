import { useEntityManagement } from '../useEntityManagement';
import * as questsService from '../../services/campaign/questsService.js';

export default function useQuestsManagement(campaignName) {
  const { items, loading, loadItems, saveItems, deleteItem } = useEntityManagement(
    campaignName,
    { load: questsService.loadQuests, save: questsService.saveQuests, delete: questsService.deleteQuest },
    { loadOnMount: true }
  );

  return {
    quests: items,
    loading,
    loadQuestsList: loadItems,
    saveQuestsList: saveItems,
    deleteQuestAction: deleteItem,
  };
}
