import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../../../rules/combat/applyDamage.js';

/**
 * Prismatic Spray spell handler (2024 ruleset).
 * Mechanics:
 * - 60-foot Cone AoE
 * - DEX save (dc_success: none — all effects happen on fail)
 * - For each target, roll 2d7 to determine ray effects:
 *   1=Red: 10d6 Fire damage (half on save)
 *   2=Orange: 10d6 Acid damage (half on save)
 *   3=Yellow: 10d6 Lightning damage (half on save)
 *   4=Green: 10d6 Poison damage (half on save)
 *   5=Blue: 10d6 Cold damage (half on save)
 *   6=Indigo: Restrained; recurring CON saves (3 successes=end, 3 failures=Petrified)
 *   7=Violet: Blinded; WIS save at start of caster's next turn (success=end, fail=banished)
 * - Each die roll is 1d7 (no re-roll needed since range is 1-7)
 */

const PRISMATIC_RAYS = {
    1: { name: 'Red', type: 'fire', damage: '10d6', saveType: 'DEX' },
    2: { name: 'Orange', type: 'acid', damage: '10d6', saveType: 'DEX' },
    3: { name: 'Yellow', type: 'lightning', damage: '10d6', saveType: 'DEX' },
    4: { name: 'Green', type: 'poison', damage: '10d6', saveType: 'DEX' },
    5: { name: 'Blue', type: 'cold', damage: '10d6', saveType: 'DEX' },
    6: { name: 'Indigo', type: 'restrained', saveType: 'DEX' },
    7: { name: 'Violet', type: 'banished', saveType: 'DEX' },
};

const DAMAGE_RAY_TYPES = new Set(['fire', 'acid', 'lightning', 'poison', 'cold']);

const STATUS_RAY_META = {
    restrained: { label: 'Indigo', outcome: 'Restrained', type: 'indigo' },
    banished: { label: 'Violet', outcome: 'Blinded', type: 'violet' },
};

function rollD7() {
    return Math.floor(Math.random() * 7) + 1;
}

// Roll 1d8 — if 8, re-roll 2d7 for two separate rays
function pickRays() {
    const firstRoll = Math.floor(Math.random() * 8) + 1;
    if (firstRoll === 8) {
        const rayRolls = [rollD7(), rollD7()];
        return {
            rays: rayRolls.map(r => PRISMATIC_RAYS[r]),
            rollDescription: `rolled 8, then 2d7 (${rayRolls.join(',')})`,
        };
    }
    return {
        rays: [PRISMATIC_RAYS[firstRoll]],
        rollDescription: `rolled ${firstRoll}`,
    };
}

// Use selected targets from CreatureSelectionModal if provided, otherwise all creatures except caster
function selectSprayTargets(action, cs, casterName) {
    const selected = action.metaCtx?.selectedTargets;
    if (Array.isArray(selected) && selected.length > 0) return selected;
    return cs.creatures.filter(c => c.name !== casterName).map(c => c.name);
}

function queueRaySave(ctx) {
    const { action, auto, campaignName, casterName, targetName, ray, rollDescription, immunityList, disadvantage, dc, savePromises, saveResults } = ctx;
    const damageFormula = auto.damage || '10d6';

    if (DAMAGE_RAY_TYPES.has(ray.type)) {
        // Check elemental immunity for damage rays (1-5)
        if (immunityList.includes(ray.type)) return true;

        // DEX save for half damage
        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'DEX',
            saveDc: dc,
            dcSuccess: 'half',
            disadvantage,
            damageFormula,
            damageType: ray.type,
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Prismatic Spray! ${targetName} hit by ${ray.name} ray (${rollDescription}) — DEX save (DC ${dc}) or take ${damageFormula} ${ray.type} damage.`,
            promptId,
        }).catch((e) => { console.error(`[prismaticSpray] Error:`, e); });

        savePromises.push(promise);
        saveResults.push({ targetName, ray, dc, type: 'damage', damageFormula });
        return false;
    }

    const statusMeta = STATUS_RAY_META[ray.type];
    if (statusMeta) {
        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'DEX',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage,
        });

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Prismatic Spray! ${targetName} hit by ${statusMeta.label} ray (${rollDescription}) — DEX save (DC ${dc}) or become ${statusMeta.outcome}.`,
            promptId,
        }).catch((e) => { console.error(`[prismaticSpray] Error:`, e); });

        savePromises.push(promise);
        saveResults.push({ targetName, ray, dc, type: statusMeta.type });
    }
    return false;
}

