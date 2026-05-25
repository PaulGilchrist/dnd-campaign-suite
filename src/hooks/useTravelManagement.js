import { useState, useCallback, useRef } from 'react';
import {
  calculatePath,
  getDailyHexBudget,
  getHexMoveCostWithRoad,
  TRAVEL_PACES,
} from '../services/travelService.js';
import {
  shouldTriggerEvent,
  generateRandomEvent,
} from '../services/randomEventService.js';
import { generateEncounterSuggestions } from '../services/encounterGenerator.js';

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
  monsters, playerLevels, roads = [],
}) {
  const [travelMode, setTravelMode] = useState(MODES.INACTIVE);
  const [travelPace, setTravelPace] = useState('normal');
  const [destination, setDestination] = useState(null);
  const [path, setPath] = useState([]);
  const [pathIndex, setPathIndex] = useState(0);
  const [accruedCost, setAccruedCost] = useState(0);
  const [dailyBudget, setDailyBudget] = useState(() => getDailyHexBudget('normal'));
  const [dayExhausted, setDayExhausted] = useState(false);
  const [travelLog, setTravelLog] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [eventFrequency, setEventFrequency] = useState('normal');
  const [rerollsRemaining, setRerollsRemaining] = useState(3);

  const pathRef = useRef([]);
  const pathIndexRef = useRef(0);

  const isTravelActive = travelMode !== MODES.INACTIVE;

  const effectiveBudgetForPace = useCallback((paceId, w) => {
    const base = getDailyHexBudget(paceId);
    const mod = w?.budgetMod ?? 1;
    return Math.floor(base * mod);
  }, []);

  const effectiveHexCost = useCallback((terrainType, q, r, w) => {
    const base = getHexMoveCostWithRoad(terrainType, q, r, roads);
    if (base === null) return null;
    const mod = w?.moveCostMod;
    if (mod === null) return null;
    return base * (mod ?? 1);
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
  }, []);

  const cancelTravel = useCallback(() => {
    setTravelMode(MODES.INACTIVE);
    setDestination(null);
    setPath([]);
    setPathIndex(0);
    setLastMessage(null);
  }, []);

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
  }, [partyPosition, hexCols, hexRows, terrain, roads]);

  const changePace = useCallback((paceId) => {
    setTravelPace(paceId);
    setDailyBudget(effectiveBudgetForPace(paceId, weather));
    setDayExhausted(false);
  }, [effectiveBudgetForPace, weather]);

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
    const cost = effectiveHexCost(tileTerrain, nextHex.q, nextHex.r, weather);
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
  }, [accruedCost, dailyBudget, terrain, onPartyMove, weather, eventFrequency, enhanceCombatEvent, effectiveHexCost]);

  const forceCamp = useCallback(() => {
    setAccruedCost(0);
    setDayExhausted(false);
    setDailyBudget(effectiveBudgetForPace(travelPace, weather));
    setRerollsRemaining(3);
    setPendingEvent(null);
    if (travelMode === MODES.PAUSED) setTravelMode(MODES.PLANNING);
    setLastMessage('A new day dawns. Travel budget refreshed.');
  }, [travelPace, effectiveBudgetForPace, weather, travelMode]);

  const forcedMarch = useCallback(() => {
    setDayExhausted(false);
    setAccruedCost(0);
    setDailyBudget(prev => Math.max(0, prev - 8));
    setLastMessage('The party pushes on with a forced march.');
  }, []);

  const currentPosition = path.length > 0 && pathIndex < path.length
    ? path[pathIndex]
    : null;

  const nextStep = path.length > 0 && pathIndex < path.length - 1
    ? path[pathIndex + 1]
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
  }, [travelMode]);

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
  }, [rerollsRemaining, currentPosition, partyPosition, terrain, enhanceCombatEvent]);

  const handleSetEventFrequency = useCallback((freq) => {
    setEventFrequency(freq);
  }, []);

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
    isTravelActive,
    MODES,
    startPlanning,
    cancelTravel,
    setDestinationAndPath,
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
