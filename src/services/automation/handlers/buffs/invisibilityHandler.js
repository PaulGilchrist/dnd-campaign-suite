import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { applyInvisibilityToTargets } from './invisibilityShared.js';

const INVISIBILITY_BUFF_NAME = 'Invisibility';

function getInvisibilityDuration(spell) {
    return spell.duration || 'Concentration, up to 1 hour';
}

export async function handle(action, playerStats, campaignName, _mapName, _characters) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || 'Touch');

    const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = getCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];

    const creatureTargets = allCreatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'invisibility_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || 'Touch',
            rangeFt,
            duration: getInvisibilityDuration(spell),
            attackerPos,
        },
    };
}

export async function applyInvisibility(action, playerStats, campaignName, _mapName, targetNames) {
    return applyInvisibilityToTargets({
        action,
        playerStats,
        campaignName,
        targetNames,
        buffName: INVISIBILITY_BUFF_NAME,
        abilityName: 'Invisibility',
        invisKeyPrefix: '_activeInvisibility_',
        logPrefix: 'invisibility',
        duration: getInvisibilityDuration(action.spell || {}),
    });
}

export function isInvisibilityActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    return activeBuffs.some(b => b.name === INVISIBILITY_BUFF_NAME && b.effect === 'invisible');
}