async function applyRayDamage(cs, campaignName, characters, casterName, targetName, ray, damageFormula, succeeded) {
    const dmgResult = rollExpression(damageFormula);
    if (!dmgResult) return;
    const finalDamage = computeDamageAfterSave(dmgResult.total, succeeded, 'half');
    if (finalDamage > 0) {
        await applyDamageToTarget(cs, targetName, finalDamage, [ray.type], campaignName, characters, { ignoreResistance: false, attackerName: casterName });
    }
}

async function resolveSpraySaveOutcome(ctx) {
    const { campaignName, casterName, cs, characters, dc, info, saveResult, results } = ctx;
    const { targetName, ray, type, damageFormula } = info;

    if (saveResult.success) {
        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'success',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: [],
            appliedDamage: saveResult.appliedDamage || 0,
        });
        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-prismatic-spray',
            targetName,
            saveDc: dc,
            saveType: 'DEX',
            success: true,
            description: `${targetName} succeeded on DEX save against ${ray.name} ray, taking half damage.`,
        }).catch((e) => { console.error(`[prismaticSpray] Error:`, e); });

        // Apply half damage for damage rays
        if (type === 'damage' && cs) {
            await applyRayDamage(cs, campaignName, characters, casterName, targetName, ray, damageFormula, true);
        }

        results.push(`${targetName}: ${ray.name} ray (saved DEX save).`);
        return;
    }

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: saveResult.appliedDamage || 0,
    });
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-prismatic-spray',
        targetName,
        saveDc: dc,
        saveType: 'DEX',
        success: false,
        description: `${targetName} failed DEX save against ${ray.name} ray, taking full ${damageFormula} ${ray.type} damage.`,
    }).catch((e) => { console.error(`[prismaticSpray] Error:`, e); });

    // Apply full damage for damage rays
    if (type === 'damage' && cs) {
        await applyRayDamage(cs, campaignName, characters, casterName, targetName, ray, damageFormula, false);
    }

    // Apply ray-specific effects on save failure
    if (type === 'indigo') {
        await applyIndigoEffect(targetName, dc, casterName, campaignName);
        results.push(`${targetName}: ${ray.name} ray (failed DEX save, Restrained).`);
    } else if (type === 'violet') {
        await applyVioletEffect(targetName, dc, casterName, campaignName);
        results.push(`${targetName}: ${ray.name} ray (failed DEX save, Blinded).`);
    } else {
        results.push(`${targetName}: ${ray.name} ray (failed DEX save, full damage).`);
    }
}

async function applyIndigoEffect(targetName, dc, casterName, campaignName) {
    // Apply Restrained condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'restrained'], campaignName);

    // Store condition metadata for recurring CON saves
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        restrained: {
            ...(existingMeta.restrained || {}),
            dc,
            ability: 'con',
        },
    }, campaignName);

    // Register prismatic_spray targetEffect for Indigo ray tracking
    const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === 'prismatic_spray_indigo' && te.source === casterName
    );
    const indigoEffect = {
        target: targetName,
        effect: 'prismatic_spray_indigo',
        source: casterName,
        dc,
    };
    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = indigoEffect;
    } else {
        allTargetEffects.push(indigoEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);

    // Set up recurring save tracking
    const saveTrackingKey = `_prismaticSprayIndigo_${targetName.replace(/\s+/g, '_')}`;
    setRuntimeValue('campaign', saveTrackingKey, {
        successes: 0,
        failures: 0,
        dc,
        casterName,
    }, campaignName);

    // Add expirations: condition + targetEffect
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'restrained' },
        { type: 'remove_target_effect', effectKey: 'prismatic_spray_indigo', target: targetName, source: casterName },
    ], campaignName);

    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Restrained',
        reason: 'Prismatic Spray (Indigo ray)',
        note: `${targetName} is Restrained by Prismatic Spray. At end of each turn, make CON save (DC ${dc}). 3 successes = spell ends. 3 failures = Petrified.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`[prismaticSpray] Error:`, e); });
}

async function applyVioletEffect(targetName, dc, casterName, campaignName) {
    // Apply Blinded condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'blinded');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'blinded'], campaignName);

    // Register prismatic_spray_violet targetEffect for WIS save tracking
    const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === 'prismatic_spray_violet' && te.source === casterName
    );
    const violetEffect = {
        target: targetName,
        effect: 'prismatic_spray_violet',
        source: casterName,
        dc,
    };
    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = violetEffect;
    } else {
        allTargetEffects.push(violetEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);

    // Track violet ray banishment timing
    const violetTrackingKey = `_prismaticSprayViolet_${targetName.replace(/\s+/g, '_')}`;
    setRuntimeValue('campaign', violetTrackingKey, {
        casterName,
        dc,
        blindedAt: Date.now(),
    }, campaignName);

    // Add expirations: condition + targetEffect
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'blinded' },
        { type: 'remove_target_effect', effectKey: 'prismatic_spray_violet', target: targetName, source: casterName },
    ], campaignName);

    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Blinded',
        reason: 'Prismatic Spray (Violet ray)',
        note: `${targetName} is Blinded by Prismatic Spray. At start of ${casterName}'s next turn, make WIS save (DC ${dc}). Success = blinded ends. Failure = banished to another plane.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`[prismaticSpray] Error:`, e); });
}

