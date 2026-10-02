import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const ANIMAL_SHAPES_EFFECT = 'animal_shapes';
const ANIMAL_SHAPES_MAX_CR = 4;
const ALLOWED_SIZES = ['Tiny', 'Small', 'Medium', 'Large'];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No creatures in combat. ${action.name} has no effect.`,
            },
        };
    }

    const casterName = playerStats.name;

    const existingEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const anyAlreadyTransformed = existingEffects.some(te => te.effect === ANIMAL_SHAPES_EFFECT);
    if (anyAlreadyTransformed) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name}, but creatures are already under its effect.`,
        }).catch((e) => { console.error("[animalShapes] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no effect on creatures already transformed by Animal Shapes.`,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'animal_shapes_target_selection',
            casterName,
            campaignName,
            spell: action.spell,
            spellLevel: action.spellSlotLevel,
            maxCR: ANIMAL_SHAPES_MAX_CR,
            allowedSizes: ALLOWED_SIZES,
            automation: auto,
        },
    };
}
