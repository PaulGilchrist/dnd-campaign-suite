import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';

function getImprisonmentEffects() {
    return (getRuntimeValue('campaign', 'targetEffects') || []).filter(te => te.effect === 'imprisonment');
}

/**
 * True when a creature is currently imprisoned.
 */
export function isCreatureTrappedInImprisonment(creatureName) {
    if (!creatureName) return false;
    return getImprisonmentEffects().some(te => te.target === creatureName);
}

/**
 * True when an attack/effect between attacker and target must be blocked by
 * an Imprisonment barrier. Allowed only when both are imprisoned by the same caster.
 */
export function isImprisonmentBlocked(attackerName, targetName, _campaignName) {
    if (!attackerName || !targetName) return false;
    const imprisonmentEffects = getImprisonmentEffects();
    if (imprisonmentEffects.length === 0) return false;

    const attackerTrapped = imprisonmentEffects.some(te => te.target === attackerName);
    const targetTrapped = imprisonmentEffects.some(te => te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
        const attackerSources = imprisonmentEffects
            .filter(te => te.target === attackerName)
            .map(te => te.source);
        return !imprisonmentEffects.some(te => te.target === targetName && attackerSources.includes(te.source));
    }
    return true;
}

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

function rollNpcImprisonmentSave(targetCreature, dc) {
    if (targetCreature) return rollSaveForCreature(targetCreature, 'WIS', dc, false, false);
    const r1 = rollD20();
    const r2 = rollD20();
    const roll = Math.max(r1, r2);
    const total = roll;
    const success = total >= dc;
    return { roll, total, bonus: 0, success, rawRolls: [r1, r2] };
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

    // Resolve the caster's current combat target (no modal — single target)
    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;

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

    const targetCreature = cs.creatures.find(c => c.name === targetName);
    if (!targetCreature) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Target "${targetName}" not found in combat. ${action.name} has no effect.`,
            },
        };
    }

    const isTargetNpc = targetCreature.type !== 'player';

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'single',
    });

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
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or be imprisoned.`,
        promptId,
    }).catch((e) => { console.error("[imprisonment] Error:", e); });

    if (isTargetNpc) {
        dispatchSaveResult(campaignName, promptId, targetName, 'WIS', dc, rollNpcImprisonmentSave(targetCreature, dc));
    }

    const saveResult = await promise;

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
            rollType: 'save-imprisonment',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against ${action.name}.`,
        }).catch((e) => { console.error("[imprisonment] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on WIS save against ${action.name}.`,
            },
        };
    }

    // Failed save: apply imprisonment target effect (badge)
    const prisonType = auto.options?.[0] || 'Slumber';

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const otherEffects = targetEffects.filter(
        te => !(te.target === targetName && te.effect === 'imprisonment' && te.source === casterName)
    );
    setRuntimeValue('campaign', 'targetEffects', [...otherEffects, {
        effect: 'imprisonment',
        target: targetName,
        source: casterName,
        prisonType,
        duration: 'Until dispelled',
    }], campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });

    // Track for expiration cleanup (badge removal)
    addExpiration(casterName, targetName, [
        { type: 'remove_target_effect', effectKey: 'imprisonment', target: targetName, source: casterName },
    ], campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-imprisonment',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} and is imprisoned (${prisonType}).`,
    }).catch((e) => { console.error("[imprisonment] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Imprisoned',
        reason: action.name,
        note: `${targetName} is imprisoned (${prisonType}) by ${action.name}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[imprisonment] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is imprisoned (${prisonType}).`,
        },
    };
}
