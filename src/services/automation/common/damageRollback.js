import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';
import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { removeCondition } from '../../combat/conditions/conditionSaveService.js';

/**
 * Get the last attack from the root-level lastAttack key.
 *
 * @param {string} [campaignName] - Campaign name for fetching combat context
 * @returns {{ attackEvent: Object|null, attackerName: string|null, targetName: string|null, primaryDamage: number, secondaryDamage: number, totalDamage: number, damageTypes: string[] }}
 */
export async function findLastAttack(campaignName) {
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack) {
        return { attackEvent: null, attackerName: null, targetName: null, primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [] };
    }

    const a = lastAttack;
    const primary = a.primaryDamage || a.rawDamage || 0;
    const secondary = a.secondaryDamage || 0;
    const actualDamage = a.actualDamage ?? (primary + secondary);

    return {
        attackEvent: {
            ...(a.affectedTargets == null ? { affectedTargets: [a.targetName] } : {}),
            ...(a.statusEffects == null ? { statusEffects: null } : {}),
            ...a,
        },
        attackerName: a.attackerName,
        targetName: a.targetName,
        trigger: a.trigger || null,
        primaryDamage: primary,
        secondaryDamage: secondary,
        totalDamage: actualDamage,
        damageTypes: a.damageTypes || [],
        primaryDamageType: a.primaryDamageType || a.damageType || null,
        secondaryDamageType: a.secondaryDamageType || null,
    };
}

/**
 * Find the last attack roll targeting a specific player.
 * Uses combatSummary.lastAttack which is the single source of truth.
 *
 * @param {string} targetName - Name of the target to find attacks against
 * @param {string} [campaignName] - Campaign name for fetching combat context
 * @returns {{ attackEvent: Object|null, attackerName: string|null }}
 */
export async function findAttackRollAgainstTarget(targetName, campaignName) {
    const result = await findLastAttack(campaignName);
    if (!result.attackEvent) return { attackEvent: null, attackerName: null };
    if (result.targetName === targetName) {
        return { attackEvent: result.attackEvent, attackerName: result.attackerName };
    }
    return { attackEvent: null, attackerName: null };
}

/**
 * Rollback damage by healing the target for the last attack's total damage (primary + secondary).
 * Logs the rollback to the campaign log.
 *
 * @returns {number} The amount that was actually healed (may be 0 if target is at max HP)
 */
export async function rollbackDamage(attackerName, targetName, campaignName, featureName) {
    const result = await findLastAttack(campaignName);
    if (!result.attackEvent) return 0;

    const a = result.attackEvent;
    if (a.attackerName !== attackerName || a.targetName !== targetName) return 0;
    if (!result.totalDamage || result.totalDamage <= 0) return 0;

    const cs = await getCombatContext(campaignName);
    if (!cs) return 0;

    const healResult = applyHealingToTarget(cs, targetName, result.totalDamage, campaignName);
    if (healResult?.newHp != null) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: targetName,
            abilityName: featureName,
            description: `${targetName} used ${featureName} — ${attackerName}'s attack misses. The attack is retroactively negated and ${targetName} is healed for ${result.totalDamage} HP.`,
            targetName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error(`[${featureName}] Error:`, e); throw e; });
        return result.totalDamage;
    }

    return 0;
}

/**
 * Find the most recent roll (attack, ability check, or save) for each creature.
 * Reads from the root-level lastAttack — the single source of truth for the most recent roll.
 * Since reactions can only target the most recent roll, this returns the same lastAttack
 * data for all creatures. Handlers should check attackerName/targetName to determine relevance.
 *
 * @returns {Promise<Object|null>} Map of { creatureName: { attackEvent, abilityEvent, saveEvent, rollType } } or null
 */
export async function findRollsByCreature(campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return null;

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const result = {};
    for (const creature of cs.creatures) {
        const name = creature.name;
        result[name] = {
            attackEvent: lastAttack?.rollType === 'attack' ? lastAttack : null,
            abilityEvent: lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill' ? lastAttack : null,
            saveEvent: lastAttack?.rollType === 'save' ? lastAttack : null,
            rollType: lastAttack?.rollType || null,
        };
    }
    return result;
}

