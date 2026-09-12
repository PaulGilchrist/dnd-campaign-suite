import { useCallback, useEffect, useRef, useState } from 'react';
import { cloneDeep } from 'lodash';
import { isCampaignKey } from './services/automation/common/campaignKeys.js';
import { peekPendingSavePrompt } from './services/combat/auras/pendingSaveRegistry.js';
import { getRuntimeValue } from './hooks/runtime/useRuntimeState.js';
import './App.css';
import CharSheet from './components/char-sheet/CharSheet.jsx';
import Initiative from './components/initiative/Initiative.jsx';
import CampaignSelection from './components/campaign-selection/CampaignSelection.jsx';
import CharacterCreationWizard from './components/character-creation/CharacterCreationWizard.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import Map from './components/map/Map.jsx';
import MapsManager from './components/maps-manager/MapsManager.jsx';
import { loadCombatSummary, setCombatSummaryCache } from './services/encounters/combatData.js';
import storage from './services/ui/storage.js';
import EncounterBuilder from './components/encounter/EncounterBuilder.jsx';
import * as mapsService from './services/maps/mapsService.js';
import useAppData from './hooks/runtime/useAppData.js';
import useCharacterManagement from './hooks/management/useCharacterManagement.js';
import useCampaignManagement from './hooks/management/useCampaignManagement.js';
import { useCharacterWizard } from './hooks/wizard/useCharacterWizard.js';
import rulesFactory from './services/rules/rulesFactory.js';
import Subscriber from './components/common/Subscriber.jsx';
import MapContextSync from './components/common/MapContextSync.jsx';
import { setRuntimeObject, seedTrackedResources, getStore, notify } from './hooks/runtime/useRuntimeState.js';
import { applyServerOverride, trackedResourcesToStoreEntries } from './services/rules/trackedResources.js';
import { useBattleMasterSelectionVersion, battleMasterSelectionSerial } from './hooks/combat/battleMaster.js';
import Notes from './components/notes/Notes.jsx';
import Quests from './components/quests/Quests.jsx';
import NPCs from './components/npcs/NPCs.jsx';
import Settlements from './components/settlements/Settlements.jsx';
import Factions from './components/factions/Factions.jsx';
import Log from './components/log/Log.jsx';
import CampaignAdmin from './components/campaign-admin/CampaignAdmin.jsx';
import SavePromptModal from './components/common/SavePromptModal.jsx';
import DeathSavePromptModal from './components/common/DeathSavePromptModal.jsx';
import ConcentrationPromptModal from './components/common/ConcentrationPromptModal.jsx';
import ConditionChoiceModal from './components/common/ConditionChoiceModal.jsx';
import BardicInspirationReactionModal from './components/common/BardicInspirationReactionModal.jsx';

