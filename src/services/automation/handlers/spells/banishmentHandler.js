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
import { addConcentration } from '../../../combat/concentration/concentrationService.js';

function getBanishmentEffects() {
    return (getRuntimeValue('campaign', 'targetEffects') || []).filter(te => te.effect === 'banishment');
}

/**
 * True when a creature is currently banished.
 */
export function isCreatureTrappedInBanishment(creatureName) {
    if (!creatureName) return false;
    return getBanishmentEffects().some(te => te.target === creatureName);
}

/**
 * True when an attack/effect between attacker and target must be blocked by
 * a Banishment demiplane. Allowed only when both are banished by the same caster.
 */
export function isBanishmentBlocked(attackerName, targetName, _campaignName) {
    if (!attackerName || !targetName) return false;
    const banishmentEffects = getBanishmentEffects();
    if (banishmentEffects.length === 0) return false;

    const attackerTrapped = banishmentEffects.some(te => te.target === attackerName);
    const targetTrapped = banishmentEffects.some(te => te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
        const attackerSources = banishmentEffects
            .filter(te => te.target === attackerName)
            .map(te => te.source);
        return !banishmentEffects.some(te => te.target === targetName && attackerSources.includes(te.source));
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

// Creature types that get permanently banished when the spell lasts 1 minute
const PERMANENT_BANISHMENT_TYPES = new Set([
    'aberration',
    'celestial',
    'elemental',
    'fey',
    'fiend',
]);

async function banishFailingTarget({ campaignName, casterName, action, targetName, dc, targetCreature, saveResult }) {
    // Apply Incapacitated condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'incapacitated');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'incapacitated'], campaignName);

    // Store condition metadata
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        incapacitated: {
            ...(existingMeta.incapacitated || {}),
            dc,
            ability: 'cha',
        },
    }, campaignName);

    // Check if target is a creature type that gets permanently banished
    const creatureType = (targetCreature?.monsterType || '').toLowerCase().replace(/\s+/g, '');
    const isPermanentType = PERMANENT_BANISHMENT_TYPES.has(creatureType);
    const permanentNote = isPermanentType
        ? ' (permanent banishment - target will not return)'
        : '';

    // Add banishment target effect
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const existingBanishment = targetEffects.filter(te => te.effect !== 'banishment' || te.target !== targetName || te.source !== casterName);
    setRuntimeValue('campaign', 'targetEffects', [
        ...existingBanishment,
        {
            effect: 'banishment',
            target: targetName,
            source: casterName,
            duration: 'Concentration, up to 1 minute',
            permanent: isPermanentType,
        },
    ], campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['incapacitated'],
        appliedDamage: 0,
    });

    // Register expirations: remove condition + remove target effect badge + break concentration
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'incapacitated' },
        { type: 'remove_target_effect', effectKey: 'banishment', target: targetName, source: casterName },
        { type: 'break_concentration', spell: action.name },
    ], campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-banishment',
        targetName,
        saveDc: dc,
        saveType: 'CHA',
        success: false,
        description: `${targetName} failed CHA save against ${action.name} and is banished.${permanentNote}`,
    }).catch((e) => { console.error("[banishment] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Incapacitated',
        reason: action.name,
        note: `${targetName} is Incapacitated by ${action.name} (banished to demiplane).${permanentNote}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[banishment] Error:", e); });
}

async function resolveBanishmentTargets(action, auto, campaignName, casterName) {
    const banishmentTargets = action.metaCtx?.banishmentTargets;
    if (banishmentTargets && Array.isArray(banishmentTargets) && banishmentTargets.length > 0) {
        return { targetNames: banishmentTargets, popup: null };
    }

    const providedTargetName = auto.targetName || action.targetName;
    if (providedTargetName) {
        return { targetNames: [providedTargetName], popup: null };
    }

    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;
    if (!targetName) {
        return {
            targetNames: null,
            popup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `No target selected. ${action.name} has no effect.`,
                },
            },
        };
    }
    return { targetNames: [targetName], popup: null };
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

    // Get target names from metaCtx (multi-target) or single targetName
    const { targetNames, popup: targetPopup } = await resolveBanishmentTargets(action, auto, campaignName, casterName);
    if (targetPopup) return targetPopup;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'CHA',
        saveDc: dc,
        attackScope: 'single',
    });

    // Set concentration on the caster
    const combatSummary = await getCombatContext(campaignName);
    if (combatSummary) {
        addConcentration(combatSummary, casterName, action.name, dc);
    }

    let banishedCount = 0;
    let savedCount = 0;
    const banishedTargets = [];
    const savedTargets = [];

    for (const targetName of targetNames) {
        const targetCreature = cs.creatures.find(c => c.name === targetName);
        const isTargetNpc = targetCreature && targetCreature.type !== 'player';

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'CHA',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage: !!action.metaCtx?.metamagicHeighten,
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a CHA save (DC ${dc}) or be banished.`,
            promptId,
        }).catch((e) => { console.error("[banishment] Error:", e); });

        if (isTargetNpc) {
            const saveResult = targetCreature
                ? rollSaveForCreature(targetCreature, 'CHA', dc, false, false)
                : (() => {
                    const r1 = rollD20();
                    const r2 = rollD20();
                    const roll = Math.max(r1, r2);
                    const total = roll;
                    const success = total >= dc;
                    return { roll, total, bonus: 0, success, rawRolls: [r1, r2] };
                })();

            dispatchSaveResult(campaignName, promptId, targetName, 'CHA', dc, saveResult);
        }

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
                rollType: 'save-banishment',
                targetName,
                saveDc: dc,
                saveType: 'CHA',
                success: true,
                description: `${targetName} succeeded on CHA save against ${action.name}.`,
            }).catch((e) => { console.error("[banishment] Error:", e); });
            savedTargets.push(targetName);
        } else {
            banishedCount++;
            await banishFailingTarget({ campaignName, casterName, action, targetName, dc, targetCreature, saveResult });
            banishedTargets.push(targetName);
        }
    }

    const summary = banishedCount > 0
        ? `${banishedCount} creature(s) banished: ${banishedTargets.join(', ')}. ${savedCount} creature(s) saved: ${savedTargets.join(', ')}.`
        : `No creatures banished. ${savedCount} creature(s) saved: ${savedTargets.join(', ')}.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
