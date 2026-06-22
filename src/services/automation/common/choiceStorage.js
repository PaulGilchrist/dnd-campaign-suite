import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Generates the runtime key for storing a chosen value by a player.
 * Key format: `_<name_with_spaces_underscored>_<suffix>`
 */
function makeKey(playerName, name, suffix) {
    const base = `_${name.replace(/\s+/g, '_')}`;
    return suffix ? `${base}_${suffix}` : base;
}

/**
 * Gets a chosen runtime value for a player.
 * @param {Object} playerStats - PlayerStats object
 * @param {string} name - Name of the feature/automation
 * @param {string} suffix - Suffix for the key (e.g., 'chosenType', 'chosenTypes')
 * @param {string} [campaignName] - Optional campaign name override
 * @returns {*} The stored value or undefined
 */
export function getChosenRuntimeValue(playerStats, name, suffix, campaignName) {
    const key = makeKey(playerStats.name, name, suffix);
    return getRuntimeValue(playerStats.name, key, campaignName || playerStats.campaignName);
}

/**
 * Sets a chosen runtime value for a player.
 * @param {Object} playerStats - PlayerStats object
 * @param {string} name - Name of the feature/automation
 * @param {*} value - The value to store
 * @param {string} suffix - Suffix for the key (e.g., 'chosenType', 'chosenTypes')
 * @param {string} [campaignName] - Optional campaign name override
 */
export function setChosenRuntimeValue(playerStats, name, value, suffix, campaignName) {
    const key = makeKey(playerStats.name, name, suffix);
    setRuntimeValue(playerStats.name, key, value, campaignName || playerStats.campaignName);
}
