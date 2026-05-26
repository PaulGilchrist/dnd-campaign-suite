import { useCallback, useEffect, useRef, useState } from 'react';
import { cloneDeep } from 'lodash';
import './App.css';
import CharSheet from './components/char-sheet/CharSheet.jsx';
import Initiative from './components/initiative/initiative.jsx';
import CampaignSelection from './components/campaign-selection/CampaignSelection.jsx';
import CharacterCreationWizard from './components/character-creation/CharacterCreationWizard.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import Map from './components/map/Map.jsx';
import MapsManager from './components/maps-manager/MapsManager.jsx';
import EncounterBuilder from './components/encounter/EncounterBuilder.jsx';
import * as mapsService from './services/mapsService.js';
import useAppData from './hooks/useAppData.js';
import useCharacterManagement from './hooks/useCharacterManagement.js';
import useCampaignManagement from './hooks/useCampaignManagement.js';
import { useCharacterWizard } from './hooks/useCharacterWizard.js';
import Notes from './components/notes/Notes.jsx';
import Quests from './components/quests/Quests.jsx';
import NPCs from './components/npcs/NPCs.jsx';
import Factions from './components/factions/Factions.jsx';
import Log from './components/log/Log.jsx';

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
      if (loaded.length > 0) {
        charMgmtRef.current.setActiveCharacter(cloneDeep(loaded[0]));
        setActiveView('charSheet');
      } else {
        wizardRef.current.handleAddCharacter();
      }
    });
    campaignRef.current.setDeleteCampaignCallback(() => { charMgmtRef.current.setCharacters([]); charMgmtRef.current.setActiveCharacter(null); });
  }, []);

  const { showCampaignSelection, campaignName, isLocalhost, handleCampaignSelect, handleRenameCampaign: handleRenameCampaignRaw, handleDeleteCampaign: handleDeleteCampaignRaw, handleBackToCampaigns } = campaignMgmt;
  const { characters, activeCharacter, setActiveCharacter, handleUploadChange, handleSaveClick, handleUploadClick, handleDeleteCharacter: handleDeleteCharacterRaw, inputRef } = charMgmt;
  const { showCharacterWizard, showEditCharacterWizard, handleAddCharacter, handleWizardComplete, handleWizardCancel, handleEditCharacter, handleEditWizardComplete, handleEditWizardCancel } = wizard;

  const [mapsView, setMapsView] = useState({ type: 'none' });
  const [npcs, setNpcs] = useState([]);
  const [activeView, setActiveView] = useState(null);
  // activeView: null | 'charSheet' | 'mapsManager' | 'encounter' | 'notes' | 'npcs' | 'initiative'
  // type: 'none' | 'manager' | 'map'
  // When type is 'map', mapName holds the sanitized map filename (e.g. 'dungeon-level-1')
  // Navigation stack for indoor map entry (POI, encounter) — push on enter, pop on back
  const mapHistoryRef = useRef([]);

  const handleEnterMap = useCallback((mapName) => {
    if (mapsView.type === 'map' && mapsView.mapName) {
      mapHistoryRef.current.push(mapsView.mapName);
    }
    setMapsView({ type: 'map', mapName });
  }, [mapsView]);

  const handleBackFromMap = useCallback(() => {
    if (mapHistoryRef.current.length > 0) {
      const prevMap = mapHistoryRef.current.pop();
      setMapsView({ type: 'map', mapName: prevMap });
    } else {
      setMapsView({ type: isLocalhost ? 'manager' : 'none' });
    }
  }, [isLocalhost]);

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
    try { localStorage.setItem('theme', newTheme); } catch { /* ignore */ }
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.title = activeView === 'charSheet' && activeCharacter
      ? activeCharacter.name
      : 'CharSheets';
  }, [activeView, activeCharacter]);

  useEffect(() => {
    setMapsView({ type: 'none' });
  }, [campaignName]);

  const handleCharacterClick = (character) => {
    setActiveCharacter(cloneDeep(character));
    setActiveView('charSheet');
  };

  const handleMapsClick = () => {
    if (mapsView.type === 'map') {
      // Already viewing a map — go back to the manager listing (GM only)
      if (isLocalhost) {
        setMapsView({ type: 'manager' });
        mapHistoryRef.current = []; // clear history when going back to manager
      }
      // Players: already on their only view, do nothing
    } else if (activeView === 'mapsManager') {
      // Already on the manager listing — do nothing
      return;
    } else {
      // Not on maps at all — open the manager
      setActiveView('mapsManager');
      if (isLocalhost) {
        setMapsView({ type: 'manager' });
      } else {
        loadActiveMapAndOpen();
      }
    }
  };

  const loadActiveMapAndOpen = async () => {
    try {
      const result = await mapsService.loadMaps(campaignName);
      const activeMap = result.maps.find(m => m.isActive);
      if (activeMap) {
        const mapName = activeMap.fileName.replace(/\.json$/, '');
        setMapsView({ type: 'map', mapName });
      } else {
        alert('No map is currently active. Ask your Game Master to activate one.');
      }
    } catch (err) {
      console.error('Error loading maps:', err);
      alert('Failed to load map data.');
    }
  };

  const handleInitiativeClick = () => {
    if (activeView !== 'initiative') {
      setActiveView('initiative');
    }
  };

  const handleEncounterClick = () => {
    if (activeView !== 'encounter') {
      setActiveView('encounter');
    }
  };

  const handleNotesClick = () => {
    if (activeView !== 'notes') {
      setActiveView('notes');
    }
  };

  const handleQuestsClick = () => {
    if (activeView !== 'quests') {
      setActiveView('quests');
    }
  };

  const handleNPCsClick = () => {
    if (activeView !== 'npcs') {
      setActiveView('npcs');
    }
  };

  const handleBackFromNPCs = () => {
    setActiveView(null);
  };

  const handleFactionsClick = () => {
    if (activeView !== 'factions') {
      setActiveView('factions');
      }
    };

  const handleLogClick = () => {
    if (activeView !== 'campaignLog') {
      setActiveView('campaignLog');
       }
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
          onMapsClick={handleMapsClick}
          onNotesClick={handleNotesClick}
          onQuestsClick={handleQuestsClick}
          onEncounterClick={handleEncounterClick}
          onRenameCampaign={handleRenameCampaign}
          onDeleteCampaign={handleDeleteCampaign}
          theme={theme}
          toggleTheme={toggleTheme}
          isLocalhost={isLocalhost}
           onNPCsClick={handleNPCsClick}
         onFactionsClick={handleFactionsClick}
         onLogClick={handleLogClick}
          />
        {activeView === 'charSheet' && activeCharacter && (
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
            campaignName={campaignName}
            onDeleteCharacter={handleDeleteCharacter}
            onEditCharacter={() => handleEditCharacter(activeCharacter)}
            onUploadClick={handleUploadClick}
            onSaveClick={handleSaveClick}
          />
        )}
        {activeView === 'initiative' && <Initiative characters={characters} campaignName={campaignName} onNpcsChange={setNpcs} />}
        {activeView === 'mapsManager' && mapsView.type === 'manager' && (
          <MapsManager
            campaignName={campaignName}
            onOpenMap={(mapName) => setMapsView({ type: 'map', mapName })}
            onBack={() => setMapsView({ type: 'none' })}
          />
        )}
        {activeView === 'mapsManager' && mapsView.type === 'map' && (
          <Map
            campaignName={campaignName}
            characters={characters}
            npcs={npcs}
            isLocalhost={isLocalhost}
            mapName={mapsView.mapName}
            onBack={handleBackFromMap}
            onEncounterCreated={handleEnterMap}
            onPoiEntered={handleEnterMap}
          />
        )}
          {activeView === 'encounter' && (
            <EncounterBuilder characters={characters} campaignName={campaignName} onStartCombat={() => setActiveView('initiative')} />
          )}
        {activeView === 'notes' && (
          <Notes
            campaignName={campaignName}
            characters={characters}
            isLocalhost={isLocalhost}
            onBack={() => setActiveView(null)}
          />
        )}
        {activeView === 'quests' && (
          <Quests
            campaignName={campaignName}
            isLocalhost={isLocalhost}
            onBack={() => setActiveView(null)}
          />
        )}
        {activeView === 'npcs' && (
          <NPCs
            campaignName={campaignName}
            characters={characters}
            onBack={handleBackFromNPCs}
          />
        )}
          {activeView === 'factions' && (
            <Factions
             campaignName={campaignName}
             characters={characters}
             isLocalhost={isLocalhost}
              onBack={() => setActiveView(null)}
               />
                 ) }

                  { activeView === 'campaignLog' && (
                       <Log
                         campaignName={campaignName}
                          characters={characters}
                           />
                            ) }

                             <br />
        {showCharacterWizard && <CharacterCreationWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} allRaces={races} allRaces2024={races2024} allClasses={classes} allSpells={spells} allSpells2024={spells2024} />}
        {showEditCharacterWizard && <CharacterCreationWizard onComplete={handleEditWizardComplete} onCancel={handleEditWizardCancel} allRaces={races} allClasses={classes} allSpells={spells} allSpells2024={spells2024} characterData={activeCharacter} isEditing={true} />}
      </div>
    </div>
  );
}

export default App;
