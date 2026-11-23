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
import SidebarShell from './components/sidebar/SidebarShell.jsx';
import Map from './components/map/Map.jsx';
import MapUnavailable from './components/map/MapUnavailable.jsx';
import MapsManager from './components/maps-manager/MapsManager.jsx';
import { loadCombatSummary, setCombatSummaryCache } from './services/encounters/combatData.js';
import { beginCampaignChangeDataEntry, readCampaignChangeData, abandonCampaignChangeDataEntry } from './services/campaign/changeDataSnapshot.js';
import CampaignEnterFailed from './components/campaign-enter-failed/CampaignEnterFailed.jsx';
import storage from './services/ui/storage.js';
import { requestEncounterLoad } from './services/ui/encounterLoadSignal.js';
import EncounterBuilder from './components/encounter/EncounterBuilder.jsx';
import * as mapsService from './services/maps/mapsService.js';
import { characterFileName } from './services/campaign/characterFileName.js';
import useCampaignType from './hooks/management/useCampaignType.js';
import useAppData from './hooks/runtime/useAppData.js';
import useCharacterManagement from './hooks/management/useCharacterManagement.js';
import useCampaignManagement from './hooks/management/useCampaignManagement.js';
import useMapHistory from './hooks/management/useMapHistory.js';
import { useCharacterWizard } from './hooks/wizard/useCharacterWizard.js';
import rulesFactory from './services/rules/rulesFactory.js';
import Subscriber from './components/common/Subscriber.jsx';
import CombatCues from './components/common/CombatCues.jsx';
import CampaignReloadNotice from './components/common/CampaignReloadNotice/CampaignReloadNotice.jsx';
import MapContextSync from './components/common/MapContextSync.jsx';
import { replaceRuntimeObject, seedTrackedResources, getStore, notify, evictCharacterStores } from './hooks/runtime/useRuntimeState.js';
import { applyServerOverride, trackedResourcesToStoreEntries } from './services/rules/trackedResources.js';
import { usePostRestoreNotice } from './hooks/ui/usePostRestoreNotice.js';
import { useBattleMasterSelectionVersion, battleMasterSelectionSerial } from './hooks/combat/battleMaster.js';
import Notes from './components/notes/Notes.jsx';
import Quests from './components/quests/Quests.jsx';
import QuestBoard from './components/quest-board/QuestBoard.jsx';
import NPCs from './components/npcs/NPCs.jsx';
import Settlements from './components/settlements/Settlements.jsx';
import CampaignBuilder from './components/campaign-builder/CampaignBuilder.jsx';
import Sessions from './components/sessions/Sessions.jsx';
import Factions from './components/factions/Factions.jsx';
import PartyInventory from './components/party-inventory/PartyInventory.jsx';
import Log from './components/log/Log.jsx';
import GMScreen from './components/gm-screen/GMScreen.jsx';
import MusicPlayer from './components/music/MusicPlayer.jsx';
import CampaignAdmin from './components/campaign-admin/CampaignAdmin.jsx';
import SavePromptModal from './components/common/SavePromptModal.jsx';
import DeathSavePromptModal from './components/common/DeathSavePromptModal.jsx';
import ConcentrationPromptModal from './components/common/ConcentrationPromptModal.jsx';
import ConditionChoiceModal from './components/common/ConditionChoiceModal.jsx';
import ErrorBoundary from './components/error-boundary/ErrorBoundary.jsx';
import FirstSessionChecklist from './components/campaign-starter/FirstSessionChecklist.jsx';
import HelpDrawer from './components/HelpDrawer/HelpDrawer.jsx';
import EmptyCampaignState from './components/campaign-empty-state/EmptyCampaignState.jsx';
import TvExitButton from './components/common/TvExitButton/TvExitButton.jsx';
import { getDocumentTitle } from './routes/config.js';
import LevelUpCelebration from './components/level-up/LevelUpCelebration.jsx';

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

function applyStoreUpdate(storeKey, data) {
  // Campaign-level keys: SSE key is "change-{campaign}-{key}" -> store in campaign store
  // Character keys: SSE key is "change-{campaign}-{characterName}" -> replace that
  // character store's bucket with the snapshot (server writes are full replaces)
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
  } else if (data === null) {
    // Cleared-bucket echo (character-key DELETE publishes null): mirror it as a
    // bucket REMOVE, exactly as the campaign branch above removes its key. The
    // empty-object snapshot replace evicts every local key (server truth: the
    // bucket is gone) and notify wakes the consumers so their declared defaults
    // win — never a stored null (hex-arrival-null-echo crash precedent), never a
    // re-POST (memory-only skipSync law). Without this arm the echo was silently
    // dropped and every mounted tab kept phantom badges/rows until a page reload
    // (bug-character-bucket-delete-echo-never-self-heals).
    replaceRuntimeObject(storeKey, {});
  } else {
    // Full-bucket echo: adopt as REPLACE (evict keys absent from the payload —
    // the server route replaced the whole bucket with this snapshot).
    // Memory-only, so this never re-POSTs the echo back (skipSync law).
    replaceRuntimeObject(storeKey, data);
  }
}

// The module-level combatData cache (getCombatSummary readers — e.g. the Aura
// of Protection board-member guard behind the phantom-bearer caveat) must
// track board writes on EVERY lane, not just the Initiative view that
// refreshes it from its own SSE subscription: a sheet-only tab stayed
// boot-stale no matter how long it settled, so the caveat wrongly asserted
// "assumed co-present (no token)" for an ally verifiably on the server board
// (bug-aura-caveat-asserts-for-on-board-bearer-stale-cache). Memory-only
// adoption (skipSync law — an echo is never re-POSTed). Same guard as the
// Initiative lane's handleCombatSummaryChange: a null (cleared-key) echo
// evicts the cache, only echoes carrying a board are adopted, anything else
// leaves the cache untouched. On Initiative tabs this runs first (the root
// Subscriber subscribes before the view's) and the Initiative handler's
// merged write still wins afterwards — that lane is behaviour-unchanged.
function syncCombatSummaryCache(storeKey, data, campaignName) {
  if (storeKey !== 'combatSummary') return;
  if (data === null) {
    setCombatSummaryCache(null, campaignName);
  } else if (data?.creatures) {
    setCombatSummaryCache(data, campaignName);
  }
}

