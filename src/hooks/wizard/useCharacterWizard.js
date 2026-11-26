import { useState, useRef, useCallback, useEffect, createElement } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import * as campaignService from '../../services/campaign/campaignService.js';
import { characterFileName, normalizeCharacterName } from '../../services/campaign/characterFileName.js';
import { stampElfishLineageRuntime } from '../../services/automation/handlers/class-other/elfishLineageHandler.js';
import { stampFiendishLegacyRuntime } from '../../services/automation/handlers/class-other/fiendishLegacyHandler.js';
import { endMageArmorOnDonning } from '../../services/rules/features/mageArmorService.js';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal.jsx';

// CLA-118/CLA-139: the wizard persists race.subrace only — stamp the runtime
// lineage/legacy keys in one merged write so nothing keeps granting the old choice.
function stampLineageRuntime(originalCharacter, characterData, campaignName) {
  const originalSubraceName = originalCharacter?.race?.subrace?.name;
  const newSubraceName = characterData.race?.subrace?.name;
  if (!newSubraceName || newSubraceName === originalSubraceName) return;
  if (characterData.race?.name === 'Elf') {
    stampElfishLineageRuntime(characterData.name, newSubraceName, campaignName);
  }
  if (characterData.race?.name === 'Tiefling') {
    stampFiendishLegacyRuntime(characterData.name, newSubraceName, campaignName);
  }
}

