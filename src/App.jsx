import { useEffect, useRef } from 'react';
import { cloneDeep } from 'lodash';
import './App.css';
import CharSheet from './components/char-sheet/char-sheet.jsx';
import CombatTracking from './components/combat-tracking/combat-tracking.jsx';
import CampaignSelection from './components/campaign-selection/campaign-selection.jsx';
import CharacterCreationWizard from './components/character-creation/character-creation-wizard.jsx';
import utils from './services/utils.js';
import useAppData from './hooks/use-app-data.js';
import useCharacterManagement from './hooks/use-character-management.js';
import useCampaignManagement from './hooks/use-campaign-management.js';
import { useCharacterWizard } from './hooks/use-character-wizard.js';

function App() {
  const appData = useAppData();
  const charMgmt = useCharacterManagement();
  const campaignMgmt = useCampaignManagement();
  const wizard = useCharacterWizard();

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
  const { characters, activeCharacter, handleCharacterClick, handleInitiativeClick, handleUploadChange, handleSaveClick, handleUploadClick, handleDeleteCharacter: handleDeleteCharacterRaw, inputRef } = charMgmt;
  const { showButton, abilityScores, classes, classes2024, equipment, magicItems, magicItems2024, races, races2024, spells, spells2024 } = appData;
  const { showCharacterWizard, showEditCharacterWizard, handleAddCharacter, handleWizardComplete, handleWizardCancel, handleEditCharacter, handleEditWizardComplete, handleEditWizardCancel } = wizard;

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

  const combatTrackingActive = characters.length > 0 && activeCharacter == null;

  if (showCampaignSelection) return <CampaignSelection onCampaignSelect={handleCampaignSelect} />;

  return (
    <div className="app">
      <input key={Date.now()} type="file" accept=".json" multiple ref={inputRef} onChange={handleUploadChange} hidden />
      <div className="campaign-name no-print">
        {campaignName}
        <button className="icon-button rename-campaign-btn" onClick={handleRenameCampaign} disabled={!isLocalhost} title="Rename Campaign"><i className="fas fa-pen"></i></button>
        <button className="icon-button delete-campaign-btn" onClick={handleDeleteCampaign} disabled={characters.length > 0} title="Delete Campaign"><i className="fas fa-trash"></i></button>
      </div>
      {characters.map(character => (
        <button key={utils.getFirstName(character.name)} className={`no-print character-btn ${activeCharacter && activeCharacter.name === character.name ? 'active' : ''}`} onClick={() => handleCharacterClick(character)}>{character.name}</button>
      ))}
      {showButton && <button className="clickable mutted no-print" onClick={handleAddCharacter}><i className="fas fa-plus"></i> Add</button>}
      {showButton && <button className="clickable mutted no-print" onClick={handleUploadClick}><i className="fas fa-arrow-up"></i> Upload</button>}
      {activeCharacter && (
        <CharSheet allAbilityScores={abilityScores} allClasses={classes} allClasses2024={classes2024} allEquipment={equipment} allMagicItems={magicItems} allRaces={races} allSpells={spells} allSpells2024={spells2024} playerSummary={activeCharacter} allRaces2024={races2024} allMagicItems2024={magicItems2024} onDeleteCharacter={handleDeleteCharacter} />
      )}
      {combatTrackingActive && <CombatTracking characters={characters} />}
      <button className="clickable mutted no-print" onClick={handleBackToCampaigns}><i className="fas fa-arrow-left"></i> Campaigns</button>
      {characters.length > 0 && activeCharacter && <button className="clickable mutted no-print" onClick={handleInitiativeClick}><i className="fas fa-shield-alt"></i> Combat</button>}
      {activeCharacter && <button className="clickable mutted no-print" onClick={handleEditCharacter}><i className="fas fa-pen"></i> Edit</button>}
      {activeCharacter && <button className="clickable mutted no-print" onClick={handleSaveClick}><i className="fas fa-arrow-down"></i> Download</button>}
      <br />
      {showCharacterWizard && <CharacterCreationWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} allRaces={races} allRaces2024={races2024} allClasses={classes} allSpells={spells} allSpells2024={spells2024} />}
      {showEditCharacterWizard && <CharacterCreationWizard onComplete={handleEditWizardComplete} onCancel={handleEditWizardCancel} allRaces={races} allClasses={classes} allSpells={spells} allSpells2024={spells2024} characterData={activeCharacter} isEditing={true} />}
    </div>
  );
}

export default App;