function handleChangeKeyEvent(event, campaignName) {
  const prefix = `change-${campaignName}-`;
  if (!event.key.startsWith(prefix)) return;
  const storeKey = event.key.slice(prefix.length);
  syncCombatSummaryCache(storeKey, event.data, campaignName);
  if (event.data === null || typeof event.data !== 'object') {
    // Null payloads are cleared-key echoes (POST null / key DELETE both publish
    // null from campaigns-changedata.js) and scalars are plain value updates
    // (travel-mode, travel-lastMessage, …). Both must mirror into the campaign
    // store or other clients keep stale state — e.g. a resolved travel
    // EventDialog stays open on the second client (cross-tab staleness bug).
    // Character stores are full-snapshot replaces, so a non-NULL non-object
    // payload there is corrupt noise and stays dropped; a null echo honestly
    // reports an evicted bucket and mirrors as a bucket REMOVE (see
    // applyStoreUpdate) so mounted consumers self-heal without a reload
    // (bug-character-bucket-delete-echo-never-self-heals). Prompt lanes below
    // need object data, so they are never reached by null/scalar echoes.
    if (isCampaignKey(storeKey) || event.data === null) {
      applyStoreUpdate(storeKey, event.data);
    }
    return;
  }
  if (storeKey.startsWith('saveResult-') && event.data.promptId) {
    redispatchSaveResult(event.data.promptId, event.data, campaignName);
  }
  applyStoreUpdate(storeKey, event.data);
}

function handleMapActivateEvent(event, { isLocalhost, activeView, mapsView, setMapsView, setActiveMapName }) {
  const data = event.data || {};
  const { activeMap } = data;
  // Deactivate echo (PUT /maps/<slug>/deactivate publishes { activeMap: null }):
  // EVERY tab must disarm its map context (backlog 2026-11-04 CQ). A stale
  // activeMapName here resurrects the old map: MapContextSync force-stamps
  // '__map__' on its next activeMapName transition (campaign re-select mounts
  // it with the stale prop), so the null-reset would survive only until then
  // (playbook gridless-ritual §258 resurrection vector on the client side).
  // Malformed payloads (null data dropped upstream, '' falls through below)
  // are never deactivations — only an explicit null in the payload is.
  if ('activeMap' in data && activeMap === null) {
    setActiveMapName(null);
    return;
  }
  if (!activeMap) return;
  // GM (localhost) manages the view through the manager listing — an activation
  // never navigates them. But it MUST still arm their own tab's map context:
  // every roller lane consumes the activeMapName prop chain (Initiative →
  // MonsterCardModal mapData), and a GM who only activated a map (never Opened
  // or re-selected) would otherwise silently roll gridless — measured range
  // gates and rage-aura distance checks degrade to tokenless leniency on the
  // GM tab while every player tab measures through the activated map
  // (bug-gm-activate-without-open-gridless-roller-lane).
  if (isLocalhost) {
    setActiveMapName(activeMap);
    return;
  }
  // A player's open map view is NEVER hijacked by an activation (the
  // "never hijacks" contract pinned by App.map-activate.test.jsx). But the
  // tab's map context must still follow the table: arm it with the newly
  // activated map (roller lanes consume it; it mirrors the server '__map__').
  // This is also the LIVE-CLEAR seam for the deactivated-map header hint: a
  // re-activation of the mounted map clears the advisory without a reload,
  // while a switch to another map keeps it on the orphaned view.
  if (mapsView.type === 'map') {
    setActiveMapName(activeMap);
    return;
  }
  // Player stranded on the blank maps view (no active map when they clicked
  // "Map") — open the map the GM just activated with zero further clicks.
  if (activeView === 'mapsManager') {
    setMapsView({ type: 'map', mapName: activeMap });
    setActiveMapName(activeMap);
  }
}

// Advisory derivation (backlog 2026-11-05 CW "silence gap"): a mounted map
// view is "the table's map" only while the campaign's active map — the
// '__map__' SSE seam mirrored into App state by handleMapActivateEvent —
// matches what the view has mounted. A deactivation (activeMap: null) or a
// switch (activeMap: <other>) leaves the open board fully intact
// (never-hijack) but no longer table-active, so the map header surfaces a
// subtle hint. Slug comparison strips .json like MapContextSync does.
const mapSlug = (name) => String(name || '').replace(/\.json$/i, '');
function isMountedMapActive(activeMapName, mountedMapName) {
  return activeMapName != null
    && mapSlug(activeMapName) !== ''
    && mapSlug(activeMapName) === mapSlug(mountedMapName);
}

// Level-up celebration handoff (roadmap Item 8): opens the EXISTING edit
// wizard for the crossing character — the same lane the sheet's "Edit"
// button uses (the edit wizard's first visible step is Basic Information,
// which owns the Level field: the level-up editing entry). The wizard seeds
// from the character passed to handleEditCharacter; setActiveCharacter arms
// the sheet view behind it (mirroring handleCharacterClick, cloneDeep).
// No new wizard flow.
function openLevelUpWizard(character, { setActiveCharacter, handleEditCharacter }) {
  setActiveCharacter(cloneDeep(character));
  handleEditCharacter(character);
}

// Reads the campaign's change-data snapshot through the shared enter-seam lane
// (changeDataSnapshot.js): every mount-seam consumer — this hydrate, the
// character seed effect, and the select callback's combatSummary preload that
// OPENED the seam — adopts the ONE entry GET instead of each fetching the same
// bytes concurrently (backlog 2026-11-22 SV: four near-simultaneous GETs per
// entry). A re-select begins a fresh entry read, so server truth is still
// re-adopted per seam, never served from the previous seam's settled bytes.
// NULL marks "no snapshot" (unlike an EMPTY object, which honestly means
// "campaign has no change-data"): hydrateCampaignRuntimeData must never
// evict the whole shared store on a fetch failure, only on real server truth.
async function fetchCampaignChangeData(campaignName) {
  try {
    return await readCampaignChangeData(campaignName);
  } catch { /* no server — use computed defaults */ }
  return null;
}

