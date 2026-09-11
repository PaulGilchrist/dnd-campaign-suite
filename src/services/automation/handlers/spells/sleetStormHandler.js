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
import { breakConcentration } from '../../../combat/concentration/concentrationService.js';

/**
 * Sleet Storm spell handler for 2024 ruleset.
 * Mechanics:
 * - 150-foot range, 40-foot-tall 20-foot-radius Cylinder
 * - Heavily Obscured area, exposed flames doused
 * - Difficult Terrain in the Cylinder
 * - Concentration, up to 1 minute
 * - DEX save on entry or start of turn — Prone + lose Concentration on failure
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
                description: 'No creatures in combat. Sleet Storm has no effect.',
            },
        };
    }

    // Get selected targets from metaCtx; if none, use all creatures
    const selectedTargetNames = action.metaCtx?.targets || cs.creatures.map(c => c.name);
    const targets = cs.creatures.filter(c => selectedTargetNames.includes(c.name));

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures selected for Sleet Storm.',
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

    // Store sleet storm area tracking for recurring saves
    const trackingKey = `_sleetStorm_${casterName.replace(/\s+/g, '_')}`;
    setRuntimeValue(casterName, trackingKey, {
        caster: casterName,
        mapName: _mapName,
        campaignName,
        saveDc: dc,
        saveType: 'DEX',
        radius: 20, // 20-foot-radius cylinder
        timestamp: Date.now(),
        duration: auto.duration || 'Concentration, up to 1 minute',
    }, campaignName);

    // Set expiration for the sleet storm area
    const durationRounds = (() => {
        const lower = (auto.duration || '').toLowerCase();
        if (lower.startsWith('1_minute')) return 10;
        const match = lower.match(/(\d+)_round/);
        if (match) return parseInt(match[1], 10);
        return undefined;
    })();

    if (durationRounds) {
        addExpiration(casterName, casterName, [
            { type: 'remove_sleet_storm_area', sleetKey: trackingKey }
        ], campaignName, durationRounds);
    }

    // Register concentration for this spell
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Sleet Storm', concentrationDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    let affectedCount = 0;
    let savedCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        // Check for prone immunity on each target individually
        if (isProneImmune(target)) {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: casterName,
                abilityName: action.name,
                description: `${targetName} is immune to Sleet Storm (Prone immunity).`,
            }).catch((e) => { console.error("[sleetStorm] Error:", e); });
            results.push(`${targetName} is immune.`);
            savedCount++;
            continue;
        }

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
            description: `${casterName} casts Sleet Storm! ${targetName} must make a DEX save (DC ${dc}) or become Prone and lose Concentration.`,
            promptId,
        }).catch((e) => { console.error("[sleetStorm] Error:", e); });

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
                rollType: 'save-sleet-storm',
                targetName,
                saveDc: dc,
                saveType: 'DEX',
                success: true,
                description: `${targetName} succeeded on DEX save against Sleet Storm.`,
            }).catch((e) => { console.error("[sleetStorm] Error:", e); });
        } else {
            affectedCount++;
            await applySleetStormProneTarget(campaignName, casterName, targetName, dc, saveResult);
            results.push(`${targetName} is Prone and loses Concentration.`);
        }
    }

    const summary = affectedCount > 0
        ? `Sleet Storm affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. Affected creatures are Prone and lose Concentration.`
        : `No creatures affected by Sleet Storm. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

function isProneImmune(target) {
    const targetImmunities = target.weaknessesAndResistivities?.immunities || [];
    return Array.isArray(targetImmunities) && targetImmunities.some(
        imm => String(imm).toLowerCase() === 'prone'
    );
}

async function applySleetStormProneTarget(campaignName, casterName, targetName, dc, saveResult) {
    // Apply Prone condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'prone');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'prone'], campaignName);

    // Store condition metadata with DC and ability for recurring DEX save
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        prone: {
            ...(existingMeta.prone || {}),
            dc,
            ability: 'dex',
            source: 'sleet_storm',
        },
    }, campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['prone'],
        appliedDamage: 0,
    });

    // Add expiration for concentration — Prone removed when concentration breaks
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'prone' },
    ], campaignName);

    // Actually break concentration for this creature if they have one
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const brokenSpell = breakConcentration(combatSummary, targetName);
        if (brokenSpell) {
            storage.set('combatSummary', combatSummary, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            addEntry(campaignName, {
                type: 'concentration_lost',
                characterName: targetName,
                spellName: brokenSpell,
                reason: 'Sleet Storm spell',
                note: `${targetName} lost concentration on ${brokenSpell} due to Sleet Storm.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[sleetStorm] Error:", e); });
        }
    }

    // Track concentration loss for this creature
    const casterConcentrationKey = `_sleetStorm_concentration_${casterName.replace(/\s+/g, '_')}`;
    const existingConcentration = getRuntimeValue(casterName, casterConcentrationKey, campaignName) || [];
    const concentrationList = Array.isArray(existingConcentration) ? [...existingConcentration] : [];
    if (!concentrationList.includes(targetName)) {
        concentrationList.push(targetName);
        setRuntimeValue(casterName, casterConcentrationKey, concentrationList, campaignName);
    }

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Prone',
        reason: 'Sleet Storm spell',
        note: `${targetName} is Prone by Sleet Storm and loses Concentration.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[sleetStorm] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-sleet-storm',
        targetName,
        saveDc: dc,
        saveType: 'DEX',
        success: false,
        description: `${targetName} failed DEX save against Sleet Storm. Becomes Prone and loses Concentration.`,
    }).catch((e) => { console.error("[sleetStorm] Error:", e); });

    // Track Sleet Storm effect with concentration duration for cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const sleetEffect = {
        target: targetName,
        effect: 'sleet_storm',
        source: casterName,
        conditions: ['prone'],
        dc: dc,
        duration: 'concentration',
        lostConcentration: true,
    };
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'sleet_storm'
    );
    if (existingIdx >= 0) {
        effects[existingIdx] = sleetEffect;
    } else {
        effects.push(sleetEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
}

export async function processSleetStormAreaSave(casterName, targetName, campaignName, _mapName) {
    const trackingKey = `_sleetStorm_${casterName.replace(/\s+/g, '_')}`;
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);

    if (!tracking || !tracking.saveDc) {
        return null;
    }

    if (_mapName) {
        try {
            const inArea = await isWithinRange(casterName, targetName, tracking.radius);
            if (!inArea) return null;
        } catch (error) {
            // If map data unavailable, proceed with save
            console.warn('[sleetStormHandler] Map data unavailable, proceeding with save:', error);
        }
    }

    const existingConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const isAlreadyProne = existingConditions.some(c => String(c).toLowerCase() === 'prone');
    if (isAlreadyProne) return null;

    const targetCharacter = getCombatContext(campaignName)?.creatures?.find(c => c.name === targetName);
    if (targetCharacter?.type === 'player') {
        const targetStats = {
            computedStats: getRuntimeValue(targetName, 'computedStats', campaignName),
        };
        if (playerIsImmuneToCondition({
            conditionKey: 'prone',
            playerStats: targetStats,
            getRuntimeValue,
            campaignName,
        })) {
            return null;
        }
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'DEX',
        saveDc: tracking.saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Sleet Storm',
        description: `${targetName} must make a DEX save (DC ${tracking.saveDc}) or become Prone and lose Concentration (Sleet Storm area).`,
        promptId,
    }).catch((e) => { console.error("[sleetStormAreaSave] Error:", e); });

    const saveResult = await promise;

    if (!saveResult.success) {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'prone');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'prone'], campaignName);

        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'failure',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: ['prone'],
            appliedDamage: 0,
        });

        // Track concentration loss
        const casterConcentrationKey = `_sleetStorm_concentration_${casterName.replace(/\s+/g, '_')}`;
        const existingConcentration = getRuntimeValue(casterName, casterConcentrationKey, campaignName) || [];
        const concentrationList = Array.isArray(existingConcentration) ? [...existingConcentration] : [];
        if (!concentrationList.includes(targetName)) {
            concentrationList.push(targetName);
            setRuntimeValue(casterName, casterConcentrationKey, concentrationList, campaignName);
        }

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-sleet-storm',
            targetName,
            saveDc: tracking.saveDc,
            saveType: 'DEX',
            success: false,
            description: `${targetName} failed DEX save against Sleet Storm. Becomes Prone and loses Concentration.`,
        }).catch((e) => { console.error("[sleetStormAreaSave] Error:", e); });
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
            rollType: 'save-sleet-storm',
            targetName,
            saveDc: tracking.saveDc,
            saveType: 'DEX',
            success: true,
            description: `${targetName} succeeded on DEX save against Sleet Storm.`,
        }).catch((e) => { console.error("[sleetStormAreaSave] Error:", e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Sleet Storm',
            description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} the DEX save (DC ${tracking.saveDc}). ${!saveResult.success ? 'Becomes Prone and loses Concentration.' : 'Unaffected.'}`,
        },
    };
}
