import { useRef, useState } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import { saveAs } from 'file-saver';
import * as campaignService from '../services/campaignService.js';
import utils from '../services/utils.js';

function useCharacterManagement(campaignName) {
  const [characters, setCharacters] = useState([]);
  const [activeCharacter, setActiveCharacter] = useState(null);
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

  const handleDeleteCharacter = async (characterName) => {
    if (!window.confirm(`Are you sure you want to delete '${characterName}'? This cannot be undone.`)) {
      return;
    }

    if (!campaignName) throw new Error('No campaign selected');

    const fileName = `${characterName.toLowerCase().replace(/\s+/g, '-')}.json`;
    await campaignService.deleteCharacter(campaignName, fileName);

    setCharacters(prev => {
      const remaining = prev.filter(char => char.name !== characterName);
      if (activeCharacter && activeCharacter.name === characterName) {
        setActiveCharacter(remaining.length > 0 ? cloneDeep(remaining[0]) : null);
      }
      return remaining;
    });
  };

  return {
    characters,
    activeCharacter,
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
