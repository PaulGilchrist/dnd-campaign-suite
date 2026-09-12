import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

/**
 * Confusion spell handler (2024 ruleset).
 * Mechanics:
 * - 10-foot-radius Sphere AoE
 * - WIS saving throw
 * - On fail: target can't take Bonus Actions or Reactions
 * - On fail: target becomes Charmed (for turn-start behavior control)
 * - Turn-start effect: roll 1d10 for confused behavior
 * - End of each turn: repeated WIS save, success ends spell
 * - Concentration, up to 1 minute
 */

async function recordConfusionSaveSuccess(campaignName, casterName, targetName, dc, saveResult) {
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
        rollType: 'save-confusion',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against Confusion.`,
    }).catch((e) => { console.error("[confusion] Error:", e); });
}

async function applyConfusionFailure(campaignName, casterName, targetName, dc, saveResult) {
    // Apply: no bonus actions, no reactions, charmed (for behavior control)
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c =>
        String(c).toLowerCase() !== 'charmed' &&
        String(c).toLowerCase() !== 'speed_zero'
    );
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed', 'speed_zero'], campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['charmed', 'speed_zero'],
        appliedDamage: 0,
    });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Confused',
        reason: 'Confusion spell',
        note: `${targetName} is Confused. Can't take Bonus Actions or Reactions. At start of each turn, rolls 1d10 for behavior. End of turn: repeat WIS save (DC ${dc}) to end effect.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[confusion] Error:", e); });

    // Register expirations: remove conditions + remove target effect badge + confusion turn-start behavior
    addExpiration(casterName, targetName, [
        { type: 'charmed', condition: 'charmed' },
        { type: 'speed_zero', condition: 'speed_zero' },
        { type: 'remove_target_effect', effectKey: 'confusion', target: targetName, source: casterName },
        { type: 'confusion_turn_start', name: 'Confusion' },
    ], campaignName);

    // Track Confusion effect with DC for cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const confusionEffect = {
        target: targetName,
        effect: 'confusion',
        source: casterName,
        conditions: ['charmed', 'speed_zero'],
        dc: dc,
        duration: 'concentration',
    };
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'confusion'
    );
    if (existingIdx >= 0) {
        effects[existingIdx] = confusionEffect;
    } else {
        effects.push(confusionEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures in combat. Confusion has no effect.',
            },
        };
    }

    const casterName = playerStats.name;

    // Register concentration for this spell
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Confusion', concentrationDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'aoe',
    });

    // Get target names from metaCtx (CreatureSelectionModal) or fall back to all creatures except caster
    const selectedTargets = Array.isArray(action.metaCtx?.targets) && action.metaCtx.targets.length > 0
        ? action.metaCtx.targets
        : cs.creatures.filter(c => c.name !== casterName).map(c => c.name);

    const targets = selectedTargets.map(name => cs.creatures.find(c => c.name === name)).filter(Boolean);

    let affectedCount = 0;
    let savedCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'WIS',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage: action.metaCtx?.heightenTarget === targetName,
            condition: 'charmed',
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Confusion! ${targetName} must make a WIS save (DC ${dc}) or become Confused (can't take Bonus Actions or Reactions, subject to 1d10 behavior each turn).`,
            promptId,
        }).catch((e) => { console.error("[confusion] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await recordConfusionSaveSuccess(campaignName, casterName, targetName, dc, saveResult);
        } else {
            affectedCount++;
            await applyConfusionFailure(campaignName, casterName, targetName, dc, saveResult);
            results.push(`${targetName} is Confused.`);
        }
    }

    const summary = affectedCount > 0
        ? `Confusion affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures can't take Bonus Actions or Reactions and are subject to confused behavior each turn.`
        : `No creatures affected by Confusion. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
