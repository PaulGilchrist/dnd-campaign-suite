import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import storage from '../../../ui/storage.js';
/**
 * Faerie Fire spell handler.
 * Mechanics:
 * - 20-foot Cube, 60-foot range
 * - DEX save on cast — failure = affected
 * - Affected creatures shed Dim Light in 10-foot radius
 * - Affected creatures can't benefit from Invisible condition and are immune to it for the duration
 * - Attack rolls against affected creatures have Advantage if attacker can see them
 * - Concentration, up to 1 minute
 */

function hasDexImmunity(target) {
    const targetImmunities = target.weaknessesAndResistivities?.immunities || [];
    if (!Array.isArray(targetImmunities) || targetImmunities.length === 0) return false;
    return targetImmunities.some(
        imm => String(imm).toLowerCase() === 'dex' || String(imm).toLowerCase() === 'dexterity'
    );
}

async function outlineTarget(campaignName, casterName, targetName, dc, saveResult) {
    // Track the faerie fire effect with concentration duration for cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const faerieEffect = {
        target: targetName,
        effect: 'faerie_fire',
        source: casterName,
        duration: 'concentration',
    };
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'faerie_fire'
    );
    if (existingIdx >= 0) {
        effects[existingIdx] = faerieEffect;
    } else {
        effects.push(faerieEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    // Add activeBuffs entry on the target for UI display
    const storedBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const newBuffs = activeBuffs.filter(b => b.name !== 'Faerie Fire');
    newBuffs.push({
        name: 'Faerie Fire',
        effect: 'faerie_fire',
        duration: 'Concentration, up to 1 minute',
        source: casterName,
        conditionImmunity: ['invisible'],
    });
    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);

    // Register expiration so the effect clears on initiative roll, short rest, and long rest
    addExpiration(casterName, targetName, [
        { type: 'remove_faerie_fire' },
    ], campaignName);

    // Remove invisible condition — Faerie Fire prevents benefiting from invisibility
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filteredConditions = conditions.filter(c => String(c).toLowerCase() !== 'invisible');
    if (filteredConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filteredConditions, campaignName);
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Invisible',
            reason: 'Faerie Fire spell — affected creatures can\'t benefit from invisibility',
            timestamp: Date.now(),
        }).catch((e) => { console.error("[faerieFire] Error:", e); });
    }

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['faerie_fire'],
        appliedDamage: 0,
    });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Faerie Fire',
        reason: 'Faerie Fire spell',
        note: `${targetName} is outlined by Faerie Fire: sheds Dim Light in 10-foot radius, is immune to the Invisible condition, and attack rolls against it have Advantage.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[faerieFire] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-faerie-fire',
        targetName,
        saveDc: dc,
        saveType: 'DEX',
        success: false,
        description: `${targetName} failed DEX save against Faerie Fire. Outlined in light.`,
    }).catch((e) => { console.error("[faerieFire] Error:", e); });
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
                description: 'No creatures in combat. Faerie Fire has no effect.',
            },
        };
    }

    // Use selected targets from metaCtx (CreatureSelectionModal), otherwise default to all creatures except the caster
    const selectedTargetNames = action.metaCtx?.targets;
    const targets = selectedTargetNames
        ? cs.creatures.filter(c => selectedTargetNames.includes(c.name) && c.name !== casterName)
        : cs.creatures.filter(c => c.name !== casterName);

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures selected for Faerie Fire.',
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

    // Register concentration for this spell
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Faerie Fire', concentrationDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    let affectedCount = 0;
    let savedCount = 0;
    let immuneCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        // Check for DEX immunity on each target individually
        if (hasDexImmunity(target)) {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: casterName,
                abilityName: action.name,
                description: `${targetName} is immune to Faerie Fire (DEX immunity).`,
            }).catch((e) => { console.error("[faerieFire] Error:", e); });
            results.push(`${targetName} is immune.`);
            immuneCount++;
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
            description: `${casterName} casts Faerie Fire! ${targetName} must make a DEX save (DC ${dc}) or be outlined in light.`,
            promptId,
        }).catch((e) => { console.error("[faerieFire] Error:", e); });

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
                rollType: 'save-faerie-fire',
                targetName,
                saveDc: dc,
                saveType: 'DEX',
                success: true,
                description: `${targetName} succeeded on DEX save against Faerie Fire.`,
            }).catch((e) => { console.error("[faerieFire] Error:", e); });
        } else {
            affectedCount++;
            await outlineTarget(campaignName, casterName, targetName, dc, saveResult);
            results.push(`${targetName} is outlined.`);
        }
    }

    const summary = affectedCount > 0
        ? `Faerie Fire affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved. ${immuneCount > 0 ? `${immuneCount} creature(s) immune.` : ''} Affected creatures shed Dim Light in a 10-foot radius, are immune to the Invisible condition, and attack rolls against them have Advantage.`
        : `No creatures affected by Faerie Fire. ${savedCount} creature(s) saved. ${immuneCount > 0 ? `${immuneCount} creature(s) immune.` : ''}`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
