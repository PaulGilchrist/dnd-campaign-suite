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
import { loadCombatSummary, setCombatSummaryCache } from './services/encounters/combatData.js';
import EncounterBuilder from './components/encounter/EncounterBuilder.jsx';
import * as mapsService from './services/maps/mapsService.js';
import useAppData from './hooks/runtime/useAppData.js';
import useCharacterManagement from './hooks/management/useCharacterManagement.js';
import useCampaignManagement from './hooks/management/useCampaignManagement.js';
import { useCharacterWizard } from './hooks/wizard/useCharacterWizard.js';
import rulesFactory from './services/rules/rulesFactory.js';
import Subscriber from './components/common/Subscriber.jsx';
import { setRuntimeObject, seedTrackedResources, getStore } from './hooks/runtime/useRuntimeState.js';
import { applyServerOverride, trackedResourcesToStoreEntries } from './services/rules/trackedResources.js';
import Notes from './components/notes/Notes.jsx';
import Quests from './components/quests/Quests.jsx';
import NPCs from './components/npcs/NPCs.jsx';
import Settlements from './components/settlements/Settlements.jsx';
import Factions from './components/factions/Factions.jsx';
import Log from './components/log/Log.jsx';
import SavePromptModal from './components/common/SavePromptModal.jsx';
import DeathSavePromptModal from './components/common/DeathSavePromptModal.jsx';
import ConcentrationPromptModal from './components/common/ConcentrationPromptModal.jsx';
import ConditionChoiceModal from './components/common/ConditionChoiceModal.jsx';
import BardicInspirationReactionModal from './components/common/BardicInspirationReactionModal.jsx';

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

  const { showCampaignSelection, campaignName, isLocalhost, handleCampaignSelect, handleRenameCampaign: handleRenameCampaignRaw, handleDeleteCampaign: handleDeleteCampaignRaw, handleBackToCampaigns } = campaignMgmt;
  const { characters, activeCharacter, setCharacters, setActiveCharacter, handleUploadChange, handleSaveClick, handleUploadClick, handleDeleteCharacter: handleDeleteCharacterRaw, inputRef } = charMgmt;
  const { showCharacterWizard, showEditCharacterWizard, handleAddCharacter, handleWizardComplete, handleWizardCancel, handleEditCharacter, handleEditWizardComplete, handleEditWizardCancel } = wizard;

   // Compute full stats for all characters through the rules engine
    const [computedCharacters, setComputedCharacters] = useState([]);
    const [processingCharacters, setProcessingCharacters] = useState(false);
    const computedKeyRef = useRef('');
    const charactersSerialRef = useRef('');
    useEffect(() => {
      if (!characters || characters.length === 0) {
        setComputedCharacters([]);
        setProcessingCharacters(false);
        computedKeyRef.current = '';
        charactersSerialRef.current = '';
        return;
      }
      const key = characters.map(c => c.name).join(',');
      const serial = JSON.stringify(characters);
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
    }, [characters, classes, classes2024, equipment, magicItems, magicItems2024, races, races2024, spells, spells2024]); // eslint-disable-line react-hooks/exhaustive-deps

   // Seed runtime store with computed tracked resources, then apply server overrides
    const seededCampaignRef = useRef('');
    useEffect(() => {
      if (!computedCharacters.length || !campaignName) return;
      const campaign = campaignName;
      if (seededCampaignRef.current === campaign && computedCharacters.length > 0) return;
      seededCampaignRef.current = campaign;
      (async () => {
        let serverData = {};
        try {
          const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/change-data`);
          if (response.ok) {
            serverData = await response.json();
          }
        } catch { /* no server — use computed defaults */ }

        for (const char of computedCharacters) {
          const stats = char.computedStats;
          if (!stats || !stats._trackedResources) continue;
          const charServerData = serverData ? serverData[stats.name] : null;
          const merged = applyServerOverride(stats._trackedResources, charServerData);
          const entries = trackedResourcesToStoreEntries(merged);
          seedTrackedResources(stats.name, entries);
          // Also seed arbitrary runtime keys (weapon mastery choices, etc.) from server data
          // Exclude transient prompt keys that should not persist across refreshes
          if (charServerData && typeof charServerData === 'object') {
            const store = getStore(stats.name);
            for (const [key, value] of Object.entries(charServerData)) {
              if (!store.has(key) && value != null && key !== 'biPrompt') {
                store.set(key, value);
              }
            }
          }
        }
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

  const handleBackFromSettlements = () => {
    setActiveView(null);
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
      }
      return;
    }
    if (event.key.startsWith('pipeline-')) {
      const prefix = `pipeline-${campaignName}-`;
      if (!event.key.startsWith(prefix)) return;
      const actualKey = event.key.slice(prefix.length);
      setRuntimeObject(actualKey, event.data, campaignName, true);
      return;
    }
    if (!event.key.startsWith('change-')) return;
    if (!event.data || typeof event.data !== 'object') return;
    const prefix = `change-${campaignName}-`;
    if (!event.key.startsWith(prefix)) return;
    const storeKey = event.key.slice(prefix.length);
    if (event.data && typeof event.data === 'object' && 'biPrompt' in event.data) {
      pendingPromptIdRef.current = event.data.biPrompt?.promptId || null;
      return;
    }
    if (pendingPromptIdRef.current && event.data && typeof event.data === 'object' && 'biPromptCleared' in event.data) {
      return;
    }
    pendingPromptIdRef.current = null;
    // When characterKey === campaignName, the SSE event key is "change-{campaign}-{campaign}"
    // and event.data contains the full store object. Extract targetEffects if present.
    let actualData = event.data;
    let effectiveStoreKey = storeKey;
    if (actualData && typeof actualData === 'object' && !Array.isArray(actualData) && actualData.targetEffects !== undefined) {
        actualData = actualData.targetEffects;
        effectiveStoreKey = 'targetEffects';
    } else if (storeKey === 'targetEffects' && actualData && typeof actualData === 'object' && !Array.isArray(actualData)) {
        actualData = actualData[storeKey];
    }
    // When the store key is a character name, event.data is the full character store object.
    // Apply each property directly to the character store instead of wrapping it.
    if (effectiveStoreKey !== 'targetEffects' && actualData && typeof actualData === 'object' && !Array.isArray(actualData)) {
        setRuntimeObject(storeKey, actualData, campaignName, true);
    } else {
        setRuntimeObject(campaignName, { [effectiveStoreKey]: actualData }, campaignName, true);
    }
  }, [campaignName, setCharacters]);

  const handleDeleteCharacter = async (characterName) => {
    try {
      await handleDeleteCharacterRaw(characterName);
    } catch (error) {
      console.error('Error deleting character:', error);
      alert(`Failed to delete character: ${error.message}`);
    }
  };

  if (showCampaignSelection) return <CampaignSelection onCampaignSelect={handleCampaignSelect} />;
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
          theme={theme}
          toggleTheme={toggleTheme}
          isLocalhost={isLocalhost}
           onNPCsClick={handleNPCsClick}
           onSettlementsClick={handleSettlementsClick}
           onFactionsClick={handleFactionsClick}
          onLogClick={handleLogClick}
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
        {activeView === 'initiative' && <Initiative characters={computedCharacters} campaignName={campaignName} onNpcsChange={setNpcs} isLocalhost={isLocalhost} mapName={activeMapName} />}
        {activeView === 'mapsManager' && mapsView.type === 'manager' && (
          <MapsManager
            campaignName={campaignName}
            onOpenMap={(mapName) => { setMapsView({ type: 'map', mapName }); setActiveMapName(mapName); }}
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
            onViewInitiative={() => setActiveView('initiative')}
          />
        )}
        {activeView === 'settlements' && (
          <Settlements
            campaignName={campaignName}
            onBack={handleBackFromSettlements}
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
        {showCharacterWizard && <CharacterCreationWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} allRaces={races} allRaces2024={races2024} allClasses={classes} allSpells={spells} allSpells2024={spells2024} campaignName={campaignName} />}
        {showEditCharacterWizard && <CharacterCreationWizard onComplete={handleEditWizardComplete} onCancel={handleEditWizardCancel} allRaces={races} allClasses={classes} allSpells={spells} allSpells2024={spells2024} characterData={activeCharacter} isEditing={true} campaignName={campaignName} />}
        <SavePromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <DeathSavePromptModal campaignName={campaignName} characters={computedCharacters} />
        <ConcentrationPromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <BardicInspirationReactionModal campaignName={campaignName} characters={computedCharacters} />
        <ConditionChoiceModal />
        <Subscriber campaignName={campaignName} handleEvent={handleRuntimeEvent} />
        {processingCharacters && <div className="loading-overlay"><div className="loading-spinner">Loading party stats...</div></div>}
      </div>
    </div>
  );
}

export default App;
