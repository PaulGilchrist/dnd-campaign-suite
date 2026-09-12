import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';


/**
 * Process the initial save success: target dances until end of next turn, speed_zero.
 */
export async function processOttoDanceSuccessSave(casterName, targetName, spellName, campaignName) {
    const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conds = Array.isArray(storedConds) ? storedConds : [];
    const filtered = conds.filter(c =>
        String(c).toLowerCase() !== 'speed_zero'
    );
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'speed_zero'], campaignName);

    addExpiration(casterName, targetName, [
        { type: 'speed_zero', condition: 'speed_zero' },
    ], campaignName, undefined, casterName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Speed 0',
        reason: `${spellName} (successful save)`,
        note: `${targetName} dances comically until the end of its next turn, spending all movement in place.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: spellName,
            description: `${targetName} succeeded on WIS save and dances comically until the end of its next turn, spending all movement in place.`,
        },
    };
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
                description: 'No creatures in combat. Otto\'s Irresistible Dance has no effect.',
            },
        };
    }

    const casterName = playerStats.name;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'single',
    });

    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No target selected. Otto\'s Irresistible Dance has no effect.',
            },
        };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
        disadvantage: !!action.metaCtx?.metamagicHeighten,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts Otto's Irresistible Dance on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or become Charmed.`,
        promptId,
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        // Successful save: dances comically until end of next turn, speed_zero
        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'success',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: [],
            appliedDamage: 0,
        });
        return await processOttoDanceSuccessSave(casterName, targetName, action.name, campaignName);
    }

    // Failed save: apply Charmed + speed_zero conditions
    return await processOttoDanceFailedSave(casterName, targetName, action, dc, saveResult, campaignName);
}

/**
 * Process the failed save: Charmed + speed_zero conditions, condition meta,
 * concentration badge targetEffect, and log entries.
 */
async function processOttoDanceFailedSave(casterName, targetName, action, dc, saveResult, campaignName) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c =>
        String(c).toLowerCase() !== 'charmed' &&
        String(c).toLowerCase() !== 'speed_zero'
    );
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed', 'speed_zero'], campaignName);

    // Store condition metadata with DC and ability for recurring WIS save
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        charmed: {
            ...(existingMeta.charmed || {}),
            dc,
            ability: 'wis',
        },
    }, campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['charmed', 'speed_zero'],
        appliedDamage: 0,
    });

    addExpiration(casterName, targetName, [
        { type: 'charmed', condition: 'charmed' },
        { type: 'speed_zero', condition: 'speed_zero' },
    ], campaignName);

    // Register the spell badge targetEffect. Its `conditions` array and
    // `duration: 'concentration'` let concentrationService remove the badge and
    // both conditions (with a log entry) when concentration breaks.
    const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === 'ottos_irresistible_dance' && te.source === casterName
    );
    const danceEffect = {
        target: targetName,
        effect: 'ottos_irresistible_dance',
        source: casterName,
        dc,
        duration: 'concentration',
        conditions: ['charmed', 'speed_zero'],
    };
    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = danceEffect;
    } else {
        allTargetEffects.push(danceEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-ottos-dance',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Otto's Irresistible Dance and is Charmed with Speed 0.`,
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed, Speed 0',
        reason: action.name,
        note: `${targetName} is Charmed by ${action.name}. While Charmed, the target dances comically, must use all movement to dance in place, has Disadvantage on Dexterity saving throws and attack rolls, and other creatures have Advantage on attack rolls against it.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[ottosDance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is Charmed with Speed 0. While Charmed, the target has Disadvantage on Dexterity saving throws and attack rolls, and other creatures have Advantage on attack rolls against it.`,
        },
    };
}
