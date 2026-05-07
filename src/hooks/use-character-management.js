import { useEffect, useRef, useState } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import { saveAs } from 'file-saver';
import Utils from '../services/utils';

function useCharacterManagement() {
  const [characters, setCharacters] = useState([]);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const preloadedCharacters = sessionStorage.getItem('characters');
    const currentCampaign = sessionStorage.getItem('currentCampaign');

    if (preloadedCharacters) {
      const loadedCharacters = JSON.parse(preloadedCharacters);
      setCharacters(loadedCharacters);
      sessionStorage.removeItem('characters');

      if (loadedCharacters.length > 0) {
        setActiveCharacter(cloneDeep(loadedCharacters[0]));
      }
    } else if (currentCampaign) {
      // If campaign was previously selected but no characters preloaded
    }
  }, []);

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
    let fileName = `${Utils.getFirstName(activeCharacter.name)}.json`;
    fileName = fileName.toLowerCase();
    const json = JSON.stringify(activeCharacter, null, 4);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, fileName);
  };

  const handleUploadClick = () => {
    inputRef.current.click();
  };

  return {
    characters,
    activeCharacter,
    handleCharacterClick,
    handleInitiativeClick,
    handleUploadChange,
    handleSaveClick,
    handleUploadClick,
    setCharacters,
    setActiveCharacter,
    inputRef,
  };
}

export default useCharacterManagement;
