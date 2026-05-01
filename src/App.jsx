import React, { useEffect, useState } from 'react';
import { cloneDeep } from 'lodash';
import { saveAs } from 'file-saver';
import './App.css'
import CharSheet from './components/char-sheet/char-sheet'
import CombatTracking from './components/combat-tracking/combat-tracking'
import CampaignSelection from './components/campaign-selection/campaign-selection'
import CharacterCreationWizard from './components/character-creation/character-creation-wizard'
import Utils from './services/utils'

function App() {
    const [abilityScores, setAbilityScores] = React.useState(null);
    const [activeCharacter, setActiveCharacter] = React.useState(null);
    const [characters, setCharacters] = React.useState([]);
    const [classes, setClasses] = React.useState([]);
    const [classes2024, setClasses2024] = React.useState([]);
    const [equipment, setEquipment] = React.useState([]);
    const [magicItems, setMagicItems] = React.useState([]);
    const [races, setRaces] = React.useState([]);
    const [races2024, setRaces2024] = React.useState([]);
    const [magicItems2024, setMagicItems2024] = React.useState([]);
    const [showButton, setShowButton] = React.useState(false);
    const [spells, setSpells] = React.useState([]);
    const [spells2024, setSpells2024] = React.useState([]);
    const [showCampaignSelection, setShowCampaignSelection] = React.useState(true);
    const [showAddCharacterModal, setShowAddCharacterModal] = React.useState(false);
    const [showCharacterWizard, setShowCharacterWizard] = React.useState(false);
    const [showEditCharacterWizard, setShowEditCharacterWizard] = React.useState(false);
    const inputRef = React.useRef(null);

    // Check if we're on localhost
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    useEffect(() => {
        fetch('/data/ability-scores.json')
             .then(response => response.json())
             .then(data => {
                setAbilityScores(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/classes.json')
             .then(response => response.json())
             .then(data => {
                setClasses(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/2024/classes.json')
             .then(response => response.json())
             .then(data => {
                setClasses2024(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/equipment.json')
             .then(response => response.json())
             .then(data => {
                setEquipment(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/magic-items.json')
             .then(response => response.json())
             .then(data => {
                setMagicItems(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/2024/magic-items.json')
             .then(response => response.json())
             .then(data => {
                setMagicItems2024(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/races.json')
             .then(response => response.json())
             .then(data => {
                setRaces(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/2024/races.json')
             .then(response => response.json())
             .then(data => {
                setRaces2024(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/spells.json')
             .then(response => response.json())
             .then(data => {
                setSpells(data);
             });
     }, []);
    useEffect(() => {
        fetch('/data/2024/spells.json')
             .then(response => response.json())
             .then(data => {
                setSpells2024(data);
             });
     }, []);

    useEffect(() => {
        // Check if characters are pre-loaded from campaign selection or URL
        const preloadedCharacters = sessionStorage.getItem('characters');

        if (preloadedCharacters) {
            const loadedCharacters = JSON.parse(preloadedCharacters);
            setCharacters(loadedCharacters);
            setShowCampaignSelection(false);

            // Clear session storage after loading
            sessionStorage.removeItem('characters');

            if (loadedCharacters.length > 0) {
                setActiveCharacter(cloneDeep(loadedCharacters[0]));
             }
             // Don't auto-open wizard here - let handleCampaignSelected handle it
         }
     }, []);

    useEffect(() => {
        // Do not allow uploading character until everything is ready
        if (classes.length > 0 && equipment.length > 0 && spells.length > 0 && spells2024.length > 0) {
            setShowButton(true);
         }
     }, [abilityScores, classes, equipment, spells, spells2024]);

    const handleCharacterClick = (character) => {
        setActiveCharacter(cloneDeep(character));
    }

    const handleInitiativeClick = () => {
        setActiveCharacter(null);
    }

    const handleUploadChange = async (event) => {
                const files = event.target.files;
                const uploadedCharacters = [];
                for (let i = 0; i < files.length; i++) {
                    const reader = new FileReader();
                    const file = files[i];
                    const readPromise = new Promise((resolve) => {
                        reader.onload = (event) => {
                            const data = JSON.parse(event.target.result);
                            uploadedCharacters.push(data);
                            resolve();
                           };
                       });
                    reader.readAsText(file);
                    await readPromise;
                  }

                 // Add uploaded characters to the existing party, replacing if name exists
                const updatedCharacters = characters.map(char => {
                    const uploaded = uploadedCharacters.find(uc => uc.name === char.name);
                    return uploaded || char;
                 });

                 // Add any new characters that weren't in the existing list
                const existingNames = new Set(updatedCharacters.map(char => char.name));
                const newCharacters = uploadedCharacters.filter(char => !existingNames.has(char.name));
                updatedCharacters.push(...newCharacters);

                setCharacters(updatedCharacters);

                 // Update active character if it was replaced
                if (activeCharacter) {
                    const updatedActive = updatedCharacters.find(char => char.name === activeCharacter.name);
                    if (updatedActive) {
                        setActiveCharacter(cloneDeep(updatedActive));
                 }
                  }

                 // If there was no active character, set the first uploaded one as active
                if (!activeCharacter && uploadedCharacters.length > 0) {
                    setActiveCharacter(cloneDeep(uploadedCharacters[0]));
                   }
               };

    const handleSaveClick = async () => {
        let fileName = `${Utils.getFirstName(activeCharacter.name)}.json`;
        fileName = fileName.toLowerCase();
        const json = JSON.stringify(activeCharacter, null, 4);
        const blob = new Blob([json], { type: 'application/json' });
        saveAs(blob, fileName);
    };

    const handleUploadClick = async () => {
        inputRef.current.click();
    };

    const handleCampaignSelected = (campaign, loadedCharacters) => {
        // Verify campaign is stored correctly
        sessionStorage.setItem('currentCampaign', campaign);

        setCharacters(loadedCharacters);
        setActiveCharacter(null); // Clear active character when switching campaigns
        setShowCampaignSelection(false);
        if (loadedCharacters.length > 0) {
            setActiveCharacter(cloneDeep(loadedCharacters[0]));
         } else {
             // Only auto-open wizard if campaign has no characters at all
             // If campaign has characters, user must click "Add Character" button
            setShowCharacterWizard(true);
         }
     };

    const handleAddCharacter = () => {
        // Open wizard instead of creating empty character
        setShowCharacterWizard(true);
    };

    const closeModal = () => {
        setShowAddCharacterModal(false);
    };

    const handleWizardComplete = async (characterData) => {
        try {
            const storedCampaign = sessionStorage.getItem('currentCampaign');
            if (!storedCampaign) {
                throw new Error('No campaign selected in sessionStorage');
            }

            // Send POST request to API to save character
            const requestBody = {
                campaignName: storedCampaign,
                character: characterData
             };

            const response = await fetch('/api/characters', {
                method: 'POST',
                headers: {
                     'Content-Type': 'application/json',
                 },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to save character: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            // Load the newly created character
            setActiveCharacter(cloneDeep(result.character));
            setShowCharacterWizard(false);

            // Refresh character list
            const encodedCampaign = encodeURIComponent(storedCampaign);
            const characterFiles = await fetch(`/api/characters/${encodedCampaign}`)
                 .then(res => res.json())
                 .then(data => data.files);

            const newCharacters = await Promise.all(
                characterFiles.map(file =>
                    fetch(`/api/characters/${encodedCampaign}/${encodeURIComponent(file)}`)
                         .then(res => res.json())
                 )
             );
            setCharacters(newCharacters);
         } catch (error) {
            console.error('Error creating character:', error);
            alert(`Failed to create character: ${error.message}. Please check the console for details.`);
         }
     };

    const handleWizardCancel = () => {
        setShowCharacterWizard(false);
    };

    const handleEditCharacter = () => {
        setShowEditCharacterWizard(true);
    };

    const handleEditWizardComplete = async (characterData) => {
        try {
            const storedCampaign = sessionStorage.getItem('currentCampaign');
            if (!storedCampaign) {
                throw new Error('No campaign selected in sessionStorage');
            }

            const encodedCampaign = encodeURIComponent(storedCampaign);
            const fileName = `${characterData.name.toLowerCase().replace(/\s+/g, '-')}.json`;

            const response = await fetch(`/api/characters/${encodedCampaign}/${encodeURIComponent(fileName)}`, {
                method: 'PUT',
                headers: {
                     'Content-Type': 'application/json',
                 },
                body: JSON.stringify(characterData),
            });

            if (!response.ok) {
                throw new Error(`Failed to update character: ${response.status}`);
            }

            setActiveCharacter(cloneDeep(characterData));
            setShowEditCharacterWizard(false);

            const newCharacters = characters.map(char =>
                char.name === characterData.name ? characterData : char
            );
            setCharacters(newCharacters);
        } catch (error) {
            console.error('Error updating character:', error);
            alert(`Failed to update character: ${error.message}`);
         }
     };

    const handleEditWizardCancel = () => {
        setShowEditCharacterWizard(false);
    };

    const handleDeleteCharacter = async (characterName) => {
        try {
            const storedCampaign = sessionStorage.getItem('currentCampaign');
            if (!storedCampaign) {
                throw new Error('No campaign selected in sessionStorage');
            }

            const encodedCampaign = encodeURIComponent(storedCampaign);
            const fileName = `${characterName.toLowerCase().replace(/\s+/g, '-')}.json`;

            const response = await fetch(`/api/characters/${encodedCampaign}/${encodeURIComponent(fileName)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Failed to delete character: ${response.status}`);
            }

            // Remove character from the list
            const newCharacters = characters.filter(char => char.name !== characterName);
            setCharacters(newCharacters);

            // If the deleted character was active, clear it
            if (activeCharacter && activeCharacter.name === characterName) {
                setActiveCharacter(null);
            }

            // If there are remaining characters, set the first one as active
            if (newCharacters.length > 0) {
                setActiveCharacter(cloneDeep(newCharacters[0]));
             }
         } catch (error) {
            console.error('Error deleting character:', error);
            alert(`Failed to delete character: ${error.message}`);
         }
     };

    const handleRenameCampaign = async () => {
        const currentCampaign = sessionStorage.getItem('currentCampaign');
        const newName = prompt('Enter new campaign name:', currentCampaign);

        if (!newName || newName.trim() === '') {
            return;
        }

        try {
            const response = await fetch(`/api/campaigns/${encodeURIComponent(currentCampaign)}`, {
                method: 'PUT',
                headers: {
                     'Content-Type': 'application/json',
                 },
                body: JSON.stringify({ newName: newName.trim() }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to rename campaign');
            }

            // Update session storage
            sessionStorage.setItem('currentCampaign', newName.trim());

            // Reload the page to reflect the changes
            window.location.reload();
        } catch (error) {
            console.error('Error renaming campaign:', error);
            alert(`Failed to rename campaign: ${error.message}`);
         }
     };

    const handleDeleteCampaign = async () => {
        const currentCampaign = sessionStorage.getItem('currentCampaign');
        if (window.confirm(`Are you sure you want to delete the campaign '${currentCampaign}'? This will delete all characters in the campaign and cannot be undone.`)) {
            try {
                const response = await fetch(`/api/campaigns/${encodeURIComponent(currentCampaign)}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to delete campaign');
                }

                // Go back to campaign selection
                setShowCampaignSelection(true);
                setCharacters([]);
                setActiveCharacter(null);
            } catch (error) {
                console.error('Error deleting campaign:', error);
                alert(`Failed to delete campaign: ${error.message}`);
             }
         }
     };

    let combatTrackingActive = characters.length > 0 && activeCharacter == null;
    // Show campaign selection if not yet selected
    if (showCampaignSelection) {
        return (
             <CampaignSelection onCampaignSelect={handleCampaignSelected} />
         );
     }

    return (
         <div className="app">
             <input key={Date.now()} type="file" accept='.json' multiple ref={inputRef} onChange={handleUploadChange} hidden></input>
             <div className="campaign-name no-print">
                 {sessionStorage.getItem('currentCampaign')}
                 <button className="icon-button rename-campaign-btn" onClick={handleRenameCampaign} disabled={!isLocalhost} title="Rename Campaign">
                            <i className="fas fa-pen"></i>
                        </button>
                 <button className="icon-button delete-campaign-btn" onClick={handleDeleteCampaign} disabled={characters.length > 0} title="Delete Campaign">
                     <i className="fas fa-trash"></i>
                 </button>
             </div>
             {characters.length > 0 && characters.map((character) => {
                return (
                    <button
                        key={Utils.getFirstName(character.name)}
                        className={`no-print ${activeCharacter && activeCharacter.name === character.name ? 'active' : ''}`}
                        onClick={() => handleCharacterClick(character)}
                     >
                         {character.name}
                     </button>
                 )
             })}
             {showButton && <button className="clickable mutted no-print" onClick={handleAddCharacter}><i className="fas fa-plus"></i>  Add</button>}
             {showButton && <button className="clickable mutted no-print" onClick={handleUploadClick}><i className="fas fa-arrow-up"></i> Upload</button>}
             {activeCharacter != null && (
                 <CharSheet
                    allAbilityScores={abilityScores}
                    allClasses={classes}

                    allClasses2024={classes2024}
                    allEquipment={equipment}
                    allMagicItems={magicItems}
                    allRaces={races}
                    allSpells={spells}
                    allSpells2024={spells2024}
                    playerSummary={activeCharacter}
                    allRaces2024={races2024}
                    allMagicItems2024={magicItems2024}
                    onDeleteCharacter={handleDeleteCharacter}
                 />
             )}
             {combatTrackingActive && <CombatTracking characters={characters} />}
             <button className="clickable mutted no-print" onClick={() => setShowCampaignSelection(true)}><i className="fas fa-arrow-left"></i> Campaigns</button>
             {characters.length > 0 && activeCharacter != null && (
                 <button className="clickable mutted no-print" onClick={handleInitiativeClick}><i className="fas fa-shield-alt"></i> Combat</button>
             )}
             {activeCharacter != null && (
                 <button className="clickable mutted no-print" onClick={handleEditCharacter}><i className="fas fa-pen"></i> Edit</button>
             )}
             {activeCharacter && <button className="clickable mutted no-print" onClick={handleSaveClick}><i className="fas fa-arrow-down"></i> Download</button>}
             <br />
             {showCharacterWizard && (
                 <CharacterCreationWizard
                    onComplete={handleWizardComplete}
                    onCancel={handleWizardCancel}
                    allRaces={races}
                    allRaces2024={races2024}
                    allClasses={classes}
                    allSpells={spells}
                    allSpells2024={spells2024}
                 />
             )}
             {showEditCharacterWizard && (
                 <CharacterCreationWizard
                    onComplete={handleEditWizardComplete}
                    onCancel={handleEditWizardCancel}
                    allRaces={races}
                    allClasses={classes}
                    allSpells={spells}
                    allSpells2024={spells2024}
                    characterData={activeCharacter}
                    isEditing={true}
                 />
             )}
         </div>
     )
}

export default App
