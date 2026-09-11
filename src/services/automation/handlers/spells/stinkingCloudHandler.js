import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { playerIsImmuneToCondition } from '../../../combat/automation/automationImmunities.js';
import { getEffectDefinition, registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

/**
 * Stinking Cloud spell handler.
 * Mechanics:
 * - 20-foot-radius Sphere of yellow, nauseating gas, Heavily Obscured
 * - Concentration, up to 1 minute
 * - CON save or Poisoned condition until end of current turn
 * - While Poisoned by Stinking Cloud: can't take Action or Bonus Action
 *   (consumed via the 'no_action_and_bonus_action' te → cannotAct gates)
 * - Zone tracking lives under `_stinkingCloud_<caster>` on the caster's store
 *   (SP-108 sleetStorm pattern): expireStaleEffects Phase 4 re-forces a CON
 *   save at each creature's TURN START while its stinking_cloud te persists.
 * - applyStinkingCloudTurnEnd sheds Poisoned + the action block at the end of
 *   the affected creature's own turn ("until the end of the current turn").
 * - Expires on concentration loss (concentration sweep of the duration:
 *   'concentration' tes), initiative roll, short rest, long rest
 * - Strong wind (Gust of Wind) disperses the cloud (unmodellable — no wind
 *   consumer exists in this engine)
 */

const BLOCK_TE_EFFECT = 'no_action_and_bonus_action';

/**
 * Remove the Poisoned condition and the no_action_and_bonus_action block te
 * for a creature at the END of its own turn (SP-111 "until the end of the
 * current turn"). Only fires when the creature carries a stinking_cloud zone
 * te from a live cloud — manual/GM poison is never auto-shed here.
 * Idempotent: only writes/logs when state is actually present.
 */
export async function applyStinkingCloudTurnEnd(campaignName, targetName) {
    if (!targetName) return;

    const tes = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (!Array.isArray(tes)) return;
    const hasCloud = tes.some(te => te && te.effect === 'stinking_cloud' && te.target === targetName);
    if (!hasCloud) return;

    const remaining = tes.filter(te => !(te && te.effect === BLOCK_TE_EFFECT && te.target === targetName));
    if (remaining.length !== tes.length) {
        await setRuntimeValue('campaign', 'targetEffects', remaining, campaignName);
    }

    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    if (conditions.some(c => String(c).toLowerCase() === 'poisoned')) {
        await setRuntimeValue(targetName, 'activeConditions',
            conditions.filter(c => String(c).toLowerCase() !== 'poisoned'), campaignName);
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Poisoned',
            reason: 'Stinking Cloud (end of current turn)',
            timestamp: Date.now(),
        }).catch((e) => { console.error('[stinkingCloudTurnEnd] Error:', e); });
    }
}

/**
 * Recurring turn-start CON save for a creature starting its turn inside the
 * Stinking Cloud zone (SP-108 sleetStorm processSleetStormAreaSave mirror).
 * Called from expireStaleEffects Phase 4 at each creature's turn start.
 */
