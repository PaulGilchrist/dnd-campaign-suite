// Shared WIS-save "charm" spell pipeline for Charm Person / Charm Monster.
// Both handlers differ only in metaCtx keys, rollType, and refusal text.
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { spellNoticePopup } from './areaSpellUtils.js';
import { getAuraConditionImmunities, auraCoversCondition, logAuraConditionImmunity } from '../../../combat/auras/auraConditionImmunity.js';

function dispatchSaveResult({ campaignName, promptId, targetName, saveType, saveDc, saveResult }) {
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

// Shared WIS NPC save (also used by Crown of Madness).
// CLA-219: disadvantage (Heightened Spell / Magical Ambush via metaCtx
// transport) rides the inline adjudication — 2d20 keep-low, mirroring
// rollSaveForCreature's mode resolution.
export function rollNpcSave(targetCreature, dc, advantage, disadvantage = false) {
    if (targetCreature) {
        return rollSaveForCreature(targetCreature, 'WIS', dc, disadvantage, advantage);
    }
    const r1 = rollD20();
    const r2 = rollD20();
    const roll = disadvantage ? Math.min(r1, r2) : advantage ? Math.max(r1, r2) : r1;
    const total = roll;
    const success = total >= dc;
    return { roll, total, bonus: 0, success, rawRolls: [r1, r2] };
}

async function logSaveSuccess({ campaignName, casterName, action, targetName, dc, saveResult, rollType, logPrefix }) {
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
        rollType,
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: true,
        description: `${targetName} succeeded on WIS save against ${action.name}.`,
    }).catch((e) => { console.error(logPrefix, e); });
}

// CLA-020: Aura of Devotion — Charmed is SUPPRESSED (save still fails, condition
// never lands) for the aura host and allies in range. Membership/range gating rides
// computeAuraComboEffects — the same verified model CLA-019 threaded for Frightened.
async function applyCharmImmunityLeg({ campaignName, casterName, action, targetName, dc, saveResult, rollType, logPrefix, auraImmunities }) {
    logAuraConditionImmunity({ campaignName, targetName, conditionKey: 'charmed', auraImmunities, sourceAbility: action.name });
    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType,
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} but is immune to Charmed — condition not applied.`,
    }).catch((e) => { console.error(logPrefix, e); });
}

async function applyCharmFailure({ campaignName, casterName, action, targetName, dc, saveResult, rollType, logPrefix, characters }) {
    const auraImmunities = await getAuraConditionImmunities({ targetName, characters });
    if (auraCoversCondition(auraImmunities, 'charmed')) {
        await applyCharmImmunityLeg({ campaignName, casterName, action, targetName, dc, saveResult, rollType, logPrefix, auraImmunities });
        return 'immune';
    }
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        charmed: {
            ...(existingMeta.charmed || {}),
            dc,
            ability: 'wis',
        },
    }, campaignName);

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['charmed'],
        appliedDamage: 0,
    });

    addExpiration({ attackerName: casterName, targetName, effects: [
        { type: 'charmed', condition: 'charmed' },
    ], campaignName });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: `${action.name} spell`,
        note: `${targetName} is Charmed by ${casterName} and regards them as a friendly acquaintance. The spell ends if ${casterName} or their companions do anything harmful to ${targetName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(logPrefix, e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType,
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} and is Charmed.`,
    }).catch((e) => { console.error(logPrefix, e); });
    return 'charmed';
}

// Target names from metaCtx (multi-target) or single targetName.
// Returns { targetNames } to proceed, or { popup } to refuse.
function resolveCharmTargetNames(action, auto, config) {
    const metaTargets = action.metaCtx?.[config.targetsKey];
    if (metaTargets && Array.isArray(metaTargets) && metaTargets.length > 0) {
        return { targetNames: metaTargets };
    }
    const providedTargetName = auto.targetName || action.targetName;
    if (!providedTargetName) {
        return { popup: spellNoticePopup(action.name, config.noTargetDescription) };
    }
    return { targetNames: [providedTargetName] };
}

// One target's cast-time WIS save: prompt, NPC auto-roll, outcome legs.
// Returns 'saved', 'immune' (CLA-020 aura-covered failed save), or 'charmed'.
async function charmOneTarget({ campaignName, casterName, action, auto, config, cs, dc, targetName, charmAdvantages, characters }) {
    const targetCreature = cs.creatures.find(c => c.name === targetName);
    const isTargetNpc = targetCreature && targetCreature.type !== 'player';
    const targetAdvantage = charmAdvantages[targetName] || auto.advantage || false;
    // CLA-219: Heightened Spell / Magical Ambush transport rides the charm lane once.
    const targetDisadvantage = !!action.metaCtx?.metamagicHeighten;

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        attackerName: casterName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
        advantage: targetAdvantage,
        disadvantage: targetDisadvantage,
        condition: 'charmed',
        ...(config.saveConditions ? { saveConditions: config.saveConditions } : {}),
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a WIS save (DC ${dc})${targetAdvantage ? ' with Advantage' : ''}${targetDisadvantage ? ' with Disadvantage' : ''} or become Charmed.`,
        promptId,
    }).catch((e) => { console.error(config.logPrefix, e); });

    if (isTargetNpc) {
        dispatchSaveResult({
    campaignName,
    promptId,
    targetName,
    saveType: 'WIS',
    saveDc: dc,
            saveResult: rollNpcSave(targetCreature, dc, targetAdvantage, targetDisadvantage),
});
    }

    const saveResult = await promise;

    if (saveResult.success) {
        await logSaveSuccess({ campaignName, casterName, action, targetName, dc, saveResult, rollType: config.rollType, logPrefix: config.logPrefix });
        return 'saved';
    }
    return await applyCharmFailure({ campaignName, casterName, action, targetName, dc, saveResult, rollType: config.rollType, logPrefix: config.logPrefix, characters });
}

