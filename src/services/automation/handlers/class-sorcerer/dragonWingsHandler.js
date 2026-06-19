import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';

const DRAGON_WINGS_KEY = 'dragonWingsActive';
const DRAGON_WINGS_USES_KEY = 'dragonWingsUses';

function getRuntimeKey(playerName, key) {
    return playerName.toLowerCase().replace(/\s+/g, '') + '_' + key;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Dragon Wings';

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = playerStats.resources?.sorcery_points?.current ?? maxSP;

    const usesKey = getRuntimeKey(playerName, DRAGON_WINGS_USES_KEY);
    const usesMax = auto.uses ?? 1;

    const storedUses = getRuntimeValue(playerName, usesKey, campaignName);
    const active = (storedUses != null ? Number(storedUses) : usesMax) > 0;

    if (!active) {
        if (currentSP >= (auto.restoreCost || 3)) {
            spendSorceryPoints(playerName, auto.restoreCost || 3, campaignName);
            await setRuntimeValue(playerName, usesKey, usesMax, campaignName);

            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} restored Dragon Wings by spending ${auto.restoreCost || 3} Sorcery Points.`,
            }).catch((e) => { console.error("[dragonWings] Error:", e); throw e; });

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} restored (${auto.restoreCost || 3} SP spent). Active until Long Rest.`,
                    automation: auto,
                },
            };
        }

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has no uses remaining. Recharges on a Long Rest, or you can spend ${auto.restoreCost || 3} Sorcery Points to restore.`,
                automation: auto,
            },
        };
    }

    // Toggle off if already active
    const activeBuffsRaw = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(activeBuffsRaw) ? activeBuffsRaw : [];
    const wasActive = activeBuffs.some(b => b.name === featureName);

    if (wasActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== featureName);
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${featureName} deactivated.`,
        }).catch((e) => { console.error("[dragonWings] Error:", e); throw e; });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} deactivated.`,
                automation: auto,
            },
        };
    }

    // Activate
    await setRuntimeValue(playerName, getRuntimeKey(playerName, DRAGON_WINGS_KEY), true, campaignName);

    const newBuffs = [...activeBuffs, {
        name: featureName,
        effect: 'dragon_wings',
        duration: auto.duration || '1_hour',
        flySpeed: auto.flySpeed || 60,
        hover: auto.hover || false,
    }];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} activated (Bonus Action, ${auto.duration || '1 hour'}). Fly Speed 60 feet (hover).`,
    }).catch((e) => { console.error("[dragonWings] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} activated. Fly Speed 60 feet (hover) for ${auto.duration || '1 hour'}.`,
            automation: auto,
        },
    };
}

export function isActive(playerName) {
    const key = getRuntimeKey(playerName, DRAGON_WINGS_KEY);
    return getRuntimeValue(playerName, key, null) === true;
}

export function deactivate(playerName, campaignName) {
    const key = getRuntimeKey(playerName, DRAGON_WINGS_KEY);
    setRuntimeValue(playerName, key, false, campaignName);
}