export function isPrismaticSprayBlocked(attackerName, targetName, _campaignName) {
    if (!attackerName || !targetName) return false;

    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];

    const attackerHasEffect = allTargetEffects.some(
        te => te.target === attackerName && (te.effect === 'prismatic_spray_indigo' || te.effect === 'prismatic_spray_violet')
    );
    const targetHasEffect = allTargetEffects.some(
        te => te.target === targetName && (te.effect === 'prismatic_spray_indigo' || te.effect === 'prismatic_spray_violet')
    );

    if (!attackerHasEffect && !targetHasEffect) return false;
    if (attackerHasEffect && targetHasEffect) {
        const attackerSources = allTargetEffects
            .filter(te => te.target === attackerName && (te.effect === 'prismatic_spray_indigo' || te.effect === 'prismatic_spray_violet'))
            .map(te => te.source);
        const targetSources = allTargetEffects
            .filter(te => te.target === targetName && (te.effect === 'prismatic_spray_indigo' || te.effect === 'prismatic_spray_violet'))
            .map(te => te.source);
        // Blocked if they don't share the same caster
        return !attackerSources.some(s => targetSources.includes(s));
    }
    return true;
}

async function processSpraySaves({ campaignName, casterName, cs, characters, dc, savePromises, saveResults, results, creaturesThatSaved, creaturesThatFailed }) {
    let saveIndex = 0;
    for (const promise of savePromises) {
        const saveResult = await promise;
        const info = saveResults[saveIndex];
        if (saveResult.success) {
            creaturesThatSaved.add(info.targetName);
        } else {
            creaturesThatFailed.add(info.targetName);
        }
        await resolveSpraySaveOutcome({ campaignName, casterName, cs, characters, dc, info, saveResult, results });
        saveIndex++;
    }
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const casterName = playerStats.name;
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures in combat. Prismatic Spray has no effect.',
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

    const targetNames = selectSprayTargets(action, cs, casterName);

    if (targetNames.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures selected. Prismatic Spray has no effect.',
            },
        };
    }

    let immuneCount = 0;
    const results = [];
    const savePromises = [];
    const saveResults = [];
    const creaturesThatSaved = new Set();
    const creaturesThatFailed = new Set();

    for (const targetName of targetNames) {
        const targetCreature = cs.creatures.find(c => c.name === targetName);
        const targetImmunities = targetCreature?.weaknessesAndResistivities?.immunities || [];
        const immunityList = Array.isArray(targetImmunities) ? targetImmunities.map(i => String(i).toLowerCase()) : [];
        const disadvantage = action.metaCtx?.heightenTarget === targetName;

        const { rays, rollDescription } = pickRays();

        for (const ray of rays) {
            const immune = queueRaySave({ action, auto, campaignName, casterName, targetName, ray, rollDescription, immunityList, disadvantage, dc, savePromises, saveResults });
            if (immune) {
                immuneCount++;
                results.push(`${targetName} is immune to ${ray.name} ray (${ray.type.charAt(0).toUpperCase() + ray.type.slice(1)} immunity).`);
            }
        }
    }

    // Process all save results
    await processSpraySaves({ campaignName, casterName, cs, characters, dc, savePromises, saveResults, results, creaturesThatSaved, creaturesThatFailed });

    const affectedCreatures = creaturesThatFailed.size;
    const savedCreatures = creaturesThatSaved.size;
    const summary = affectedCreatures > 0
        ? `Prismatic Spray affects ${affectedCreatures} creature(s). ${results.join(' ')} ${savedCreatures} creature(s) saved. ${immuneCount > 0 ? `${immuneCount} ray(s) immune.` : ''}`
        : `No creatures affected by Prismatic Spray. ${savedCreatures} creature(s) saved. ${immuneCount > 0 ? `${immuneCount} ray(s) immune.` : ''}`;
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}
