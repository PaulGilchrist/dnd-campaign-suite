import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { playerIsImmuneToCondition } from '../../../combat/automation/automationImmunities.js';
import { getEffectDefinition } from '../../../combat/conditions/targetEffectDefinitions.js';

/**
 * Web spell handler for 2024 ruleset.
 * Mechanics:
 * - 60-foot range, 20-foot Cube of sticky webbing
 * - Concentration, up to 1 hour
 * - DEX save at cast for every creature in the area — Restrained on failure
 * - Zone tracking lives under `_web_<caster>` on the caster's store
 *   (SP-108 sleetStorm pattern); a `web` zone te marks every creature in the
 *   area. expireStaleEffects Phase 5 re-forces a recurring STR save at each
 *   carrier's TURN START — Restrained on failure; success leaves it free.
 *   Already-Restrained creatures skip the recurring save (breaking free via
 *   a STR (Athletics) action is a GM-adjudicated residual).
 * - Expires at spell end (1 hour = 600 rounds, CLA-334 encoding) or when
 *   concentration breaks (duration:'concentration' te sweep).
 * Accepted gaps (no consumers in this engine): Difficult Terrain / Lightly
 * Obscured prose, STR (Athletics) break-free modal, anchoring/collapse,
 * flammability / 2d4 fire / burn-away.
 */

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
                description: 'No creatures in combat. Web has no effect.',
            },
        };
    }

    // Get selected targets from metaCtx — includes ALL creatures (including caster)
    const selectedTargetNames = action.metaCtx?.targets || cs.creatures.map(c => c.name);
    const targets = cs.creatures.filter(c => selectedTargetNames.includes(c.name));

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures selected for Web.',
            },
        };
    }

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'DEX',
        saveDc: dc,
        attackScope: 'aoe',
    });

    // Store the web zone area for recurring turn-start saves
    // (SP-108 sleetStorm `_sleetStorm_<caster>` pattern).
    const trackingKey = `_web_${casterName.replace(/\s+/g, '_')}`;
    setRuntimeValue(casterName, trackingKey, {
        caster: casterName,
        mapName: _mapName,
        campaignName,
        saveDc: dc,
        saveType: 'DEX',
        radius: 20, // 20-foot cube
        timestamp: Date.now(),
        duration: auto.duration || action.spell?.duration || 'Concentration, up to 1 hour',
    }, campaignName);

    // Zone marker te for every creature in the area (registry 'web') — the
    // expireStaleEffects Phase 5 seam re-forces a save for each carrier at
    // its turn start while concentration persists.
    if (!getEffectDefinition('web')) {
        console.error('[webAreaSaveHandler] "web" missing from targetEffectDefinitions registry');
    }
    const storedZoneEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const zoneEffects = Array.isArray(storedZoneEffects) ? [...storedZoneEffects] : [];
    for (const zoneTarget of targets) {
        const webEffect = {
            target: zoneTarget.name,
            effect: 'web',
            source: casterName,
            dc: dc,
            duration: 'concentration',
        };
        const existingIdx = zoneEffects.findIndex(
            te => te.target === zoneTarget.name && te.effect === 'web' && te.source === casterName
        );
        if (existingIdx >= 0) {
            zoneEffects[existingIdx] = webEffect;
        } else {
            zoneEffects.push(webEffect);
        }
    }
    setRuntimeValue('campaign', 'targetEffects', zoneEffects, campaignName);

    // Expiration: the zone lasts at most 1 hour (600 rounds — CLA-334
    // minutes-as-rounds encoding) even with sustained concentration; the
    // zone te + tracking key are swept here, concentration loss sweeps the
    // duration:'concentration' tes separately via cleanupConcentrationEffects.
    const durationRounds = (() => {
        const lower = (auto.duration || action.spell?.duration || 'Concentration, up to 1 hour').toLowerCase();
        const hourMatch = lower.match(/(\d+)\s*_?\s*hour/);
        if (hourMatch) return parseInt(hourMatch[1], 10) * 600;
        const minuteMatch = lower.match(/(\d+)\s*_?\s*minute/);
        if (minuteMatch) return parseInt(minuteMatch[1], 10) * 10;
        const roundMatch = lower.match(/(\d+)\s*_?round/);
        if (roundMatch) return parseInt(roundMatch[1], 10);
        return undefined;
    })();

    if (durationRounds) {
        addExpiration(casterName, casterName, [
            { type: 'clear_runtime_value', creatureName: casterName, key: trackingKey },
            { type: 'remove_target_effect', effectKey: 'web', source: casterName },
        ], campaignName, durationRounds);
    }

    // Register concentration for this spell
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Web', concentrationDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    let affectedCount = 0;
    let savedCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'DEX',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage: action.metaCtx?.heightenTarget === targetName,
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Web! ${targetName} must make a DEX save (DC ${dc}) or become Restrained by sticky webbing.`,
            promptId,
        }).catch((e) => { console.error("[web] Error:", e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
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
                rollType: 'save-web',
                targetName,
                saveDc: dc,
                saveType: 'DEX',
                success: true,
                description: `${targetName} succeeded on DEX save against Web.`,
            }).catch((e) => { console.error("[web] Error:", e); });
        } else {
            affectedCount++;

            // Apply Restrained condition
            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained');
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'restrained'], campaignName);

            // Store condition metadata with DC and ability for recurring STR save
            const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
            setRuntimeValue(targetName, 'activeConditionMeta', {
                ...existingMeta,
                restrained: {
                    ...(existingMeta.restrained || {}),
                    dc,
                    ability: 'str',
                },
            }, campaignName);

            await addTargetResult(campaignName, {
                targetName,
                saveResult: 'failure',
                roll: saveResult.roll ?? 0,
                total: saveResult.total ?? 0,
                conditions: ['restrained'],
                appliedDamage: 0,
            });

            // Add expiration for concentration — Restrained removed when the
            // spell ends (600 rounds) — ONE merged entry (two sequential
            // addExpiration calls race server-side, playbook 42ab).
            addExpiration(casterName, targetName, [
                { type: 'condition', condition: 'restrained' },
            ], campaignName, durationRounds);

            addEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Restrained',
                reason: 'Web spell',
                note: `${targetName} is Restrained by Web: Speed is 0, attack rolls against you have Advantage, your attack rolls have Disadvantage, and you have Disadvantage on Dexterity saving throws. STR save (DC ${dc}) each turn or remain Restrained.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[web] Error:", e); });

            addEntry(campaignName, {
                type: 'save_result',
                characterName: casterName,
                rollType: 'save-web',
                targetName,
                saveDc: dc,
                saveType: 'DEX',
                success: false,
                description: `${targetName} failed DEX save against Web. Becomes Restrained by sticky webbing.`,
            }).catch((e) => { console.error("[web] Error:", e); });

            results.push(`${targetName} is Restrained.`);
        }
    }

    const summary = affectedCount > 0
        ? `Web affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures are Restrained (Speed 0, attack rolls against them have Advantage, their attacks have Disadvantage, Disadvantage on DEX saves). Restrained creatures can use their action to make a STR (Athletics) check vs DC ${dc} to break free.`
        : `No creatures affected by Web. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

export async function processWebAreaSave(casterName, targetName, campaignName, mapName) {
    const trackingKey = `_web_${casterName.replace(/\s+/g, '_')}`;
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);

    if (!tracking || !tracking.saveDc) {
        return null;
    }

    if (mapName) {
        try {
            const inArea = await isWithinRange(casterName, targetName, tracking.radius);
            if (!inArea) return null;
        } catch (error) {
            // If map data unavailable, proceed with save
            console.warn('[webAreaSaveHandler] Map data unavailable, proceeding with save:', error);
        }
    }

    const existingConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const isAlreadyRestrained = existingConditions.some(c => String(c).toLowerCase() === 'restrained');
    if (isAlreadyRestrained) return null;

    const targetCharacter = getCombatContext(campaignName)?.creatures?.find(c => c.name === targetName);
    if (targetCharacter?.type === 'player') {
        const targetStats = {
            computedStats: getRuntimeValue(targetName, 'computedStats', campaignName),
        };
        if (playerIsImmuneToCondition({
            conditionKey: 'restrained',
            playerStats: targetStats,
            getRuntimeValue,
            campaignName,
        })) {
            return null;
        }
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'STR',
        saveDc: tracking.saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Web',
        description: `${targetName} must make a STR save (DC ${tracking.saveDc}) or become Restrained (Web area).`,
        promptId,
    }).catch((e) => { console.error("[webAreaSave] Error:", e); });

    const saveResult = await promise;

    if (!saveResult.success) {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'restrained'], campaignName);

        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'failure',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: ['restrained'],
            appliedDamage: 0,
        });

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-web',
            targetName,
            saveDc: tracking.saveDc,
            saveType: 'STR',
            success: false,
            description: `${targetName} failed STR save against Web. Becomes Restrained.`,
        }).catch((e) => { console.error("[webAreaSave] Error:", e); });
    } else {
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
            rollType: 'save-web',
            targetName,
            saveDc: tracking.saveDc,
            saveType: 'STR',
            success: true,
            description: `${targetName} succeeded on STR save against Web.`,
        }).catch((e) => { console.error("[webAreaSave] Error:", e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Web',
            description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} the STR save (DC ${tracking.saveDc}). ${!saveResult.success ? 'Becomes Restrained.' : 'Unaffected.'}`,
        },
    };
}
