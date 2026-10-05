import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

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

    // SP-039: 'enhance_ability_target_selection' had ZERO renderer consumers.
    // The sheet gate flow (spellGates gateEnhanceAbility → HexAbilityModal +
    // SecondaryTargetModal two-stage) owns target+ability selection, so this
    // trigger lane reports via the rendered automation_info type instead of
    // a dead popup (no new UI).
    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name} needs a willing target and a chosen ability. Cast it from the spellbook to choose ${creatureTargets.join(', ')} and an ability (STR/DEX/INT/WIS/CHA).`,
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

    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
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

    // SP-039: register caster concentration and persist the summary
    // (protectionFromEnergyHandler SP-093/CLA-170 pattern) so the badge
    // survives reload and concentration breaks are tracked.
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary?.creatures) {
        const spellSaveDc = playerStats.spellAbilities?.saveDc || 8 + playerStats.proficiency;
        addConcentration(combatSummary, casterName, action.name, spellSaveDc, targetName);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    } else {
        console.error('[enhanceAbility] No combat summary — concentration not registered for', casterName);
    }

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
