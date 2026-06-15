import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../common/targetResolver.js';
import { postLogEntry } from '../../shared/logPoster.js';

const SHIELD_OF_FAITH_BUFF_NAME = 'Shield of Faith';

function getShieldOfFaithDuration(spell) {
    return spell.duration || 'Concentration, up to 10 minutes';
}

export async function handle(action, playerStats, campaignName, mapName) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || '60 feet');

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
            type: 'shield_of_faith_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || '60 feet',
            rangeFt,
            duration: getShieldOfFaithDuration(spell),
            attackerPos,
        },
    };
}

export async function applyShieldOfFaith(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const duration = getShieldOfFaithDuration(spell);

    for (const targetName of targetNames) {
        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
        const existingShield = buffs.some(b => b.name === SHIELD_OF_FAITH_BUFF_NAME);
        if (!existingShield) {
            buffs.push({
                name: SHIELD_OF_FAITH_BUFF_NAME,
                effect: 'shield_of_faith',
                acBonus: 2,
                duration,
                sourceCharacter: playerStats.name,
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        addExpiration(playerStats.name, targetName, [
            { type: 'remove_active_buff', buffName: SHIELD_OF_FAITH_BUFF_NAME }
        ], campaignName);

        postLogEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: SHIELD_OF_FAITH_BUFF_NAME,
            description: `${playerStats.name} cast ${SHIELD_OF_FAITH_BUFF_NAME} on ${targetName}. Target's AC increases by 2.`,
        }).catch(() => {});
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetNames.length} target(s) gained +2 AC from ${action.name}.`,
        },
    };
}

export function isShieldOfFaithActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    return activeBuffs.some(b => b.name === SHIELD_OF_FAITH_BUFF_NAME && b.effect === 'shield_of_faith');
}

export function getShieldOfFaithBonus(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const shieldBuff = activeBuffs.find(b => b.name === SHIELD_OF_FAITH_BUFF_NAME && b.effect === 'shield_of_faith');
    return shieldBuff ? shieldBuff.acBonus || 2 : 0;
}
