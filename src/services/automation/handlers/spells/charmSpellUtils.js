// Shared WIS-save "charm" spell pipeline for Charm Person / Charm Monster.
// Both handlers differ only in metaCtx keys, rollType, and refusal text.
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
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

function rollNpcSave(targetCreature, dc, advantage) {
    if (targetCreature) {
        return rollSaveForCreature(targetCreature, 'WIS', dc, false, advantage);
    }
    const r1 = rollD20();
    const r2 = rollD20();
    const roll = advantage ? Math.max(r1, r2) : r1;
    const total = roll;
    const success = total >= dc;
    return { roll, total, bonus: 0, success, rawRolls: [r1, r2] };
}

async function logSaveSuccess(campaignName, casterName, action, targetName, dc, saveResult, rollType, logPrefix) {
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
        rollType,
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against ${action.name}.`,
    }).catch((e) => { console.error(logPrefix, e); });
}

async function applyCharmFailure({ campaignName, casterName, action, targetName, dc, saveResult, rollType, logPrefix }) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

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
        reason: `${action.name} spell`,
        note: `${targetName} is Charmed by ${casterName} and regards them as a friendly acquaintance. The spell ends if ${casterName} or their companions do anything harmful to ${targetName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(logPrefix, e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType,
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} and is Charmed.`,
    }).catch((e) => { console.error(logPrefix, e); });
}

export async function handleCharmSpell(action, playerStats, campaignName, config) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No creatures in combat. ${action.name} has no effect.`,
            },
        };
    }

    const casterName = playerStats.name;

    // Get target names from metaCtx (multi-target) or single targetName
    const metaTargets = action.metaCtx?.[config.targetsKey];
    let targetNames;
    if (metaTargets && Array.isArray(metaTargets) && metaTargets.length > 0) {
        targetNames = metaTargets;
    } else {
        const providedTargetName = auto.targetName || action.targetName;
        if (!providedTargetName) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: config.noTargetDescription,
                },
            };
        }
        targetNames = [providedTargetName];
    }

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: targetNames.length > 1 ? 'single' : 'single',
    });

    let charmedCount = 0;
    let savedCount = 0;
    const charmedTargets = [];
    const savedTargets = [];

    const charmAdvantages = action.metaCtx?.[config.advantagesKey] || {};

    for (const targetName of targetNames) {
        const targetCreature = cs.creatures.find(c => c.name === targetName);
        const isTargetNpc = targetCreature && targetCreature.type !== 'player';
        const targetAdvantage = charmAdvantages[targetName] || auto.advantage || false;

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            attackerName: casterName,
            saveType: 'WIS',
            saveDc: dc,
            dcSuccess: 'none',
            advantage: targetAdvantage,
            disadvantage: !!action.metaCtx?.metamagicHeighten,
            condition: 'charmed',
            ...(config.saveConditions ? { saveConditions: config.saveConditions } : {}),
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a WIS save (DC ${dc})${targetAdvantage ? ' with Advantage' : ''} or become Charmed.`,
            promptId,
        }).catch((e) => { console.error(config.logPrefix, e); });

        if (isTargetNpc) {
            dispatchSaveResult(campaignName, promptId, targetName, 'WIS', dc, rollNpcSave(targetCreature, dc, targetAdvantage));
        }

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await logSaveSuccess(campaignName, casterName, action, targetName, dc, saveResult, config.rollType, config.logPrefix);
            savedTargets.push(targetName);
        } else {
            charmedCount++;
            await applyCharmFailure({ campaignName, casterName, action, targetName, dc, saveResult, rollType: config.rollType, logPrefix: config.logPrefix });
            charmedTargets.push(targetName);
        }
    }

    const summary = charmedCount > 0
        ? `${charmedCount} creature(s) charmed: ${charmedTargets.join(', ')}. ${savedCount} creature(s) saved: ${savedTargets.join(', ')}.`
        : `No creatures charmed. ${savedCount} creature(s) saved: ${savedTargets.join(', ')}.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
