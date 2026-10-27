import { useCallback, useEffect, useRef } from 'react';
import { isEqual } from 'lodash';
import { useSyncedState } from '../runtime/useSyncedState.js';
import {
  calculatePath,
  getDailyHexBudget,
  getHexMoveCostWithRoad,
  HORSEBACK_SPEED_MULTIPLIER,
  TRAVEL_PACES,
  EXHAUSTION_LEVELS,
  applyExhaustionSpeedPenaltyToBudget,
  getExhaustionMultiplierPercent,
} from '../../services/campaign/travelService.js';
import {
  shouldTriggerEvent,
  generateRandomEvent,
} from '../../services/campaign/randomEventService.js';
import { generateEncounterSuggestions } from '../../services/encounters/encounterGenerator.js';
import { getRuntimeValue, setRuntimeValue, hasRuntimeValue, setRuntimeObject } from '../runtime/useRuntimeState.js';
import { hexNeighbors } from '../../services/maps/hexMapUtils.js';
import { hasSelfRestoration } from '../../services/combat/automation/automationService.js';
import { setSessionPhase, readSessionPhase } from '../../services/combat/sessionService.js';
import { claimTripOwner, releaseTripOwner } from '../../services/maps/travelSession.js';

const MODES = {
  INACTIVE: 'inactive',
  PLANNING: 'planning',
  TRAVELING: 'traveling',
  PAUSED: 'paused',
};

const TERRAIN_TO_ENVIRONMENT = {
  plains: ['grassland', 'desert'],
  forest: ['forest'],
  hills: ['hills', 'grassland'],
  mountains: ['mountain'],
  desert: ['desert'],
  swamp: ['swamp'],
  tundra: ['arctic'],
  beach: ['coastal'],
};

const lazyDailyBudget = () => getDailyHexBudget('normal');

// Map-file write-back snapshot (improve 2026-10-26-D). null = "no trip" —
// the pristine/cancelled/idle shape, kept byte-identical to the null the
// loader lanes seed so a quiet open never dirties the document. Everything
// else (planning, traveling, paused) publishes in full so buildTravelInit
// can resume from the file exactly as from change-data. Arrival clears the
// completed-trip keys (COMPLETED_TRIP_KEYS below), so the post-arrival
// snapshot falls through to null and the map file sheds the finished trip
// too (improve 2026-10-26-D arrival-stale-destination).
const COMPLETED_TRIP_KEYS = ['travel-destination', 'travel-path', 'travel-pathIndex'];

const buildPublishSnapshot = (s) => {
  if (s.travelMode === MODES.INACTIVE && !s.destination && (!s.path || s.path.length === 0)) {
    return null;
  }
  // dailyBudget is the hook's SYNCED value — resolveInitialTravelState parks
  // the lazy getter there while no value exists, so resolve it before the
  // snapshot reaches JSON (a function byte would break the round-trip).
  const budget = typeof s.dailyBudget === 'function' ? s.dailyBudget() : s.dailyBudget;
  return {
    travelMode: s.travelMode,
    travelPace: s.travelPace,
    destination: s.destination,
    path: s.path,
    pathIndex: s.pathIndex,
    accruedCost: s.accruedCost,
    dailyBudget: budget,
    dayExhausted: s.dayExhausted,
    forcedMarchHours: s.forcedMarchHours,
  };
};

const resolveInitialTravelState = (initialTravelState) => {
  const init = initialTravelState || {};
  return {
    travelMode: init.travelMode || MODES.INACTIVE,
    travelPace: init.travelPace || 'normal',
    destination: init.destination || null,
    path: init.path || [],
    pathIndex: init.pathIndex || 0,
    accruedCost: typeof init.accruedCost === 'number' ? init.accruedCost : 0,
    dailyBudget: typeof init.dailyBudget === 'number' ? init.dailyBudget : lazyDailyBudget,
    dayExhausted: !!init.dayExhausted,
    forcedMarchHours: typeof init.forcedMarchHours === 'number' ? init.forcedMarchHours : 0,
  };
};