/**
 * Find the most recent roll across all creatures (used by Portent).
 * Returns the single most recent event regardless of creature type.
 *
 * @returns {Promise<{ creatureName: string, eventType: string, eventData: Object, isStale: boolean }|null>}
 */
export async function findMostRecentRollAcrossCreatures(campaignName) {
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack) return null;

    let eventType = 'attack';
    if (lastAttack.rollType === 'check' || lastAttack.rollType === 'skill') {
        eventType = 'ability';
    } else if (lastAttack.rollType === 'save') {
        eventType = 'save';
    }

    return {
        creatureName: lastAttack.attackerName || lastAttack.targetName || null,
        eventType,
        eventData: lastAttack,
        isStale: false,
    };
}

/**
 * Create a lastAttack entry for a save-based spell (single-target or AoE).
 * Call this at the start of a spell handler before the target loop.
 *
 * @param {string} campaignName
 * @param {Object} config
 * @param {string} config.casterName - The caster's name
 * @param {string} config.spellName - The spell or feature name
 * @param {string} config.saveType - Save ability (e.g. 'WIS', 'DEX')
 * @param {number} config.saveDc - The save DC
 * @param {'aoe'|'single'} config.attackScope - Whether the spell targets one creature or an area
 * @param {string|null} [config.damageFormula] - Damage formula (null for condition-only spells)
 * @param {string|null} [config.damageType] - Damage type (null for condition-only spells)
 * @param {number} [config.damageOnSuccess] - Base damage on successful save (0 for most spells)
 * @param {number} [config.damageOnFailure] - Base damage on failed save (0 for condition-only spells)
 */
export function storeSpellLastAttack(campaignName, config) {
    const { casterName, spellName, saveType, saveDc, attackScope, damageFormula, damageType, damageOnSuccess, damageOnFailure } = config;

    if (!casterName) console.warn('[storeSpellLastAttack] casterName is missing');
    if (!spellName) console.warn('[storeSpellLastAttack] spellName is missing');
    if (!saveType) console.warn('[storeSpellLastAttack] saveType is missing');
    if (saveDc == null) console.warn('[storeSpellLastAttack] saveDc is missing');

    const lastAttack = {
        attackerName: casterName || null,
        attackName: spellName || null,
        rollType: 'spell-save',
        saveType: saveType || null,
        saveDc: saveDc ?? 0,
        attackScope: attackScope || 'aoe',
        damageFormula: damageFormula || null,
        damageType: damageType || null,
        damageOnSuccess: damageOnSuccess || 0,
        damageOnFailure: damageOnFailure || 0,
        targetResults: [],
        affectedTargets: [],
        statusEffects: [],
        rawDamage: 0,
        primaryDamage: 0,
        actualDamage: 0,
        damageApplied: false,
        timestamp: Date.now(),
    };

    setRuntimeValue('campaign', 'lastAttack', lastAttack, campaignName);
}

/**
 * Add a per-target save result to the current spell lastAttack.
 * Recomputes aggregated fields (affectedTargets, statusEffects, damage) after each call.
 *
 * @param {string} campaignName
 * @param {Object} result
 * @param {string} result.targetName - Target creature name
 * @param {'success'|'failure'|'immune'} result.saveResult - Save outcome
 * @param {number} [result.roll] - Natural d20 result
 * @param {number} [result.total] - Total save roll (d20 + bonus)
 * @param {string[]} [result.conditions] - Condition keys applied on failure (empty for success/immune)
 * @param {number} [result.appliedDamage] - Actual damage dealt after resistances (0 for condition-only)
 */
export async function addTargetResult(campaignName, result) {
    const existing = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!existing || existing.rollType !== 'spell-save') {
        return;
    }

    const entry = {
        targetName: result.targetName,
        saveResult: result.saveResult || 'failure',
        roll: result.roll ?? 0,
        total: result.total ?? 0,
        conditions: result.conditions || [],
        appliedDamage: result.appliedDamage || 0,
    };

    const targetResults = [...(existing.targetResults || []), entry];

    const affectedTargets = targetResults.map(r => r.targetName);
    const statusEffects = [...new Set(targetResults.flatMap(r => r.conditions))];
    const actualDamage = targetResults.reduce((sum, r) => sum + r.appliedDamage, 0);

    const updated = {
        ...existing,
        targetResults,
        affectedTargets,
        statusEffects,
        rawDamage: actualDamage,
        primaryDamage: actualDamage,
        actualDamage,
        damageApplied: actualDamage > 0,
    };

    setRuntimeValue('campaign', 'lastAttack', updated, campaignName);
}

