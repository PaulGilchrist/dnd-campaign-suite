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
import MapUnavailable from './components/map/MapUnavailable.jsx';
import MapsManager from './components/maps-manager/MapsManager.jsx';
import { loadCombatSummary, setCombatSummaryCache } from './services/encounters/combatData.js';
import storage from './services/ui/storage.js';
import EncounterBuilder from './components/encounter/EncounterBuilder.jsx';
import * as mapsService from './services/maps/mapsService.js';
import { characterFileName } from './services/campaign/characterFileName.js';
import useAppData from './hooks/runtime/useAppData.js';
import useCharacterManagement from './hooks/management/useCharacterManagement.js';
import useCampaignManagement from './hooks/management/useCampaignManagement.js';
import { useCharacterWizard } from './hooks/wizard/useCharacterWizard.js';
import rulesFactory from './services/rules/rulesFactory.js';
import Subscriber from './components/common/Subscriber.jsx';
import CampaignReloadNotice from './components/common/CampaignReloadNotice/CampaignReloadNotice.jsx';
import MapContextSync from './components/common/MapContextSync.jsx';
import { setRuntimeObject, seedTrackedResources, getStore, notify } from './hooks/runtime/useRuntimeState.js';
import { applyServerOverride, trackedResourcesToStoreEntries } from './services/rules/trackedResources.js';
import { usePostRestoreNotice } from './hooks/ui/usePostRestoreNotice.js';
import { useBattleMasterSelectionVersion, battleMasterSelectionSerial } from './hooks/combat/battleMaster.js';
import Notes from './components/notes/Notes.jsx';
import Quests from './components/quests/Quests.jsx';
import NPCs from './components/npcs/NPCs.jsx';
import Settlements from './components/settlements/Settlements.jsx';
import Sessions from './components/sessions/Sessions.jsx';
import Factions from './components/factions/Factions.jsx';
import PartyInventory from './components/party-inventory/PartyInventory.jsx';
import Log from './components/log/Log.jsx';
import CampaignAdmin from './components/campaign-admin/CampaignAdmin.jsx';
import SavePromptModal from './components/common/SavePromptModal.jsx';
import DeathSavePromptModal from './components/common/DeathSavePromptModal.jsx';
import ConcentrationPromptModal from './components/common/ConcentrationPromptModal.jsx';
import ConditionChoiceModal from './components/common/ConditionChoiceModal.jsx';
import BardicInspirationReactionModal from './components/common/BardicInspirationReactionModal.jsx';
import ErrorBoundary from './components/error-boundary/ErrorBoundary.jsx';

function handleCharacterKeyEvent(event, { setCharacters, activeCharacter, setActiveCharacter }) {
  if (event.key.startsWith('character-delete-')) {
    const file = event.key.replace(/^character-delete-.+-/, '');
    // Ghost-sheet fix (backlog 2026-10-28-P): mirror the local-delete lane's
    // fallback (useCharacterManagement.js) — if the deleted character is the
    // one open in the sheet view, reassign activeCharacter to the next
    // remaining character (cloneDeep, like the local lane) or null when the
    // roster empties; activeView is left alone (the sheet renders only while
    // activeCharacter is set). Non-active deletes leave it untouched.
    setCharacters(prev => {
      const remaining = prev.filter(c => characterFileName(c.name) !== file);
      if (activeCharacter && characterFileName(activeCharacter.name) === file) {
        setActiveCharacter(remaining.length > 0 ? cloneDeep(remaining[0]) : null);
      }
      return remaining;
    });
  } else if (event.key.startsWith('character-create-')) {
    // Create echo (bug-character-create-no-live-mirror): event.data carries the
    // full new character — append it if absent so passive tabs see new party
    // members live. The name check dedups the echo on the CREATING tab, whose
    // wizard refetch already listed the character.
    const created = event.data;
    setCharacters(prev => (prev.some(c => c.name === created.name) ? prev : [...prev, created]));
  } else {
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

function redispatchSaveResult(promptId, data, campaignName) {
  const pending = peekPendingSavePrompt(promptId);
  if (pending) {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { ...pending, ...data } }));
    return;
  }
  const listenerPrompts = getRuntimeValue('campaign', 'pendingSaveListenerPrompts', campaignName) || []; // fix#339 (#1520-family): read/write symmetric channel vocabulary per fix#153/#198 — reader is arity-2 (useRuntimeState.js:63), scope = this campaign's SSE-mirrored store (applyStoreUpdate :90-93) until #1520
  if (listenerPrompts.includes(promptId)) {
    window.dispatchEvent(new CustomEvent('save-result', { detail: data }));
  }
}

