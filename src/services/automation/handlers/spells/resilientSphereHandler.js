import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';

async function resolveSphereTarget(action, campaignName, casterName) {
    // 2024 rules: target selected via SecondaryTargetModal (passed through metaCtx)
    let targetName = action.metaCtx?.resilientSphereTargetName;

    // 5e rules: use existing resolveTarget (reads from combat context targetName)
    if (!targetName) {
        const targetInfo = await resolveTarget(campaignName, casterName);
        targetName = targetInfo?.target?.name;
    }
    return targetName;
}

async function encloseInResilientSphere(action, auto, casterName, targetName, dc, saveResult, campaignName) {
    // Failed save: apply the sphere enclosure
    const { wasActive } = toggleResilientSphere(
        targetName,
        action.name,
        casterName,
        auto.duration || 'Concentration, up to 1 minute',
        campaignName
    );

    // Add targetEffect for badge rendering (2024 rules)
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const newEffects = [...allTargetEffects, {
        target: targetName,
        effect: 'resilient_sphere',
        source: casterName,
        duration: 'concentration',
    }];
    setRuntimeValue('campaign', 'targetEffects', newEffects, campaignName, true);

    if (!wasActive) {
        addExpiration(casterName, targetName, [
            { type: 'remove_active_buff', buffName: action.name, effect: 'resilient_sphere' },
            { type: 'remove_target_effect', effectKey: 'resilient_sphere', target: targetName, source: casterName }
        ], campaignName);
    }

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Resilient Sphere',
        reason: action.name,
        note: `${targetName} is enclosed in Otiluke's Resilient Sphere. Nothing can pass through the barrier. The sphere is immune to all damage. Inside can't be damaged from outside; inside can't damage outside. Enclosed creature can use action to roll sphere at half speed. Others can pick up and move it. Disintegrate destroys it.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[resilientSphere] Error:", e); });

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['resilient_sphere'],
        appliedDamage: 0,
    });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-resilient-sphere',
        targetName,
        saveDc: dc,
        saveType: 'DEX',
        success: false,
        description: `${targetName} failed DEX save against ${action.name} and is enclosed in a Resilient Sphere.`,
    }).catch((e) => { console.error("[resilientSphere] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed DEX save and is enclosed in a Resilient Sphere. Nothing passes through the barrier. The sphere is immune to all damage. Inside can't be damaged from outside; inside can't damage outside. Creature can use action to roll sphere at half speed. Others can move it. Disintegrate destroys it.`,
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
                description: `No creatures in combat. ${action.name} has no effect.`,
            },
        };
    }

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'DEX',
        saveDc: dc,
        attackScope: 'single',
    });

    const targetName = await resolveSphereTarget(action, campaignName, casterName);

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No target selected. ${action.name} has no effect.`,
            },
        };
    }

    // Check if target is an ally — auto-fail save
    const allyList = getAllyList(casterName);
    const isAlly = allyList.includes(targetName);

    // Ally auto-fails the save — no prompt needed
    const saveResult = isAlly
        ? { success: false, roll: 0, total: 0 }
        : await promptResilientSphereSave(action, auto, campaignName, casterName, targetName, dc);

    if (saveResult.success) {
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
            rollType: 'save-resilient-sphere',
            targetName,
            saveDc: dc,
            saveType: 'DEX',
            success: true,
            description: `${targetName} succeeded on DEX save against ${action.name}.`,
        }).catch((e) => { console.error("[resilientSphere] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on DEX save against ${action.name}.`,
            },
        };
    }

    // Failed save: apply the sphere enclosure
    return encloseInResilientSphere(action, auto, casterName, targetName, dc, saveResult, campaignName);
}

async function promptResilientSphereSave(action, auto, campaignName, casterName, targetName, dc) {
    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'DEX',
        saveDc: dc,
        dcSuccess: 'none',
        disadvantage: !!action.metaCtx?.metamagicHeighten,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a DEX save (DC ${dc}) or be enclosed in a Resilient Sphere.`,
        promptId,
    }).catch((e) => { console.error("[resilientSphere] Error:", e); });

    return await promise;
}

function toggleResilientSphere(targetName, buffName, casterName, duration, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === buffName && b.effect === 'resilient_sphere');

    const newBuffs = wasActive
        ? activeBuffs.filter(b => !(b.name === buffName && b.effect === 'resilient_sphere'))
        : [...activeBuffs, {
            name: buffName,
            effect: 'resilient_sphere',
            duration,
            sourceCharacter: casterName,
        }];

    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);

    return { isActive: !wasActive, wasActive };
}

export function isResilientSphereActive(targetName, campaignName) {
    // Check activeBuffs (works for both 5e and 2024)
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    if (activeBuffs.some(b => b.effect === 'resilient_sphere')) return true;

    // Check targetEffects (2024 version)
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (targetEffects.some(te => te.effect === 'resilient_sphere' && te.target === targetName)) return true;

    return false;
}

export function getResilientSphereSource(targetName, campaignName) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const buff = activeBuffs.find(b => b.effect === 'resilient_sphere');
    if (buff?.sourceCharacter) return buff.sourceCharacter;

    // Check targetEffects for 2024 version
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const te = targetEffects.find(te => te.effect === 'resilient_sphere' && te.target === targetName);
    return te?.source || null;
}
