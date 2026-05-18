import { useEffect, useRef, useState } from 'react';
import { cloneDeep } from 'lodash';
import './App.css';
import CharSheet from './components/char-sheet/CharSheet.jsx';
import Initiative from './components/initiative/initiative.jsx';
import CampaignSelection from './components/campaign-selection/CampaignSelection.jsx';
import CharacterCreationWizard from './components/character-creation/CharacterCreationWizard.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import Positioning from './components/positioning/Positioning.jsx';
import utils from './services/utils.js';
import useAppData from './hooks/useAppData.js';
import useCharacterManagement from './hooks/useCharacterManagement.js';
import useCampaignManagement from './hooks/useCampaignManagement.js';
import { useCharacterWizard } from './hooks/useCharacterWizard.js';

function App() {
  const appData = useAppData();
  const { abilityScores, classes, classes2024, equipment, magicItems, magicItems2024, races, races2024, spells, spells2024 } = appData;
  const campaignMgmt = useCampaignManagement();
  const charMgmt = useCharacterManagement(campaignMgmt.campaignName);
  const wizard = useCharacterWizard(campaignMgmt.campaignName);

  const charMgmtRef = useRef();
  const campaignRef = useRef();
  const wizardRef = useRef();
  useEffect(() => { charMgmtRef.current = charMgmt; campaignRef.current = campaignMgmt; wizardRef.current = wizard; }, [charMgmt, campaignMgmt, wizard]);

  useEffect(() => {
    wizardRef.current.setCharacterCallbacks({ setCharacters: charMgmtRef.current.setCharacters, setActiveCharacter: charMgmtRef.current.setActiveCharacter });
  }, []);

  useEffect(() => {
    campaignRef.current.setCampaignSelectCallback((_, loaded) => {
      charMgmtRef.current.setCharacters(loaded);
      loaded.length > 0 ? charMgmtRef.current.setActiveCharacter(cloneDeep(loaded[0])) : wizardRef.current.handleAddCharacter();
    });
    campaignRef.current.setDeleteCampaignCallback(() => { charMgmtRef.current.setCharacters([]); charMgmtRef.current.setActiveCharacter(null); });
  }, []);

  const { showCampaignSelection, campaignName, isLocalhost, handleCampaignSelect, handleRenameCampaign: handleRenameCampaignRaw, handleDeleteCampaign: handleDeleteCampaignRaw, handleBackToCampaigns } = campaignMgmt;
  const { characters, activeCharacter, setActiveCharacter, handleInitiativeClick: handleInitiativeClickRaw, handleUploadChange, handleSaveClick, handleUploadClick, handleDeleteCharacter: handleDeleteCharacterRaw, inputRef } = charMgmt;
  const { showCharacterWizard, showEditCharacterWizard, handleAddCharacter, handleWizardComplete, handleWizardCancel, handleEditCharacter, handleEditWizardComplete, handleEditWizardCancel } = wizard;

  const [showPositioning, setShowPositioning] = useState(false);

  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('theme');
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try { localStorage.setItem('theme', newTheme); } catch {}
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const handleCharacterClick = (character) => {
    setActiveCharacter(cloneDeep(character));
    setShowPositioning(false);
  };

  const handlePositioningClick = () => {
    setActiveCharacter(null);
    setShowPositioning(true);
  };

  const handleInitiativeClick = () => {
    handleInitiativeClickRaw();
    setShowPositioning(false);
  };

  const handleRenameCampaign = async () => {
    try {
      await handleRenameCampaignRaw();
    } catch (error) {
      console.error('Error renaming campaign:', error);
      alert(`Failed to rename campaign: ${error.message}`);
    }
  };

  const handleDeleteCampaign = async () => {
    try {
      await handleDeleteCampaignRaw();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert(`Failed to delete campaign: ${error.message}`);
    }
  };

  const handleDeleteCharacter = async (characterName) => {
    try {
      await handleDeleteCharacterRaw(characterName);
    } catch (error) {
      console.error('Error deleting character:', error);
      alert(`Failed to delete character: ${error.message}`);
    }
  };

  const initiativeActive = characters.length > 0 && activeCharacter == null && !showPositioning;

  if (showCampaignSelection) return <CampaignSelection onCampaignSelect={handleCampaignSelect} />;

  return (
    <div className="app">
      <input key={Date.now()} type="file" accept=".json" multiple ref={inputRef} onChange={handleUploadChange} hidden />
      <div className="app-body">
        <Sidebar
          campaignName={campaignName}
          characters={characters}
          activeCharacter={activeCharacter}
          onBackToCampaigns={handleBackToCampaigns}
          onAddCharacter={handleAddCharacter}
          onCharacterClick={handleCharacterClick}
          onInitiativeClick={handleInitiativeClick}
          onPositioningClick={handlePositioningClick}
          onRenameCampaign={handleRenameCampaign}
          onDeleteCampaign={handleDeleteCampaign}
          theme={theme}
          toggleTheme={toggleTheme}
          isLocalhost={isLocalhost}
        />
        {activeCharacter && (
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
            onEditCharacter={() => handleEditCharacter(activeCharacter)}
            onUploadClick={handleUploadClick}
            onSaveClick={handleSaveClick}
          />
        )}
        {initiativeActive && <Initiative characters={characters} />}
        {showPositioning && <Positioning campaignName={campaignName} characters={characters} />}
        <br />
        {showCharacterWizard && <CharacterCreationWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} allRaces={races} allRaces2024={races2024} allClasses={classes} allSpells={spells} allSpells2024={spells2024} />}
        {showEditCharacterWizard && <CharacterCreationWizard onComplete={handleEditWizardComplete} onCancel={handleEditWizardCancel} allRaces={races} allClasses={classes} allSpells={spells} allSpells2024={spells2024} characterData={activeCharacter} isEditing={true} />}
      </div>
    </div>
  );
}

export default App;
