import { useState, useCallback, useRef } from 'react';
import {
  calculatePath,
  getDailyHexBudget,
  getHexMoveCost,
  getHexTravelTime,
  TRAVEL_PACES,
} from '../services/travelService.js';

const MODES = {
  INACTIVE: 'inactive',
  PLANNING: 'planning',
  TRAVELING: 'traveling',
  PAUSED: 'paused',
};

export default function useTravelManagement({ gridSize, terrain, partyPosition, onPartyMove }) {
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
    setDailyBudget(getDailyHexBudget(paceId));
    setDayExhausted(false);
  }, []);

  const advanceOneHex = useCallback(() => {
    const currentPath = pathRef.current;
    const currentIdx = pathIndexRef.current;

    if (!currentPath || currentPath.length === 0 || currentIdx >= currentPath.length) {
      return false;
    }

    const nextHex = currentPath[currentIdx];
    const key = `${nextHex.q},${nextHex.r}`;
    const tileTerrain = terrain[key] || 'plains';
    const cost = getHexMoveCost(tileTerrain);
    if (cost === null) return false;

    const newAccrued = accruedCost + cost;
    if (newAccrued > dailyBudget) {
      setDayExhausted(true);
      setLastMessage(`The party has exhausted their travel budget for the day. Camp for the night or push into forced march?`);
      return false;
    }

    if (onPartyMove) onPartyMove(nextHex);
    setAccruedCost(newAccrued);
    const newIdx = currentIdx + 1;
    setPathIndex(newIdx);
    pathIndexRef.current = newIdx;
    setLastMessage(null);

    const arrived = newIdx >= currentPath.length;
    if (arrived) {
      setTravelMode(MODES.INACTIVE);
      setLastMessage('The party has arrived at their destination.');
    }

    return true;
  }, [accruedCost, dailyBudget, terrain, onPartyMove, travelMode]);

  const forceCamp = useCallback(() => {
    setAccruedCost(0);
    setDayExhausted(false);
    const pace = TRAVEL_PACES.find(p => p.id === travelPace);
    setDailyBudget(pace ? getDailyHexBudget(pace.id) : 24);
    setLastMessage('A new day dawns. Travel budget refreshed.');
  }, [travelPace]);

  const forcedMarch = useCallback(() => {
    setDayExhausted(false);
    setAccruedCost(0);
    setDailyBudget(prev => Math.max(0, prev - 8));
    setLastMessage('The party pushes on with a forced march.');
  }, []);

  const currentStep = path.length > 0 && pathIndex < path.length
    ? path[pathIndex]
    : null;

  const nextStep = path.length > 0 && pathIndex < path.length
    ? path[pathIndex]
    : null;

  const remainingSteps = path.length > 0 ? path.slice(pathIndex) : [];

  const paceInfo = TRAVEL_PACES.find(p => p.id === travelPace) || TRAVEL_PACES[1];

  const hexesRemaining = Math.max(0, path.length - pathIndex);

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
    currentStep,
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
