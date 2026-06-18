import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../shared/logPoster.js';

const MAGE_ARMOR_BUFF_NAME = 'Mage Armor';

function getMageArmorDuration(spell) {
    return spell.duration || '8 hours';
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
            type: 'mage_armor_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || 'Touch',
            rangeFt,
            duration: getMageArmorDuration(spell),
            attackerPos,
        },
    };
}

export async function applyMageArmor(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const duration = getMageArmorDuration(spell);

    for (const targetName of targetNames) {
        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
        const existingMageArmor = buffs.some(b => b.name === MAGE_ARMOR_BUFF_NAME);
        if (!existingMageArmor) {
            buffs.push({
                name: MAGE_ARMOR_BUFF_NAME,
                effect: 'mage_armor',
                acBonus: 3,
                duration,
                sourceCharacter: playerStats.name,
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        addExpiration(playerStats.name, targetName, [
            { type: 'remove_active_buff', buffName: MAGE_ARMOR_BUFF_NAME }
        ], campaignName);

        postLogEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: MAGE_ARMOR_BUFF_NAME,
            description: `${playerStats.name} cast ${MAGE_ARMOR_BUFF_NAME} on ${targetName}. Target's AC increases by 3 (13 + Dex modifier).`,
        }).catch((e) => { console.error("[mageArmorHandler] Error:", e); throw e; });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetNames.length} target(s) gained +3 AC from ${action.name}.`,
        },
    };
}
