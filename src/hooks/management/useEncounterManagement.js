import { useState, useCallback } from 'react';
import {
  loadEncounters,
  saveEncounter as saveEncounterService,
  loadEncounter,
  updateEncounter,
  deleteEncounter,
  renameEncounter,
} from '../../services/encounters/encountersService.js';

function useEncounterManagement(campaignName) {
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'save' | 'load' | 'rename'

  const loadEncounterList = useCallback(async () => {
    if (!campaignName) return;
    try {
      const response = await loadEncounters(campaignName);
      setEncounters(response.encounters || []);
    } catch (error) {
      console.error('Failed to load encounter list:', error);
    }
  }, [campaignName]);

  const openSaveModal = useCallback(() => {
    setModalMode('save');
    setModalOpen(true);
  }, []);

  const openLoadModal = useCallback(async () => {
    await loadEncounterList();
    setModalMode('load');
    setModalOpen(true);
  }, [loadEncounterList]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalMode(null);
  }, []);

  const saveEncounter = useCallback(async (name, data) => {
    try {
      await saveEncounterService(campaignName, name, data);
      await loadEncounterList();
    } catch (error) {
      console.error('Failed to save encounter:', error);
      throw error;
    }
  }, [campaignName, loadEncounterList]);

  const handleLoad = useCallback(async (name) => {
    setLoading(true);
    try {
      const data = await loadEncounter(campaignName, name);
      closeModal();
      return data;
    } catch (error) {
      console.error('Failed to load encounter:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [campaignName, closeModal]);

  const handleDelete = useCallback(async (name) => {
    try {
      await deleteEncounter(campaignName, name);
      await loadEncounterList();
    } catch (error) {
      console.error('Failed to delete encounter:', error);
      throw error;
    }
  }, [campaignName, loadEncounterList]);

  const handleRename = useCallback(async (oldName, newName) => {
    try {
      await renameEncounter(campaignName, oldName, newName);
      await loadEncounterList();
    } catch (error) {
      console.error('Failed to rename encounter:', error);
      throw error;
    }
  }, [campaignName, loadEncounterList]);

  const updateExistingEncounter = useCallback(async (name, data) => {
    try {
      await updateEncounter(campaignName, name, data);
    } catch (error) {
      console.error('Failed to update encounter:', error);
      throw error;
    }
  }, [campaignName]);

  return {
    encounters,
    loading,
    modalOpen,
    modalMode,
    loadEncounterList,
    openSaveModal,
    openLoadModal,
    closeModal,
    saveEncounter,
    updateEncounter: updateExistingEncounter,
    loadEncounterData: handleLoad,
    deleteEncounterAction: handleDelete,
    renameEncounterAction: handleRename,
  };
}

export default useEncounterManagement;