function handleCharacterKeyEvent(event, { setCharacters, activeCharacter, setActiveCharacter }) {
  if (event.key.startsWith('character-delete-')) {
    const file = event.key.replace(/^character-delete-.+-/, '');
    setCharacters(prev => prev.filter(c => `${c.name.replace(/[^a-zA-Z0-9]/g, '_')}.json` !== file));
  } else if (!event.key.startsWith('character-create-')) {
    const updated = event.data;
    setCharacters(prev => {
      const idx = prev.findIndex(c => c.name === updated.name);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    if (activeCharacter && activeCharacter.name === updated.name) {
      setActiveCharacter(updated);
    }
  }
}

function handlePipelineKeyEvent(event, campaignName) {
  const prefix = `pipeline-${campaignName}-`;
  if (!event.key.startsWith(prefix)) return;
  const actualKey = event.key.slice(prefix.length);
  setRuntimeObject(actualKey, event.data, campaignName, true);
}

function redispatchSaveResult(promptId, data) {
  const pending = peekPendingSavePrompt(promptId);
  if (pending) {
    console.debug(`[saveDebug] App.handleRuntimeEvent SSE saveResult: re-dispatching save-result for "${promptId}" with merged pending data`, { pendingKeys: Object.keys(pending) });
    window.dispatchEvent(new CustomEvent('save-result', { detail: { ...pending, ...data } }));
    return;
  }
  const listenerPrompts = getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || [];
  if (listenerPrompts.includes(promptId)) {
    console.debug(`[saveDebug] App.handleRuntimeEvent SSE saveResult: re-dispatching save-result for pending listener prompt "${promptId}"`);
    window.dispatchEvent(new CustomEvent('save-result', { detail: data }));
  } else {
    console.debug(`[saveDebug] App.handleRuntimeEvent SSE saveResult: no pending prompt "${promptId}", skipping re-dispatch`);
  }
}

function applyStoreUpdate(storeKey, data, campaignName) {
  // Campaign-level keys: SSE key is "change-{campaign}-{key}" -> store in campaign store
  // Character keys: SSE key is "change-{campaign}-{characterName}" -> apply full object to character store
  if (isCampaignKey(storeKey)) {
    const campaignStore = getStore('campaign');
    campaignStore.set(storeKey, data);
    notify('campaign');
  } else {
    setRuntimeObject(storeKey, data, campaignName, true);
  }
}

function handleChangeKeyEvent(event, campaignName, pendingPromptIdRef) {
  if (!event.data || typeof event.data !== 'object') return;
  const prefix = `change-${campaignName}-`;
  if (!event.key.startsWith(prefix)) return;
  const storeKey = event.key.slice(prefix.length);
  if (storeKey.startsWith('saveResult-') || storeKey.startsWith('savePrompt-') || storeKey.startsWith('savePromptCleared-')) {
    console.debug(`[saveDebug] App.handleRuntimeEvent SSE change received`, { key: event.key, storeKey, data: event.data });
  }
  if (storeKey.startsWith('saveResult-') && event.data.promptId) {
    redispatchSaveResult(event.data.promptId, event.data);
  }
  if ('biPrompt' in event.data) {
    pendingPromptIdRef.current = event.data.biPrompt?.promptId || null;
    return;
  }
  if (pendingPromptIdRef.current && 'biPromptCleared' in event.data) {
    return;
  }
  pendingPromptIdRef.current = null;
  applyStoreUpdate(storeKey, event.data, campaignName);
}

async function fetchCampaignChangeData(campaignName) {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/change-data`);
    if (response.ok) {
      return await response.json();
    }
  } catch { /* no server — use computed defaults */ }
  return {};
}

function seedCharServerKeys(storeName, charServerData) {
  if (!charServerData || typeof charServerData !== 'object') return;
  const store = getStore(storeName);
  let seededAny = false;
  for (const [key, value] of Object.entries(charServerData)) {
    if (!store.has(key) && value != null && key !== 'biPrompt') {
      store.set(key, value);
      seededAny = true;
    }
  }
  // Wake store listeners (e.g. maneuver recompute) for values seeded from disk
  if (seededAny) notify(storeName);
}

function seedCharFeatureKeys(storeName, char) {
  // Seed Magic Initiate instances / Fey Touched / Shadow Touched from character data
  if (char.magicInitiateInstances && Array.isArray(char.magicInitiateInstances)) {
    getStore(storeName).set('_magicInitiateInstances', char.magicInitiateInstances);
  }
  if (char.feyTouchedSpell) {
    getStore(storeName).set('feyTouchedSpell', char.feyTouchedSpell);
  }
  if (char.shadowTouchedSpell) {
    getStore(storeName).set('shadowTouchedSpell', char.shadowTouchedSpell);
  }
}

function seedCharacterRuntimeData(char, serverData) {
  const stats = char.computedStats;
  if (!stats || !stats._trackedResources) return;
  const charServerData = serverData ? serverData[stats.name] : null;
  const merged = applyServerOverride(stats._trackedResources, charServerData);
  seedTrackedResources(stats.name, trackedResourcesToStoreEntries(merged));
  seedCharServerKeys(stats.name, charServerData);
  seedCharFeatureKeys(stats.name, char);
}

function seedCampaignRuntimeData(serverData) {
  // Campaign keys are at the top level of serverData, seeded into the 'campaign' store
  if (!serverData || typeof serverData !== 'object') return;
  const campaignStore = getStore('campaign');
  for (const [key, value] of Object.entries(serverData)) {
    if (!campaignStore.has(key) && value != null) {
      campaignStore.set(key, value);
    }
  }
}

function MapsAreaView({ campaignName, characters, npcs, isLocalhost, mapsView, onBackFromMap, onEncounterCreated, setMapsView, setActiveMapName }) {
  if (mapsView.type === 'manager') {
    return (
      <MapsManager
        campaignName={campaignName}
        onOpenMap={(mapName) => { setMapsView({ type: 'map', mapName }); setActiveMapName(mapName); }}
        onBack={() => setMapsView({ type: 'none' })}
      />
    );
  }
  if (mapsView.type === 'map') {
    return (
      <Map
        campaignName={campaignName}
        characters={characters}
        npcs={npcs}
        isLocalhost={isLocalhost}
        mapName={mapsView.mapName}
        onBack={onBackFromMap}
        onEncounterCreated={onEncounterCreated}
        onPoiEntered={onEncounterCreated}
      />
    );
  }
  return null;
}

function OverlayViews({ activeView, campaignName, characters, isLocalhost, theme, toggleTheme, onRenameCampaign, onDeleteCampaign, setActiveView }) {
  const views = {
    encounter: <EncounterBuilder characters={characters} campaignName={campaignName} onJoinEncounter={() => setActiveView('initiative')} />,
    notes: <Notes campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} onBack={() => setActiveView(null)} />,
    quests: <Quests campaignName={campaignName} isLocalhost={isLocalhost} onBack={() => setActiveView(null)} />,
    npcs: <NPCs campaignName={campaignName} characters={characters} onBack={() => setActiveView(null)} onViewInitiative={() => setActiveView('initiative')} />,
    settlements: <Settlements campaignName={campaignName} onBack={() => setActiveView(null)} />,
    factions: <Factions campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} onBack={() => setActiveView(null)} />,
    campaignLog: <Log campaignName={campaignName} characters={characters} />,
    campaignRepair: (
      <CampaignAdmin
        campaignName={campaignName}
        onBack={() => setActiveView(null)}
        theme={theme}
        toggleTheme={toggleTheme}
        onRenameCampaign={onRenameCampaign}
        onDeleteCampaign={onDeleteCampaign}
      />
    ),
  };
  return views[activeView] || null;
}

function App() {
  const appData = useAppData();
  const { abilityScores, classes, classes2024, equipment, magicItems, magicItems2024, races, races2024, spells, spells2024 } = appData;
  const campaignMgmt = useCampaignManagement();
  const charMgmt = useCharacterManagement(campaignMgmt.campaignName);
  const wizard = useCharacterWizard(campaignMgmt.campaignName);

  const charMgmtRef = useRef();
  const campaignRef = useRef();
  const wizardRef = useRef();
  const campaignNameRef = useRef(null);
  useEffect(() => { charMgmtRef.current = charMgmt; campaignRef.current = campaignMgmt; wizardRef.current = wizard; }, [charMgmt, campaignMgmt, wizard]);
  useEffect(() => { campaignNameRef.current = campaignMgmt.campaignName; }, [campaignMgmt.campaignName]);

  useEffect(() => {
    wizardRef.current.setCharacterCallbacks({ setCharacters: charMgmtRef.current.setCharacters, setActiveCharacter: charMgmtRef.current.setActiveCharacter });
  }, []);

  useEffect(() => {
    campaignRef.current.setCampaignSelectCallback(async (name, loaded) => {
      charMgmtRef.current.setCharacters(loaded);
      // Pre-load combatSummary for the selected campaign so attack rider maneuvers work immediately
      const cs = await loadCombatSummary(name);
      if (cs) {
        setCombatSummaryCache(cs, name);
      } else if (loaded.length > 0) {
        // No combat data on server yet — initialize from player characters
        const creatures = loaded.map(c => ({
          name: c.name,
          type: 'player',
          currentHp: c.computedStats?.hp?.current || c.hp?.current || 1,
          maxHp: c.computedStats?.hp?.max || c.hp?.max || 1,
        }));
        const initial = { round: 1, creatures };
        setCombatSummaryCache(initial, name);
        storage.set('combatSummary', initial, name);
      }
      setCombatSummaryLoaded(true);
      if (loaded.length > 0) {
        charMgmtRef.current.setActiveCharacter(cloneDeep(loaded[0]));
        setActiveView('charSheet');
      } else {
        wizardRef.current.handleAddCharacter();
      }
    });
    campaignRef.current.setDeleteCampaignCallback(() => { charMgmtRef.current.setCharacters([]); charMgmtRef.current.setActiveCharacter(null); });
  }, []);

  const { showCampaignSelection, campaignName, isLocalhost, handleRenameCampaign: handleRenameCampaignRaw, handleDeleteCampaign: handleDeleteCampaignRaw, handleBackToCampaigns } = campaignMgmt;
  const { characters, activeCharacter, setCharacters, setActiveCharacter, handleUploadChange, handleSaveClick, handleUploadClick, handleDeleteCharacter: handleDeleteCharacterRaw, inputRef } = charMgmt;
  const { showCharacterWizard, showEditCharacterWizard, handleAddCharacter, handleWizardComplete, handleWizardCancel, handleEditCharacter, handleEditWizardComplete, handleEditWizardCancel } = wizard;

   // Compute full stats for all characters through the rules engine
    const [computedCharacters, setComputedCharacters] = useState([]);
    const [processingCharacters, setProcessingCharacters] = useState(false);
    const computedKeyRef = useRef('');
    const charactersSerialRef = useRef('');
    const maneuverSelectionVersion = useBattleMasterSelectionVersion(characters, campaignMgmt.campaignName);
    useEffect(() => {
      if (!characters || characters.length === 0) {
        setComputedCharacters([]);
        setProcessingCharacters(false);
        computedKeyRef.current = '';
        charactersSerialRef.current = '';
        return;
      }
      const key = characters.map(c => c.name).join(',');
      const serial = JSON.stringify(characters) + '|' + battleMasterSelectionSerial(characters, campaignMgmt.campaignName);
      if (key === computedKeyRef.current && serial === charactersSerialRef.current && computedCharacters.length > 0) return;
      computedKeyRef.current = key;
      charactersSerialRef.current = serial;
      let cancelled = false;
      setProcessingCharacters(true);
      (async () => {
        const enriched = await Promise.all(characters.map(async (character) => {
          try {
            const is2024 = character.rules === '2024';
            const effectiveClasses = is2024 ? classes2024 : classes;
            const effectiveRaces = is2024 ? races2024 : races;
            const effectiveMagicItems = is2024 ? magicItems2024 : magicItems;
            const spellData = is2024 ? spells2024 : spells;
            const playerStats = await rulesFactory.getPlayerStats(effectiveClasses, equipment, effectiveMagicItems, effectiveRaces, spellData, character);
            return { ...character, computedStats: playerStats };
          } catch {
            return character;
          }
        }));
        if (!cancelled) {
          setComputedCharacters(enriched);
          setProcessingCharacters(false);
        }
      })();
      return () => { cancelled = true; };
    }, [characters, maneuverSelectionVersion, classes, classes2024, equipment, magicItems, magicItems2024, races, races2024, spells, spells2024]); // eslint-disable-line react-hooks/exhaustive-deps

   // Seed runtime store with computed tracked resources, then apply server overrides
    const seededCampaignRef = useRef('');
    useEffect(() => {
      if (!computedCharacters.length || !campaignName) return;
      const campaign = campaignName;
      if (seededCampaignRef.current === campaign && computedCharacters.length > 0) return;
      seededCampaignRef.current = campaign;
      (async () => {
        const serverData = await fetchCampaignChangeData(campaignName);
        // Also seed arbitrary runtime keys (weapon mastery choices, etc.) from server data,
        // excluding transient prompt keys that should not persist across refreshes
        for (const char of computedCharacters) {
          seedCharacterRuntimeData(char, serverData);
        }
        // Seed campaign-level runtime data (targetEffects, etc.)
        seedCampaignRuntimeData(serverData);
      })();
    }, [computedCharacters, campaignName]);

  const [mapsView, setMapsView] = useState({ type: 'none' });
  const [activeMapName, setActiveMapName] = useState(null);
  const [npcs, setNpcs] = useState([]);
  const [activeView, setActiveView] = useState(null);
   // activeView: null | 'charSheet' | 'mapsManager' | 'encounter' | 'notes' | 'npcs' | 'settlements' | 'initiative'
  // type: 'none' | 'manager' | 'map'
  // When type is 'map', mapName holds the sanitized map filename (e.g. 'dungeon-level-1')
  // Navigation stack for indoor map entry (POI, encounter) — push on enter, pop on back
  const mapHistoryRef = useRef([]);

  const handleEnterMap = useCallback((mapName) => {
    if (mapsView.type === 'map' && mapsView.mapName) {
      mapHistoryRef.current.push(mapsView.mapName);
    }
    setMapsView({ type: 'map', mapName });
    setActiveMapName(mapName);
  }, [mapsView]);

  const handleBackFromMap = useCallback(() => {
    if (mapHistoryRef.current.length > 0) {
      const prevMap = mapHistoryRef.current.pop();
      setMapsView({ type: 'map', mapName: prevMap });
    } else {
      setMapsView({ type: isLocalhost ? 'manager' : 'none' });
    }
  }, [isLocalhost]);

  const [combatSummaryLoaded, setCombatSummaryLoaded] = useState(false);

  // Reset the loaded flag when switching campaigns so stale characters from the
  // previous campaign can't render (or bleed into the new campaign's initiative
  // roster) while the new campaign's data is still loading.
  const handleCampaignSelect = (campaign, characters) => {
    setCombatSummaryLoaded(false);
    campaignMgmt.handleCampaignSelect(campaign, characters);
  };

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

  useEffect(() => {
    setActiveMapName(null);
    if (!campaignName) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await mapsService.loadMaps(campaignName);
        if (cancelled) return;
        const active = result.maps.find(m => m.isActive);
        if (active) setActiveMapName(active.fileName.replace(/\.json$/, ''));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
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
        setActiveMapName(mapName);
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

  const handleSettlementsClick = () => {
    if (activeView !== 'settlements') {
      setActiveView('settlements');
    }
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

  /**
   * WARNING: SSE re-render loop risk
   * setRuntimeObject is called with skipSync=true to prevent re-POSTing the full
   * store back to the server on SSE echoes (the server already has this data).
   */
  // eslint-disable-next-line server-first/no-local-game-state
  const pendingPromptIdRef = useRef(null);
  const handleRuntimeEvent = useCallback((event) => {
    if (event.key == null || event.data == null) return;
    if (event.key.startsWith('character-')) {
      handleCharacterKeyEvent(event, { setCharacters, activeCharacter, setActiveCharacter });
      return;
    }
    if (event.key.startsWith('pipeline-')) {
      handlePipelineKeyEvent(event, campaignName);
      return;
    }
    handleChangeKeyEvent(event, campaignName, pendingPromptIdRef);
  }, [campaignName, setCharacters, activeCharacter, setActiveCharacter]);

  const handleDeleteCharacter = async (characterName) => {
    try {
      await handleDeleteCharacterRaw(characterName);
    } catch (error) {
      console.error('Error deleting character:', error);
      alert(`Failed to delete character: ${error.message}`);
    }
  };

  if (showCampaignSelection) return <CampaignSelection onCampaignSelect={handleCampaignSelect} />;
  if (appData.isLoading) return <div className="loading-overlay"><div className="loading-spinner">Loading rules data...</div></div>;
  if (!combatSummaryLoaded) return <div className="loading-overlay"><div className="loading-spinner">Loading campaign...</div></div>;

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
          isLocalhost={isLocalhost}
           onNPCsClick={handleNPCsClick}
           onSettlementsClick={handleSettlementsClick}
           onFactionsClick={handleFactionsClick}
          onLogClick={handleLogClick}
          onRepairClick={() => setActiveView('campaignRepair')}
          activeView={activeView}
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
              activeMapName={activeMapName}
              characters={computedCharacters}
              onDeleteCharacter={handleDeleteCharacter}
             onEditCharacter={() => handleEditCharacter(activeCharacter)}
             onUploadClick={handleUploadClick}
             onSaveClick={handleSaveClick}
           />
        )}
        {activeView === 'initiative' && <Initiative characters={computedCharacters} campaignName={campaignName} onNpcsChange={setNpcs} isLocalhost={isLocalhost} mapName={activeMapName} onViewCharacter={handleCharacterClick} />}
        {activeView === 'mapsManager' && (
          <MapsAreaView
            campaignName={campaignName}
            characters={characters}
            npcs={npcs}
            isLocalhost={isLocalhost}
            mapsView={mapsView}
            onBackFromMap={handleBackFromMap}
            onEncounterCreated={handleEnterMap}
            setMapsView={setMapsView}
            setActiveMapName={setActiveMapName}
          />
        )}
        <OverlayViews
          activeView={activeView}
          campaignName={campaignName}
          characters={characters}
          isLocalhost={isLocalhost}
          theme={theme}
          toggleTheme={toggleTheme}
          onRenameCampaign={handleRenameCampaign}
          onDeleteCampaign={handleDeleteCampaign}
          setActiveView={setActiveView}
        />
        <br />
        {showCharacterWizard && <CharacterCreationWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} allClasses={classes} campaignName={campaignName} />}
        {showEditCharacterWizard && <CharacterCreationWizard onComplete={handleEditWizardComplete} onCancel={handleEditWizardCancel} allClasses={classes} characterData={activeCharacter} isEditing={true} campaignName={campaignName} />}
        <SavePromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <DeathSavePromptModal campaignName={campaignName} characters={computedCharacters} />
        <ConcentrationPromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <BardicInspirationReactionModal campaignName={campaignName} characters={computedCharacters} />
        <ConditionChoiceModal />
        <Subscriber campaignName={campaignName} handleEvent={handleRuntimeEvent} />
        <MapContextSync campaignName={campaignName} activeMapName={activeMapName} />
        {processingCharacters && <div className="loading-overlay"><div className="loading-spinner">Loading party stats...</div></div>}
      </div>
    </div>
  );
}

export default App;
