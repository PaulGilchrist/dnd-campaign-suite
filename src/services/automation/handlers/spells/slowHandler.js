import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

function getTrackingKey(targetName) {
    return `_slow_${targetName.replace(/\s+/g, '_')}`;
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'slow_repeat_save' && te.source === casterName)
    );
    setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
}

export async function processSlowRepeatSave(casterName, targetName, saveDc, campaignName) {
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
        abilityName: 'Slow (repeat save)',
        description: `${targetName} makes a WIS save (DC ${saveDc}) at end of turn (Slow).`,
        promptId,
    }).catch((e) => { console.error("[slow] Error:", e); throw e; });

    const saveResult = await promise;

    if (saveResult.success) {
        // Successful save — remove Slow conditions, clear tracking
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        const filtered = conds.filter(c =>
            String(c).toLowerCase() !== 'slow'
        );
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        setRuntimeValue(casterName, trackingKey, null, campaignName);
        cleanupTargetEffect(casterName, targetName, campaignName);

        // Remove slow-related target effects
        const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
        const filteredEffects = Array.isArray(allTargetEffects) ? allTargetEffects.filter(
            te => !(te.target === targetName && te.effect === 'speed_halved' && te.source === casterName) &&
                  !(te.target === targetName && te.effect === 'no_reactions' && te.source === casterName) &&
                  !(te.target === targetName && te.effect === 'ac_penalty' && te.source === casterName) &&
                  !(te.target === targetName && te.effect === 'dex_save_disadvantage' && te.source === casterName)
        ) : [];
        setRuntimeValue(campaignName, 'targetEffects', filteredEffects, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-slow',
            targetName,
            saveDc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save. Slow ends!`,
        }).catch((e) => { console.error("[slow] Error:", e); throw e; });

        postLogEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Slow',
            reason: 'Slow (successful repeat save)',
            timestamp: Date.now(),
        });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Slow',
                description: `${targetName} succeeded on WIS save. Slow ends!`,
            },
        };
    }

    // Failed save — spell continues, keep tracking
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-slow',
        targetName,
        saveDc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save. Slow continues.`,
    }).catch((e) => { console.error("[slow] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Slow',
            description: `${targetName} failed WIS save. Slow continues.`,
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
                description: 'No creatures in combat. Slow has no effect.',
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
            description: `${casterName} casts Slow! ${targetName} must make a WIS save (DC ${dc}) or be slowed.`,
            promptId,
        }).catch((e) => { console.error("[slow] Error:", e); throw e; });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-slow',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Slow.`,
            }).catch((e) => { console.error("[slow] Error:", e); throw e; });
        } else {
            affectedCount++;

            // Apply slow condition
            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'slow');
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'slow'], campaignName);

            // Set tracking for end-of-turn repeat save
            const trackingKey = getTrackingKey(targetName);
            setRuntimeValue(casterName, trackingKey, true, campaignName);

            // Add expiration for concentration (up to 10 rounds = 1 minute)
            addExpiration(casterName, targetName, [
                { type: 'condition', condition: 'slow' },
            ], campaignName, 10);

            // Store target effects for the slow debuffs
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const effects = Array.isArray(targetEffects) ? targetEffects : [];
            const slowEffect = {
                target: targetName,
                effect: 'speed_halved',
                source: casterName,
                condition: 'slow',
            };
            const noReactionEffect = {
                target: targetName,
                effect: 'no_reactions',
                source: casterName,
            };
            const acPenaltyEffect = {
                target: targetName,
                effect: 'ac_penalty',
                source: casterName,
                value: -2,
            };
            const dexSaveDisadvantageEffect = {
                target: targetName,
                effect: 'dex_save_disadvantage',
                source: casterName,
            };
            const actionLimitEffect = {
                target: targetName,
                effect: 'action_limit',
                source: casterName,
            };
            const singleAttackEffect = {
                target: targetName,
                effect: 'single_attack_limit',
                source: casterName,
            };
            const somaticFailureEffect = {
                target: targetName,
                effect: 'somatic_failure_chance',
                source: casterName,
                chance: 25,
            };
            const slowRepeatSaveEffect = {
                target: targetName,
                effect: 'slow_repeat_save',
                source: casterName,
                dc: dc,
                saveType: 'WIS',
                duration: 'concentration',
            };

            // Remove existing slow effects from this caster for this target
            const existingFiltered = effects.filter(
                te => !(te.target === targetName && te.source === casterName &&
                    ['speed_halved', 'no_reactions', 'ac_penalty', 'dex_save_disadvantage',
                     'action_limit', 'single_attack_limit', 'somatic_failure_chance', 'slow_repeat_save']
                        .includes(te.effect))
            );

            const allEffects = [
                ...existingFiltered,
                slowEffect,
                noReactionEffect,
                acPenaltyEffect,
                dexSaveDisadvantageEffect,
                actionLimitEffect,
                singleAttackEffect,
                somaticFailureEffect,
                slowRepeatSaveEffect,
            ];
            setRuntimeValue(campaignName, 'targetEffects', allEffects, campaignName);

            postLogEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Slow',
                reason: 'Slow spell',
                note: `${targetName} is affected by Slow: Speed halved, -2 AC penalty, disadvantage on DEX saves, no reactions, action OR bonus action (not both), one attack max, 25% somatic spell failure. Repeats WIS save at end of each turn.`,
                timestamp: Date.now(),
            });

            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-slow',
                targetName,
                saveDc: dc,
                saveType: 'WIS',
                success: false,
                description: `${targetName} failed WIS save against Slow. Speed halved, -2 AC, disadvantage on DEX saves, no reactions, action/bonus action (not both), one attack max. Repeats save at end of each turn.`,
            }).catch((e) => { console.error("[slow] Error:", e); throw e; });

            results.push(`${targetName} is slowed.`);
        }
    }

    const summary = affectedCount > 0
        ? `Slow affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures have Speed halved, -2 AC penalty, disadvantage on DEX saves, no reactions, action or bonus action (not both), one attack max, and 25% somatic spell failure chance. Repeats WIS save at end of each turn.`
        : `No creatures affected by Slow. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
