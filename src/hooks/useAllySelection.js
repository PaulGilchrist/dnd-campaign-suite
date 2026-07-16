import { getRuntimeValue, setRuntimeValue } from './runtime/useRuntimeState.js';

/**
 * Get the ally list for a creature.
 * Returns the stored allies array, or [creatureName] if not set.
 */
export function getAllyList(creatureName) {
    const storedAllies = getRuntimeValue(creatureName, 'selectedAllies');
    if (Array.isArray(storedAllies) && storedAllies.length > 0) {
        return storedAllies;
    }
    return [creatureName];
}

/**
 * Set the ally list for a creature and persist to server.
 */
export function setAllyList(creatureName, allies, campaignName) {
    setRuntimeValue(creatureName, 'selectedAllies', allies, campaignName);
}
