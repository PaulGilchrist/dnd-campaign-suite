import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { getCurrentSorceryPoints, spendSorceryPoints } from '../../../../hooks/useMetamagic.js';
import { setInnateSorceryActive } from '../../../combat/buffs/buffService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto.type === 'sorcery_aura') {
        const currentUses = getRuntimeValue(playerStats.name, 'innateSorceryUses', campaignName);
        const usesMax = getClassFeatures(playerStats)?.maxInnateSorcery || 0;
        const remaining = currentUses != null ? Number(currentUses) : usesMax;

        if (remaining <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} has no remaining uses. Recharges on a long rest.`,
                    automation: auto,
                },
            };
        }

        const newRemaining = Math.max(0, remaining - 1);
        setRuntimeValue(playerStats.name, 'innateSorceryUses', newRemaining, campaignName);

        setInnateSorceryActive(playerStats.name, true, campaignName);
        window.dispatchEvent(new CustomEvent('innate-sorcery-updated'));

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} activated (${newRemaining}/${usesMax} uses remaining).`,
                automation: auto,
            },
        };
    }

    const cost = auto.cost || 2;
    const currentUses = getRuntimeValue(playerStats.name, 'innateSorceryUses', campaignName);
    const usesMax = getClassFeatures(playerStats)?.maxInnateSorcery || 0;
    const remaining = currentUses != null ? Number(currentUses) : usesMax;
    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerStats.name, maxSP);

    if (remaining > 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Cannot use ${action.name} while Innate Sorcery still has uses remaining (${remaining} uses left).`,
                automation: auto,
            },
        };
    }

    if (currentSP < cost) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Not enough Sorcery Points to use ${action.name}. Cost: ${cost} SP, Have: ${currentSP} SP.`,
                automation: auto,
            },
        };
    }

    spendSorceryPoints(playerStats.name, cost, campaignName);
    setRuntimeValue(playerStats.name, 'innateSorceryUses', 0, campaignName);
    setInnateSorceryActive(playerStats.name, true, campaignName);
    window.dispatchEvent(new CustomEvent('innate-sorcery-updated'));

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated (${cost} SP spent). Innate Sorcery is now active (0/${usesMax} uses remaining).`,
            automation: auto,
        },
    };
}