/**
 * Rollback all effects of a countered spell.
 * Heals damage, removes conditions, and cleans targetEffects for all affected targets.
 * Returns summary of what was rolled back.
 *
 * @param {Object} lastAttack - The lastAttack object from the spell being countered
 * @param {string} campaignName - Campaign name
 * @param {string} featureName - Name of the feature (e.g. 'Counterspell')
 * @param {Object} [existingCombatContext] - Pre-fetched combat context (avoids redundant re-fetch)
 * @returns {Promise<{targetsHealed: number, conditionsRemoved: Array, effectsRemoved: number, damageHealed: number, logDescription: string}>}
 */
export async function rollbackSpellEffects(lastAttack, campaignName, featureName, existingCombatContext) {
    const attackerName = lastAttack.attackerName || 'Unknown';
    const spellName = lastAttack.attackName || lastAttack.damageName || 'unknown spell';

    const cs = existingCombatContext || await getCombatContext(campaignName);
    if (!cs) {
        console.error(`[${featureName}] No combat context for rollback`);
        return { targetsHealed: 0, conditionsRemoved: [], effectsRemoved: 0, damageHealed: 0, logDescription: '' };
    }

    let rolledBack = {
        targetsHealed: 0,
        conditionsRemoved: [],
        effectsRemoved: 0,
        damageHealed: 0,
        logDescription: '',
    };

    const targetResults = lastAttack.targetResults;
    const targets = lastAttack.affectedTargets || [lastAttack.targetName];

    if (targetResults && targetResults.length > 0) {
        for (const tr of targetResults) {
            rollbackTarget(cs, tr.targetName, tr.appliedDamage, tr.conditions, rolledBack, featureName, campaignName);
        }
    } else {
        const totalDamage = lastAttack.actualDamage ?? ((lastAttack.primaryDamage || 0) + (lastAttack.secondaryDamage || 0));
        const conditionKeys = lastAttack.statusEffects || [];

        for (const targetName of targets) {
            rollbackTarget(cs, targetName, totalDamage, conditionKeys, rolledBack, featureName, campaignName);
        }
    }

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filtered = storedEffects.filter(te => !(te.target && targets.includes(te.target) && te.source === attackerName));
    if (filtered.length < storedEffects.length) {
        rolledBack.effectsRemoved = storedEffects.length - filtered.length;
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
    }

    rolledBack.logDescription = buildRollbackLogDescription(attackerName, spellName, targets, rolledBack);

    return rolledBack;
}

function buildRollbackLogDescription(attackerName, spellName, targets, rolledBack) {
    const damageStr = rolledBack.damageHealed > 0 ? `${rolledBack.damageHealed} HP healed` : 'no damage dealt';
    const conditionStr = rolledBack.conditionsRemoved.length > 0
        ? `${rolledBack.conditionsRemoved.length} condition(s) removed`
        : 'no conditions to remove';
    const effectStr = rolledBack.effectsRemoved > 0 ? `${rolledBack.effectsRemoved} target effect(s) cleared` : 'no target effects to clear';
    const affectedList = targets.join(', ');

    return `${attackerName}'s spell '${spellName}' was countered — ${damageStr}, ${conditionStr}, ${effectStr} on ${affectedList}.`;
}

function rollbackTarget(cs, targetName, damage, conditions, rolledBack, featureName, campaignName) {
    if (damage > 0) {
        const healResult = applyHealingToTarget(cs, targetName, damage, campaignName);
        if (healResult?.newHp != null) {
            rolledBack.damageHealed += damage;
            rolledBack.targetsHealed++;
        }
    }
    for (const condition of conditions) {
        try {
            removeCondition(cs, targetName, condition, getRuntimeValue, setRuntimeValue, campaignName);
            rolledBack.conditionsRemoved.push({ targetName, condition });
        } catch (e) {
            console.error(`[${featureName}] Failed to remove condition '${condition}' from ${targetName}:`, e);
        }
    }
}


