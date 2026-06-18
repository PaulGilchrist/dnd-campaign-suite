import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';

function getRuntimeKey(playerName, key) {
    return playerName.toLowerCase().replace(/\s+/g, '') + '_' + key;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Transe of Order';

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = playerStats.resources?.sorcery_points?.current ?? maxSP;

    const usesKey = getRuntimeKey(playerName, 'transeOfOrderUses');
    const restKey = getRuntimeKey(playerName, 'transeOfOrderRestTimestamp');

    const lastRest = getRuntimeValue(playerName, restKey, campaignName);
    const now = Date.now();
    let usesMax = 1;
    let active;

    if (lastRest && (now - lastRest) < 86400000) {
        const stored = getRuntimeValue(playerName, usesKey, campaignName);
        active = (stored != null ? Number(stored) : usesMax) > 0;
    } else {
        active = true;
    }

    if (!active) {
        if (currentSP >= 5) {
            spendSorceryPoints(playerName, 5, campaignName);
            await setRuntimeValue(playerName, restKey, now, campaignName);
            await setRuntimeValue(playerName, usesKey, usesMax, campaignName);

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} restored Transe of Order by spending 5 Sorcery Points.`,
                timestamp: now,
            }).catch(() => {});

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} restored (5 SP spent). Active until Long Rest.`,
                    automation: auto,
                },
            };
        }

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has no uses remaining. Recharges on a Long Rest, or you can spend 5 Sorcery Points to restore.`,
                automation: auto,
            },
        };
    }

    setRuntimeValue(playerName, getRuntimeKey(playerName, 'transeOfOrderActive'), true, campaignName);
    window.dispatchEvent(new CustomEvent('transe-of-order-updated'));

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName} (Bonus Action, 1 minute). Attack rolls against you can't benefit from Advantage. D20 tests treat 9 or lower as 10.`,
        timestamp: now,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} activated. Attack rolls against you can't benefit from Advantage. D20 tests treat 9 or lower as 10.`,
            automation: auto,
        },
    };
}

export function isActive(playerName) {
    const key = getRuntimeKey(playerName, 'transeOfOrderActive');
    return getRuntimeValue(playerName, key, null) === true;
}

export function deactivate(playerName, campaignName) {
    const key = getRuntimeKey(playerName, 'transeOfOrderActive');
    setRuntimeValue(playerName, key, false, campaignName);
}
