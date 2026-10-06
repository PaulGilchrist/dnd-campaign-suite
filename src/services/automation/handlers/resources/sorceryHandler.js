import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { getCurrentSorceryPoints, spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { setInnateSorceryActive, isInnateSorceryActive } from '../../../combat/buffs/buffService.js';
import { addEntry } from '../../../ui/logService.js';

// CLA-194 §5 activation logging: activations log ability_use, refusals log
// automation + innate_sorcery_refused (zero-spend refusals stay unlogged spends).
function logActivation(playerStats, description, campaignName) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Innate Sorcery',
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[sorceryHandler:log-error]', e); });
}

function logRefusal(playerStats, action, reason, campaignName) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        abilityName: action.name,
        automationType: action.automation?.type,
        description: `${action.name} refused: ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[sorceryHandler:log-error]', e); });
}

async function activateInnateSorceryAura(action, auto, playerStats, campaignName) {
    const currentUses = getRuntimeValue(playerStats.name, 'innateSorceryUses', campaignName);
    const usesMax = getClassFeatures(playerStats)?.maxInnateSorcery || 0;
    const remaining = currentUses != null ? Number(currentUses) : usesMax;

    if (remaining <= 0) {
        logRefusal(playerStats, action, 'innate_sorcery_refused no_uses', campaignName);
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
    logActivation(playerStats, `activated ${action.name} (+1 spell save DC, Advantage on Sorcerer spell attack rolls; ${newRemaining}/${usesMax} uses remaining)`, campaignName);
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

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (isInnateSorceryActive(playerStats.name, campaignName)) {
        logRefusal(playerStats, action, 'innate_sorcery_refused already_active', campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} is already active.`,
                automation: auto,
            },
        };
    }

    if (auto.type === 'sorcery_aura') {
        return await activateInnateSorceryAura(action, auto, playerStats, campaignName);
    }

    const cost = auto.cost || 2;
    const currentUses = getRuntimeValue(playerStats.name, 'innateSorceryUses', campaignName);
    const usesMax = getClassFeatures(playerStats)?.maxInnateSorcery || 0;
    const remaining = currentUses != null ? Number(currentUses) : usesMax;
    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerStats.name, maxSP);

    if (remaining > 0) {
        logRefusal(playerStats, action, 'innate_sorcery_refused uses_remaining', campaignName);
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
        logRefusal(playerStats, action, 'innate_sorcery_refused insufficient_sorcery_points', campaignName);
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

    spendSorceryPoints(playerStats.name, cost, campaignName, getClassFeatures(playerStats)?.maxSorceryPoints || 0);
    setRuntimeValue(playerStats.name, 'innateSorceryUses', 0, campaignName);
    setInnateSorceryActive(playerStats.name, true, campaignName);
    logActivation(playerStats, `activated ${action.name} via Sorcery Incarnate (${cost} SP spent; +1 spell save DC, Advantage on Sorcerer spell attack rolls)`, campaignName);
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
