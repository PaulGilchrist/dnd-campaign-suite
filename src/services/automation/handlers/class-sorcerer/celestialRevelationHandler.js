import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addEntry } from '../../../ui/logService.js';
import { handle as handleBuff } from '../buffs/buffHandler.js';
import { handle as handleCondition } from '../buffs/conditionHandler.js';
import { handle as handleAttackRider } from '../combat/attackRiderHandler.js';
import { applyAuraDamage } from '../../../rules/effects/expirations.js';

const TRANSFORMATION_EFFECTS = {
    'Heavenly Wings': {
        buffEffect: 'fly_speed_equals_walk_speed',
        description: 'Two spectral wings sprout from your back. You gain a Fly Speed equal to your Speed.',
    },
    'Inner Radiance': {
        buffEffect: 'inner_radiance',
        description: 'Searing light radiates from your eyes and mouth. You shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.',
    },
    'Necrotic Shroud': {
        buffEffect: 'necrotic_shroud',
        description: 'Your eyes become pools of darkness, and flightless wings sprout from your back.',
    },
};

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    // Check level gate
    if (auto.minLevel && playerStats.level < auto.minLevel) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Celestial Revelation requires character level ${auto.minLevel}. You are currently level ${playerStats.level}.`,
                automation: auto,
            },
        };
    }

    // Check uses-based recharge (shared across all three options)
    const maxUses = auto.usesMax ?? auto.uses ?? 1;
    if (maxUses > 0) {
        const usesKey = auto.resourceKey || '_celestialRevelationUses';
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has been used and cannot be used again until a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    // Present choice modal for transformation option
    return {
        type: 'modal',
        modalName: 'celestialRevelation',
        payload: {
            action,
            playerStats,
            campaignName,
        },
    };
}

export async function confirmCelestialRevelation(playerStats, chosenOption, campaignName) {
    const auto = {
        type: 'celestial_revelation',
        options: ['Heavenly Wings', 'Inner Radiance', 'Necrotic Shroud'],
        chooseOne: true,
        recharge: 'long_rest',
        casting_time: '1 bonus action',
        minLevel: 3,
    };

    // Check level gate
    if (auto.minLevel && playerStats.level < auto.minLevel) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Celestial Revelation',
                description: `Celestial Revelation requires character level ${auto.minLevel}. You are currently level ${playerStats.level}.`,
                automation: auto,
            },
        };
    }

    // Check uses-based recharge (shared across all three options)
    const maxUses = auto.usesMax ?? auto.uses ?? 1;
    if (maxUses > 0) {
        const usesKey = auto.resourceKey || '_celestialRevelationUses';
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Celestial Revelation',
                    description: 'Celestial Revelation has been used and cannot be used again until a Long Rest.',
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    }

    // Store the chosen transformation option
    await setRuntimeValue(playerStats.name, '_celestialRevelationOption', chosenOption, campaignName);

    // Set up duration expiration (1 minute = 10 rounds)
    addExpiration(playerStats.name, playerStats.name, [
        { type: 'remove_active_buff', buffName: chosenOption }
    ], campaignName);

    // Apply the chosen transformation's buff with the correct effect type
    const effectConfig = TRANSFORMATION_EFFECTS[chosenOption] || { buffEffect: chosenOption, description: '' };
    toggleBuff(
        playerStats.name,
        chosenOption,
        { effect: effectConfig.buffEffect, duration: '1_minute' },
        campaignName,
        playerStats.name
    );

    // Dispatch sub-feature automations for the chosen option
    const popupDescriptions = [];

    if (chosenOption === 'Heavenly Wings') {
        // temp_buff for fly speed
        const buffResult = await handleBuff({
            name: chosenOption,
            automation: {
                type: 'temp_buff',
                effect: 'fly_speed_equals_walk_speed',
                duration: '1_minute',
                recharge: 'long_rest',
                casting_time: '1 bonus action',
            },
        }, playerStats, campaignName, null);
        if (buffResult?.type === 'popup' && buffResult.payload?.description) {
            popupDescriptions.push(buffResult.payload.description);
        }

        // attack_rider for radiant damage on hit
        const riderResult = await handleAttackRider({
            name: chosenOption,
            automation: {
                type: 'attack_rider',
                damageExpression: 'proficiency_bonus',
                damageType: 'Radiant',
                trigger: 'hit',
                oncePerTurn: true,
                casting_time: 'passive',
            },
        }, playerStats, campaignName, null);
        if (riderResult?.type === 'popup' && riderResult.payload?.description) {
            popupDescriptions.push(riderResult.payload.description);
        }
    } else if (chosenOption === 'Inner Radiance') {
        setRuntimeValue(playerStats.name, 'innerRadianceActive', true, campaignName);
        await applyAuraDamage(playerStats.name, playerStats, campaignName, [], {
            activeKey: 'innerRadianceActive',
            damageValue: playerStats.proficiency || 0,
            range: 10,
            damageType: 'Radiant',
        });
    } else if (chosenOption === 'Necrotic Shroud') {
        const conditionResult = await handleCondition({
            name: chosenOption,
            automation: {
                type: 'set_condition',
                saveType: 'CHA',
                saveDc: 'ability',
                condition: 'frightened',
                range: '10 ft',
                duration: 'until_end_of_next_turn',
                casting_time: '1 bonus action',
            },
        }, playerStats, campaignName, null);

        if (conditionResult?.type === 'modal' && conditionResult.modalName === 'setCondition') {
            return {
                type: 'setCondition',
                payload: conditionResult.payload,
            };
        }
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: chosenOption,
        description: `${chosenOption} used`,
    }).catch((e) => { console.error('[celestialRevelation] Error:', e); });

    const description = popupDescriptions.length > 0
        ? popupDescriptions.join('. ') + '.'
        : effectConfig.description;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Celestial Revelation',
            description: `Transforming into ${chosenOption}. ${description} The transformation lasts for 1 minute or until you end it.`,
            automation: auto,
        },
    };
}
