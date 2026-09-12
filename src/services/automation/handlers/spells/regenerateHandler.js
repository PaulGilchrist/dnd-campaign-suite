import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const REGEN_NAME = 'Regenerate';
const REGEN_EFFECT_KEY = 'regenerate';

function isRegenerateSpell(spell) {
    return (spell.name || '') === REGEN_NAME;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const spell = action.spell || {};

    if (!isRegenerateSpell(spell)) {
        return null;
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat context found. Cannot apply Regenerate.',
            },
        };
    }

    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'regenerate_target_selection',
            name: action.name,
            creatureTargets,
            range: spell.range || 'Touch',
            automation: action.automation || {},
        },
    };
}

function resolveInitialHealExpression(spell) {
    const slotLevel = spell.level || 7;
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel) return '4d8 + 15';
    const expression = healAtSlotLevel[slotLevel] || healAtSlotLevel[Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b).pop()];
    return expression || '4d8 + 15';
}

function stampRegenerateEffect(targetName, casterName, campaignName) {
    // Register target effect badge
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    // Remove any existing regenerate effect on this target
    const filtered = effects.filter(te => !(te.target === targetName && te.effect === REGEN_EFFECT_KEY));
    filtered.push({
        target: targetName,
        effect: REGEN_EFFECT_KEY,
        source: casterName,
    });
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
}

export async function applyRegenerateEffect(action, playerStats, campaignName, mapName, targetName) {
    if (!targetName) {
        return null;
    }

    const casterName = playerStats.name;
    const spell = action.spell || {};

    // Calculate initial heal: 4d8 + 15
    const initialHealExpression = resolveInitialHealExpression(spell);

    const initialRoll = evaluateAutoExpression(initialHealExpression, playerStats);
    const healAmount = typeof initialRoll === 'number' && initialRoll > 0 ? initialRoll : 33;

    // Get creature max HP
    const combatSummary = getCombatSummary(campaignName);
    const creature = combatSummary?.creatures?.find(c => c.name === targetName);
    const maxHp = creature?.maxHp || playerStats.hitPoints || 0;

    // Get current HP
    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : (creature?.currentHp ?? maxHp);
    const actualHeal = Math.min(healAmount, maxHp - currentHp);

    // Apply initial healing
    if (actualHeal > 0 && combatSummary) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
    }

    // Log the initial heal
    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: actualHeal,
        currentHp: Math.min(maxHp, currentHp + actualHeal),
        maxHp,
        isHealing: true,
        sourceName: casterName,
        note: 'Regenerate',
        formula: initialHealExpression,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[regenerate] Error logging heal:", e); });

    // Set regenerateActive on target to trigger turn-start healing
    setRuntimeValue(targetName, 'regenerateActive', true, campaignName);

    stampRegenerateEffect(targetName, casterName, campaignName);

    // Log ability use
    const popupText = `Regenerate on ${targetName}: Regained ${actualHeal} HP. Target gains 1 HP per turn and is restored to full HP when the effect ends.`;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: popupText,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[regenerate] Error logging ability use:", e); });

    // Log spell effect
    addEntry(campaignName, {
        type: 'spell_effect',
        characterName: casterName,
        spellName: action.name,
        targetName,
        effects: [`Initial heal: ${actualHeal} HP, Ongoing: 1 HP/turn`],
        timestamp: Date.now(),
    }).catch((e) => { console.error("[regenerate] Error logging spell effect:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: popupText,
        },
    };
}

export function isRegenerateActive(targetName, campaignName) {
    const stored = getRuntimeValue(targetName, 'regenerateActive', campaignName);
    return stored === true;
}