export function useCharacterWizard(campaignName) {
  const [showCharacterWizard, setShowCharacterWizard] = useState(false);
  const [showEditCharacterWizard, setShowEditCharacterWizard] = useState(false);
  // Captured edit-session seed: set ONLY by handleEditCharacter and cleared when the
  // session closes. The edit wizard renders from this instead of the live
  // activeCharacter, so a remount (campaign re-select, view churn) can never silently
  // re-target a different character (2026-11-20 reattach bug).
  const [editingCharacter, setEditingCharacter] = useState(null);
  const callbacksRef = useRef({ setCharacters: null, setActiveCharacter: null });
  const originalCharacterRef = useRef(null);

  // Item 7 (native-dialog retirement, wizard save lane): the level-change
  // confirm and the save-failure alert ride IN-APP dialog state — an
  // unhandled native window.confirm/alert blocks every automated driver
  // call (the Item 7 e2e wedge law). Mirrors the useReloadGuard toll shape:
  // the pending verdict lives in a ref so settle answers the EXACT promise
  // that armed it; the host mounts `wizardDialog` as a sibling overlay.
  // Cancel/Escape/backdrop on the level toll = abort the save, wizard and
  // draft stay (zero writes). The error face dismisses either way — the
  // failed save already wrote nothing and the wizard stays open for a retry.
  const [pendingAsk, setPendingAsk] = useState(null);
  const askResolveRef = useRef(null);
  const settleAsk = useCallback((proceed) => {
    const resolve = askResolveRef.current;
    askResolveRef.current = null;
    setPendingAsk(null);
    if (resolve) resolve(proceed);
  }, []);
  const askLevelChange = useCallback((message) => {
    settleAsk(false); // re-entrant ask answers the PREVIOUS toll KEEP
    return new Promise((resolve) => {
      askResolveRef.current = resolve;
      setPendingAsk({ kind: 'level-change', message });
    });
  }, [settleAsk]);
  const showWizardError = useCallback((message) => {
    settleAsk(false);
    setPendingAsk({ kind: 'error', message });
  }, [settleAsk]);
  // Never strand a pending toll on unmount (campaign switch mid-dialog): the
  // caller's proceed-branch is answered KEEP (useReloadGuard law).
  useEffect(() => () => {
    const resolve = askResolveRef.current;
    askResolveRef.current = null;
    if (resolve) resolve(false);
  }, []);
  const wizardDialog = pendingAsk
    ? pendingAsk.kind === 'level-change'
      ? createElement(DeleteConfirmModal, {
          titleId: 'wizard-level-change-title',
          title: 'Change Level?',
          confirmLabel: 'Change Level',
          onCancel: () => settleAsk(false),
          onConfirm: () => settleAsk(true),
        }, pendingAsk.message)
      : createElement(DeleteConfirmModal, {
          titleId: 'wizard-save-error-title',
          title: 'Save Failed',
          confirmLabel: 'OK',
          onCancel: () => settleAsk(false),
          onConfirm: () => settleAsk(false),
        }, pendingAsk.message)
    : null;

  const setCharacterCallbacks = useCallback(({ setCharacters, setActiveCharacter }) => {
    callbacksRef.current = { setCharacters, setActiveCharacter };
  }, []);

  const handleAddCharacter = useCallback(() => {
    setShowCharacterWizard(true);
  }, []);

  const handleWizardCancel = useCallback(() => {
    setShowCharacterWizard(false);
  }, []);

  const handleWizardComplete = useCallback(async (characterData) => {
    try {
      if (!campaignName) throw new Error('No campaign selected');
      // Normalize the display name client-side too (server mirror) so the
      // local roster/sidebar shows exactly what the server stores — no
      // leading/trailing spaces, collapsed internal runs.
      const payload = { ...characterData, name: normalizeCharacterName(characterData.name) };
      const result = await campaignService.createCharacter(campaignName, payload);
      callbacksRef.current.setActiveCharacter(cloneDeep(result.character));
      setShowCharacterWizard(false);
      const encodedCampaign = encodeURIComponent(campaignName);
      const characterFiles = await fetch(`/api/campaigns/${encodedCampaign}`).then(res => res.json()).then(data => data.files);
      const newCharacters = await Promise.all(
        characterFiles.map(file => fetch(`/api/campaigns/${encodedCampaign}/${encodeURIComponent(file)}`).then(res => res.json()))
      );
      callbacksRef.current.setCharacters(newCharacters);
    } catch (error) {
      console.error('Error creating character:', error);
      // Single-owner prefix (mirrors the delete lane, App.jsx wrapper): the
      // service's Error already carries "Failed to create character: " on HTTP
      // failures, so surfacing the message verbatim avoids the doubled prefix.
      // Item 7: in-app dialog face (was a native alert — see the wizardDialog
      // state machine above); the wizard stays open so the draft survives.
      showWizardError(error.message);
    }
  }, [campaignName, showWizardError]);

  const handleEditCharacter = useCallback((originalCharacter) => {
    originalCharacterRef.current = originalCharacter;
    setEditingCharacter(originalCharacter);
    setShowEditCharacterWizard(true);
  }, []);

  const handleEditWizardCancel = useCallback(() => {
    setShowEditCharacterWizard(false);
    setEditingCharacter(null);
  }, []);

  // Campaign-switch seam (App.jsx handleCampaignSelect / back-to-Campaigns): the
  // wizard open-flags are App-level state on a never-unmounted component, so
  // leaving and re-entering a campaign would otherwise resurrect a stale wizard
  // session — the edit lane re-seeded from the new activeCharacter. Close both
  // lanes and drop the captured edit seed.
  const closeWizards = useCallback(() => {
    setShowCharacterWizard(false);
    setShowEditCharacterWizard(false);
    setEditingCharacter(null);
  }, []);

  const handleEditWizardComplete = useCallback(async (characterData) => {
    try {
      if (!campaignName) throw new Error('No campaign selected');
      const originalCharacter = originalCharacterRef.current;
      // Destructive-edit guard (mirrors the Quests confirm that names the
      // object): a level change re-derives proficiency, HP and every dependent
      // modifier across the live campaign — name the change and confirm IN-APP
      // before the save PUT fires (Item 7: the shared DeleteConfirmModal tier,
      // never a native confirm). Cancel aborts the save and keeps the wizard
      // open.
      // Mirror the server's display-name normalization so the PUT URL, the
      // stored name, and local roster state all agree on the clean spelling.
      const savedData = { ...characterData, name: normalizeCharacterName(characterData.name) };
      const originalLevel = Number(originalCharacter?.level);
      const newLevel = Number(savedData?.level);
      if (
        Number.isFinite(originalLevel) &&
        Number.isFinite(newLevel) &&
        originalLevel !== newLevel
      ) {
        const proceed = await askLevelChange(
          `Change ${savedData.name}'s level from ${originalLevel} to ${newLevel}? This updates the character in the live campaign.`
        );
        if (!proceed) {
          return;
        }
      }
      const originalFileName = characterFileName(originalCharacter.name);
      const fileName = characterFileName(savedData.name);
      await campaignService.updateCharacter(campaignName, fileName, savedData, originalFileName);
      // SP-074: inventory step (16) saves are the donning seam — armor newly added
      // to equipped[] ends Mage Armor before any consumer re-reads the sheet (§39).
      await endMageArmorOnDonning(originalCharacter, savedData, campaignName);
      stampLineageRuntime(originalCharacter, savedData, campaignName);
      callbacksRef.current.setActiveCharacter(cloneDeep(savedData));
      setShowEditCharacterWizard(false);
      setEditingCharacter(null);
      const { setCharacters } = callbacksRef.current;
      setCharacters(prev => prev.map(char => char.name === originalCharacter.name ? savedData : char));
    } catch (error) {
      console.error('Error updating character:', error);
      // Single-owner prefix (see the create catch above): surface the service's
      // already-prefixed message verbatim — no "Failed to update character:
      // Failed to update character: Not Found" doubling. Item 7: in-app
      // dialog face (was a native alert); wizard + draft stay for a retry.
      showWizardError(error.message);
    }
  }, [campaignName, askLevelChange, showWizardError]);

  return {
    showCharacterWizard,
    showEditCharacterWizard,
    editingCharacter,
    closeWizards,
    handleAddCharacter,
    handleWizardComplete,
    handleWizardCancel,
    handleEditCharacter,
    handleEditWizardComplete,
    handleEditWizardCancel,
    setCharacterCallbacks,
    wizardDialog,
  };
}
