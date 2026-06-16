import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

/**
 * Sleep spell handler for 2024 ruleset.
 * Mechanics:
 * - WIS save or Incapacitated until end of target's next turn
 * - At end of target's next turn: repeat save; failure = Unconscious for duration
 * - Spell ends if target takes damage
 * - Spell ends if someone within 5ft takes action to shake target
 * - Creatures with "Magical Sleep" or "Exhaustion" immunity auto-succeed
 */

function getTrackingKey(targetName) {
    return `_sleep_${targetName.replace(/\s+/g, '_')}`;
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'sleep_repeat_save' && te.source === casterName)
    );
    setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
}

export async function processSleepRepeatSave(casterName, targetName, saveDc, campaignName) {
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
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Sleep (repeat save)',
        description: `${targetName} makes a WIS save (DC ${saveDc}) at end of turn (Sleep).`,
        promptId,
    }).catch(() => {});

    const saveResult = await promise;

    if (saveResult.success) {
        // First save succeeded — remove Incapacitated, clear tracking
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        setRuntimeValue(targetName, 'activeConditions', conds.filter(c => String(c).toLowerCase() !== 'incapacitated'), campaignName);
        setRuntimeValue(casterName, trackingKey, null, campaignName);
        cleanupTargetEffect(casterName, targetName, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-sleep',
            targetName,
            saveDc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save. Sleep ends!`,
        }).catch(() => {});

        postLogEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Incapacitated',
            reason: 'Sleep (successful repeat save)',
            timestamp: Date.now(),
        });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sleep',
                description: `${targetName} succeeded on WIS save. Sleep ends!`,
            },
        };
    }

    // Second save failed — apply Unconscious, clear tracking
    const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conds = Array.isArray(storedConds) ? storedConds : [];
    setRuntimeValue(targetName, 'activeConditions', [...conds.filter(c => String(c).toLowerCase() !== 'unconscious'), 'unconscious'], campaignName);
    setRuntimeValue(casterName, trackingKey, null, campaignName);
    cleanupTargetEffect(casterName, targetName, campaignName);

    postLogEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Unconscious',
        reason: 'Sleep (failed repeat save)',
        note: `${targetName} is now Unconscious for the duration of Sleep.`,
        timestamp: Date.now(),
    });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-sleep',
        targetName,
        saveDc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save and is now Unconscious.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Sleep',
            description: `${targetName} failed WIS save and is now Unconscious.`,
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
                description: 'No creatures in combat. Sleep has no effect.',
            },
        };
    }

    const casterName = playerStats.name;
    const targets = cs.creatures.filter(c => c.name !== casterName);

    let affectedCount = 0;
    let savedCount = 0;
    let immunityCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        // Check for immunities: Magical Sleep or Exhaustion immunity
        const targetImmunities = target.immunities || [];
        const hasMagicalSleepImmunity = targetImmunities.some(
            imm => String(imm).toLowerCase() === 'magical sleep'
        );
        const hasExhaustionImmunity = targetImmunities.some(
            imm => String(imm).toLowerCase() === 'exhaustion'
        );

        if (hasMagicalSleepImmunity || hasExhaustionImmunity) {
            immunityCount++;
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: casterName,
                abilityName: action.name,
                description: `${targetName} is immune to Sleep (does not sleep / Exhaustion immunity).`,
            }).catch(() => {});
            results.push(`${targetName} is immune to Sleep.`);
            continue;
        }

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
            description: `${casterName} casts Sleep! ${targetName} must make a WIS save (DC ${dc}) or become Incapacitated.`,
            promptId,
        }).catch(() => {});

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-sleep',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Sleep.`,
            }).catch(() => {});
        } else {
            affectedCount++;

            // Apply Incapacitated condition
            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'incapacitated');
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'incapacitated'], campaignName);

            // Set tracking for end-of-turn repeat save
            const trackingKey = getTrackingKey(targetName);
            setRuntimeValue(casterName, trackingKey, true, campaignName);

            // Add expiration for concentration
            addExpiration(casterName, targetName, [
                { type: 'incapacitated', condition: 'incapacitated' },
            ], campaignName, 10);

            // Store target effect for end-of-turn repeated saves
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const effects = Array.isArray(targetEffects) ? targetEffects : [];
            const existingIdx = effects.findIndex(
                te => te.target === targetName && te.effect === 'sleep_repeat_save'
            );
            const sleepEffect = {
                target: targetName,
                effect: 'sleep_repeat_save',
                source: casterName,
                condition: 'incapacitated',
                dc: dc,
                saveType: 'WIS',
                duration: 'concentration',
            };
            if (existingIdx >= 0) {
                effects[existingIdx] = sleepEffect;
            } else {
                effects.push(sleepEffect);
            }
            setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

            postLogEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Incapacitated',
                reason: 'Sleep spell',
                note: `${targetName} is Incapacitated by Sleep. At the end of its next turn, it repeats the save. Failure means Unconscious for the duration. The spell ends if the target takes damage or someone within 5ft shakes it.`,
                timestamp: Date.now(),
            });

            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-sleep',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: false,
                description: `${targetName} failed WIS save against Sleep and is Incapacitated. At the end of each of its turns, it repeats the save.`,
            }).catch(() => {});

            results.push(`${targetName} is Incapacitated.`);
        }
    }

    const summary = affectedCount > 0
        ? `Sleep affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. ${immunityCount} creature(s) immune. Affected creatures are Incapacitated until the end of their next turn, then repeat the save. Failure on the second save means Unconscious for the duration. The spell ends if a target takes damage or someone within 5ft shakes it.`
        : `No creatures affected by Sleep. ${savedCount} creature(s) saved. ${immunityCount} creature(s) immune.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
