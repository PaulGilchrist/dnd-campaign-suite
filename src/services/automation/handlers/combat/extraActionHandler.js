import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../../services/encounters/combatData.js';

function extraActionPopup(action, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}

async function gateOncePerCombat(action, auto, campaignName) {
    if (!auto.oncePerCombat) return null;
    const combatSummary = await loadCombatSummary(campaignName);
    if (combatSummary && combatSummary.round > 1) {
        return extraActionPopup(action, auto, `${action.name} can only be used once per combat.`);
    }
    return null;
}

function gateFirstRoundOnly(action, auto) {
    if (!auto.firstRoundOnly) return null;
    const currentRound = getCurrentCombatRound();
    if (currentRound && currentRound > 1) {
        return extraActionPopup(action, auto, `${action.name} can only be used in the first round of combat.`);
    }
    return null;
}

function gateUsesRemaining(action, auto, playerStats, campaignName, usesMax, resourceKey) {
    if (usesMax <= 0) return null;
    const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
    if (usesUsed > 0) return null;
    return extraActionPopup(action, auto, `${action.name} has no uses remaining. Recharges on a ${auto.recharge || 'Short Rest'}.`);
}

async function gateOncePerTurn(action, auto, playerStats, campaignName) {
    if (!auto.oncePerTurn) return null;
    const usedThisRound = getRuntimeValue(playerStats.name, 'actionSurgeUsedThisRound', campaignName);
    const currentRound = getCurrentCombatRound();
    if (usedThisRound === currentRound) {
        return extraActionPopup(action, auto, `${action.name} can only be used once per turn.`);
    }
    await setRuntimeValue(playerStats.name, 'actionSurgeUsedThisRound', currentRound, campaignName, true);
    return null;
}

async function consumeExtraActionUses(auto, playerStats, campaignName, usesMax, resourceKey) {
    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
        if (usesUsed > 0) {
            await setRuntimeValue(playerStats.name, resourceKey, usesUsed - 1, campaignName, true);
        }
    }

    if (auto.oncePerCombat) {
        await setRuntimeValue(playerStats.name, resourceKey, 0, campaignName, true);
    }
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const usesMax = auto.uses || 1;
    const resourceKey = auto.resourceKey || 'actionSurgeUses';

    const combatRefusal = await gateOncePerCombat(action, auto, campaignName);
    if (combatRefusal) return combatRefusal;

    const roundRefusal = gateFirstRoundOnly(action, auto);
    if (roundRefusal) return roundRefusal;

    const usesRefusal = gateUsesRemaining(action, auto, playerStats, campaignName, usesMax, resourceKey);
    if (usesRefusal) return usesRefusal;

    const turnRefusal = await gateOncePerTurn(action, auto, playerStats, campaignName);
    if (turnRefusal) return turnRefusal;

    await consumeExtraActionUses(auto, playerStats, campaignName, usesMax, resourceKey);

    return automationInfoPopup(action);
}
