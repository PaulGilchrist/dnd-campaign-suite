import { useState, useRef, useCallback } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import * as campaignService from '../../services/campaign/campaignService.js';

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
