import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import { SLOW_TE_EFFECTS } from '../../../combat/conditions/slowEffects.js';

export { SLOW_TE_EFFECTS, removeSlowEffectsForTarget } from '../../../combat/conditions/slowEffects.js';

async function recordSlowSaveSuccess(campaignName, casterName, targetName, dc, saveResult) {
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
        rollType: 'save-slow',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against Slow.`,
    }).catch((e) => { console.error("[slow] Error:", e); });
}

async function applySlowToTarget(campaignName, action, casterName, targetName, dc, saveResult) {
    // Apply slow condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'slow');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'slow'], campaignName);

    // Store condition metadata with DC and ability for recurring WIS save
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        slow: {
            ...(existingMeta.slow || {}),
            dc,
            ability: 'wis',
        },
    }, campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['slow'],
        appliedDamage: 0,
    });

    // Add expiration for concentration (up to 10 rounds = 1 minute)
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'slow' },
    ], campaignName);

    // Store target effects for the slow debuffs with condition reference for concentration cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];

    // Remove existing slow effects from this caster for this target
    const existingFiltered = effects.filter(
        te => !(te.target === targetName && te.source === casterName &&
            SLOW_TE_EFFECTS.includes(te.effect))
    );

    const slowEffect = (effect, extra) => ({
        target: targetName,
        effect,
        source: casterName,
        duration: 'concentration',
        condition: 'slow',
        ...extra,
    });

    // SP-109: the -2 AC penalty is carried by the slow CONDITION
    // (conditionEffects case 'slow' → acPenalty) and folded into hit
    // resolution via getSlowAcPenalty — no ac_penalty te (would double-count).
    const allEffects = [
        ...existingFiltered,
        slowEffect('no_reactions'),
        slowEffect('dex_save_disadvantage'),
        slowEffect('action_limit'),
        slowEffect('single_attack_limit'),
        slowEffect('somatic_failure_chance', { chance: 25 }),
    ];
    setRuntimeValue('campaign', 'targetEffects', allEffects, campaignName);

    // Persist the caster's concentration with the real save DC (SP-107 pattern)
    const summary = getCombatSummary(campaignName);
    if (summary?.creatures) {
        const casterCreature = summary.creatures.find(c => c.name === casterName);
        if (casterCreature && casterCreature.concentration?.spell !== action.name) {
            addConcentration(summary, casterName, action.name, dc);
            storage.set('combatSummary', summary, campaignName);
        }
    }

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Slow',
        reason: 'Slow spell',
        note: `${targetName} is affected by Slow: Speed halved, -2 AC penalty, disadvantage on DEX saves, no reactions, action OR bonus action (not both), one attack max, 25% somatic spell failure.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[slow] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-slow',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Slow. Speed halved, -2 AC, disadvantage on DEX saves, no reactions, action/bonus action (not both), one attack max, and 25% somatic spell failure chance.`,
    }).catch((e) => { console.error("[slow] Error:", e); });
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
                description: 'No creatures in combat. Slow has no effect.',
            },
        };
    }

    const casterName = playerStats.name;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: action.metaCtx?.targets ? 'single' : 'aoe',
    });

    const selectedTargets = action.metaCtx?.targets;
    let targets;
    if (selectedTargets && Array.isArray(selectedTargets) && selectedTargets.length > 0) {
        targets = selectedTargets.map(name => ({ name }));
    } else {
        targets = cs.creatures.filter(c => c.name !== casterName);
    }

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
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Slow! ${targetName} must make a WIS save (DC ${dc}) or be slowed.`,
            promptId,
        }).catch((e) => { console.error("[slow] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await recordSlowSaveSuccess(campaignName, casterName, targetName, dc, saveResult);
        } else {
            affectedCount++;
            await applySlowToTarget(campaignName, action, casterName, targetName, dc, saveResult);
            results.push(`${targetName} is slowed.`);
        }
    }

    const summary = affectedCount > 0
        ? `Slow affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures have Speed halved, -2 AC penalty, disadvantage on DEX saves, no reactions, action or bonus action (not both), one attack max, and 25% somatic spell failure chance.`
        : `No creatures affected by Slow. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
