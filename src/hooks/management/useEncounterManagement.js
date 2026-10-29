// NOTE: This hook has a significantly different shape (modal state, individual encounter
// operations) and is not refactored to useEntityManagement.
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
    // QA 2026-10-24: list reloads (open/save/delete/rename) must expose a
    // `loading` window so EncounterModal can disable stale row actions —
    // a pen click landing between setEncounters and onClose silently closed
    // the modal with zero feedback.
    setLoading(true);
    try {
      const response = await loadEncounters(campaignName);
      setEncounters(response.encounters || []);
    } catch (error) {
      console.error('Failed to load encounter list:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignName]);

  const openSaveModal = useCallback(() => {
    setModalMode('save');
    setModalOpen(true);
  }, []);

  const openLoadModal = useCallback(async () => {
    // QA 2026-10-24: open first, then reload — the fetch window is made
    // visible INSIDE the modal (rows disabled while `loading`) instead of
    // landing fresh rows into an already-open modal the instant a stale
    // node may have been captured (silent-close flake).
    setModalMode('load');
    setModalOpen(true);
    await loadEncounterList();
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

  // Backlog 2026-10-28-U: single-layer logging (c5d784d1f canon, mirroring
  // updateExistingEncounter below): the service logs the one
  // `Error renaming encounter:` console.error; failures pass through untouched
  // to the leaf EncounterModal, which renders the inline error. Run U counted
  // THREE app lines for one dup-name rename (service + hook + modal) — this
  // wrapper must stay silent.
  const handleRename = useCallback(async (oldName, newName) => {
    await renameEncounter(campaignName, oldName, newName);
    await loadEncounterList();
  }, [campaignName, loadEncounterList]);

  // No try/catch here (lint no-useless-catch + c5d784d1f single-layer
  // fingerprint): the service logs the one console.error, the error passes
  // through to EncounterBuilder which owns the user-facing copy. Run-S
  // double-logging (hook + component) is what pinned this lane silent.
  const updateExistingEncounter = useCallback(
    (name, data) => updateEncounter(campaignName, name, data),
    [campaignName]
  );

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
