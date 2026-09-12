import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';


function isImmuneToParalysis(targetCreature, targetConditions) {
    const targetImmunities = targetCreature?.immunities || [];
    const allImmunities = [...new Set([...targetImmunities, ...(targetConditions.includes('petrified') ? ['paralyzed'] : [])])];
    return allImmunities.some(i => String(i).toLowerCase() === 'paralyzed');
}

function isUnseeableInvisible(targetConditions, casterCreature) {
    const targetInvisible = targetConditions.some(c => String(c).toLowerCase() === 'invisible');
    const casterSenses = casterCreature?.senses || [];
    const hasTruesight = casterSenses.some(s => String(s.name || s.type || '').toLowerCase() === 'truesight');
    const hasBlindsight = casterSenses.some(s => String(s.name || s.type || '').toLowerCase() === 'blindsight');
    return targetInvisible && !hasTruesight && !hasBlindsight;
}

async function applyParalyzedOnFail({ campaignName, auto, playerStats, action, casterName, cs, casterCreature, targetName, dc, saveResult }) {
    // Failed save: apply Paralyzed condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'paralyzed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'paralyzed'], campaignName);

    // Store condition metadata with DC and ability for recurring save (Hold Person/Monster repeat the WIS save)
    const repeatSaveAbility = String(auto.saveType || 'WIS').toLowerCase() || 'wis';
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        paralyzed: {
            ...(existingMeta.paralyzed || {}),
            dc,
            ability: repeatSaveAbility,
        },
    }, campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['paralyzed'],
        appliedDamage: 0,
    });

    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'paralyzed' },
    ], campaignName);

    const concentrationDc = 8 + (playerStats.proficiency || 2) + (playerStats.abilities?.CON?.bonus ?? 0);
    if (casterCreature) {
        addConcentration(cs, casterName, action.name, concentrationDc);
    }

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-hold-monster',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} and is Paralyzed.`,
    }).catch((e) => { console.error("[holdMonster] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Paralyzed',
        reason: action.name,
        note: `${targetName} is Paralyzed by ${action.name}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[holdMonster] Error:", e); });
}

// Get target names from metaCtx (multi-target) or resolveTarget (single)
async function selectHoldTargets(action, campaignName, casterName) {
    const holdMonsterTargets = action.metaCtx?.holdMonsterTargets;
    const holdPersonTargets = action.metaCtx?.holdPersonTargets;

    if (holdMonsterTargets && Array.isArray(holdMonsterTargets) && holdMonsterTargets.length > 0) {
        return { targetNames: holdMonsterTargets };
    }
    if (holdPersonTargets && Array.isArray(holdPersonTargets) && holdPersonTargets.length > 0) {
        return { targetNames: holdPersonTargets };
    }
    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;
    if (!targetName) {
        return { popup: `No target selected. ${action.name} has no effect.` };
    }
    return { targetNames: [targetName] };
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
                description: `No creatures in combat. ${action.name} has no effect.`,
            },
        };
    }

    const casterName = playerStats.name;
    const casterCreature = cs.creatures.find(c => c.name === casterName);

    const selection = await selectHoldTargets(action, campaignName, casterName);
    if (selection.popup) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: selection.popup,
            },
        };
    }
    const targetNames = selection.targetNames;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'single',
    });

    let paralyzedCount = 0;
    let savedCount = 0;
    const paralyzedTargets = [];
    const savedTargets = [];

    for (const targetName of targetNames) {
        const targetCreature = cs.creatures.find(c => c.name === targetName);
        if (!targetCreature) {
            savedCount++;
            savedTargets.push(`${targetName} (not found)`);
            continue;
        }

        const targetConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        if (isImmuneToParalysis(targetCreature, targetConditions)) {
            savedCount++;
            savedTargets.push(`${targetName} (immune)`);
            continue;
        }

        if (isUnseeableInvisible(targetConditions, casterCreature)) {
            savedCount++;
            savedTargets.push(`${targetName} (invisible)`);
            continue;
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
            description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or become Paralyzed.`,
            promptId,
        }).catch((e) => { console.error("[holdMonster] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await recordHoldTargetResult(campaignName, targetName, saveResult, 'success');
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-hold-monster',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against ${action.name}.`,
            }).catch((e) => { console.error("[holdMonster] Error:", e); });
            savedTargets.push(targetName);
        } else {
            paralyzedCount++;
            await applyParalyzedOnFail({ campaignName, auto, playerStats, action, casterName, cs, casterCreature, targetName, dc, saveResult });
            paralyzedTargets.push(targetName);
        }
    }

    const summary = paralyzedCount > 0
        ? `${paralyzedCount} creature(s) paralyzed: ${paralyzedTargets.join(', ')}. ${savedCount} creature(s) saved: ${savedTargets.join(', ')}.`
        : `No creatures paralyzed. ${savedCount} creature(s) saved: ${savedTargets.join(', ')}.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

async function recordHoldTargetResult(campaignName, targetName, saveResult, saveOutcome) {
    await addTargetResult(campaignName, {
        targetName,
        saveResult: saveOutcome,
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
}
