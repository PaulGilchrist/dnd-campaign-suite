import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { loadCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

const DREAD_AMBUSH_USED_THIS_TURN_KEY = 'dreadAmbushUsedThisTurn';
const DREAD_AMBUSH_USES_KEY = 'dreadambushUses';

// Resolve damage expression with scaling
function resolveDreadAmbushDamageExpr(auto, playerStats) {
    let damageExpr = auto.damageExpression || '2d6';
    if (!auto.scaling) return damageExpr;
    const entries = Object.entries(auto.scaling)
        .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
        .filter(e => !isNaN(e.level))
        .sort((a, b) => a.level - b.level);
    for (const entry of entries) {
        if (playerStats.level >= entry.level) {
            damageExpr = entry.expr;
        }
    }
    return damageExpr;
}

function ambushRefusal(featureName, description, auto) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}

function checkAmbushUses(auto, playerStats, playerName, featureName) {
    if (!auto.uses_expression) return { currentUses: 0, refusal: null };
    const maxUses = evaluateAutoExpression(auto.uses_expression, playerStats);
    // maxUses and playerName available via dreadAmbush params
    const currentUses = Number(getRuntimeValue(playerName, DREAD_AMBUSH_USES_KEY) ?? maxUses);
    if (currentUses <= 0) {
        // no uses remaining
        return { currentUses, refusal: ambushRefusal(featureName, `${featureName} has no uses remaining. Recharges on a Long Rest.`, auto) };
    }
    return { currentUses, refusal: null };
}

function checkAmbushOncePerTurn(auto, playerName, featureName, campaignName) {
    if (!auto.oncePerTurn) return null;
    const storedRound = getRuntimeValue(playerName, DREAD_AMBUSH_USED_THIS_TURN_KEY);
    if (storedRound === getCurrentCombatRound(campaignName)) {
        return ambushRefusal(featureName, `${featureName}: Already used this turn. Once per turn.`, auto);
    }
    return null;
}

function checkAmbushAttackGates(featureName, attackEvent, playerName, auto) {
    if (!attackEvent) {
        return ambushRefusal(featureName, `${featureName}: No recent attack found. Must be used after you deal damage with a weapon attack.`, auto);
    }
    // Verify character was the attacker
    if (attackEvent.attackerName !== playerName) {
        return ambushRefusal(featureName, `${featureName}: You must be the attacker to use this feature.`, auto);
    }
    // Verify damage was applied
    if (!attackEvent.damageApplied) {
        return ambushRefusal(featureName, `${featureName}: No damage was applied by your last attack.`, auto);
    }
    return null;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Dread Ambush';

    // Check uses remaining
    const { currentUses, refusal: usesRefusal } = checkAmbushUses(auto, playerStats, playerName, featureName);
    if (usesRefusal) return usesRefusal;

    // Check oncePerTurn
    const roundRefusal = checkAmbushOncePerTurn(auto, playerName, featureName, campaignName);
    if (roundRefusal) return roundRefusal;

    // Get last attack
    const attackResult = await findLastAttack(campaignName);
    const gateRefusal = checkAmbushAttackGates(featureName, attackResult.attackEvent, playerName, auto);
    if (gateRefusal) return gateRefusal;

    // Resolve damage expression with scaling
    const damageExpr = resolveDreadAmbushDamageExpr(auto, playerStats);

    const targetName = attackResult.targetName;
    const damageType = auto.damageType || 'Psychic';

    // Roll and apply damage
    const damageRoll = rollExpression(damageExpr);
    const damageTotal = damageRoll?.total || 0;

    const combatSummary = await loadCombatSummary(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    applyDamageToTarget(combatSummary, targetName, damageTotal, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerName });

    // Decrement uses
    if (auto.uses_expression) {
        await setRuntimeValue(playerName, DREAD_AMBUSH_USES_KEY, currentUses - 1, campaignName);
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
