import { getRuntimeValue, setRuntimeValue, getRuntimeKeysByPrefix } from '../../../hooks/runtime/useRuntimeState.js';
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
    const round = getCurrentCombatRound(campaignName);
    const key = `${MAJESTY_BLOCKED_KEY_PREFIX}${attackerName}`;
    const stored = getRuntimeValue(characterName, key, campaignName);
    return stored?.round === round;
}

export function markAttackerTriggeredMajesty(characterName, attackerName, campaignName) {
    const round = getCurrentCombatRound(campaignName);
    const key = `${MAJESTY_BLOCKED_KEY_PREFIX}${attackerName}`;
    setRuntimeValue(characterName, key, { round }, campaignName);
}

// CLA-370: round must be the round the caller is entering (roundToSet at
// round-wrap) — the combatSummary cache lags one round behind at that point.
export function clearPerRoundMajestyTrackers(characterName, campaignName, currentRound) {
    const round = currentRound ?? getCurrentCombatRound(campaignName);
    const keys = getRuntimeKeysByPrefix(characterName, MAJESTY_BLOCKED_KEY_PREFIX);
    for (const key of keys) {
        const stored = getRuntimeValue(characterName, key, campaignName);
        if (stored && stored.round !== round) {
            setRuntimeValue(characterName, key, null, campaignName);
        }
    }
}

export function buildMajestyPromptData(defenderName, attackerName, saveDc) {
    return {
        targetName: attackerName,
        saveType: 'CHA',
        saveDc,
        sourceName: defenderName,
    };
}
