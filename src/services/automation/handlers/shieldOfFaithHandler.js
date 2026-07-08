import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../common/targetResolver.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';

const SHIELD_OF_FAITH_BUFF_NAME = 'Shield of Faith';

function getShieldOfFaithDuration(spell) {
    return spell.duration || 'Concentration, up to 10 minutes';
}

export async function handle(action, playerStats, campaignName, mapName, _characters) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || '60 feet');

    const positions = mapName ? await resolveMapPositions(campaignName, mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = getCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];

    const creatureTargets = allCreatures.map(c => c.name);

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

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: SHIELD_OF_FAITH_BUFF_NAME,
            description: `${playerStats.name} cast ${SHIELD_OF_FAITH_BUFF_NAME} on ${targetName}. Target's AC increases by 2.`,
        }).catch((e) => { console.error("[shieldOfFaith] Error:", e); });
    }

    const targetsList = targetNames.length === 1 ? targetNames[0] : targetNames.join(', ');
    const description = targetNames.length === 1
        ? `${targetNames[0]} gained +2 AC from ${action.name}.`
        : `${targetNames.length} targets gained +2 AC from ${action.name}: ${targetsList}.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
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