export async function processStinkingCloudAreaSave(casterName, targetName, campaignName, _mapName) {
    const trackingKey = `_stinkingCloud_${casterName.replace(/\s+/g, '_')}`;
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);

    if (!tracking || !tracking.saveDc) {
        return null;
    }

    if (_mapName) {
        try {
            const inArea = await isWithinRange(casterName, targetName, tracking.radius || 20);
            if (!inArea) return null;
        } catch (error) {
            // If map data unavailable, proceed with save
            console.warn('[stinkingCloudHandler] Map data unavailable, proceeding with save:', error);
        }
    }

    const targetCreature = (await getCombatContext(campaignName))?.creatures?.find(c => c.name === targetName);

    // Poison immunity (or no need to breathe) = automatic success.
    const targetImmunities = targetCreature?.weaknessesAndResistivities?.immunities || [];
    if (Array.isArray(targetImmunities) && targetImmunities.some(imm => String(imm).toLowerCase() === 'poison')) {
        return null;
    }

    if (targetCreature?.type === 'player') {
        const targetStats = {
            computedStats: getRuntimeValue(targetName, 'computedStats', campaignName),
        };
        if (playerIsImmuneToCondition({
            conditionKey: 'poisoned',
            playerStats: targetStats,
            getRuntimeValue,
            campaignName,
        })) {
            return null;
        }
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc: tracking.saveDc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Stinking Cloud',
        description: `${targetName} starts its turn in Stinking Cloud and must make a CON save (DC ${tracking.saveDc}) or become Poisoned until the end of the current turn (can't take an Action or Bonus Action).`,
        promptId,
    }).catch((e) => { console.error("[stinkingCloudAreaSave] Error:", e); });

    const saveResult = await promise;

    if (!saveResult.success) {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'poisoned');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'poisoned'], campaignName);

        const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
        setRuntimeValue(targetName, 'activeConditionMeta', {
            ...existingMeta,
            poisoned: {
                ...(existingMeta.poisoned || {}),
                dc: tracking.saveDc,
                ability: 'con',
                source: 'stinking_cloud',
            },
        }, campaignName);

        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'failure',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: ['poisoned'],
            appliedDamage: 0,
        });

        if (!getEffectDefinition(BLOCK_TE_EFFECT)) {
            console.error(`[stinkingCloudHandler] "${BLOCK_TE_EFFECT}" missing from targetEffectDefinitions registry`);
        }
        registerTargetEffect(campaignName, targetName, BLOCK_TE_EFFECT, casterName, {
            duration: 'until_end_of_current_turn',
            reason: 'Poisoned by Stinking Cloud (can\'t take an Action or Bonus Action)',
        });

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-stinking-cloud',
            targetName,
            saveDc: tracking.saveDc,
            saveType: 'CON',
            success: false,
            description: `${targetName} failed its turn-start CON save (DC ${tracking.saveDc}) against Stinking Cloud and is Poisoned until the end of the current turn — can't take an Action or Bonus Action.`,
        }).catch((e) => { console.error("[stinkingCloudAreaSave] Error:", e); });

        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Poisoned',
            reason: 'Stinking Cloud (turn start)',
            note: `${targetName} is Poisoned by Stinking Cloud. While Poisoned, the creature can't take an Action or Bonus Action.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[stinkingCloudAreaSave] Error:", e); });
    } else {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        if (conditions.some(c => String(c).toLowerCase() === 'poisoned')) {
            setRuntimeValue(targetName, 'activeConditions',
                conditions.filter(c => String(c).toLowerCase() !== 'poisoned'), campaignName);
            addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Poisoned',
                reason: 'Stinking Cloud (turn-start save succeeded)',
                timestamp: Date.now(),
            }).catch((e) => { console.error("[stinkingCloudAreaSave] Error:", e); });
        }

        const tes = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
        const remaining = tes.filter(te => !(te.effect === BLOCK_TE_EFFECT && te.target === targetName && te.source === casterName));
        if (remaining.length !== tes.length) {
            setRuntimeValue('campaign', 'targetEffects', remaining, campaignName);
        }

        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'success',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: [],
            appliedDamage: 0,
        });

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-stinking-cloud',
            targetName,
            saveDc: tracking.saveDc,
            saveType: 'CON',
            success: true,
            description: `${targetName} succeeded on its turn-start CON save (DC ${tracking.saveDc}) against Stinking Cloud.`,
        }).catch((e) => { console.error("[stinkingCloudAreaSave] Error:", e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Stinking Cloud',
            description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} the CON save (DC ${tracking.saveDc}) at turn start. ${saveResult.success ? 'Unaffected.' : 'Poisoned until the end of the current turn — can\'t take an Action or Bonus Action.'}`,
        },
    };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const casterName = playerStats.name;

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures in combat. Stinking Cloud has no effect.',
            },
        };
    }

    // Get selected targets from metaCtx; if none, use all creatures
    const selectedTargetNames = action.metaCtx?.targets || cs.creatures.map(c => c.name);
    const targets = cs.creatures.filter(c => selectedTargetNames.includes(c.name));

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures selected for Stinking Cloud.',
            },
        };
    }

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'CON',
        saveDc: dc,
        attackScope: 'aoe',
    });

    // Store the cloud zone area for recurring turn-start saves
    // (SP-108 sleetStorm `_sleetStorm_<caster>` pattern).
    const trackingKey = `_stinkingCloud_${casterName.replace(/\s+/g, '_')}`;
    setRuntimeValue(casterName, trackingKey, {
        caster: casterName,
        mapName: _mapName,
        campaignName,
        saveDc: dc,
        saveType: 'CON',
        radius: 20, // 20-foot-radius sphere
        timestamp: Date.now(),
        duration: auto.duration || 'Concentration, up to 1 minute',
    }, campaignName);

    // Expiration: the spell lasts at most 1 minute (10 rounds) even with
    // sustained concentration — mirrors sleetStorm's 1_minute→10 mapping and
    // the CLA-334 minutes-as-rounds encoding. Concentration loss sweeps the
    // 'concentration' tes separately via cleanupConcentrationEffects.
    const durationRounds = (() => {
        const lower = (auto.duration || action.spell?.duration || 'Concentration, up to 1 minute').toLowerCase();
        const minuteMatch = lower.match(/(\d+)\s*_?minute/);
        if (minuteMatch) return parseInt(minuteMatch[1], 10) * 10;
        const roundMatch = lower.match(/(\d+)\s*_?round/);
        if (roundMatch) return parseInt(roundMatch[1], 10);
        return undefined;
    })();

    if (durationRounds) {
        addExpiration(casterName, casterName, [
            { type: 'clear_runtime_value', creatureName: casterName, key: trackingKey },
            { type: 'remove_target_effect', effectKey: 'stinking_cloud', source: casterName },
            { type: 'remove_target_effect', effectKey: BLOCK_TE_EFFECT, source: casterName },
        ], campaignName, durationRounds);
    }

    // Register concentration for this spell
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Stinking Cloud', concentrationDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    let affectedCount = 0;
    let savedCount = 0;
    let immuneCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        // Check for poison immunity on each target individually
        if (isPoisonImmune(target)) {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: casterName,
                abilityName: action.name,
                description: `${targetName} is immune to Stinking Cloud (Poison immunity).`,
            }).catch((e) => { console.error("[stinkingCloud] Error:", e); });
            results.push(`${targetName} is immune.`);
            immuneCount++;
            continue;
        }

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'CON',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage: action.metaCtx?.heightenTarget === targetName,
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Stinking Cloud! ${targetName} must make a CON save (DC ${dc}) or become Poisoned.`,
            promptId,
        }).catch((e) => { console.error("[stinkingCloud] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await addTargetResult(campaignName, {
                targetName,
                saveResult: 'success',
                roll: saveResult.roll ?? 0,
                total: saveResult.total ?? 0,
                conditions: [],
                appliedDamage: 0,
            });
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-stinking-cloud',
                targetName,
                saveDc: dc,
                saveType: 'CON',
                success: true,
                description: `${targetName} succeeded on CON save against Stinking Cloud.`,
            }).catch((e) => { console.error("[stinkingCloud] Error:", e); });
        } else {
            affectedCount++;
            await applyCloudPoisonedTarget(campaignName, casterName, targetName, dc, saveResult);
            results.push(`${targetName} is Poisoned.`);
        }
    }

    const summary = affectedCount > 0
        ? `Stinking Cloud affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. ${immuneCount > 0 ? `${immuneCount} creature(s) immune.` : ''} Affected creatures are Poisoned (can't take Actions or Bonus Actions) until the end of their current turn.`
        : `No creatures affected by Stinking Cloud. ${savedCount} creature(s) saved. ${immuneCount > 0 ? `${immuneCount} creature(s) immune.` : ''}`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

function isPoisonImmune(target) {
    const targetImmunities = target.weaknessesAndResistivities?.immunities || [];
    return Array.isArray(targetImmunities) && targetImmunities.some(
        imm => String(imm).toLowerCase() === 'poison'
    );
}

async function applyCloudPoisonedTarget(campaignName, casterName, targetName, dc, saveResult) {
    // Apply Poisoned condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'poisoned');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'poisoned'], campaignName);

    // Store condition metadata with DC and ability for recurring CON save
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        poisoned: {
            ...(existingMeta.poisoned || {}),
            dc,
            ability: 'con',
        },
    }, campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['poisoned'],
        appliedDamage: 0,
    });

    // Add expiration for concentration — Poisoned removed when concentration breaks
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'poisoned' },
    ], campaignName);

    // Note: initiative-rolled event has nothing to do with turn/round expiration.
    // It fires once at the start of a new combat to reset once-per-combat trackers.
    // Turn/round-based expiration is handled by expireStaleEffects in the initiative component.

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Poisoned',
        reason: 'Stinking Cloud spell',
        note: `${targetName} is Poisoned by Stinking Cloud. While Poisoned, the creature can't take an Action or Bonus Action.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[stinkingCloud] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-stinking-cloud',
        targetName,
        saveDc: dc,
        saveType: 'CON',
        success: false,
        description: `${targetName} failed CON save against Stinking Cloud and is Poisoned.`,
    }).catch((e) => { console.error("[stinkingCloud] Error:", e); });

    // Track Stinking Cloud effect with concentration duration for cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const stinkingEffect = {
        target: targetName,
        effect: 'stinking_cloud',
        source: casterName,
        conditions: ['poisoned'],
        dc: dc,
        duration: 'concentration',
    };
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'stinking_cloud'
    );
    if (existingIdx >= 0) {
        effects[existingIdx] = stinkingEffect;
    } else {
        effects.push(stinkingEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    // Poisoned-in-this-way rider: block Action + Bonus Action until the
    // end of the current turn (consumed by computeConditionEffects →
    // cannotAct gates; shed at turn end by applyStinkingCloudTurnEnd).
    if (!getEffectDefinition(BLOCK_TE_EFFECT)) {
        console.error(`[stinkingCloudHandler] "${BLOCK_TE_EFFECT}" missing from targetEffectDefinitions registry`);
    }
    registerTargetEffect(campaignName, targetName, BLOCK_TE_EFFECT, casterName, {
        duration: 'until_end_of_current_turn',
        reason: 'Poisoned by Stinking Cloud (can\'t take an Action or Bonus Action)',
    });
}