export default function useTravelManagement({
  hexCols, hexRows, terrain, partyPosition, onPartyMove, weather,
  monsters, playerLevels, roads = [], characters = [], campaignName = '',
  initialTravelState,
  onTravelStateChange,
}) {
  const init = resolveInitialTravelState(initialTravelState);

  const [travelMode, _setTravelModeRaw] = useSyncedState('campaign', 'travel-mode', init.travelMode, campaignName);
  // L5 §10.1 session orchestration: wrapping the travel-mode setter is the
  // single seam every call site (startPlanning/cancel/changePace/…) flows
  // through. TRAVELING engages the travel phase, INACTIVE returns to
  // exploration (planning/paused keep the current phase — nothing moves yet).
  // Action-driven, never wall-clock (AGENTS.md No Game Timers).
  const setTravelMode = useCallback((mode) => {
    _setTravelModeRaw(mode);
    if (mode === MODES.TRAVELING) {
      setSessionPhase({ campaignName, phase: 'travel', changedBy: 'travel management', reason: 'travel started' }).catch((e) => { console.error('[useTravelManagement] session phase travel failed:', e); });
    } else if (mode === MODES.INACTIVE) {
      // L5 §10.1 phase ownership: travel returns the table to exploration ONLY
      // while it owns the phase. An `encounter` phase armed by another engine
      // action must survive — accepting a travel combat event with
      // enforcement.autoEncounters on spawns its battle map, and opening that
      // map transiently remounts HexMap, whose tool-sync cancelTravel lands
      // here AFTER the auto-encounter wrote `encounter` (a blind write here
      // clobbered it while monsters sat on the tracker). Initiative's Clear
      // (createCreatureHandlers.handleClear) is the owner of
      // encounter → exploration.
      if (readSessionPhase(campaignName) === 'travel') {
        setSessionPhase({ campaignName, phase: 'exploration', changedBy: 'travel management', reason: 'travel ended' }).catch((e) => { console.error('[useTravelManagement] session phase exploration failed:', e); });
      }
    }
  }, [campaignName, _setTravelModeRaw]);
  const [travelPace, setTravelPace] = useSyncedState('campaign', 'travel-pace', init.travelPace, campaignName);
  const [destination, setDestination] = useSyncedState('campaign', 'travel-destination', init.destination, campaignName);
  const [path, setPath] = useSyncedState('campaign', 'travel-path', init.path, campaignName);
  const [pathIndex, setPathIndex] = useSyncedState('campaign', 'travel-pathIndex', init.pathIndex, campaignName);
  const [accruedCost, setAccruedCost] = useSyncedState('campaign', 'travel-accruedCost', init.accruedCost, campaignName);
  const [dailyBudget, setDailyBudget] = useSyncedState('campaign', 'travel-dailyBudget', init.dailyBudget, campaignName);
  const [dayExhausted, setDayExhausted] = useSyncedState('campaign', 'travel-dayExhausted', init.dayExhausted, campaignName);
  const [forcedMarchHours, setForcedMarchHours] = useSyncedState('campaign', 'travel-forcedMarchHours', init.forcedMarchHours, campaignName);
  const [travelLog, setTravelLog] = useSyncedState('campaign', 'travel-log', [], campaignName);
  const [lastMessage, setLastMessage] = useSyncedState('campaign', 'travel-lastMessage', null, campaignName);
  const [pendingEvent, setPendingEvent] = useSyncedState('campaign', 'travel-pendingEvent', null, campaignName);
  const [eventFrequency, setEventFrequency] = useSyncedState('campaign', 'travel-eventFrequency', 'normal', campaignName);
  const [rerollsRemaining, setRerollsRemaining] = useSyncedState('campaign', 'travel-rerollsRemaining', 3, campaignName);
  const [horseback, setHorseback] = useSyncedState('campaign', 'travel-horseback', false, campaignName);

  // Seeded from the mount-time SYNCED path (change-data resume): advanceOneHex
  // drives off these refs, so a trip restored into the store (reload resume)
  // must repopulate them or every advance silently no-ops. The file-adoption
  // lane repopulates them again when travelInit arrives post-mount.
  const pathRef = useRef(path);
  const pathIndexRef = useRef(pathIndex);

  // Improve 2026-10-26 (run-E backlog): the mode an event interrupted. Events
  // only fire on advance, so mid-route the party was MODES.TRAVELING (set by
  // prior advances); an event on the FIRST advance interrupts MODES.PLANNING.
  // skipEvent restores THIS mode so a mid-trip skip stays 'traveling' instead
  // of mislabelling the party as 'planning'. Ephemeral UI-flow state — same
  // lifecycle as pendingEvent — so a ref, never a persisted key.
  const modeBeforePauseRef = useRef(MODES.PLANNING);

  // ── Map-file write-back (improve 2026-10-26-D) ──
  // The file lane is the reload-resume source: useMapLoader reads the saved
  // document's travelState through buildTravelInit at open. The server-first
  // refactor (4497e99ad) moved live state to the change-data keys above but
  // dropped the old onTravelStateChange publisher with it, leaving the file's
  // travelState stuck at null all trip (only arrival-side bytes rode along
  // via partyPosition edits). Restore the publisher: every committed travel
  // mutation publishes one snapshot; setTravelStateRef (HexMap) bumps
  // travelSaveVersion and the loader's deep dirty-gate writes at most one PUT.
  // The isEqual guard against the last-published snapshot keeps SSE echo
  // re-renders (new array identities, same bytes) from bumping, and seeding
  // from the mount snapshot keeps a quiet open — resume included — silent.
  const publishedTravelRef = useRef(buildPublishSnapshot(init));
  useEffect(() => {
    if (!onTravelStateChange) return;
    const snapshot = buildPublishSnapshot({
      travelMode, travelPace, destination, path, pathIndex,
      accruedCost, dailyBudget, dayExhausted, forcedMarchHours,
    });
    if (isEqual(snapshot, publishedTravelRef.current)) return;
    publishedTravelRef.current = snapshot;
    onTravelStateChange(snapshot);
  }, [travelMode, travelPace, destination, path, pathIndex, accruedCost,
      dailyBudget, dayExhausted, forcedMarchHours, onTravelStateChange]);

  // File→store adoption (improve 2026-10-26-D, second half of the lane).
  // The loader resolves the map document ASYNC, so on a cold mount the
  // useSyncedState hooks above bake their idle defaults long before
  // initialTravelState (buildTravelInit of the file's travelState) arrives —
  // a trip persisted in the map file could therefore never resume. When the
  // file carries an active trip AND change-data holds no live travel-mode
  // (change-data is the authority whenever it speaks), materialize the file
  // bytes into the campaign bucket with ONE merged setRuntimeObject (#18
  // multi-POST race avoided). The useSyncedState listeners pick the values
  // up via the store notify; the publisher above then re-confirms them
  // byte-identical against the loader's dirty gate (zero extra PUTs).
  const fileResumeAppliedRef = useRef(false);
  useEffect(() => {
    if (fileResumeAppliedRef.current || !initialTravelState) return;
    fileResumeAppliedRef.current = true;
    if (hasRuntimeValue('campaign', 'travel-mode')) return;
    // init = resolveInitialTravelState(initialTravelState): every field is
    // concrete, so a legacy file missing keys still materializes complete
    // live state. The mode goes through the RAW setter: this is materializing
    // an existing trip, not travel starting — the §10.1 phase arm (wrapper)
    // must stay reserved for user-initiated transitions
    // (bug-autoencounter-travel-phase-clobber contract).
    _setTravelModeRaw(init.travelMode);
    setTravelPace(init.travelPace);
    setDestination(init.destination);
    setPath(init.path);
    setPathIndex(init.pathIndex);
    setAccruedCost(init.accruedCost);
    setDailyBudget(typeof init.dailyBudget === 'function' ? init.dailyBudget() : init.dailyBudget);
    setDayExhausted(init.dayExhausted);
    setForcedMarchHours(init.forcedMarchHours);
    // advanceOneHex reads the REFS, not the synced state — a resumed trip
    // must repopulate them too, or every advance silently no-ops on the
    // empty mount-time ref.
    pathRef.current = init.path;
    pathIndexRef.current = init.pathIndex;
  }, [initialTravelState, campaignName, init]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTravelActive = travelMode !== MODES.INACTIVE;

  const toggleHorseback = useCallback(() => {
    setHorseback(prev => !prev);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Takes the forced-march hours EXPLICITLY: every call site writes
  // travel-forcedMarchHours in the same tick it writes the budget, and the
  // closure value is always the pre-write one (stale-closure bug — FM paid an
  // un-penalized budget, Camp resurrected yesterday's penalty). Callers pass
  // the post-write hours: forcedMarch → hours + 1, forceCamp/changePace → 0.
  const effectiveBudgetForPace = useCallback((paceId, w, hours) => {
    const base = getDailyHexBudget(paceId);
    const mod = w?.budgetMod ?? 1;
    const weatherAdjusted = Math.floor(base * mod);
    return applyExhaustionSpeedPenaltyToBudget(weatherAdjusted, hours);
  }, []);

  // Budget-at-mount weather seed (improve 2026-10-26-E): a FRESH mount (no
  // travel-* keys in change-data — same authority guard as the adoption lane
  // above, one step stricter: it probes the budget key itself) baked the
  // un-modded lazy base (4) into travel-dailyBudget before the async map
  // load could surface the file's persisted weather, so a storm-seeded map
  // showed base 4 until the first pace/camp/reroll seam re-derived it. Seed
  // the weather-modded effective budget ONCE via the SAME helper the seams
  // use. Gates, in order: one-shot ref; weather arrived (loaded file carries
  // one, or a later first-travel auto-roll — riding those re-derives is the
  // whole point, the seams below re-publish the budget on their own rolls
  // and the hasRuntimeValue guard then keeps this silent); change-data
  // already holds a budget = live/resume day (store-first authority,
  // navigation-restore + AC2); an in-flight or file trip belongs to the
  // adoption lane, which already carries its stamped budget. Clear weather
  // (budgetMod 1) writes the same 4 the default baked (valuesEqual short-
  // circuits the POST). Rides the mount/load effect — no game timers.
  const weatherBudgetSeedRef = useRef(false);
  useEffect(() => {
    if (weatherBudgetSeedRef.current || !weather || !campaignName) return;
    weatherBudgetSeedRef.current = true;
    if (hasRuntimeValue('campaign', 'travel-dailyBudget')) return;
    if (hasRuntimeValue('campaign', 'travel-mode')) return;
    if (initialTravelState) return;
    setDailyBudget(effectiveBudgetForPace(travelPace, weather, 0));
  }, [weather, initialTravelState, campaignName, travelPace, effectiveBudgetForPace]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveHexCost = useCallback((terrainType, q, r, w, hb) => {
    const base = getHexMoveCostWithRoad(terrainType, q, r, roads);
    if (base === null) return null;
    const mod = w?.moveCostMod;
    if (mod === null) return null;
    const cost = base * (mod ?? 1);
    return hb ? cost / HORSEBACK_SPEED_MULTIPLIER : cost;
  }, [roads]);

  // Over-budget mount flag (improve 2026-10-26-E backlog): a stale accruedCost
  // survives arrival BY DESIGN (same-day trips share the day's budget pool),
  // so the panel could mount (map open, or re-press after an arrival that
  // landed on an exhausted day) into a state where EVERY advance would
  // reject — disabled Advance with no exhausted banner, Camp/Forced-March
  // unreachable, until a cancel/re-press or a wasted reject-click flagged
  // dayExhausted. Mirror the advance reject-and-flag producer at the mount
  // seam: accrued + the cheapest affordable adjacent-hex entry cost > budget
  // means no legal move remains today, so flag dayExhausted through the SAME
  // synced lane (server-first — change-data + SSE + the publisher's null
  // snapshot gate keep the store and the render byte-consistent). Then the
  // existing TravelPanel gates (banner :exhausted, advanceDisabled) light up
  // together with no panel change. Neighbor economics mirror the engine
  // exactly — advanceOneHex/calculatePath read `terrain[key] || 'plains'`
  // for in-bounds hexes (API-created maps ship an EMPTY terrain dict; the
  // whole grid plays as plains), and out-of-bounds hexes are not legal
  // steps. Conservative by construction:
  // - some adjacent hex still affordable (accrued + minCost <= budget) →
  //   NEVER flags (a fresh day at accrued 0 cannot trip it either);
  // - extreme weather (effectiveHexCost null everywhere) leaves no affordable
  //   cost to compare — the travel-impossible message lane keeps its lane;
  // - never CLEARS the flag — camp / forced march / pace change own that.
  // Event-driven (deps churn), no game timers.
  useEffect(() => {
    if (dayExhausted || !partyPosition || typeof dailyBudget !== 'number') return;
    const neighborCosts = [];
    for (const nb of hexNeighbors(partyPosition.q, partyPosition.r)) {
      if (nb.q < 0 || nb.q >= hexCols || nb.r < 0 || nb.r >= hexRows) continue;
      const cost = effectiveHexCost(terrain[`${nb.q},${nb.r}`] || 'plains', nb.q, nb.r, weather, horseback);
      if (cost !== null) neighborCosts.push(cost);
    }
    if (neighborCosts.length === 0) return;
    if (accruedCost + Math.min(...neighborCosts) > dailyBudget) {
      setDayExhausted(true);
    }
  }, [dayExhausted, partyPosition, terrain, weather, horseback,
      hexCols, hexRows, accruedCost, dailyBudget, effectiveHexCost, setDayExhausted]);

  const enhanceCombatEvent = useCallback((event, terrainType) => {
    if (event.type !== 'combat' || !monsters || monsters.length === 0 || !playerLevels || playerLevels.length === 0) {
      return event;
    }
    const environments = TERRAIN_TO_ENVIRONMENT[terrainType] || ['grassland'];
    const suggestions = generateEncounterSuggestions({
      monsters,
      playerLevels,
      difficulty: 1,
      environments,
      count: 1,
    });
    if (suggestions.length === 0) return event;

    const enc = suggestions[0];
    return {
      ...event,
      encounter: {
        monsters: enc.monsters.map(m => ({ index: m.index, name: m.name, qty: m.qty })),
        difficultyLabel: enc.difficultyLabel,
        totalXP: enc.totalXP,
      },
    };
  }, [monsters, playerLevels]);

  const startPlanning = useCallback(() => {
    setTravelMode(MODES.PLANNING);
    setDestination(null);
    setPath([]);
    setPathIndex(0);
    setLastMessage(null);
    // Provenance claim (bug-hex-trip-clobbered-by-second-client): the tab
    // that STARTS a trip stamps itself as owner in the shared store, so a
    // second client's toggle interactions can adopt-but-never-destroy it.
    claimTripOwner(campaignName);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelTravel = useCallback(() => {
    setTravelMode(MODES.INACTIVE);
    setDestination(null);
    setPath([]);
    setPathIndex(0);
    setLastMessage(null);
    // The trip is gone — ownership releases with it (arrival lands through
    // the same inactive seam; cancel/arrival are the only exits).
    releaseTripOwner(campaignName);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrival clears the finished trip (improve 2026-10-26-D): destination/
  // path/pathIndex describe the trip that just COMPLETED — retaining them
  // left the post-arrival bucket self-contradictory (travel-mode:inactive
  // next to a live destination, backlog 2026-10-26-D). They are REMOVED
  // from change-data via the proven per-key DELETE lane (same as
  // savePromptService; a null-POST would only leave `key: null` behind).
  // The local store parks on idle bytes with skipSync=true: the DELETEs
  // are the only server writes for these keys, so there is no same-tick
  // POST→DELETE ordering hazard, and null/[] (vs the mount-time defaults
  // a bare store.delete would expose) keeps the publisher's snapshot null
  // even after a reload-resumed trip arrives. Day-state keys (pace,
  // accruedCost, dailyBudget, dayExhausted, forcedMarchHours) survive
  // arrival exactly as they survive cancelTravel.
  const clearCompletedTripKeys = useCallback(() => {
    setRuntimeObject('campaign', {
      'travel-destination': null,
      'travel-path': [],
      'travel-pathIndex': 0,
    }, campaignName, true);
    pathRef.current = [];
    pathIndexRef.current = 0;
    if (!campaignName) return;
    COMPLETED_TRIP_KEYS.forEach((key) => {
      fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`, { method: 'DELETE' })
        .catch((e) => console.error('[useTravelManagement] Failed to clear completed-trip key:', key, e));
    });
  }, [campaignName]);

  const setDestinationAndPath = useCallback((to) => {
    if (!partyPosition) return;
    const newPath = calculatePath(partyPosition, to, { hexCols, hexRows, terrain, roads });
    if (newPath.length === 0) return;
    setDestination(to);
    setPath(newPath);
    pathRef.current = newPath;
    setPathIndex(0);
    pathIndexRef.current = 0;
    setLastMessage(null);
    setTravelMode(MODES.PLANNING);
  }, [partyPosition, hexCols, hexRows, terrain, roads]); // eslint-disable-line react-hooks/exhaustive-deps

  // Takes the post-regen weather EXPLICITLY (same idiom as the hours param
  // above): the weather-regen seams (camp / manual re-roll / weatherChange
  // event) roll a new weather and re-derive economics in the SAME tick, and
  // the closure `weather` is always the pre-roll one — the budget landed one
  // weather generation out of date. Callers pass the fresh roll; pace-chip
  // toggles pass nothing and legitimately ride the current closure weather.
  const changePace = useCallback((paceId, weatherOverride) => {
    setTravelPace(paceId);
    setDailyBudget(effectiveBudgetForPace(paceId, weatherOverride ?? weather, 0));
    setDayExhausted(false);
    setForcedMarchHours(0);
  }, [effectiveBudgetForPace, weather]); // eslint-disable-line react-hooks/exhaustive-deps

  // Park travel for a spawned event: remember the mode it interrupts (skip
  // resumes it — mid-route events restore TRAVELING) without pushing the
  // already max-complex advanceOneHex over the ESLint ceiling.
  const pauseForEvent = useCallback((event) => {
    if (travelMode !== MODES.PAUSED) modeBeforePauseRef.current = travelMode;
    setPendingEvent(event);
    setTravelMode(MODES.PAUSED);
  }, [travelMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceOneHex = useCallback(() => {
    const currentPath = pathRef.current;
    const currentIdx = pathIndexRef.current;
    const nextIdx = currentIdx + 1;

    if (!currentPath || currentPath.length < 2 || nextIdx >= currentPath.length) {
      return { moved: false };
    }

    const nextHex = currentPath[nextIdx];
    const key = `${nextHex.q},${nextHex.r}`;
    const tileTerrain = terrain[key] || 'plains';
    const cost = effectiveHexCost(tileTerrain, nextHex.q, nextHex.r, weather, horseback);
    if (cost === null) {
      if (weather?.moveCostMod === null) {
        // Label is "Extreme" (weatherService) — `${label} weather` reads
        // "Extreme weather makes travel impossible…" without the old doubled
        // word ("Extreme extreme", bug 2026-10-27-G). The panel's extreme-
        // weather camp row is the affordance this prompt points at.
        setLastMessage(`${weather.label || 'Extreme'} weather makes travel impossible. Camp and wait it out.`);
      }
      return { moved: false };
    }

    const newAccrued = accruedCost + cost;
    if (newAccrued > dailyBudget) {
      setDayExhausted(true);
      setLastMessage(`The party has exhausted their travel budget for the day. Camp for the night or push into forced march?`);
      return { moved: false };
    }

    const arrived = nextIdx >= currentPath.length - 1;

    if (onPartyMove) onPartyMove(nextHex);
    setAccruedCost(newAccrued);

    if (arrived) {
      // Single lastMessage write (no prior null): two POSTs to the same
      // endpoint in one tick can reorder and strand the arrival prose.
      setTravelMode(MODES.INACTIVE);
      setLastMessage('The party has arrived at their destination.');
      clearCompletedTripKeys();
      return { moved: true, arrived: true };
    }

    setPathIndex(nextIdx);
    pathIndexRef.current = nextIdx;
    setLastMessage(null);

    if (shouldTriggerEvent(tileTerrain, weather, eventFrequency)) {
      let event = generateRandomEvent(tileTerrain);
      event = enhanceCombatEvent(event, tileTerrain);
      pauseForEvent(event);
      setLastMessage(`⚡ ${event.title}`);
      return { moved: true, event };
    }

    // L5 §10.1: the party is now MOVING along a planned route (this advance
    // neither arrived nor stopped for an event) — the missing producer for
    // MODES.TRAVELING. The setter wrapper arms sessionState.phase='travel'
    // exactly once (sessionService dedupes same-phase writes) and arrival /
    // cancel below return it to exploration through the phase-ownership
    // guard. Placed AFTER both early returns so an advance never double-writes
    // travel-mode in one tick (same-endpoint POSTs can race); one mode write
    // per advance, and the guard skips same-value churn.
    if (travelMode !== MODES.TRAVELING) setTravelMode(MODES.TRAVELING);

    return { moved: true };
  }, [accruedCost, dailyBudget, terrain, onPartyMove, weather, eventFrequency, enhanceCombatEvent, effectiveHexCost, horseback, travelMode, pauseForEvent, clearCompletedTripKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  // weatherOverride: see changePace above — Camp regenerates weather in the
  // same tick, so the caller passes the NEW day's roll for the budget write.
  const forceCamp = useCallback((weatherOverride) => {
    setAccruedCost(0);
    setDayExhausted(false);
    setDailyBudget(effectiveBudgetForPace(travelPace, weatherOverride ?? weather, 0));
    setRerollsRemaining(3);
    setPendingEvent(null);
    setForcedMarchHours(0);
    if (travelMode === MODES.PAUSED) setTravelMode(MODES.PLANNING);
    setLastMessage('A new day dawns. Travel budget refreshed.');
  }, [travelPace, effectiveBudgetForPace, weather, travelMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const partyHasMaxExhaustion = useCallback(() => {
    return characters.some(char => {
      const name = char.name || char;
      const level = getRuntimeValue(name, 'exhaustionLevel');
      return (typeof level === 'number' ? level : 0) >= EXHAUSTION_LEVELS;
    });
  }, [characters]);

  const addExhaustionToAll = useCallback(() => {
    characters.forEach(char => {
      const name = char.name || char;
      const hasSR = hasSelfRestoration(char.computedStats || char);
      if (hasSR) return;
      const current = getRuntimeValue(name, 'exhaustionLevel');
      const level = typeof current === 'number' ? current : 0;
      if (level < EXHAUSTION_LEVELS) {
        setRuntimeValue(name, 'exhaustionLevel', level + 1, campaignName);
      }
    });
  }, [characters, campaignName]);

  const forcedMarch = useCallback(() => {
    if (partyHasMaxExhaustion()) {
      setLastMessage('Cannot forced march — a party member has reached maximum exhaustion.');
      return false;
    }
    addExhaustionToAll();
    const nextHours = forcedMarchHours + 1;
    setForcedMarchHours(nextHours);
    setDayExhausted(false);
    setAccruedCost(0);
    setDailyBudget(effectiveBudgetForPace(travelPace, weather, nextHours));
    setLastMessage(`Forced march — 1 exhaustion added to all party members. Speed reduced to ${getExhaustionMultiplierPercent(nextHours)}%.`);
    return true;
  }, [partyHasMaxExhaustion, addExhaustionToAll, effectiveBudgetForPace, travelPace, weather, forcedMarchHours]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPosition = path.length > 0 && pathIndex < path.length
    ? path[pathIndex]
    : null;

  const remainingSteps = path.length > 0 ? path.slice(pathIndex + 1) : [];

  const paceInfo = TRAVEL_PACES.find(p => p.id === travelPace) || TRAVEL_PACES[1];

  const hexesRemaining = Math.max(0, path.length - 1 - pathIndex);

  // resumePausedMode: the SKIP leg re-joins the in-progress route, so it
  // restores the mode the event interrupted (traveling mid-route, planning on
  // the first advance). The ACCEPT leg navigates away (encounter map / weather
  // regen ends the movement lane), so it keeps the legacy PLANNING restore —
  // do not fold the two together.
  const clearEvent = useCallback((resumePausedMode) => {
    setPendingEvent(null);
    if (travelMode === MODES.PAUSED) {
      setTravelMode(resumePausedMode
        ? (modeBeforePauseRef.current || MODES.PLANNING)
        : MODES.PLANNING);
    }
    setLastMessage(null);
  }, [travelMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptEvent = useCallback(() => {
    const evt = pendingEvent;
    clearEvent(false);
    return evt;
  }, [pendingEvent, clearEvent]);

  const skipEvent = useCallback(() => {
    clearEvent(true);
  }, [clearEvent]);

  const rerollEvent = useCallback(() => {
    if (rerollsRemaining <= 0) return;
    setRerollsRemaining(prev => prev - 1);
    const pos = currentPosition || partyPosition;
    if (!pos) return;
    const key = `${pos.q},${pos.r}`;
    const tileTerrain = terrain[key] || 'plains';
    let newEvent = generateRandomEvent(tileTerrain);
    newEvent = enhanceCombatEvent(newEvent, tileTerrain);
    setPendingEvent(newEvent);
    setLastMessage(`⚡ ${newEvent.title}`);
  }, [rerollsRemaining, currentPosition, partyPosition, terrain, enhanceCombatEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetEventFrequency = useCallback((freq) => {
    setEventFrequency(freq);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    travelMode,
    travelPace,
    destination,
    path,
    pathIndex,
    accruedCost,
    dailyBudget,
    dayExhausted,
    travelLog,
    lastMessage,
    pendingEvent,
    eventFrequency,
    rerollsRemaining,
    currentPosition,
    remainingSteps,
    paceInfo,
    hexesRemaining,
    horseback,
    forcedMarchHours,
    exhaustionMultiplier: getExhaustionMultiplierPercent(forcedMarchHours),
    partyHasMaxExhaustion: partyHasMaxExhaustion(),
    isTravelActive,
    MODES,
    startPlanning,
    cancelTravel,
    setDestinationAndPath,
    toggleHorseback,
    changePace,
    advanceOneHex,
    forceCamp,
    forcedMarch,
    acceptEvent,
    skipEvent,
    rerollEvent,
    setEventFrequency: handleSetEventFrequency,
    setTravelLog,
    setLastMessage,
  };
}
