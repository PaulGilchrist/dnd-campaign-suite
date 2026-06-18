import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

/**
 * Stinking Cloud spell handler for 2024 ruleset.
 * Mechanics:
 * - 20-foot-radius Sphere of yellow, nauseating gas, Heavily Obscured
 * - Concentration, up to 1 minute
 * - CON save or Poisoned condition until end of current turn
 * - While Poisoned by Stinking Cloud: can't take Action or Bonus Action
 * - Strong wind (Gust of Wind) disperses the cloud
 */

function getTrackingKey(targetName) {
    return `_stinking_cloud_${targetName.replace(/\s+/g, '_')}`;
}

function cleanupTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const cleaned = effects.filter(
        te => !(te.target === targetName && te.effect === 'stinking_cloud_repeat_save' && te.source === casterName)
    );
    setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
}

export async function processStinkingCloudRepeatSave(casterName, targetName, saveDc, campaignName) {
    const trackingKey = getTrackingKey(targetName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);
    if (!tracking) {
        return null;
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Stinking Cloud (repeat save)',
        description: `${targetName} makes a CON save (DC ${saveDc}) at end of turn (Stinking Cloud).`,
        promptId,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    const saveResult = await promise;

    if (saveResult.success) {
        // Save succeeded — remove Poisoned condition, clear tracking
        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conds = Array.isArray(storedConds) ? storedConds : [];
        setRuntimeValue(targetName, 'activeConditions', conds.filter(c => String(c).toLowerCase() !== 'poisoned'), campaignName);
        setRuntimeValue(casterName, trackingKey, null, campaignName);
        cleanupTargetEffect(casterName, targetName, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-stinking-cloud',
            targetName,
            saveDc,
            saveType: 'CON',
            success: true,
            description: `${targetName} succeeded on CON save. Stinking Cloud ends!`,
        }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

        postLogEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Poisoned',
            reason: 'Stinking Cloud (successful repeat save)',
            timestamp: Date.now(),
        });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Stinking Cloud',
                description: `${targetName} succeeded on CON save. Stinking Cloud ends!`,
            },
        };
    }

    // Save failed — Poisoned already applied, keep tracking for next turn
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-stinking-cloud',
        targetName,
        saveDc,
        saveType: 'CON',
        success: false,
        description: `${targetName} failed CON save and remains Poisoned by Stinking Cloud.`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Stinking Cloud',
            description: `${targetName} failed CON save and remains Poisoned.`,
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
                description: 'No creatures in combat. Stinking Cloud has no effect.',
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

        // Check for poison immunity
        if (playerStats.immunities && Array.isArray(playerStats.immunities)) {
            const hasPoisonImmunity = playerStats.immunities.some(
                imm => String(imm).toLowerCase() === 'poison'
            );
            if (hasPoisonImmunity) {
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: casterName,
                    abilityName: action.name,
                    description: `${targetName} is immune to Stinking Cloud (Poison immunity).`,
                }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });
                results.push(`${targetName} is immune to Stinking Cloud.`);
                continue;
            }
        }

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'CON',
            saveDc: dc,
            dcSuccess: 'none',
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Stinking Cloud! ${targetName} must make a CON save (DC ${dc}) or become Poisoned.`,
            promptId,
        }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-stinking-cloud',
                targetName,
                saveDc: dc,
                saveType: 'CON',
                success: true,
                description: `${targetName} succeeded on CON save against Stinking Cloud.`,
            }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });
        } else {
            affectedCount++;

            // Apply Poisoned condition
            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'poisoned');
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'poisoned'], campaignName);

            // Set tracking for end-of-turn repeat save
            const trackingKey = getTrackingKey(targetName);
            setRuntimeValue(casterName, trackingKey, true, campaignName);

            // Add expiration for concentration
            addExpiration(casterName, targetName, [
                { type: 'poisoned', condition: 'poisoned' },
            ], campaignName, 10);

            // Store target effect for end-of-turn repeated saves
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const effects = Array.isArray(targetEffects) ? targetEffects : [];
            const existingIdx = effects.findIndex(
                te => te.target === targetName && te.effect === 'stinking_cloud_repeat_save'
            );
            const stinkingCloudEffect = {
                target: targetName,
                effect: 'stinking_cloud_repeat_save',
                source: casterName,
                condition: 'poisoned',
                dc: dc,
                saveType: 'CON',
                duration: 'concentration',
            };
            if (existingIdx >= 0) {
                effects[existingIdx] = stinkingCloudEffect;
            } else {
                effects.push(stinkingCloudEffect);
            }
            setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);

            postLogEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Poisoned',
                reason: 'Stinking Cloud spell',
                note: `${targetName} is Poisoned by Stinking Cloud. While Poisoned, the creature can't take an Action or Bonus Action. At the end of its next turn, it repeats the save. Failure means remaining Poisoned.`,
                timestamp: Date.now(),
            });

            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-stinking-cloud',
                targetName,
                saveDc: dc,
                saveType: 'CON',
                success: false,
                description: `${targetName} failed CON save against Stinking Cloud and is Poisoned. At the end of its next turn, it repeats the save.`,
            }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

            results.push(`${targetName} is Poisoned.`);
        }
    }

    const summary = affectedCount > 0
        ? `Stinking Cloud affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures are Poisoned (can't take Actions or Bonus Actions) until the end of their current turn. At the end of each of their turns, they repeat the save. Failure means remaining Poisoned.`
        : `No creatures affected by Stinking Cloud. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
