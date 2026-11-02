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

/**
 * True when the creature has an EDITED (explicit) ally list on record.
 * Distinguishes "trusts no one" (a defector confirmed [self] in the editor)
 * from never-configured (getAllyList's [self] fallback) — the allegiance
 * override lanes (aura bearers, sneak flanking, opportunity reach) keep the
 * pre-editor type-based defaults until an explicit list exists.
 */
export function hasExplicitAllyList(creatureName) {
    const storedAllies = getRuntimeValue(creatureName, 'selectedAllies');
    return Array.isArray(storedAllies) && storedAllies.length > 0;
}
