import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { loadCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

const DREAD_AMBUSH_USED_THIS_TURN_KEY = 'dreadAmbushUsedThisTurn';
const DREAD_AMBUSH_USES_KEY = 'dreadambushUses';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Dread Ambush';

    // Check uses remaining
    let usesKey = DREAD_AMBUSH_USES_KEY;
    let currentUses = 0;
    if (auto.uses_expression) {
        const maxUses = evaluateAutoExpression(auto.uses_expression, playerStats);
        currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    // Check oncePerTurn
    if (auto.oncePerTurn) {
        const storedRound = getRuntimeValue(playerName, DREAD_AMBUSH_USED_THIS_TURN_KEY);
        const currentRound = getCurrentCombatRound(campaignName);
        if (storedRound === currentRound) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName}: Already used this turn. Once per turn.`,
                    automation: auto,
                },
            };
        }
    }

    // Get last attack
    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No recent attack found. Must be used after you deal damage with a weapon attack.`,
                automation: auto,
            },
        };
    }

    // Verify character was the attacker
    if (attackEvent.attackerName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: You must be the attacker to use this feature.`,
                automation: auto,
            },
        };
    }

    // Verify damage was applied
    if (!attackEvent.damageApplied) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No damage was applied by your last attack.`,
                automation: auto,
            },
        };
    }

    // Resolve damage expression with scaling
    let damageExpr = auto.damageExpression || '2d6';
    if (auto.scaling) {
        const entries = Object.entries(auto.scaling)
            .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
            .filter(e => !isNaN(e.level))
            .sort((a, b) => a.level - b.level);
        for (const entry of entries) {
            if (playerStats.level >= entry.level) {
                damageExpr = entry.expr;
            }
        }
    }

    const targetName = attackResult.targetName;
    const damageType = auto.damageType || 'Psychic';

    // Roll and apply damage
    const damageRoll = rollExpression(damageExpr);
    const damageTotal = damageRoll?.total || 0;

    const combatSummary = await loadCombatSummary(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    applyDamageToTarget(combatSummary, targetName, damageTotal, [damageType], campaignName, characters, false, playerName);

    // Decrement uses
    if (auto.uses_expression) {
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    // Mark oncePerTurn
    if (auto.oncePerTurn) {
        const currentRound = getCurrentCombatRound(campaignName);
        await setRuntimeValue(playerName, DREAD_AMBUSH_USED_THIS_TURN_KEY, currentRound, campaignName);
    }

    // Log to campaign log
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to deal ${damageTotal} ${damageType} damage to ${targetName} (rolled ${damageExpr}).`,
        targetName,
        damageType,
        damageTotal,
        formula: damageExpr,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[dreadAmbushHandler] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName,
            description: `${featureName}: Dealt <strong>${damageTotal}</strong> ${damageType} damage to ${targetName}. (Rolled ${damageExpr}.)`,
            automation: auto,
        },
    };
}
