import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const combatSummary = await getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            creatureTargets,
            maxTargets: 1,
            automation: action.automation || {},
        },
    };
}

function resolveHealExpression(auto, action) {
    const healAtSlotLevel = action.spell?.heal_at_slot_level;
    const spellLevel = auto.slotLevel || action.spellSlotLevel || 3;
    if (healAtSlotLevel?.[spellLevel]) return healAtSlotLevel[spellLevel];
    if (healAtSlotLevel) {
        const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
        const highestBelow = levels.filter(l => l <= spellLevel).pop();
        if (highestBelow) return healAtSlotLevel[highestBelow];
    }
    return auto.healExpression || '2d6';
}

function targetHpValues(creature, targetName, campaignName) {
    const isPlayer = creature.type === 'player';
    return {
        maxHp: isPlayer ? getRuntimeValue(targetName, 'hitPoints') : creature.maxHp,
        currentHp: isPlayer ? getRuntimeValue(targetName, 'currentHitPoints', campaignName) : creature.currentHp,
    };
}

export async function applyAuraOfVitality(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const auto = action.automation || {};
    const casterName = playerStats.name;
    const targetName = targetNames[0];
    const combatSummary = await getCombatSummary(campaignName);

    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Target ${targetName} not found in combat.`,
            },
        };
    }

    const expression = resolveHealExpression(auto, action);

    const result = rollExpression(expression);
    if (!result) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Failed to roll healing for ${action.name}.`,
            },
        };
    }

    const { maxHp, currentHp } = targetHpValues(creature, targetName, campaignName);

    if (maxHp == null) {
        console.error(`[auraOfVitality] Cannot determine maxHp for ${targetName} (creature.maxHp=${creature.maxHp}, hitPoints=${getRuntimeValue(targetName, 'hitPoints')})`);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Could not determine max HP for ${targetName}.`,
            },
        };
    }

    if (currentHp == null) {
        console.error(`[auraOfVitality] Cannot determine currentHp for ${targetName} (creature.currentHp=${creature.currentHp}, currentHitPoints=${getRuntimeValue(targetName, 'currentHitPoints', campaignName)})`);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Could not determine current HP for ${targetName}.`,
            },
        };
    }

    const healAmount = Math.min(result.total, Math.max(0, maxHp - currentHp));

    if (healAmount > 0) {
        applyHealingToTarget(combatSummary, targetName, healAmount, campaignName);
    }

    const newHp = Math.min(maxHp, currentHp + healAmount);

    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: healAmount,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        sourceName: casterName,
        note: action.name,
        formula: expression,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[auraOfVitality] Error:', e); });

    // Badge on the healed creature (for display on their card)
    registerTargetEffect(campaignName, targetName, 'aura_of_vitality', casterName);

    // Also store on the caster (for free cast checking)
    registerTargetEffect(campaignName, casterName, 'aura_of_vitality', casterName);

    addExpiration(casterName, targetName, [
        { type: 'remove_active_buff', buffName: 'Aura of Vitality' },
    ], campaignName, undefined, casterName);

    const cs = getCombatSummary(campaignName);
    addConcentration(cs, casterName, 'Aura of Vitality', 10 + Math.floor(playerStats.concentrationBonus || 0));

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts ${action.name} on ${targetName}. Target heals ${healAmount} HP (rolled ${expression}: ${result.total}). Concentration, up to 1 minute.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[auraOfVitality] Error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${casterName} casts ${action.name} on ${targetName}. Target heals ${healAmount} HP (${expression} rolled ${result.total}). Concentration maintained.`,
            automation: auto,
        },
    };
}

export function isAuraOfVitalityActive(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.some(te => te.effect === 'aura_of_vitality' && te.target === targetName);
}
