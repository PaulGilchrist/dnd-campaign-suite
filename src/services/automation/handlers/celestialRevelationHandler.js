import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../rules/expirations.js';

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
    ], campaignName, 10);

    // Apply the chosen transformation's buff with the correct effect type
    const { toggleBuff } = await import('../common/buffToggle.js');
    const effectConfig = TRANSFORMATION_EFFECTS[chosenOption] || { buffEffect: chosenOption, description: '' };
    toggleBuff(
        playerStats.name,
        chosenOption,
        { effect: effectConfig.buffEffect, duration: '1_minute' },
        campaignName,
        playerStats.name
    );

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Celestial Revelation',
            description: `Transforming into ${chosenOption}. ${effectConfig.description} The transformation lasts for 1 minute or until you end it.`,
            automation: auto,
        },
    };
}
