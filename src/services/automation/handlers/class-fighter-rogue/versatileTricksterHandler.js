import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function applyVersatileTrickster(action, playerStats, campaignName, secondaryTargetName) {
    const auto = action.automation || {};

    if (!secondaryTargetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name || 'Versatile Trickster',
                automationType: auto.type || 'versatile_trickster',
                description: `Versatile Trickster: No secondary target selected.`,
                automation: auto,
            },
        };
    }

    // Validate size limit for Trip on secondary target
    const cs = await getCombatContext(campaignName);
    const secondaryTarget = cs?.creatures?.find(c => c.name === secondaryTargetName);

    if (secondaryTarget) {
        const sizeOrder = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
        const targetSizeIndex = sizeOrder.indexOf(secondaryTarget.size);
        if (targetSizeIndex !== -1 && targetSizeIndex > sizeOrder.indexOf('Large')) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name || 'Versatile Trickster',
                    automationType: auto.type || 'versatile_trickster',
                    description: `<b>Trip</b> cannot be used on ${secondaryTargetName}: Target is ${secondaryTarget.size} (too large for Trip — only Large or smaller affected).`,
                    automation: auto,
                },
            };
        }
    }

    // Apply Trip effect to secondary target
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: secondaryTargetName,
        source: action.name || 'Versatile Trickster',
        option: 'Trip',
        effect: 'prone',
        value: null,
        noOpportunityAttacks: false,
        duration: 'until_start_of_next_turn',
        saveType: 'DEX',
        saveDc: 'ability',
        saveAbility: 'DEX',
        condition: 'prone',
        repeatingSave: false,
        requires: null,
        sizeLimit: 'large_or_smaller',
        movement: null,
        cost: null,
        ignoreResistance: false,
        restoreCost: null,
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Versatile Trickster',
        description: `Trip applied to ${secondaryTargetName} (secondary target via Versatile Trickster).`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name || 'Versatile Trickster',
            automationType: auto.type || 'versatile_trickster',
            description: `Versatile Trickster: Trip also applied to ${secondaryTargetName} — target must make a Dexterity save or gain the Prone condition.`,
            automation: auto,
        },
    };
}