function buildCharmSummary({ charmedTargets, savedTargets, immuneTargets }) {
    const immuneTail = immuneTargets.length > 0 ? ` ${immuneTargets.length} creature(s) immune: ${immuneTargets.join(', ')}.` : '';
    if (charmedTargets.length > 0) {
        return `${charmedTargets.length} creature(s) charmed: ${charmedTargets.join(', ')}. ${savedTargets.length} creature(s) saved: ${savedTargets.join(', ')}.${immuneTail}`;
    }
    return `No creatures charmed. ${savedTargets.length} creature(s) saved: ${savedTargets.join(', ')}.${immuneTail}`;
}

// CLA-219: Magical Ambush rides the charm lane here because the sheet's
// charm chooser confirm rebuilds metaCtx (useSimpleSpellHandlers) and the
// chooser never passes through executeSpellCast's choke-point fold.
function foldMagicalAmbush(action, playerStats, campaignName) {
    if (action.metaCtx?.metamagicHeighten) return;
    const passives = playerStats.automation?.passives || [];
    if (!passives.some(p => p.type === 'passive_rule' && p.effect === 'magical_ambush')) return;
    const conditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
    if (conditions.some(c => String(c).toLowerCase() === 'invisible')) {
        action.metaCtx = { ...action.metaCtx, metamagicHeighten: true };
    }
}

export async function handleCharmSpell(action, playerStats, campaignName, config) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    foldMagicalAmbush(action, playerStats, campaignName);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return spellNoticePopup(action.name, `No creatures in combat. ${action.name} has no effect.`);
    }

    const casterName = playerStats.name;

    const targetResolution = resolveCharmTargetNames(action, auto, config);
    if (targetResolution.popup) return targetResolution.popup;
    const targetNames = targetResolution.targetNames;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: targetNames.length > 1 ? 'single' : 'single',
    });

    const charmAdvantages = action.metaCtx?.[config.advantagesKey] || {};
    const characters = action.metaCtx?.characters || [];

    const charmedTargets = [];
    const savedTargets = [];
    const immuneTargets = [];
    for (const targetName of targetNames) {
        const outcome = await charmOneTarget({ campaignName, casterName, action, auto, config, cs, dc, targetName, charmAdvantages, characters });
        if (outcome === 'charmed') charmedTargets.push(targetName);
        else if (outcome === 'immune') immuneTargets.push(targetName);
        else savedTargets.push(targetName);
    }

    return spellNoticePopup(action.name, buildCharmSummary({ charmedTargets, savedTargets, immuneTargets }));
}
