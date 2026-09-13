import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const HASTE_BUFF_NAME = 'Haste';

function getHasteDuration(spell) {
    return spell.duration || 'Concentration, up to 1 minute';
}

export async function handle(action, playerStats, campaignName, _mapName, _characters) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || '30 feet');

    const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = getCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];

    const creatureTargets = allCreatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'haste_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || '30 feet',
            rangeFt,
            duration: getHasteDuration(spell),
            attackerPos,
        },
    };
}

export async function applyHaste(action, playerStats, campaignName, _mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const duration = getHasteDuration(spell);

    for (const targetName of targetNames) {
        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
        const existingHaste = buffs.some(b => b.name === HASTE_BUFF_NAME);
        if (!existingHaste) {
            buffs.push({
                name: HASTE_BUFF_NAME,
                effect: 'haste',
                duration,
                sourceCharacter: playerStats.name,
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        const conditionEffects = getRuntimeValue(targetName, 'conditionEffects', campaignName) || {};
        const existingAdvantages = conditionEffects.saveAdvantageAbilities || [];
        const updatedAdvantages = existingAdvantages.includes('DEX') ? existingAdvantages : [...existingAdvantages, 'DEX'];
        const newConditionEffects = {
            ...conditionEffects,
            saveAdvantageCount: (conditionEffects.saveAdvantageCount || 0) + 1,
            saveAdvantageAbilities: updatedAdvantages,
        };
        setRuntimeValue(targetName, 'conditionEffects', newConditionEffects, campaignName);

        addExpiration({ attackerName: playerStats.name, targetName, effects: [
            { type: 'remove_active_buff', buffName: HASTE_BUFF_NAME }
        ], campaignName });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Haste',
            description: `${playerStats.name} cast Haste on ${targetName}. Target's speed is doubled, gains +2 AC, and has advantage on DEX saving throws. Target gains an additional action each turn (Attack, Dash, Disengage, Hide, or Use Object). When the spell ends, the target loses this extra action.`,
        }).catch((e) => { console.error('[haste] Error logging:', e); });
    }

    const targetsList = targetNames.length === 1 ? targetNames[0] : targetNames.join(', ');
    const description = targetNames.length === 1
        ? `${targetNames[0]} gained Haste from ${action.name}.`
        : `${targetNames.length} targets gained Haste from ${action.name}: ${targetsList}.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
        },
    };
}

export function isHasteActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    return activeBuffs.some(b => b.name === HASTE_BUFF_NAME && b.effect === 'haste');
}
