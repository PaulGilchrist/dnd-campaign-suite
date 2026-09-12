import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';

async function applyFearSaveSuccess(campaignName, casterName, targetName, dc, saveResult) {
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
        rollType: 'save-fear',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against Fear.`,
    }).catch((e) => { console.error("[fear] Error:", e); });
}

async function applyFearSaveFail(campaignName, casterName, targetName, dc, saveResult) {
    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['frightened'],
        appliedDamage: 0,
    });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Frightened',
        reason: 'Fear spell',
        note: `${targetName} drops what it was holding, becomes Frightened, and must take the Dash action to move away from ${casterName} on each of its turns.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[fear] Error:", e); });

    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'frightened' },
    ], campaignName);

    // Track Fear-specific effect: affected creature can re-save if it ends its turn
    // without line of sight to the caster
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'fear_end_on_los'
    );
    const fearEffect = {
        target: targetName,
        effect: 'fear_end_on_los',
        source: casterName,
        condition: 'frightened',
        dc: dc,
        duration: 'concentration',
    };
    if (existingIdx >= 0) {
        effects[existingIdx] = fearEffect;
    } else {
        effects.push(fearEffect);
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
                description: 'No creatures in combat. Fear has no effect.',
            },
        };
    }

    const casterName = playerStats.name;

    // Register caster concentration at the caster's spell save DC (sleetStormHandler pattern)
    addConcentration(cs, casterName, 'Fear', dc);
    storage.set('combatSummary', cs, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'aoe',
    });

    const targets = cs.creatures.filter(c => c.name !== casterName);

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
            condition: 'frightened',
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Fear! ${targetName} must make a WIS save (DC ${dc}) or drop what it's holding and become Frightened.`,
            promptId,
        }).catch((e) => { console.error("[fear] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await applyFearSaveSuccess(campaignName, casterName, targetName, dc, saveResult);
        } else {
            affectedCount++;

            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'frightened'], campaignName);

            await applyFearSaveFail(campaignName, casterName, targetName, dc, saveResult);

            results.push(`${targetName} drops what it's holding and is Frightened.`);
        }
    }

    const summary = affectedCount > 0
        ? `Fear affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures drop what they're holding, are Frightened, and must use the Dash action to move away on each of their turns. An affected creature can repeat the save if it ends its turn without line of sight to you.`
        : `No creatures affected by Fear. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
