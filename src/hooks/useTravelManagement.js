import { useState, useCallback, useRef } from 'react';
import {
  calculatePath,
  getDailyHexBudget,
  getHexMoveCost,
  TRAVEL_PACES,
} from '../services/travelService.js';

const MODES = {
  INACTIVE: 'inactive',
  PLANNING: 'planning',
  TRAVELING: 'traveling',
  PAUSED: 'paused',
};

export default function useTravelManagement({ gridSize, terrain, partyPosition, onPartyMove, weather }) {
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

  const pathRef = useRef([]);
  const pathIndexRef = useRef(0);

  const isTravelActive = travelMode !== MODES.INACTIVE;

  const effectiveBudgetForPace = useCallback((paceId, w) => {
    const base = getDailyHexBudget(paceId);
    const mod = w?.budgetMod ?? 1;
    return Math.floor(base * mod);
  }, []);

  const effectiveHexCost = useCallback((terrainType, w) => {
    const base = getHexMoveCost(terrainType);
    if (base === null) return null;
    const mod = w?.moveCostMod;
    if (mod === null) return null;
    return base * (mod ?? 1);
  }, []);

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
    const newPath = calculatePath(partyPosition, to, gridSize, terrain);
    if (newPath.length === 0) return;
    setDestination(to);
    setPath(newPath);
    pathRef.current = newPath;
    setPathIndex(0);
    pathIndexRef.current = 0;
    setLastMessage(null);
    setTravelMode(MODES.PLANNING);
  }, [partyPosition, gridSize, terrain]);

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
      return false;
    }

    const nextHex = currentPath[nextIdx];
    const key = `${nextHex.q},${nextHex.r}`;
    const tileTerrain = terrain[key] || 'plains';
    const cost = effectiveHexCost(tileTerrain, weather);
    if (cost === null) {
      if (weather?.moveCostMod === null) {
        setLastMessage(`Extreme ${weather.label?.toLowerCase() || 'weather'} makes travel impossible. Camp and wait it out.`);
      }
      return false;
    }

    const newAccrued = accruedCost + cost;
    if (newAccrued > dailyBudget) {
      setDayExhausted(true);
      setLastMessage(`The party has exhausted their travel budget for the day. Camp for the night or push into forced march?`);
      return false;
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
    }

    return true;
  }, [accruedCost, dailyBudget, terrain, onPartyMove, weather]);

  const forceCamp = useCallback(() => {
    setAccruedCost(0);
    setDayExhausted(false);
    setDailyBudget(effectiveBudgetForPace(travelPace, weather));
    setLastMessage('A new day dawns. Travel budget refreshed.');
  }, [travelPace, effectiveBudgetForPace, weather]);

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
    setTravelLog,
    setLastMessage,
  };
}