// Campaign-enter gate escape (backlog TT 2026-11-22): the enter-seam
// change-data GET gates ALL campaign rendering, so a stalled socket used to
// pin the tab on the `Loading campaign...` face forever (prod analogue: a
// captive proxy / half-open keep-alive). Past this bounded wait — or on a
// fast GET failure (500 / network error) — the gate flips to the
// CampaignEnterFailed face with a Retry affordance instead.
export const CAMPAIGN_ENTER_TIMEOUT_MS = 10000;

/**
 * Bounded enter-seam combatSummary preload. The load JOINS the ONE entry GET
 * (single-GET law, caa1d0b0c) via the STRICT lane, so a genuine GET failure
 * rejects fast; the timer is a benign-UI escape only (no-timers policy
 * allowlist: 'network fetch timeout' — no game state advances on this clock,
 * it decides which face the enter gate shows). On timeout the seam is
 * ABANDONED first, releasing the hung socket + slot so the Retry seam issues
 * a FRESH GET instead of re-joining the dead one. A late original response
 * cannot clobber a retry result: its attempt token is stale (checked by
 * useCampaignEnterGate) and the abandoned read already rejected its joiners.
 */
function loadCampaignEnterData(campaignName) {
  const load = loadCombatSummary(campaignName, { strict: true });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // fetch timeout (benign UI): release the stalled enter seam, decide nothing else.
      abandonCampaignChangeDataEntry(campaignName);
      const err = new Error(`change-data enter timed out (${CAMPAIGN_ENTER_TIMEOUT_MS} ms) for ${campaignName}`);
      err.enterLoadTimedOut = true;
      reject(err);
    }, CAMPAIGN_ENTER_TIMEOUT_MS);
    load.then(
      (cs) => { clearTimeout(timer); resolve(cs); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Campaign-enter gate (module scope: App sits at the eslint statement
 * ceiling — useCampaignScopeRescope/EmptyCampaignStage precedent). Backlog
 * TT 2026-11-22: the enter-seam change-data GET gates ALL campaign
 * rendering, so a stalled socket used to pin the tab on `Loading campaign...`
 * forever (prod analogue: captive proxy / half-open keep-alive). Every seam
 * attempt carries an attempt token; a superseded (or timed-out-then-aborted)
 * attempt can never apply its bytes. Stalls past CAMPAIGN_ENTER_TIMEOUT_MS
 * and fast GET failures (500 / network error, surfaced through the STRICT
 * enter load) land on ONE unified failure face with a Retry affordance that
 * re-runs the seam for the SAME campaign in the SAME tab — the successful
 * fast path renders byte-identically to before (the face state is only ever
 * set on a settled-failed attempt).
 */
function useCampaignEnterGate({ charMgmtRef, wizardRef, campaignRef, consumeRestore, setActiveView, setCombatSummaryLoaded }) {
  const [enterError, setEnterError] = useState(null);
  const attemptRef = useRef(0);
  const lastEnterRef = useRef(null);

  const runEnter = useCallback(async (name, loaded) => {
    const attempt = ++attemptRef.current;
    lastEnterRef.current = { name, loaded };
    setEnterError(null);
    charMgmtRef.current.setCharacters(loaded);
    // Open the enter-seam snapshot BEFORE the combat preload: this fetch is
    // the ONE change-data GET the whole mount seam hydrates from (rescope
    // hydrate + character seed adopt it; the preload below joins its live
    // slot — backlog 2026-11-22 SV chatty-enter fix).
    beginCampaignChangeDataEntry(name);
    let cs = null;
    try {
      cs = await loadCampaignEnterData(name);
    } catch (err) {
      // Stale attempt (Retry/re-select superseded us) or abandoned stall:
      // never apply, never clobber. The fast-fail lane (getCombatContext)
      // owns the console warn; only the pure stall (no bytes ever arrived)
      // logs here.
      if (attempt !== attemptRef.current) return;
      if (err.enterLoadTimedOut) console.error(`Campaign enter stalled: ${err.message}`);
      setEnterError(err);
      return;
    }
    if (attempt !== attemptRef.current) return;
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
    }
    // Zero-character entry NEVER auto-opens the creation wizard (owner
    // doctrine 2026-11-23): both seeded presets (qa-arena, qa-starter) and
    // plain campaigns land on their normal first-run view — the starter
    // checklist and/or the EmptyCampaignState card — with hero building an
    // explicit click (sidebar "Add Character", the card's "Add your first
    // character" button, or the checklist's Build-heroes step). The old
    // offer-once auto-open seam (and its localStorage pref facade) is fully
    // removed; the GM-only character-creation server guard is untouched.
    // Post-rollback auto-selection: land the GM back on the Admin view
    // instead of the character sheet after the full page reload.
    if (consumeRestore(name)) {
      setActiveView('campaignRepair');
    }
  }, [charMgmtRef, consumeRestore, setActiveView, setCombatSummaryLoaded]);

  const retryEnter = useCallback(() => {
    const last = lastEnterRef.current;
    if (last) runEnter(last.name, last.loaded);
  }, [runEnter]);

  // Back-to-selection lane: the ONE seam every exit rides — the sidebar
  // "Campaigns" control and the CampaignEnterFailed `Back to Campaigns`
  // escape (server durably down) share this callback (App sits at the
  // max-statements ceiling, so the lane lives here, next to the gate's other
  // escape). Campaign-switch law (see App.handleCampaignSelect): both seams
  // close the wizard lanes — leaving a campaign must not leave a resurrectable
  // open-flag behind on the never-unmounted App.
  const backToCampaigns = useCallback(() => {
    wizardRef.current.closeWizards();
    campaignRef.current.handleBackToCampaigns();
  }, [wizardRef, campaignRef]);

  useEffect(() => {
    campaignRef.current.setCampaignSelectCallback(runEnter);
    campaignRef.current.setDeleteCampaignCallback(() => { charMgmtRef.current.setCharacters([]); charMgmtRef.current.setActiveCharacter(null); });
  }, [runEnter, campaignRef, charMgmtRef]);

  return { enterError, retryEnter, backToCampaigns };
}

function seedCharServerKeys(storeName, charServerData) {
  if (!charServerData || typeof charServerData !== 'object') return;
  const store = getStore(storeName);
  let seededAny = false;
  for (const [key, value] of Object.entries(charServerData)) {
    if (!store.has(key) && value != null) {
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

function hydrateCampaignRuntimeData(serverData) {
  // Campaign keys are at the top level of serverData, adopted into the shared
  // 'campaign' store. That store is ONE global bucket keyed by characterKey
  // only (useRuntimeState.js `stores`), so selecting a campaign must RE-SCOPE
  // it to that campaign's own snapshot: adopt-and-evict via
  // replaceRuntimeObject, the same full-replace law the character-bucket SSE
  // echoes follow (applyStoreUpdate). The old seed-if-absent never evicted, so
  // a no-reload campaign switch left campaign A's keys readable under campaign
  // B — the Admin AI panel rendered A's aiConfig (endpoint, model, a live
  // referee console) for a B whose server answers {value:null}
  // (bug-campaign-store-ghost-keys-survive-campaign-switch). Memory-only: the
  // server owns this data, an adopted snapshot is never re-POSTed (skipSync law).
  // Null-valued snapshot entries stay UNADOPTED (never a stored null — the
  // null-echo REMOVE doctrine from applyStoreUpdate, hex-arrival-null-echo
  // crash precedent); the POST-null lanes park nulls server-side, and absent
  // from the adopted set a ghost null key evicts just like a missing one.
  if (!serverData || typeof serverData !== 'object') return;
  const adopted = Object.fromEntries(
    Object.entries(serverData).filter(([, value]) => value != null)
  );
  replaceRuntimeObject('campaign', adopted);
}

// Enter-seam store rescope (module scope: App sits at the eslint statement
// ceiling, EmptyCampaignStage/isActiveEconomyRowGmDriven precedent). ONE
// fetch of the entered campaign's change-data drives BOTH scope lanes:
// adopt-and-evict the shared 'campaign' bucket (every entry, including
// re-selects) AND evict the character-keyed buckets on a real campaign
// change. Law details in the effect body below.
function useCampaignScopeRescope(campaignName, showCampaignSelection) {
  // Tracks the campaign whose scope the character-keyed stores currently
  // hold (enter-seam evict gate).
  const charScopedCampaignRef = useRef('');
  useEffect(() => {
    if (!campaignName || showCampaignSelection) return;
    // Character-scope rescope (bug-character-store-ghost-keys-survive-
    // campaign-switch): the character-keyed buckets in useRuntimeState's
    // `stores` Map are keyed by BARE character name, so the campaign-store
    // adopt-and-evict below leaves a no-reload switch leaking campaign A's
    // per-character runtime keys into a SAME-NAMED creature under campaign B
    // (fresh qa-arena NPC 1 pre-trusting A's allies, spurious friendly-fire
    // confirm, allegiance-override lanes reading ghost bytes). Fires ONLY
    // when the campaign name actually CHANGES — never on same-campaign
    // re-select: the character seed effect in App reseeds locally-derived
    // keys only on a campaign change (seededCampaignRef gate), so a
    // re-select wipe would strand them until a reload. Synchronous, before
    // the snapshot fetch: every bucket still present at this moment belongs
    // to the previous scope (the new campaign's SSE EventSource only opens
    // on this render and its connect replay is asynchronous). Memory-only —
    // the entered campaign's own buckets arrive via that replay + the seed
    // effect (the exact lanes a reload hydrates through, which is why the
    // reload-cure face was honest).
    if (charScopedCampaignRef.current !== campaignName) {
      charScopedCampaignRef.current = campaignName;
      evictCharacterStores();
    }
    let cancelled = false;
    (async () => {
      const serverData = await fetchCampaignChangeData(campaignName);
      if (!cancelled) hydrateCampaignRuntimeData(serverData);
    })();
    return () => { cancelled = true; };
  }, [campaignName, showCampaignSelection]);
}

function MapsAreaView({ campaignName, characters, npcs, isLocalhost, mapsView, activeMapName, activeCharacter, onBackFromMap, backMapTarget, onEncounterCreated, setMapsView, setActiveMapName, onRetryActiveMap }) {
  if (mapsView.type === 'manager') {
    return (
      <MapsManager
        campaignName={campaignName}
        onOpenMap={(mapName, mapDisplayName) => { setMapsView({ type: 'map', mapName, mapDisplayName }); setActiveMapName(mapName); }}
        // Deleting the active map clears the server key (stampActiveMapContext
        // null) — mirror that into this tab's roller-lane context so the stale
        // name can't keep arming modal mapData for a deleted file
        // (bug-gm-activate-without-open-gridless-roller-lane, delete face).
        onMapDeleted={(fileName) => setActiveMapName(prev => (prev === fileName ? null : prev))}
      />
    );
  }
  if (mapsView.type === 'map') {
    const mountedIsActive = isMountedMapActive(activeMapName, mapsView.mapName);
    // "View the new map" affordance (backlog 2026-11-08): a visitor pinned on
    // an orphaned board while the campaign HAS a different active map gets an
    // explicit jump button in the advisory chip. Never-hijack holds — the view
    // changes ONLY on click, mirroring the blank-view auto-open lane's
    // { type: 'map', mapName } contract. No active map (deactivation) or the
    // mounted map being the table's map ⇒ no button. GM (localhost) navigates
    // through the manager listing and is deliberately left unchanged.
    const newActiveMap = !isLocalhost && !mountedIsActive && activeMapName != null
      ? mapSlug(activeMapName)
      : null;
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
          // Ownership tint (roadmap Item 6): the name this device currently
          // has open in the sidebar/sheet (per-client local state, never
          // synced). Visitors get a green ring on their selected
          // character's token; the GM lane renders every token neutral.
          localCharacterName={activeCharacter?.name}
          // Deactivated-map advisory (backlog 2026-11-05 CW): false once the
          // campaign's active map ('__map__' SSE seam) no longer matches the
          // mounted board — the GM deactivated or switched while this view was
          // open. The board itself is never blanked (never-hijack).
          mapIsActive={mountedIsActive}
          onViewNewMap={newActiveMap
            ? () => setMapsView({ type: 'map', mapName: newActiveMap })
            : undefined}
          onBack={onBackFromMap}
          // Dynamic Back-label source (backlog 2026-11-11 JV): the current
          // stack top the pop branch will open, or null for the static label.
          backMapTarget={backMapTarget}
          onEncounterCreated={onEncounterCreated}
          onPoiEntered={onEncounterCreated}
        />
      </ErrorBoundary>
    );
  }
  // Player with no active map — friendly waiting state until the GM
  // activates one (the map-activate SSE auto-open, or the Back-transition
  // self-heal seed + auto-check, swaps this out when a map is active).
  if (!isLocalhost) {
    return <MapUnavailable onRetry={onRetryActiveMap} />;
  }
  return null;
}

// Zero-character empty-state gate (backlog UM 2026-11-20): the card owns the
// BLANK main stage only — an active view (any sidebar destination) or an open
// creation/edit wizard means the stage already has content. Hoisted to module
// level so App stays inside the lint statement/complexity caps (MapsAreaView
// precedent).
function EmptyCampaignStage({ activeView, characters, showCharacterWizard, showEditCharacterWizard, campaignName, onAddCharacter, onOpenChecklist, isLocalhost }) {
  if (activeView || characters.length > 0 || showCharacterWizard || showEditCharacterWizard) return null;
  return (
    <EmptyCampaignState
      campaignName={campaignName}
      onAddCharacter={onAddCharacter}
      onOpenChecklist={onOpenChecklist}
      isLocalhost={isLocalhost}
    />
  );
}

// Starter-checklist deep links (backlog 2026-11-11 KW): plain steps just
// switch views exactly like the sidebar handlers; the "Join <wave>" step
// additionally fires the EncounterBuilder Load-modal signal so the saved-wave
// list opens automatically (per-client UI intent, never synced).
function handleChecklistNavigate(view, intent, setActiveView) {
  if (view === 'encounter' && intent === 'load') {
    requestEncounterLoad();
  }
  setActiveView(view);
}

function OverlayViews({ activeView, campaignName, characters, isLocalhost, theme, toggleTheme, onRenameCampaign, onDeleteCampaign, setActiveView, restoredSnapshot }) {
  const views = {
    encounter: <EncounterBuilder characters={characters} campaignName={campaignName} onJoinEncounter={() => setActiveView('initiative')} />,
    notes: <Notes campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} />,
    quests: <Quests campaignName={campaignName} isLocalhost={isLocalhost} />,
    // Player quest board — read-only shared-table theatre (open to visitors;
    // the GM sees the same board plus the GM-only Quests planner above).
    questBoard: <QuestBoard campaignName={campaignName} />,
    npcs: <NPCs campaignName={campaignName} characters={characters} onViewInitiative={() => setActiveView('initiative')} />,
    settlements: <Settlements campaignName={campaignName} />,
    sessions: <Sessions campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} onViewInitiative={() => setActiveView('initiative')} />,
    factions: <Factions campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} />,
    campaignBuilder: <CampaignBuilder campaignName={campaignName} />,
    partyInventory: <PartyInventory campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} />,
    campaignLog: <Log campaignName={campaignName} characters={characters} isLocalhost={isLocalhost} />,
    campaignRepair: (
      <CampaignAdmin
        campaignName={campaignName}
        characters={characters}
        theme={theme}
        toggleTheme={toggleTheme}
        onRenameCampaign={onRenameCampaign}
        onDeleteCampaign={onDeleteCampaign}
        restoredSnapshot={restoredSnapshot}
        isLocalhost={isLocalhost}
        onNavigate={(view) => setActiveView(view)}
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

  const charMgmtRef = useRef(), campaignRef = useRef(), wizardRef = useRef();
  useEffect(() => { charMgmtRef.current = charMgmt; campaignRef.current = campaignMgmt; wizardRef.current = wizard; }, [charMgmt, campaignMgmt, wizard]);

  const [activeView, setActiveView] = useState(null);
   // activeView: null | 'charSheet' | 'mapsManager' | 'encounter' | 'notes' | 'npcs' | 'settlements' | 'initiative'
  // type: 'none' | 'manager' | 'map'
  // When type is 'map', mapName holds the sanitized map filename (e.g. 'dungeon-level-1')
  // and mapDisplayName (optional) the manager row's display name — threads to the
  // rejected-load notice (backlog map-load-notice-slug-naming). POI-entered maps
  // carry no display name; the notice falls back to the slug there.
  // Navigation stack for indoor map entry (POI, encounter) — push on enter, pop
  // on back. Entries carry { mapName, mapDisplayName } so the board toolbar's
  // dynamic "Back to <map>" label (backlog 2026-11-11 JV, useMapHistory) can
  // name the popped map the way its row/header was named; the pop still drives
  // mapsView by slug only.
  const mapHistory = useMapHistory();

  // Post-rollback carry-over: re-select the campaign, land on the Admin view,
  // and show the "restored" banner after the rollback's full page reload.
  const { autoSelectCampaign, restoredSnapshot, consumeRestore } = usePostRestoreNotice(activeView);

  useEffect(() => {
    wizardRef.current.setCharacterCallbacks({ setCharacters: charMgmtRef.current.setCharacters, setActiveCharacter: charMgmtRef.current.setActiveCharacter });
  }, []);

  const [combatSummaryLoaded, setCombatSummaryLoaded] = useState(false);

  // Enter-seam gate: the shared change-data GET gates ALL rendering; bounded
  // stall + unified failure/Retry face live in the module-scope hook (which
  // also registers the select/delete callbacks it owns the seam for).
  const { enterError, retryEnter, backToCampaigns } = useCampaignEnterGate({
    charMgmtRef, wizardRef, campaignRef, consumeRestore, setActiveView, setCombatSummaryLoaded,
  });

  const { showCampaignSelection, campaignName, isLocalhost, handleRenameCampaign: handleRenameCampaignRaw, handleDeleteCampaign: handleDeleteCampaignRaw } = campaignMgmt;
  const { characters, activeCharacter, setCharacters, setActiveCharacter, handleUploadChange, handleSaveClick, handleUploadClick, handleDeleteCharacter: handleDeleteCharacterRaw, deleteErrorName, dismissDeleteError, inputRef } = charMgmt;
  const { showCharacterWizard, showEditCharacterWizard, editingCharacter, closeWizards, handleAddCharacter, handleWizardComplete, handleWizardCancel, handleEditCharacter, handleEditWizardComplete, handleEditWizardCancel } = wizard;

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
    // Campaign-store rescope on every entry + character-store eviction on a
    // campaign CHANGE (bug-campaign-store-ghost-keys-survive-campaign-switch
    // and its character-scope follow-up). The full law lives with the
    // module-scope hook (App's statement ceiling — EmptyCampaignStage
    // precedent): its gate is the ENTER seam (campaign armed + picker left),
    // NOT the character-seed effect below, so a zero-character throwaway
    // re-scopes too, and re-selecting the SAME campaign re-reads server truth
    // for the 'campaign' bucket in ONE pass (the two-pass law retired with
    // d25431cab) without wiping live character state.
    useCampaignScopeRescope(campaignName, showCampaignSelection);
    // Level-up celebration arming (roadmap Item 8): stays FALSE until the
    // change-data seed above has landed, so the seed itself (character JSON
    // `xp` → runtime `xp` jump on cold boot) can never read as an XP award.
    // The celebration watches runtime values only once armed (per-client UI
    // gate — no game state).
    const [runtimeSeeded, setRuntimeSeeded] = useState(false);
    useEffect(() => {
      if (!computedCharacters.length || !campaignName) return;
      if (seededCampaignRef.current === campaignName && computedCharacters.length > 0) return;
      seededCampaignRef.current = campaignName;
      setRuntimeSeeded(false);
      (async () => {
        const serverData = await fetchCampaignChangeData(campaignName);
        // Also seed arbitrary runtime keys (weapon mastery choices, etc.) from server data,
        // excluding transient prompt keys that should not persist across refreshes
        for (const char of computedCharacters) {
          seedCharacterRuntimeData(char, serverData);
        }
        setRuntimeSeeded(true);
      })();
    }, [computedCharacters, campaignName]);

  const [mapsView, setMapsView] = useState({ type: 'none' });
  const [activeMapName, setActiveMapName] = useState(null);
  const [npcs, setNpcs] = useState([]);

  const handleEnterMap = useCallback((mapName) => {
    if (mapsView.type === 'map' && mapsView.mapName) {
      mapHistory.push({ mapName: mapsView.mapName, mapDisplayName: mapsView.mapDisplayName });
    }
    setMapsView({ type: 'map', mapName });
    setActiveMapName(mapName);
    // mapHistory only ever mutates its ref + setState mirror (no render-order
    // coupling), so re-creating this callback is behaviour-neutral.
  }, [mapsView, mapHistory]);

  // Self-heal the player's Back transition (backlog 2026-11-05 CV): Back with
  // an empty stack reset mapsView to 'none' even while an active map existed,
  // stranding the player on the MapUnavailable placeholder until a manual
  // "Check Again" — only NEW activation SSE events auto-opened while blank
  // (handleMapActivateEvent view-gate). On entering the blank state, seed
  // instantly from the armed active-map context AND run the single auto-check
  // (loadActiveMapAndOpen, the exact "Check Again" lane) that re-opens the
  // CURRENT server-active map — covering an unarmed/stale tab context too.
  // The check only ever OPENS (no active map ⇒ the placeholder stays visible,
  // no-map case unchanged) and this branch runs solely while LEAVING a map
  // view, so an open view is never hijacked or re-switched.
  const handleBackFromMap = () => {
    if (mapHistory.armed()) {
      const prevMap = mapHistory.pop().mapName;
      setMapsView({ type: 'map', mapName: prevMap });
    } else if (isLocalhost) {
      setMapsView({ type: 'manager' });
    } else {
      setMapsView(activeMapName ? { type: 'map', mapName: activeMapName } : { type: 'none' });
      loadActiveMapAndOpen();
    }
  };

  // Reset the loaded flag when switching campaigns so stale characters from the
  // previous campaign can't render (or bleed into the new campaign's initiative
  // roster) while the new campaign's data is still loading.
  // Regression (2026-11-04, run CR): the loaded-flag reset only covered the
  // loading window — the select callback re-arms the sheet view ONLY when the
  // new campaign HAS characters, so a zero-character campaign left the
  // previous campaign's sheet mounted indefinitely under the new header, with
  // live Rest/Edit/Delete buttons that POSTed the stale character's runtime
  // bucket into the new campaign's change-data (ghost buckets). Drop the view
  // and the held character here too; the select callback above re-arms
  // activeView='charSheet' + activeCharacter once the new roster has loaded.
  // Regression (2026-11-20, wizard-reattach bug): the same reset law must cover the
  // wizard open-flags. They live on the never-unmounted App, so leaving + re-entering
  // a campaign resurrected a stale wizard session — and the edit lane re-seeded from
  // the NEW campaign-load activeCharacter (first roster entry), silently re-targeting
  // the GM's edit at the wrong character file. closeWizards() runs BEFORE the select
  // callback below, so a re-entered campaign never repaints a surviving session.
  const handleCampaignSelect = (campaign, characters) => {
    setCombatSummaryLoaded(false);
    setActiveView(null);
    setActiveCharacter(null);
    closeWizards();
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

  // Tab title always answers "which campaign is this?" (backlog KKK 2026-11-21):
  // "<campaign> — <view>" while mounted, neutral app name on the select screen.
  useEffect(() => {
    document.title = getDocumentTitle({
      campaignName,
      showCampaignSelection,
      activeView,
      characterName: activeCharacter?.name,
    });
  }, [campaignName, showCampaignSelection, activeView, activeCharacter]);

  useEffect(() => {
    setMapsView({ type: 'none' });
  }, [campaignName]);

  // Campaign type (standard | arena | starter) drives the sidebar chip and
  // arena nav gating (see useCampaignType).
  const campaignType = useCampaignType(campaignName);

  // Starter-checklist remount epoch (backlog UM 2026-11-20): the empty-state
  // card's "Open the starter checklist" affordance bumps this to re-mount
  // FirstSessionChecklist, surfacing a checklist this client had dismissed
  // (its dismiss flag is per-client UI state, reset by a remount — nothing
  // is written to the server).
  const [checklistEpoch, setChecklistEpoch] = useState(0), [helpOpen, setHelpOpen] = useState(false); // multi-declarator: App is AT the max-statements ceiling

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
        // Regression (2026-11-03, GM twin of bug-lan-map-nav-noop-mid-session):
        // this branch only re-armed the mapsView sub-state, so a GM who had a
        // map open and then navigated elsewhere (char sheet, Log…) saw NOTHING
        // on the first Maps click — MapsAreaView renders only when
        // activeView === 'mapsManager', so the click changed an invisible flag
        // and the second click fell through to the else branch below to
        // actually navigate. Re-arm the view in lockstep with the sub-state,
        // mirroring every sibling header handler (`setActiveView(view)`).
        // While already on mapsManager this is a state no-op, preserving the
        // "Maps exits an open map back to the manager listing" contract.
        setActiveView('mapsManager');
        setMapsView({ type: 'manager' });
        mapHistory.clear(); // clear history + dynamic Back-label mirror when going back to manager
      } else if (activeView !== 'mapsManager') {
        // Regression (bug-lan-map-nav-noop-mid-session): a player who navigated
        // to another view (Log, sheet…) unmounts MapsAreaView while mapsView
        // still says 'map' — the old "already on their only view" assumption
        // held only while mapsManager was active, so the re-entry click was a
        // silent no-op stuck on the previous view. Re-arm the view and
        // re-resolve the active map, so a GM activation made while the player
        // was away opens the CURRENT active map, not the stale mapsView name.
        setActiveView('mapsManager');
        loadActiveMapAndOpen();
      }
      // Player already on the map view — do nothing
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
   * Echo mirroring (applyStoreUpdate / replaceRuntimeObject) is memory-only —
   * SSE echoes must never re-POST to the server (the server already has this
   * data; re-POSTing causes a broadcast loop).
   */
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
    if (event.key === `map-activate-${campaignName}`) {
      handleMapActivateEvent(event, { isLocalhost, activeView, mapsView, setMapsView, setActiveMapName });
      return;
    }
    handleChangeKeyEvent(event, campaignName);
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
  if (appData.isLoading) return <div className="loading-overlay" role="status" aria-busy="true"><div className="loading-spinner">Loading rules data...</div></div>;
  // Enter gate (backlog TT 2026-11-22): a stalled/fast-failed enter-seam GET
  // no longer parks on the busy face — the bounded wait in useCampaignEnterGate
  // flips it to the honest failure face with Retry + Back-to-Campaigns escapes.
  if (!combatSummaryLoaded) return enterError
    ? <CampaignEnterFailed campaignName={campaignName} onRetry={retryEnter} onBack={backToCampaigns} />
    : <div className="loading-overlay" role="status" aria-busy="true"><div className="loading-spinner">Loading campaign...</div></div>;

  return (
    <div className="app">
      {/* Hidden multi-file JSON import lane (CharSummary "Upload" clicks it via
          inputRef). It mounts as the FIRST `input` in the app DOM, so it needs
          an accessible name to keep aria-label locators off invisible elements
          (2026-11-03 QA backlog). */}
      <input key={Date.now()} type="file" accept=".json" multiple ref={inputRef} onChange={handleUploadChange} hidden aria-label="Import campaign JSON" />
      <div className="app-body">
        <SidebarShell
          campaignName={campaignName}
          characters={characters}
          activeCharacter={activeCharacter}
          deleteErrorName={deleteErrorName}
          onDismissDeleteError={dismissDeleteError}
          onBackToCampaigns={backToCampaigns}
          onAddCharacter={handleAddCharacter}
          onCharacterClick={handleCharacterClick}
          onInitiativeClick={handleInitiativeClick}
          onMapsClick={handleMapsClick}
          onMusicClick={() => setActiveView('music')}
          onNotesClick={handleNotesClick}
          onQuestsClick={handleQuestsClick}
          onQuestBoardClick={() => setActiveView('questBoard')}
          onEncounterClick={handleEncounterClick}
          onRenameCampaign={handleRenameCampaign}
          onDeleteCampaign={handleDeleteCampaign}
          isLocalhost={isLocalhost}
           onNPCsClick={handleNPCsClick}
           onInventoryClick={handleInventoryClick}
           onSessionsClick={() => setActiveView('sessions')}
           onSettlementsClick={handleSettlementsClick}
           onCampaignBuilderClick={() => setActiveView('campaignBuilder')}
            onFactionsClick={handleFactionsClick}
           onGMScreenClick={() => setActiveView('gmScreen')}
           onLogClick={handleLogClick}
          onRepairClick={() => setActiveView('campaignRepair')}
          activeView={activeView}
          campaignType={campaignType}
          onHelpClick={() => setHelpOpen(true)}
           />
        <ErrorBoundary resetKey={`${campaignName}|${activeView}`}>
        {/* onNavigate forwards the step's optional intent (see the wave step
            in FirstSessionChecklist) — 'load' auto-opens the builder's
            saved-wave list; every other step navigates as before. */}
        <FirstSessionChecklist key={checklistEpoch} campaignName={campaignName} onNavigate={(view, intent) => handleChecklistNavigate(view, intent, setActiveView)} onBuildHeroes={handleAddCharacter} isLocalhost={isLocalhost} />
        {/* Zero-character empty state (backlog UM 2026-11-20, owner doctrine
            2026-11-23): a zero-character campaign lands here — the main stage
            used to go fully blank once the retired offer-once auto-wizard was
            consumed (nav + dice tray, no affordance). The card only owns the
            blank stage — any real view (activeView set) or an open wizard
            replaces it; the sidebar "Add Character" lane is untouched. */}
        <EmptyCampaignStage
          activeView={activeView}
          characters={characters}
          showCharacterWizard={showCharacterWizard}
          showEditCharacterWizard={showEditCharacterWizard}
          campaignName={campaignName}
          onAddCharacter={handleAddCharacter}
          onOpenChecklist={() => setChecklistEpoch(n => n + 1)}
          isLocalhost={isLocalhost}
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
        {activeView === 'initiative' && <Initiative characters={computedCharacters} campaignName={campaignName} onNpcsChange={setNpcs} isLocalhost={isLocalhost} mapName={activeMapName} onViewCharacter={handleCharacterClick} onOpenEncounters={() => setActiveView('encounter')} onAddCharacter={handleAddCharacter} localCharacterName={activeCharacter?.name} />}
        {/* GM Screen: pure-read lookup over computedCharacters + the runtime
            store (no writes, no mutation affordances). Sidebar entry is
            localhostOnly — same gate as the other GM views. */}
        {activeView === 'gmScreen' && <GMScreen characters={computedCharacters} campaignName={campaignName} />}
        {activeView === 'mapsManager' && (
          <MapsAreaView
            campaignName={campaignName}
            // The board's movement-budget lane resolves sheet speed through the
            // SAME characters lane the Initiative header strip uses — the
            // derived list carries computedStats.speed (feat/mount +10s);
            // the raw list cannot (bug-movement-budget-caps-all-movers-at-30).
            characters={computedCharacters}
            npcs={npcs}
            isLocalhost={isLocalhost}
            mapsView={mapsView}
            activeMapName={activeMapName}
            activeCharacter={activeCharacter}
            onBackFromMap={handleBackFromMap}
            backMapTarget={mapHistory.top}
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
        {/* Persistent music player: mounted once per campaign and kept alive
            across view navigation (the view outlet above unmounts views on
            switch, which used to destroy the player and cut audio). The
            panel only renders on the Music view; the hidden iframe survives
            everywhere else. Audio stops solely via the player's Pause/Stop
            buttons (or leaving the campaign entirely). Mounted OUTSIDE the
            ErrorBoundary so a crash in another view cannot kill playback. */}
        <MusicPlayer campaignName={campaignName} visible={activeView === 'music'} />
        {/* TV escape hatch: while the per-client TV pref is ON this corner
            button renders on EVERY view (outside the view outlet), so a cold
            tab restored into tracker-TV — sidebar fully unmounted by
            SidebarShell — can always exit with zero nav guessing. */}
        <TvExitButton />
        <br />
        {showCharacterWizard && <CharacterCreationWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} allClasses={classes} campaignName={campaignName} existingCharacters={characters} />}
        {/* characterData is the CAPTURED editingCharacter (set by handleEditCharacter
            at Edit-click time), never the live activeCharacter — a mid-session change
            of the active character can't re-target the mounted wizard (2026-11-20
            reattach bug); keying by name makes a re-edit of a different character a
            clean remount (fresh seed) rather than a mixed draft. */}
        {showEditCharacterWizard && <CharacterCreationWizard key={editingCharacter?.name} onComplete={handleEditWizardComplete} onCancel={handleEditWizardCancel} allClasses={classes} characterData={editingCharacter} isEditing={true} campaignName={campaignName} existingCharacters={characters} />}
        <SavePromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <DeathSavePromptModal campaignName={campaignName} characters={computedCharacters} />
        <ConcentrationPromptModal campaignName={campaignName} characters={computedCharacters} activeMapName={activeMapName} />
        <ConditionChoiceModal />
        {/* In-app help drawer (Phase 3): opened from the sidebar "?"; overlays
            whatever view is live and closes on backdrop / × / Escape. */}
        <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} activeView={activeView} />
        {/* LEVEL UP celebration (roadmap Item 8): every screen, every client —
            mounted OUTSIDE the view outlet so it survives view navigation,
            exactly like the adjudication prompts. Pure presentation over the
            shared runtime/roster lanes. */}
        <LevelUpCelebration
          campaignName={campaignName}
          characters={characters}
          armed={runtimeSeeded}
          onOpenWizard={(character) => openLevelUpWizard(character, { setActiveCharacter, handleEditCharacter })}
        />
        <Subscriber campaignName={campaignName} handleEvent={handleRuntimeEvent} />
        {/* Sensory cues (roadmap Item 10): the SSE log-lane audio twin of the
            outcome floaters, mounted ONCE on the campaign shell (owner ruling
            2026-11-20) so every view — Characters, Map, Log, Initiative —
            hears saves/deaths/attacks, not just the tracker. Live appends
            only (no backlog blast); the SFX gate lives in audioCues. The heal
            twin still fires at HpFeedback itself. */}
        <CombatCues campaignName={campaignName} />
        <CampaignReloadNotice campaignName={campaignName} />
        <MapContextSync campaignName={campaignName} activeMapName={activeMapName} isLocalhost={isLocalhost} />
        {/* Blocking busy layer while the roster is being enriched (App.css
            .loading-overlay: fixed full-viewport backdrop, so the sidebar
            and views cannot be clicked against an empty computedCharacters
            roster — 2026-11-12 OP backlog). */}
        {processingCharacters && <div className="loading-overlay" role="status" aria-busy="true"><div className="loading-spinner">Loading party stats...</div></div>}
      </div>
    </div>
  );
}

export default App;
