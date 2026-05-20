import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router';
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
import Notes from './components/notes/Notes.jsx';
import * as mapsService from './services/mapsService.js';
import utils from './services/utils.js';
import useAppData from './hooks/useAppData.js';
import useCharacterManagement from './hooks/useCharacterManagement.js';
import useCampaignManagement from './hooks/useCampaignManagement.js';
import { useCharacterWizard } from './hooks/useCharacterWizard.js';
import Root from './routes/root';
import Campaigns from './routes/campaigns';
import CampaignLayout from './routes/campaigns.$name';
import CampaignIndex from './routes/campaigns.$name.index';
import CharacterSheet from './routes/campaigns.$name.characters.$charId';
import InitiativeRoute from './routes/campaigns.$name.initiative';
import MapsRoute from './routes/campaigns.$name.maps';
import MapRoute from './routes/campaigns.$name.maps.$mapName';
import EncountersRoute from './routes/campaigns.$name.encounters';
import NotesRoute from './routes/campaigns.$name.notes';

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

  const [mapsView, setMapsView] = useState({ type: 'none' });
  const [npcs, setNpcs] = useState([]);
  const [showEncounter, setShowEncounter] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

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

  useEffect(() => {
    setMapsView({ type: 'none' });
  }, [campaignName]);

  useEffect(() => {
    setShowNotes(false);
  }, [campaignName]);

  const handleCharacterClick = (character) => {
    setActiveCharacter(cloneDeep(character));
    setMapsView({ type: 'none' });
    setShowEncounter(false);
  };

  const handleMapsClick = () => {
    setActiveCharacter(null);
    setShowEncounter(false);
    if (isLocalhost) {
      setMapsView(prev => {
        if (prev.type === 'manager') return { type: 'none' };
        return { type: 'manager' };
      });
    } else {
      if (mapsView.type === 'map') {
        setMapsView({ type: 'none' });
      } else {
        loadActiveMapAndOpen();
      }
    }
  };

  const handleEncounterClick = () => {
    setActiveCharacter(null);
    setMapsView({ type: 'none' });
    setShowEncounter(prev => !prev);
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
    handleInitiativeClickRaw();
    setMapsView({ type: 'none' });
    setShowEncounter(false);
  };

  const handleNotesClick = () => {
    setActiveCharacter(null);
    setMapsView({ type: 'none' });
    setShowEncounter(false);
    setShowNotes(prev => !prev);
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

  const initiativeActive = characters.length > 0 && activeCharacter == null && mapsView.type === 'none' && !showEncounter && !showNotes;

  if (showCampaignSelection) return <CampaignSelection onCampaignSelect={handleCampaignSelect} />;

  return (
    <div className="app">
      <input key={Date.now()} type="file" accept=".json" multiple ref={inputRef} onChange={handleUploadChange} hidden />
      <div className="app-body">
        <Routes>
          <Route path="/" element={<Root />}>
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaign/:name" element={<CampaignLayout />}>
              <Route index element={<CampaignIndex />} />
              <Route path="characters/:charId" element={<CharacterSheet />} />
              <Route path="initiative" element={<InitiativeRoute />} />
              <Route path="maps" element={<MapsRoute />} />
              <Route path="maps/:mapName" element={<MapRoute />} />
              <Route path="encounters" element={<EncountersRoute />} />
              <Route path="notes" element={<NotesRoute />} />
            </Route>
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