function applyStoreUpdate(storeKey, data, campaignName) {
  // Campaign-level keys: SSE key is "change-{campaign}-{key}" -> store in campaign store
  // Character keys: SSE key is "change-{campaign}-{characterName}" -> apply full object to character store
  if (isCampaignKey(storeKey)) {
    const campaignStore = getStore('campaign');
    if (data === null) {
      // Cleared-key echo (POST null / key DELETE both publish null): mirror it as a
      // key REMOVE, not a stored null. useSyncedState then re-exposes the consumer's
      // DECLARED default (null scalars fall back to null too, so the run-K
      // EventDialog-close-on-clear fix is unchanged) and typed consumers — e.g. the
      // travel hook's Array `path` render reads — are never handed a raw null
      // (bug-hex-arrival-null-echo-blank-screen: storing null crashed the whole SPA).
      campaignStore.delete(storeKey);
    } else {
      campaignStore.set(storeKey, data);
    }
    notify('campaign');
  } else {
    setRuntimeObject(storeKey, data, campaignName, true);
  }
}

function handleChangeKeyEvent(event, campaignName, pendingPromptIdRef) {
  const prefix = `change-${campaignName}-`;
  if (!event.key.startsWith(prefix)) return;
  const storeKey = event.key.slice(prefix.length);
  if (event.data === null || typeof event.data !== 'object') {
    // Null payloads are cleared-key echoes (POST null / key DELETE both publish
    // null from campaigns-changedata.js) and scalars are plain value updates
    // (travel-mode, travel-lastMessage, …). Both must mirror into the campaign
    // store or other clients keep stale state — e.g. a resolved travel
    // EventDialog stays open on the second client (cross-tab staleness bug).
    // Character stores are full-snapshot replaces, so a non-object payload
    // there is corrupt noise and stays dropped; prompt lanes below need object
    // data, so they are never reached by null/scalar echoes.
    if (isCampaignKey(storeKey)) {
      applyStoreUpdate(storeKey, event.data, campaignName);
    }
    return;
  }
  if (storeKey.startsWith('saveResult-') && event.data.promptId) {
    redispatchSaveResult(event.data.promptId, event.data, campaignName);
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

function handleMapActivateEvent(event, { isLocalhost, activeView, mapsView, setMapsView, setActiveMapName }) {
  // GM (localhost) manages maps through the manager listing — behavior unchanged there.
  if (isLocalhost) return;
  const { activeMap } = event.data || {};
  if (!activeMap) return;
  // Player stranded on the blank maps view (no active map when they clicked
  // "Map") — open the map the GM just activated with zero further clicks.
  if (activeView === 'mapsManager' && mapsView.type !== 'map') {
    setMapsView({ type: 'map', mapName: activeMap });
    setActiveMapName(activeMap);
  }
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

function MapsAreaView({ campaignName, characters, npcs, isLocalhost, mapsView, onBackFromMap, onBackFromManager, onEncounterCreated, setMapsView, setActiveMapName, onRetryActiveMap }) {
  if (mapsView.type === 'manager') {
    return (
      <MapsManager
        campaignName={campaignName}
        onOpenMap={(mapName, mapDisplayName) => { setMapsView({ type: 'map', mapName, mapDisplayName }); setActiveMapName(mapName); }}
        onBack={onBackFromManager}
      />
    );
  }
  if (mapsView.type === 'map') {
    return (
      // Per-editor seam: a map-editor render crash degrades to the reload
      // card without taking the maps manager/sidebar down with it.
      <ErrorBoundary resetKey={mapsView.mapName}>
        <Map
          campaignName={campaignName}
          characters={characters}
          npcs={npcs}
          isLocalhost={isLocalhost}
          mapName={mapsView.mapName}
          mapDisplayName={mapsView.mapDisplayName}
          onBack={onBackFromMap}
          onEncounterCreated={onEncounterCreated}
          onPoiEntered={onEncounterCreated}
        />
      </ErrorBoundary>
    );
  }
  // Player with no active map — friendly waiting state until the GM
  // activates one (the map-activate SSE auto-open swaps this out).
  if (!isLocalhost) {
    return <MapUnavailable onRetry={onRetryActiveMap} />;
  }
  return null;
}

function OverlayViews({ activeView, campaignName, characters, isLocalhost, theme, toggleTheme, onRenameCampaign, onDeleteCampaign, setActiveView, restoredSnapshot }) {
  const views = {
    encounter: <EncounterBuilder characters={characters} campaignName={campaignName} onJoinEncounter={() => setActiveView('initiative')} />,
    notes: <Notes campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} onBack={() => setActiveView(null)} />,
    quests: <Quests campaignName={campaignName} isLocalhost={isLocalhost} onBack={() => setActiveView(null)} />,
    npcs: <NPCs campaignName={campaignName} characters={characters} onBack={() => setActiveView(null)} onViewInitiative={() => setActiveView('initiative')} />,
    settlements: <Settlements campaignName={campaignName} onBack={() => setActiveView(null)} />,
    sessions: <Sessions campaignName={campaignName} characters={characters} onBack={() => setActiveView(null)} onViewInitiative={() => setActiveView('initiative')} />,
    factions: <Factions campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} onBack={() => setActiveView(null)} />,
    partyInventory: <PartyInventory campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} onBack={() => setActiveView(null)} />,
    campaignLog: <Log campaignName={campaignName} characters={characters} />,
    campaignRepair: (
      <CampaignAdmin
        campaignName={campaignName}
        characters={characters}
        onBack={() => setActiveView(null)}
        theme={theme}
        toggleTheme={toggleTheme}
        onRenameCampaign={onRenameCampaign}
        onDeleteCampaign={onDeleteCampaign}
        restoredSnapshot={restoredSnapshot}
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
  useEffect(() => { charMgmtRef.current = charMgmt; campaignRef.current = campaignMgmt; wizardRef.current = wizard; }, [charMgmt, campaignMgmt, wizard]);

  const [activeView, setActiveView] = useState(null);
   // activeView: null | 'charSheet' | 'mapsManager' | 'encounter' | 'notes' | 'npcs' | 'settlements' | 'initiative'
  // type: 'none' | 'manager' | 'map'
  // When type is 'map', mapName holds the sanitized map filename (e.g. 'dungeon-level-1')
  // and mapDisplayName (optional) the manager row's display name — threads to the
  // rejected-load notice (backlog map-load-notice-slug-naming). POI-entered maps
  // carry no display name; the notice falls back to the slug there.
  // Navigation stack for indoor map entry (POI, encounter) — push on enter, pop on back
  const mapHistoryRef = useRef([]);

  // Post-rollback carry-over: re-select the campaign, land on the Admin view,
  // and show the "restored" banner after the rollback's full page reload.
  const { autoSelectCampaign, restoredSnapshot, consumeRestore } = usePostRestoreNotice(activeView);

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
      // Post-rollback auto-selection: land the GM back on the Admin view
      // instead of the character sheet after the full page reload.
      if (consumeRestore(name)) {
        setActiveView('campaignRepair');
      }
    });
    campaignRef.current.setDeleteCampaignCallback(() => { charMgmtRef.current.setCharacters([]); charMgmtRef.current.setActiveCharacter(null); });
  }, [consumeRestore]);

  const { showCampaignSelection, campaignName, isLocalhost, handleRenameCampaign: handleRenameCampaignRaw, handleDeleteCampaign: handleDeleteCampaignRaw, handleBackToCampaigns } = campaignMgmt;
  const { characters, activeCharacter, setCharacters, setActiveCharacter, handleUploadChange, handleSaveClick, handleUploadClick, handleDeleteCharacter: handleDeleteCharacterRaw, deleteErrorName, dismissDeleteError, inputRef } = charMgmt;
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
            const playerStats = await rulesFactory.getPlayerStats({ allClasses: effectiveClasses, allEquipment: equipment, allMagicItems: effectiveMagicItems, allRaces: effectiveRaces, allSpells: spellData, playerSummary: character });
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

  // Manager Back closes the maps area — but 'mapsManager' must not stay the
  // active view over a null MapsAreaView (a blank pane with the sidebar still
  // on "Maps"). Match every other view's Back → setActiveView(null) convention.
  const handleBackFromManager = useCallback(() => {
    setMapsView({ type: 'none' });
    setActiveView(null);
  }, []);

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
      if (isLocalhost) {
        // Self-heal the blank sub-state: a Back click or a campaign switch
        // can reset mapsView to 'none' while the sidebar still reads
        // 'mapsManager' — MapsAreaView renders nothing there, so the click
        // must reopen the manager listing instead of being swallowed as an
        // "already viewing the manager" no-op.
        if (mapsView.type === 'none') {
          setMapsView({ type: 'manager' });
        }
        return;
      }
      // Player on a blank maps view (earlier load found no active map) —
      // retry the active-map load so a map the GM activates later opens
      loadActiveMapAndOpen();
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
        setMapsView({ type: 'map', mapName, mapDisplayName: activeMap.name });
        setActiveMapName(mapName);
      }
      // No active map: the MapsAreaView waiting placeholder stays visible —
      // no blocking alert. A later map-activate SSE (or "Check Again") opens it.
    } catch (err) {
      console.error('Error loading maps:', err);
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

  const handleInventoryClick = () => {
    if (activeView !== 'partyInventory') {
      setActiveView('partyInventory');
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

  const handleRenameCampaign = async (newName) => {
    try {
      await handleRenameCampaignRaw(newName);
    } catch (error) {
      console.error('Error renaming campaign:', error);
      if (!newName) {
        // Legacy prompt-only caller (no modal) — surface via alert.
        alert(`Failed to rename campaign: ${error.message}`);
      } else {
        // Modal caller — CampaignAdmin renders the error in-modal; rethrow so it knows.
        throw error;
      }
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
    if (event.key == null) return;
    // Null data on a change-<campaign>-<key> echo is a cleared-key broadcast —
    // let it through so handleChangeKeyEvent can mirror the clear to the
    // campaign store. All other lanes need object payloads and keep dropping nulls.
    if (event.data == null && !event.key.startsWith(`change-${campaignName}-`)) return;
    if (event.key.startsWith('character-')) {
      handleCharacterKeyEvent(event, { setCharacters, activeCharacter, setActiveCharacter });
      return;
    }
    if (event.key.startsWith('pipeline-')) {
      handlePipelineKeyEvent(event, campaignName);
      return;
    }
    if (event.key === `map-activate-${campaignName}`) {
      handleMapActivateEvent(event, { isLocalhost, activeView, mapsView, setMapsView, setActiveMapName });
      return;
    }
    handleChangeKeyEvent(event, campaignName, pendingPromptIdRef);
  }, [campaignName, isLocalhost, activeView, mapsView, setCharacters, activeCharacter, setActiveCharacter]);

  const handleDeleteCharacter = async (characterName) => {
    try {
      await handleDeleteCharacterRaw(characterName);
    } catch (error) {
      // Single-warn doctrine: campaignService.deleteCharacter's catch owns
      // the console.error for every character HTTP failure (uniform with its
      // sibling service functions); this wrapper's job is the user-visible
      // alert only — logging at both layers printed two identical stacks per
      // failed delete (2026-10-28-P). Same reasoning as the delete-dispatcher
      // comment in useCharacterManagement.js:78-84.
      // Single-owner copy: the service's thrown Error already carries the
      // "Failed to delete character: " prefix, so alerting the raw message
      // here printed it twice ("Failed to delete character: Failed to delete
      // character: Not Found", c8acd5cba residual). The service owns the
      // prefix; we surface the message verbatim. The persistent inline roster
      // error is owned by useCharacterManagement (deleteErrorName) and shown
      // under the sidebar roster; this wrapper keeps the transient alert only.
      alert(error.message);
    }
  };

  if (showCampaignSelection) return <CampaignSelection onCampaignSelect={handleCampaignSelect} autoSelectCampaign={autoSelectCampaign} isLocalhost={isLocalhost} />;
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
          deleteErrorName={deleteErrorName}
          onDismissDeleteError={dismissDeleteError}
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
           onInventoryClick={handleInventoryClick}
           onSessionsClick={() => setActiveView('sessions')}
           onSettlementsClick={handleSettlementsClick}
           onFactionsClick={handleFactionsClick}
          onLogClick={handleLogClick}
          onRepairClick={() => setActiveView('campaignRepair')}
          activeView={activeView}
           />
        <ErrorBoundary resetKey={`${campaignName}|${activeView}`}>
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
            onBackFromManager={handleBackFromManager}
            onEncounterCreated={handleEnterMap}
            setMapsView={setMapsView}
            setActiveMapName={setActiveMapName}
            onRetryActiveMap={loadActiveMapAndOpen}
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
          restoredSnapshot={restoredSnapshot}
        />
        </ErrorBoundary>
        <br />
        {showCharacterWizard && <CharacterCreationWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} allClasses={classes} campaignName={campaignName} existingCharacters={characters} />}
        {showEditCharacterWizard && <CharacterCreationWizard onComplete={handleEditWizardComplete} onCancel={handleEditWizardCancel} allClasses={classes} characterData={activeCharacter} isEditing={true} campaignName={campaignName} existingCharacters={characters} />}
        <SavePromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <DeathSavePromptModal campaignName={campaignName} characters={computedCharacters} />
        <ConcentrationPromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <BardicInspirationReactionModal campaignName={campaignName} characters={computedCharacters} />
        <ConditionChoiceModal />
        <Subscriber campaignName={campaignName} handleEvent={handleRuntimeEvent} />
        <CampaignReloadNotice campaignName={campaignName} />
        <MapContextSync campaignName={campaignName} activeMapName={activeMapName} isLocalhost={isLocalhost} />
        {processingCharacters && <div className="loading-overlay"><div className="loading-spinner">Loading party stats...</div></div>}
      </div>
    </div>
  );
}

export default App;
