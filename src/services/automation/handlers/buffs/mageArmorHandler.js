import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const MAGE_ARMOR_BUFF_NAME = 'Mage Armor';

function getMageArmorDuration(spell) {
    return spell.duration || '8 hours';
}

// SP-074 (§38 hours×600 clock family, mirrors parseBarkskinDurationRounds):
// '8 hours' → 4800 rounds; unparseable durations stay Infinity (undefined rounds).
function parseMageArmorDurationRounds(duration) {
    const lower = String(duration || '').toLowerCase();
    const hourMatch = lower.match(/(\d+)\s*_?\s*hour/);
    if (hourMatch) return parseInt(hourMatch[1], 10) * 600;
    const minuteMatch = lower.match(/(\d+)\s*_?\s*minute/);
    if (minuteMatch) return parseInt(minuteMatch[1], 10) * 10;
    const roundMatch = lower.match(/(\d+)\s*_?round/);
    if (roundMatch) return parseInt(roundMatch[1], 10);
    return undefined;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || 'Touch');

    const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, playerStats.name) : null;
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

export async function applyMageArmor(action, playerStats, campaignName, _mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const duration = getMageArmorDuration(spell);
    const rounds = parseMageArmorDurationRounds(duration);

    for (const targetName of targetNames) {
        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
        const existingMageArmor = buffs.some(b => b.name === MAGE_ARMOR_BUFF_NAME);
        if (!existingMageArmor) {
            buffs.push({
                name: MAGE_ARMOR_BUFF_NAME,
                effect: 'mage_armor',
                baseAc: 13,
                duration,
                sourceCharacter: playerStats.name,
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
            // SP-074 D3: ONE addExpiration clock ('8 hours' → rounds 4800, §38
            // hours×600; long-buff shape drops the anchor) registered in the same
            // pass as the activeBuffs stamp — barkskinHandler remove_active_buff twin.
            addExpiration({ attackerName: playerStats.name, targetName, effects: [
                { type: 'remove_active_buff', buffName: MAGE_ARMOR_BUFF_NAME }
            ], campaignName, rounds });
        }

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: MAGE_ARMOR_BUFF_NAME,
            description: `${playerStats.name} cast ${MAGE_ARMOR_BUFF_NAME} on ${targetName}. Target's base AC becomes 13 + Dexterity modifier.`,
        }).catch((e) => { console.error('[mageArmorHandler] Error logging:', e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetNames.length} target(s) received Mage Armor from ${action.name}. Base AC becomes 13 + Dexterity modifier.`,
        },
    };
}
