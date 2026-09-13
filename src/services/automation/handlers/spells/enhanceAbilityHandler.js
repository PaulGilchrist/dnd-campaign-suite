import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

export const ENHANCE_ABILITY_ABILITIES = [
    { value: 'STR', label: 'Strength' },
    { value: 'DEX', label: 'Dexterity' },
    { value: 'INT', label: 'Intelligence' },
    { value: 'WIS', label: 'Wisdom' },
    { value: 'CHA', label: 'Charisma' },
];

function getAbilityLabel(ability) {
    const match = ENHANCE_ABILITY_ABILITIES.find(a => a.value === ability);
    return match ? match.label : ability;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};

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

    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'enhance_ability_target_selection',
            name: action.name,
            creatureTargets,
            abilities: ENHANCE_ABILITY_ABILITIES,
            range: auto.range || 'Touch',
            automation: auto,
        },
    };
}

export async function applyEnhanceAbility({ action, playerStats, campaignName, targetNames, ability }) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0 || !ability) {
        return null;
    }

    const targetName = targetNames[0];
    const casterName = playerStats.name;
    const abilityLabel = getAbilityLabel(ability);

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];

    const existingIndex = effects.findIndex(
        te => te.target === targetName && te.effect === 'enhance_ability' && te.source === casterName
    );
    const enhanceEffect = {
        target: targetName,
        effect: 'enhance_ability',
        source: casterName,
        ability,
        duration: 'concentration',
    };
    if (existingIndex >= 0) {
        effects[existingIndex] = enhanceEffect;
    } else {
        effects.push(enhanceEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} cast ${action.name} on ${targetName}, granting Advantage on ${abilityLabel} ability checks for up to 1 hour.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[enhanceAbility] Error logging:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${casterName} cast ${action.name} on ${targetName}: Advantage on ${abilityLabel} ability checks for up to 1 hour (concentration).`,
            automation: action.automation || {},
        },
    };
}
