import { useState, useRef, useCallback } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import * as campaignService from '../services/campaign-service.js';

export function useCharacterWizard() {
  const [showCharacterWizard, setShowCharacterWizard] = useState(false);
  const [showEditCharacterWizard, setShowEditCharacterWizard] = useState(false);
  const callbacksRef = useRef({ setCharacters: null, setActiveCharacter: null });

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
      const storedCampaign = sessionStorage.getItem('currentCampaign');
      if (!storedCampaign) throw new Error('No campaign selected');
      const result = await campaignService.createCharacter(storedCampaign, characterData);
      callbacksRef.current.setActiveCharacter(cloneDeep(result.character));
      setShowCharacterWizard(false);
      const encodedCampaign = encodeURIComponent(storedCampaign);
      const characterFiles = await fetch(`/api/characters/${encodedCampaign}`).then(res => res.json()).then(data => data.files);
      const newCharacters = await Promise.all(
        characterFiles.map(file => fetch(`/api/characters/${encodedCampaign}/${encodeURIComponent(file)}`).then(res => res.json()))
      );
      callbacksRef.current.setCharacters(newCharacters);
    } catch (error) {
      console.error('Error creating character:', error);
      alert(`Failed to create character: ${error.message}`);
    }
  }, []);

  const handleEditCharacter = useCallback(() => {
    setShowEditCharacterWizard(true);
  }, []);

  const handleEditWizardCancel = useCallback(() => {
    setShowEditCharacterWizard(false);
  }, []);

  const handleEditWizardComplete = useCallback(async (characterData) => {
    try {
      const storedCampaign = sessionStorage.getItem('currentCampaign');
      if (!storedCampaign) throw new Error('No campaign selected');
      const fileName = `${characterData.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      await campaignService.updateCharacter(storedCampaign, fileName, characterData);
      callbacksRef.current.setActiveCharacter(cloneDeep(characterData));
      setShowEditCharacterWizard(false);
      const { setCharacters } = callbacksRef.current;
      setCharacters(prev => prev.map(char => char.name === characterData.name ? characterData : char));
    } catch (error) {
      console.error('Error updating character:', error);
      alert(`Failed to update character: ${error.message}`);
    }
  }, []);

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
