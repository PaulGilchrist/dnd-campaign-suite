import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

/**
 * Tasha's Hideous Laughter spell handler for 2024 ruleset.
 * Mechanics:
 * - WIS save or Prone + Incapacitated conditions for duration
 * - At end of target's turn: repeat WIS save (Advantage if triggered by damage)
 * - Each time target takes damage: repeat WIS save (Advantage)
 * - Successful save ends the spell
 * - Concentration, up to 1 minute
 * - Higher level: one additional creature per slot level above 1
 */

function getTrackingKey(targetName) {
    return `_tashas_laughter_${targetName.replace(/\s+/g, '_')}`;
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'tashas_laughter_repeat_save' && te.source === casterName)
    );
    setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
}

export async function processTashasLaughterRepeatSave(casterName, targetName, saveDc, campaignName) {
    const trackingKey = getTrackingKey(targetName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (!tracking) {
        return null;
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc,
        dcSuccess: 'none',
        advantage: true,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: "Tasha's Hideous Laughter (repeat save)",
        description: `${targetName} makes a WIS save (DC ${saveDc}) at end of turn (Tasha's Hideous Laughter).`,
        promptId,
    }).catch((e) => { console.error("[tashasLaughter] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        // Save succeeded — remove conditions, clear tracking
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        const filtered = conds.filter(c =>
            String(c).toLowerCase() !== 'prone' &&
            String(c).toLowerCase() !== 'incapacitated'
        );
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        setRuntimeValue(casterName, trackingKey, null, campaignName);
        setRuntimeValue(targetName, `tashas_laughter_${targetName.replace(/\s+/g, '_')}_damageTrigger`, false, campaignName);
        cleanupTargetEffect(casterName, targetName, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-tashas-laughter',
            targetName,
            saveDc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save. Tasha's Hideous Laughter ends!`,
        }).catch((e) => { console.error("[tashasLaughter] Error:", e); });

        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Prone, Incapacitated',
            reason: "Tasha's Hideous Laughter (successful repeat save)",
            timestamp: Date.now(),
        }).catch((e) => { console.error("[tashasLaughter] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Tasha's Hideous Laughter",
                description: `${targetName} succeeded on WIS save. Tasha's Hideous Laughter ends!`,
            },
        };
    }

    // Save failed — keep conditions, keep tracking for next turn
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-tashas-laughter',
        targetName,
        saveDc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save and remains Prone and Incapacitated.`,
    }).catch((e) => { console.error("[tashasLaughter] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: "Tasha's Hideous Laughter",
            description: `${targetName} failed WIS save and remains Prone and Incapacitated.`,
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
                description: "No creatures in combat. Tasha's Hideous Laughter has no effect.",
            },
        };
    }

    const casterName = playerStats.name;
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
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Tasha's Hideous Laughter! ${targetName} must make a WIS save (DC ${dc}) or become Prone and Incapacitated.`,
            promptId,
        }).catch((e) => { console.error("[tashasLaughter] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-tashas-laughter',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Tasha's Hideous Laughter.`,
            }).catch((e) => { console.error("[tashasLaughter] Error:", e); });
        } else {
            affectedCount++;

            // Apply Prone + Incapacitated conditions
            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c =>
                String(c).toLowerCase() !== 'prone' &&
                String(c).toLowerCase() !== 'incapacitated'
            );
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'prone', 'incapacitated'], campaignName);

            // Set tracking for end-of-turn repeat save
            const trackingKey = getTrackingKey(targetName);
            setRuntimeValue(casterName, trackingKey, true, campaignName);

            // Set damage trigger flag for damage-triggered repeat save
            setRuntimeValue(targetName, `tashas_laughter_${targetName.replace(/\s+/g, '_')}_damageTrigger`, true, campaignName);

            // Add expiration for concentration - conditions removed after duration
            addExpiration(casterName, targetName, [
                { type: 'condition', condition: 'prone' },
                { type: 'condition', condition: 'incapacitated' },
                { type: 'tashas_laughter_expiration' },
            ], campaignName);

            // Store target effect for end-of-turn repeated saves
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const effects = Array.isArray(targetEffects) ? targetEffects : [];
            const existingIdx = effects.findIndex(
                te => te.target === targetName && te.effect === 'tashas_laughter_repeat_save'
            );
            const laughterEffect = {
                target: targetName,
                effect: 'tashas_laughter_repeat_save',
                source: casterName,
                dc: dc,
                saveType: 'WIS',
                duration: 'concentration',
            };
            if (existingIdx >= 0) {
                effects[existingIdx] = laughterEffect;
            } else {
                effects.push(laughterEffect);
            }
            setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

            addEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Prone, Incapacitated',
                reason: "Tasha's Hideous Laughter spell",
                note: `${targetName} is Prone and Incapacitated by Tasha's Hideous Laughter. The target can't end the Prone condition on itself. At the end of each of its turns and each time it takes damage, it repeats the WIS save with Advantage (if triggered by damage).`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[tashasLaughter] Error:", e); });

            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-tashas-laughter',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: false,
                description: `${targetName} failed WIS save against Tasha's Hideous Laughter and is Prone and Incapacitated. At the end of each of its turns and each time it takes damage, it repeats the save.`,
            }).catch((e) => { console.error("[tashasLaughter] Error:", e); });

            results.push(`${targetName} is Prone and Incapacitated.`);
        }
    }

    const summary = affectedCount > 0
        ? `Tasha's Hideous Laughter affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures are Prone and Incapacitated. At the end of each of their turns and each time they take damage, they repeat the WIS save (Advantage if triggered by damage).`
        : `No creatures affected by Tasha's Hideous Laughter. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
