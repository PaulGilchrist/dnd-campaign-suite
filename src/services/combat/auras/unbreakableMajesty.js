import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

const MAJESTY_KEY = 'unbreakableMajestyActive';
const MAJESTY_DC_KEY = 'unbreakableMajestySaveDc';
const MAJESTY_BLOCKED_KEY_PREFIX = 'unbreakableMajestyBlocked_';

export function isUnbreakableMajestyActive(characterName, campaignName) {
    return getRuntimeValue(characterName, MAJESTY_KEY, campaignName) === true;
}

export function getUnbreakableMajestySaveDc(characterName, campaignName) {
    return Number(getRuntimeValue(characterName, MAJESTY_DC_KEY, campaignName) || 0);
}

export function clearUnbreakableMajesty(characterName, campaignName) {
    setRuntimeValue(characterName, MAJESTY_KEY, null, campaignName);
    setRuntimeValue(characterName, MAJESTY_DC_KEY, null, campaignName);
}

export function hasAttackerTriggeredMajesty(characterName, attackerName, campaignName) {
    const round = getCurrentCombatRound();
    const key = `${MAJESTY_BLOCKED_KEY_PREFIX}${attackerName}`;
    const stored = getRuntimeValue(characterName, key, campaignName);
    return stored?.round === round;
}

export function markAttackerTriggeredMajesty(characterName, attackerName, campaignName) {
    const round = getCurrentCombatRound();
    const key = `${MAJESTY_BLOCKED_KEY_PREFIX}${attackerName}`;
    setRuntimeValue(characterName, key, { round }, campaignName);
}

export function clearPerRoundMajestyTrackers(characterName, campaignName) {
    const round = getCurrentCombatRound();
    const prefix = `${MAJESTY_BLOCKED_KEY_PREFIX}`;
    try {
        const allKeys = Object.keys(localStorage);
        for (const storageKey of allKeys) {
            if (!storageKey.startsWith(`runtime:${campaignName}:${characterName}:${prefix}`)) continue;
            const stored = getRuntimeValue(characterName, storageKey.split(':').pop(), campaignName);
            if (stored && stored.round !== round) {
                setRuntimeValue(characterName, storageKey.split(':').pop(), null, campaignName);
            }
        }
    } catch (_e) { /* ignore */ }
}

export function buildMajestyPromptData(defenderName, attackerName, saveDc) {
    return {
        targetName: attackerName,
        saveType: 'CHA',
        saveDc,
        sourceName: defenderName,
    };
}
