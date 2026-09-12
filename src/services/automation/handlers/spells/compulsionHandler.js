import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

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

function rollNpcCompulsionSave(targetInfo, targetName, dc, saveAdvantage) {
    const cs = targetInfo.cs;
    const creature = cs?.creatures?.find(c => c.name === targetName);
    if (creature) return rollSaveForCreature(creature, 'WIS', dc, false, saveAdvantage);
    const r1 = rollD20();
    const r2 = rollD20();
    const roll = saveAdvantage ? Math.max(r1, r2) : r1;
    const total = roll;
    const success = total >= dc;
    return { roll, total, bonus: 0, success, rawRolls: [r1, r2] };
}

async function applyCompulsionCharm(targetName, campaignName) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);
}

async function applyCompulsionSaveSuccess(campaignName, casterName, actionName, targetName, dc, saveResult) {
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
        rollType: 'save-compulsion',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against Compulsion.`,
    }).catch((e) => { console.error("[compulsion] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: actionName,
            description: `${targetName} succeeded on WIS save against Compulsion.`,
        },
    };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const saveAdvantage = auto.advantage || false;

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
                description: 'No target selected. Compulsion has no effect.',
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
        abilityName: action.name,
        description: `${casterName} casts Compulsion on ${targetName}! ${targetName} must make a WIS save (DC ${dc})${saveAdvantage ? ' with Advantage' : ''} or become Charmed.`,
        promptId,
    }).catch((e) => { console.error("[compulsion] Error:", e); });

    if (targetInfo?.target?.type === 'npc') {
        const saveResult = rollNpcCompulsionSave(targetInfo, targetName, dc, saveAdvantage);
        dispatchSaveResult(campaignName, promptId, targetName, 'WIS', dc, saveResult);
    }

    const saveResult = await promise;

    if (saveResult.success) {
        return await applyCompulsionSaveSuccess(campaignName, casterName, action.name, targetName, dc, saveResult);
    }

    await applyCompulsionCharm(targetName, campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['charmed'],
        appliedDamage: 0,
    });

    addExpiration(casterName, targetName, [
        { type: 'charmed', condition: 'charmed' },
    ], campaignName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Compulsion spell',
        note: `${targetName} is Charmed by ${casterName}. As a bonus action on each of its turns, ${targetName} must use its movement to travel to the nearest space that is furthest away from ${casterName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[compulsion] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-compulsion',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Compulsion and is Charmed.`,
    }).catch((e) => { console.error("[compulsion] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is Charmed by Compulsion. As a bonus action on each of its turns, ${targetName} must use its movement to travel to the nearest space that is furthest away from ${casterName}.`,
        },
    };
}
