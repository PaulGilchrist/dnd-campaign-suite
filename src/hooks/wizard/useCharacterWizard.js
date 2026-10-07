import { useState, useRef, useCallback } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import * as campaignService from '../../services/campaign/campaignService.js';
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
      const result = await campaignService.createCharacter(campaignName, characterData);
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
      const originalFileName = `${originalCharacter.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      const fileName = `${characterData.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      await campaignService.updateCharacter(campaignName, fileName, characterData, originalFileName);
      // SP-074: inventory step (16) saves are the donning seam — armor newly added
      // to equipped[] ends Mage Armor before any consumer re-reads the sheet (§39).
      await endMageArmorOnDonning(originalCharacter, characterData, campaignName);
      stampLineageRuntime(originalCharacter, characterData, campaignName);
      callbacksRef.current.setActiveCharacter(cloneDeep(characterData));
      setShowEditCharacterWizard(false);
      const { setCharacters } = callbacksRef.current;
      setCharacters(prev => prev.map(char => char.name === originalCharacter.name ? characterData : char));
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
