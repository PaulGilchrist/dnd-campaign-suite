import { useState, useCallback, useEffect } from 'react';
import * as questsService from '../services/campaign/questsService.js';

function useQuestsManagement(campaignName) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadQuestsList = useCallback(async () => {
    if (!campaignName) return;
    setLoading(true);
    try {
      const quests = await questsService.loadQuests(campaignName);
      setQuests(quests);
    } catch (error) {
      console.error('Failed to load quests:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignName]);

  const saveQuestsList = useCallback(async (questsArray) => {
    if (!campaignName) return;
    try {
      await questsService.saveQuests(campaignName, questsArray);
      await loadQuestsList();
    } catch (error) {
      console.error('Failed to save quests:', error);
    }
  }, [campaignName, loadQuestsList]);

  const deleteQuestAction = useCallback(async (questId) => {
    if (!campaignName) return;
    try {
      await questsService.deleteQuest(campaignName, questId);
      await loadQuestsList();
    } catch (error) {
      console.error('Failed to delete quest:', error);
    }
  }, [campaignName, loadQuestsList]);

  useEffect(() => {
    if (campaignName) {
      loadQuestsList();
    }
  }, [campaignName, loadQuestsList]);

  return { quests, loading, loadQuestsList, saveQuestsList, deleteQuestAction };
}

export default useQuestsManagement;
