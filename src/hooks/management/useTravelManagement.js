import { useCallback, useRef } from 'react';
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
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasSelfRestoration } from '../../services/combat/automation/automationService.js';

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

export default function useTravelManagement({
  hexCols, hexRows, terrain, partyPosition, onPartyMove, weather,
  monsters, playerLevels, roads = [], characters = [], campaignName = '',
  initialTravelState,
}) {
  const _init = initialTravelState || {};

  const [travelMode, setTravelMode] = useSyncedState(campaignName, 'travel-mode', _init.travelMode || MODES.INACTIVE, campaignName);
  const [travelPace, setTravelPace] = useSyncedState(campaignName, 'travel-pace', _init.travelPace || 'normal', campaignName);
  const [destination, setDestination] = useSyncedState(campaignName, 'travel-destination', _init.destination || null, campaignName);
  const [path, setPath] = useSyncedState(campaignName, 'travel-path', _init.path || [], campaignName);
  const [pathIndex, setPathIndex] = useSyncedState(campaignName, 'travel-pathIndex', _init.pathIndex || 0, campaignName);
  const [accruedCost, setAccruedCost] = useSyncedState(campaignName, 'travel-accruedCost', typeof _init.accruedCost === 'number' ? _init.accruedCost : 0, campaignName);
  const [dailyBudget, setDailyBudget] = useSyncedState(campaignName, 'travel-dailyBudget', typeof _init.dailyBudget === 'number' ? _init.dailyBudget : () => getDailyHexBudget('normal'), campaignName);
  const [dayExhausted, setDayExhausted] = useSyncedState(campaignName, 'travel-dayExhausted', !!_init.dayExhausted, campaignName);
  const [forcedMarchHours, setForcedMarchHours] = useSyncedState(campaignName, 'travel-forcedMarchHours', typeof _init.forcedMarchHours === 'number' ? _init.forcedMarchHours : 0, campaignName);
  const [travelLog, setTravelLog] = useSyncedState(campaignName, 'travel-log', [], campaignName);
  const [lastMessage, setLastMessage] = useSyncedState(campaignName, 'travel-lastMessage', null, campaignName);
  const [pendingEvent, setPendingEvent] = useSyncedState(campaignName, 'travel-pendingEvent', null, campaignName);
  const [eventFrequency, setEventFrequency] = useSyncedState(campaignName, 'travel-eventFrequency', 'normal', campaignName);
  const [rerollsRemaining, setRerollsRemaining] = useSyncedState(campaignName, 'travel-rerollsRemaining', 3, campaignName);
  const [horseback, setHorseback] = useSyncedState(campaignName, 'travel-horseback', false, campaignName);

  const pathRef = useRef([]);
  const pathIndexRef = useRef(0);

  const isTravelActive = travelMode !== MODES.INACTIVE;

  const toggleHorseback = useCallback(() => {
    setHorseback(prev => !prev);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveBudgetForPace = useCallback((paceId, w) => {
    const base = getDailyHexBudget(paceId);
    const mod = w?.budgetMod ?? 1;
    const weatherAdjusted = Math.floor(base * mod);
    return applyExhaustionSpeedPenaltyToBudget(weatherAdjusted, forcedMarchHours);
  }, [forcedMarchHours]);

  const effectiveHexCost = useCallback((terrainType, q, r, w, hb) => {
    const base = getHexMoveCostWithRoad(terrainType, q, r, roads);
    if (base === null) return null;
    const mod = w?.moveCostMod;
    if (mod === null) return null;
    const cost = base * (mod ?? 1);
    return hb ? cost / HORSEBACK_SPEED_MULTIPLIER : cost;
  }, [roads]);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelTravel = useCallback(() => {
    setTravelMode(MODES.INACTIVE);
    setDestination(null);
    setPath([]);
    setPathIndex(0);
    setLastMessage(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setDestinationAndPath = useCallback((to) => {
    if (!partyPosition) return;
    const newPath = calculatePath(partyPosition, to, hexCols, hexRows, terrain, roads);
    if (newPath.length === 0) return;
    setDestination(to);
    setPath(newPath);
    pathRef.current = newPath;
    setPathIndex(0);
    pathIndexRef.current = 0;
    setLastMessage(null);
    setTravelMode(MODES.PLANNING);
  }, [partyPosition, hexCols, hexRows, terrain, roads]); // eslint-disable-line react-hooks/exhaustive-deps

  const changePace = useCallback((paceId) => {
    setTravelPace(paceId);
    setDailyBudget(effectiveBudgetForPace(paceId, weather));
    setDayExhausted(false);
    setForcedMarchHours(0);
  }, [effectiveBudgetForPace, weather]); // eslint-disable-line react-hooks/exhaustive-deps

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
        setLastMessage(`Extreme ${weather.label?.toLowerCase() || 'weather'} makes travel impossible. Camp and wait it out.`);
      }
      return { moved: false };
    }

    const newAccrued = accruedCost + cost;
    if (newAccrued > dailyBudget) {
      setDayExhausted(true);
      setLastMessage(`The party has exhausted their travel budget for the day. Camp for the night or push into forced march?`);
      return { moved: false };
    }

    if (onPartyMove) onPartyMove(nextHex);
    setAccruedCost(newAccrued);
    setPathIndex(nextIdx);
    pathIndexRef.current = nextIdx;
    setLastMessage(null);

    const arrived = nextIdx >= currentPath.length - 1;
    if (arrived) {
      setTravelMode(MODES.INACTIVE);
      setLastMessage('The party has arrived at their destination.');
      return { moved: true, arrived: true };
    }

    if (shouldTriggerEvent(tileTerrain, weather, eventFrequency)) {
      let event = generateRandomEvent(tileTerrain);
      event = enhanceCombatEvent(event, tileTerrain);
      setPendingEvent(event);
      setTravelMode(MODES.PAUSED);
      setLastMessage(`⚡ ${event.title}`);
      return { moved: true, event };
    }

    return { moved: true };
  }, [accruedCost, dailyBudget, terrain, onPartyMove, weather, eventFrequency, enhanceCombatEvent, effectiveHexCost, horseback]); // eslint-disable-line react-hooks/exhaustive-deps

  const forceCamp = useCallback(() => {
    setAccruedCost(0);
    setDayExhausted(false);
    setDailyBudget(effectiveBudgetForPace(travelPace, weather));
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
    setForcedMarchHours(prev => prev + 1);
    setDayExhausted(false);
    setAccruedCost(0);
    setDailyBudget(effectiveBudgetForPace(travelPace, weather));
    setLastMessage(`Forced march — 1 exhaustion added to all party members. Speed reduced to ${getExhaustionMultiplierPercent(forcedMarchHours + 1)}%.`);
    return true;
  }, [partyHasMaxExhaustion, addExhaustionToAll, effectiveBudgetForPace, travelPace, weather, forcedMarchHours]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPosition = path.length > 0 && pathIndex < path.length
    ? path[pathIndex]
    : null;

  const remainingSteps = path.length > 0 ? path.slice(pathIndex + 1) : [];

  const paceInfo = TRAVEL_PACES.find(p => p.id === travelPace) || TRAVEL_PACES[1];

  const hexesRemaining = Math.max(0, path.length - 1 - pathIndex);

  const clearEvent = useCallback(() => {
    setPendingEvent(null);
    if (travelMode === MODES.PAUSED) {
      setTravelMode(MODES.PLANNING);
    }
    setLastMessage(null);
  }, [travelMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptEvent = useCallback(() => {
    const evt = pendingEvent;
    clearEvent();
    return evt;
  }, [pendingEvent, clearEvent]);

  const skipEvent = useCallback(() => {
    clearEvent();
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
