import { useState, useRef, useCallback } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import * as campaignService from '../../services/campaign/campaignService.js';
import { characterFileName, normalizeCharacterName } from '../../services/campaign/characterFileName.js';
import { stampElfishLineageRuntime } from '../../services/automation/handlers/class-other/elfishLineageHandler.js';
import { stampFiendishLegacyRuntime } from '../../services/automation/handlers/class-other/fiendishLegacyHandler.js';
import { endMageArmorOnDonning } from '../../services/rules/features/mageArmorService.js';

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
  const callbacksRef = useRef({ setCharacters: null, setActiveCharacter: null });
  const originalCharacterRef = useRef(null);

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
      alert(`Failed to create character: ${error.message}`);
    }
  }, [campaignName]);

  const handleEditCharacter = useCallback((originalCharacter) => {
    originalCharacterRef.current = originalCharacter;
    setShowEditCharacterWizard(true);
  }, []);

  const handleEditWizardCancel = useCallback(() => {
    setShowEditCharacterWizard(false);
  }, []);

  const handleEditWizardComplete = useCallback(async (characterData) => {
    try {
      if (!campaignName) throw new Error('No campaign selected');
      const originalCharacter = originalCharacterRef.current;
      // Destructive-edit guard (mirrors the Quests confirm that names the
      // object): a level change re-derives proficiency, HP and every dependent
      // modifier across the live campaign — name the change and confirm before
      // the save PUT fires. Cancel aborts the save and keeps the wizard open.
      // Mirror the server's display-name normalization so the PUT URL, the
      // stored name, and local roster state all agree on the clean spelling.
      const savedData = { ...characterData, name: normalizeCharacterName(characterData.name) };
      const originalLevel = Number(originalCharacter?.level);
      const newLevel = Number(savedData?.level);
      if (
        Number.isFinite(originalLevel) &&
        Number.isFinite(newLevel) &&
        originalLevel !== newLevel &&
        !window.confirm(`Change ${savedData.name}'s level from ${originalLevel} to ${newLevel}? This updates the character in the live campaign.`)
      ) {
        return;
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
      const { setCharacters } = callbacksRef.current;
      setCharacters(prev => prev.map(char => char.name === originalCharacter.name ? savedData : char));
    } catch (error) {
      console.error('Error updating character:', error);
      alert(`Failed to update character: ${error.message}`);
    }
  }, [campaignName]);

  return {
    showCharacterWizard,
    showEditCharacterWizard,
    handleAddCharacter,
    handleWizardComplete,
    handleWizardCancel,
    handleEditCharacter,
    handleEditWizardComplete,
    handleEditWizardCancel,
    setCharacterCallbacks,
  };
}
