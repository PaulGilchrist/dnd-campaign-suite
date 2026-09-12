import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { rollNpcSave } from './charmSpellUtils.js';

function dispatchSaveResult(campaignName, promptId, targetName, saveType, saveDc, saveResult) {
    sendSaveResult(campaignName, targetName, {
        promptId,
        success: saveResult.success,
        roll: saveResult.roll,
        total: saveResult.total,
        saveBonus: saveResult.bonus,
        rawRolls: saveResult.rawRolls,
    });

    window.dispatchEvent(new CustomEvent('save-result', {
        detail: {
            promptId,
            targetName,
            saveType,
            saveDc,
            success: saveResult.success,
            roll: saveResult.roll,
            total: saveResult.total,
            saveBonus: saveResult.bonus,
            rawRolls: saveResult.rawRolls,
        },
    }));
}

async function recordDominateSuccess(campaignName, casterName, spellName, targetName, dc, saveResult) {
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
        rollType: `save-${spellName.toLowerCase().replace(/\s+/g, '-')}`,
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against ${spellName}.`,
    }).catch((e) => { console.error(`[${spellName}] Error:`, e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: spellName,
            description: `${targetName} succeeded on WIS save (DC ${dc}) against ${spellName}. Roll: ${saveResult.roll ?? 0} + ${saveResult.bonus ?? 0} = ${saveResult.total ?? 0}.`,
        },
    };
}

async function applyDominateCharm(campaignName, casterName, spellName, targetName, dc, saveResult) {
    // Failed save: apply Charmed condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['charmed'],
        appliedDamage: 0,
    });

    addExpiration(casterName, targetName, [
        { type: 'dominated', condition: 'charmed' },
    ], campaignName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: `${spellName} spell`,
        note: `${targetName} is Charmed by ${casterName} and regards them as a friendly acquaintance. You have a telepathic link with the target as long as you are on the same plane of existence. You can use this link to issue commands to the target (no action required). The spell ends if ${casterName} or allies deal damage to the target, or when the target takes damage and succeeds on a WIS save.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`[${spellName}] Error:`, e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: `save-${spellName.toLowerCase().replace(/\s+/g, '-')}`,
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${spellName} and is Charmed.`,
    }).catch((e) => { console.error(`[${spellName}] Error:`, e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: spellName,
            description: `${targetName} failed WIS save (DC ${dc}) against ${spellName}. Roll: ${saveResult.roll ?? 0} + ${saveResult.bonus ?? 0} = ${saveResult.total ?? 0} — ${targetName} is Charmed by ${casterName}. You have a telepathic link with the target and can issue commands to it (no action required). The spell ends if concentration is lost, on initiative roll, short rest, or long rest.`,
        },
    };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const saveAdvantage = auto.advantage || false;

    const casterName = playerStats.name;
    const spellName = action.name;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName,
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
                name: spellName,
                description: 'No target selected. Dominate has no effect.',
            },
        };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        attackerName: casterName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
        advantage: saveAdvantage,
        disadvantage: !!action.metaCtx?.metamagicHeighten,
        condition: 'charmed',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: spellName,
        description: `${casterName} casts ${spellName} on ${targetName}! ${targetName} must make a WIS save (DC ${dc})${saveAdvantage ? ' with Advantage' : ''} or become Charmed.`,
        promptId,
    }).catch((e) => { console.error(`[${spellName}] Error:`, e); });

    if (targetInfo?.target?.type === 'npc') {
        const creature = targetInfo.cs?.creatures?.find(c => c.name === targetName);
        dispatchSaveResult(campaignName, promptId, targetName, 'WIS', dc, rollNpcSave(creature, dc, saveAdvantage));
    }

    const saveResult = await promise;

    if (saveResult.success) {
        return recordDominateSuccess(campaignName, casterName, spellName, targetName, dc, saveResult);
    }

    return applyDominateCharm(campaignName, casterName, spellName, targetName, dc, saveResult);
}
