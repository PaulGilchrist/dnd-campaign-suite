// NOTE: This hook has a completely different shape (file upload/download, active character
// selection) and is not refactored to useEntityManagement.
import { useRef, useState } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import { saveAs } from 'file-saver';
import * as campaignService from '../../services/campaign/campaignService.js';
import { characterFileName } from '../../services/campaign/characterFileName.js';
import utils from '../../services/ui/utils.js';

function useCharacterManagement(campaignName) {
  const [characters, setCharacters] = useState([]);
  const [activeCharacter, setActiveCharacter] = useState(null);
  // Ephemeral UI error state (display-flag category, NOT game state — see the
  // server-first doctrine): name of the character whose last DELETE failed, so
  // the roster can surface the failure inline (the alert alone is transient and
  // the name-filtered delete-SSE mirror cannot see a failed delete). Cleared on
  // the next successful delete or explicit dismiss.
  const [deleteErrorName, setDeleteErrorName] = useState(null);
  const inputRef = useRef(null);

  const handleCharacterClick = (character) => {
    setActiveCharacter(cloneDeep(character));
  };

  const handleInitiativeClick = () => {
    setActiveCharacter(null);
  };

  const handleUploadChange = async (event) => {
    const files = event.target.files;
    const uploadedCharacters = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const readPromise = new Promise((resolve) => {
        reader.onload = (evt) => {
          uploadedCharacters.push(JSON.parse(evt.target.result));
          resolve();
         };
        });
       reader.readAsText(file);
      await readPromise;
     }

    setCharacters((prevCharacters) => {
      const updatedCharacters = prevCharacters.map(char => {
        const uploaded = uploadedCharacters.find(uc => uc.name === char.name);
        return uploaded || char;
       });

      const existingNames = new Set(updatedCharacters.map(char => char.name));
      const newCharacters = uploadedCharacters.filter(char => !existingNames.has(char.name));
      updatedCharacters.push(...newCharacters);

      return updatedCharacters;
     });

    setActiveCharacter((prevActiveCharacter) => {
      if (prevActiveCharacter) {
        const updatedActive = uploadedCharacters.find(uc => uc.name === prevActiveCharacter.name);
        return updatedActive ? cloneDeep(updatedActive) : prevActiveCharacter;
       }

      if (!prevActiveCharacter && uploadedCharacters.length > 0) {
        return cloneDeep(uploadedCharacters[0]);
       }

      return prevActiveCharacter;
     });
   };

  const handleSaveClick = async () => {
    let fileName = `${utils.getName(activeCharacter.name)}.json`;
    fileName = fileName.toLowerCase();
    const json = JSON.stringify(activeCharacter, null, 4);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, fileName);
  };

  const handleUploadClick = () => {
    inputRef.current.click();
  };

  // Fix#36-queue: no confirm here — the leaf CharSummary owns the single
  // delete prompt (:626, generic house message). This is a straight
  // dispatcher mirroring the App.jsx :598 wrapper above it; confirming at
  // both layers stacked two dialogs per click. House pattern: leaf
  // components confirm at the click point (Notes, Factions, Sessions,
  // Quests, Settlements, NPCs, PartyInventory, CharSummary). Sole production
  // caller is that wrapper, always reached through the confirming leaf.
  const handleDeleteCharacter = async (characterName) => {
    // Any DELETE failure (404-mocked or otherwise) records the character name
    // for the sidebar's inline roster error, then RE-THROWS so the App.jsx
    // wrapper keeps owning the user-visible alert (service still owns the
    // single console.error + "Failed to delete character: " prefix).
    try {
      if (!campaignName) throw new Error('No campaign selected');

      await campaignService.deleteCharacter(campaignName, characterFileName(characterName));

      setCharacters(prev => {
        const remaining = prev.filter(char => char.name !== characterName);
        if (activeCharacter && activeCharacter.name === characterName) {
          setActiveCharacter(remaining.length > 0 ? cloneDeep(remaining[0]) : null);
        }
        return remaining;
      });
      setDeleteErrorName(null);
    } catch (error) {
      setDeleteErrorName(characterName);
      throw error;
    }
  };

  const dismissDeleteError = () => setDeleteErrorName(null);

  return {
    characters,
    activeCharacter,
    deleteErrorName,
    dismissDeleteError,
    handleCharacterClick,
    handleInitiativeClick,
    handleUploadChange,
    handleSaveClick,
    handleUploadClick,
    handleDeleteCharacter,
    setCharacters,
    setActiveCharacter,
    inputRef,
  };
}

export default useCharacterManagement;
