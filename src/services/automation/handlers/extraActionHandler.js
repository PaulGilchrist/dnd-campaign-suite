import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { automationInfoPopup } from '../../shared/popupResponse.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../services/encounters/combatData.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const usesMax = auto.uses || 1;
    const resourceKey = auto.resourceKey || 'actionsurgeUses';

    // Check oncePerCombat flag
    if (auto.oncePerCombat) {
        const combatSummary = await loadCombatSummary(campaignName);
        if (combatSummary && combatSummary.round > 1) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} can only be used once per combat.`,
                    automation: auto,
                },
            };
        }
    }

    // Check firstRoundOnly flag
    if (auto.firstRoundOnly) {
        const currentRound = getCurrentCombatRound();
        if (currentRound && currentRound > 1) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} can only be used in the first round of combat.`,
                    automation: auto,
                },
            };
        }
    }

    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
        if (usesUsed <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has no uses remaining. Recharges on a ${auto.recharge || 'Short Rest'}.`,
                    automation: auto,
                },
            };
        }
    }

    if (auto.oncePerTurn) {
        const usedThisTurn = getRuntimeValue(playerStats.name, 'actionsurgeUsedThisTurn', campaignName);
        if (usedThisTurn) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} can only be used once per turn.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, 'actionsurgeUsedThisTurn', true, campaignName, true);
    }

    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
        if (usesUsed > 0) {
            await setRuntimeValue(playerStats.name, resourceKey, usesUsed - 1, campaignName, true);
        }
    }

    if (auto.oncePerCombat) {
        await setRuntimeValue(playerStats.name, resourceKey, 0, campaignName, true);
    }

    return automationInfoPopup(action);
}
