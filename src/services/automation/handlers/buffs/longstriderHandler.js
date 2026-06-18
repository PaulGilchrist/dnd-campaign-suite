import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../shared/logPoster.js';

const LONGSTRIDER_BUFF_NAME = 'Longstrider';

function getLongstriderDuration(spell) {
    return spell.duration || '1 hour';
}

export async function handle(action, playerStats, campaignName, mapName) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || 'Touch');

    const positions = mapName ? await resolveMapPositions(campaignName, mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerStats.name)
        .map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'longstrider_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || 'Touch',
            rangeFt,
            duration: getLongstriderDuration(spell),
            attackerPos,
        },
    };
}

export async function applyLongstrider(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const duration = getLongstriderDuration(spell);

    for (const targetName of targetNames) {
        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
        const existingLongstrider = buffs.some(b => b.name === LONGSTRIDER_BUFF_NAME);
        if (!existingLongstrider) {
            buffs.push({
                name: LONGSTRIDER_BUFF_NAME,
                effect: 'speed_boost',
                speedBonus: 10,
                duration,
                sourceCharacter: playerStats.name,
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        addExpiration(playerStats.name, targetName, [
            { type: 'remove_active_buff', buffName: LONGSTRIDER_BUFF_NAME }
        ], campaignName);

        postLogEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: LONGSTRIDER_BUFF_NAME,
            description: `${playerStats.name} cast ${LONGSTRIDER_BUFF_NAME} on ${targetName}. Speed increased by 10 feet.`,
        }).catch((e) => { console.error("[longstriderHandler] Error:", e); throw e; });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetNames.length} target(s) gained +10 feet speed from ${action.name}.`,
        },
    };
}
