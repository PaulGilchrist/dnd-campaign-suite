import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints, getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Trance of Order';

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);

    const usesKey = 'tranceOfOrderUses';
    const activeKey = 'tranceOfOrderActive';
    const usesMax = 1;

    const stored = getRuntimeValue(playerName, usesKey, campaignName);
    const active = (stored != null ? Number(stored) : usesMax) > 0;

    if (!active) {
        if (currentSP >= 5) {
            spendSorceryPoints(playerName, 5, campaignName);

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} restored and activated Trance of Order by spending 5 Sorcery Points.`,
            }).catch((e) => { console.error("[tranceOfOrder] Error:", e); });

            setRuntimeValue(playerName, usesKey, 0, campaignName);
            setRuntimeValue(playerName, activeKey, true, campaignName);
            window.dispatchEvent(new CustomEvent('trance-of-order-updated'));

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} activated (5 SP spent). Attack rolls against you can't benefit from Advantage. D20 tests treat 9 or lower as 10.`,
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

    setRuntimeValue(playerName, usesKey, 0, campaignName);
    setRuntimeValue(playerName, activeKey, true, campaignName);
    window.dispatchEvent(new CustomEvent('trance-of-order-updated'));

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName} (Bonus Action, 1 minute). Attack rolls against you can't benefit from Advantage. D20 tests treat 9 or lower as 10.`,
    }).catch((e) => { console.error("[tranceOfOrder] Error:", e); });

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
    return getRuntimeValue(playerName, 'tranceOfOrderActive', null) === true;
}

export function deactivate(playerName, campaignName) {
    setRuntimeValue(playerName, 'tranceOfOrderActive', false, campaignName);
}
