import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rollNpcSave } from './charmSpellUtils.js';
import storage from '../../../ui/storage.js';

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

async function recordCrownSaveSuccess(campaignName, casterName, action, targetName, dc, saveResult) {
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
        rollType: 'save-crown-of-madness',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against Crown of Madness.`,
    }).catch((e) => { console.error("[crownOfMadness] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} succeeded on WIS save against Crown of Madness.`,
        },
    };
}

async function applyCrownCharm(campaignName, casterName, action, playerStats, targetName, dc, saveResult) {
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
        { type: 'charmed', condition: 'charmed' },
    ], campaignName);

    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Crown of Madness', concentrationDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Crown of Madness spell',
        note: `${targetName} is Charmed by ${casterName}. On each of its turns, ${targetName} must use its action to make a melee attack against a creature chosen by ${casterName} before moving.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[crownOfMadness] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-crown-of-madness',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save and is Charmed by Crown of Madness.`,
    }).catch((e) => { console.error("[crownOfMadness] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is Charmed by Crown of Madness. On each of its turns, ${targetName} must use its action to make a melee attack against a creature chosen by ${casterName} before moving.`,
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
                description: 'No target selected. Crown of Madness has no effect.',
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
        description: `${casterName} casts Crown of Madness on ${targetName}! ${targetName} must make a WIS save (DC ${dc})${saveAdvantage ? ' with Advantage' : ''} or become Charmed.`,
        promptId,
    }).catch((e) => { console.error("[crownOfMadness] Error:", e); });

    if (targetInfo?.target?.type === 'npc') {
        const creature = targetInfo.cs?.creatures?.find(c => c.name === targetName);
        dispatchSaveResult(campaignName, promptId, targetName, 'WIS', dc, rollNpcSave(creature, dc, saveAdvantage));
    }

    const saveResult = await promise;

    if (saveResult.success) {
        return recordCrownSaveSuccess(campaignName, casterName, action, targetName, dc, saveResult);
    }

    return applyCrownCharm(campaignName, casterName, action, playerStats, targetName, dc, saveResult);
}
