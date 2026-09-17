import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

// MA-0248: Ancient Silver Dragon Paralyzing Breath. A failed CON save (DC 24)
// first FAILURE stages Incapacitated until the end of the target's next turn,
// when it repeats the save; a SECOND failure Paralyzes it, repeating the save
// at the end of each of its turns and ending on a success, with an automatic
// success after 1 minute (10 rounds, CLA-334 minutes×10).
//
// MA-0068 staged-sleep shape (stage te + turn-END repeat-save seam + rounds
// clock), sibling to weakeningBreathService MA-0102 — NOT the sleep_staged te:
// paralysis never wakes on damage, so it rides its own registered te key and
// sleepService.wakeSleepOnDamage (keyed to sleep_staged) stays untouched.
// Zero damage row — HP untouched; ladder events all log (AGENTS.md logging).

export const PARALYZING_STAGED_TE = 'paralyzing_staged';
const DEFAULT_PARALYZED_ROUNDS = 10;

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function targetOf(te) {
    return Array.isArray(te?.target) ? te.target[0] : te?.target;
}

function capitalize(word) {
    const s = String(word || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const SAVE_TYPE_WORDS = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

function saveTypeAbbr(saveType) {
    const s = String(saveType || 'con').toLowerCase();
    if (SAVE_TYPE_WORDS[s]) return s;
    return Object.keys(SAVE_TYPE_WORDS).find(k => SAVE_TYPE_WORDS[k].toLowerCase() === s) || 'con';
}

function findStagedEffect(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.find(te => te.effect === PARALYZING_STAGED_TE && targetOf(te) === targetName) || null;
}

function applyCondition(targetName, condition, campaignName, skipSync) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const filtered = conditions.filter(c => lower(c) !== lower(condition));
    setRuntimeValue(targetName, 'activeConditions', [...filtered, condition], campaignName, skipSync);
}

function removeCondition(targetName, condition, campaignName, skipSync) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const filtered = conditions.filter(c => lower(c) !== lower(condition));
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName, skipSync);
    }
}

function stageEffect(targetName, casterName, saveDc, options) {
    return {
        target: targetName,
        effect: PARALYZING_STAGED_TE,
        source: casterName,
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: saveDc,
        saveType: saveTypeAbbr(options.saveType || 'CON').toUpperCase(),
        duration: 'staged_until_repeat_save',
        label: options.label || 'Paralyzing Breath',
        logLabel: options.logLabel || options.label || 'Paralyzing Breath',
        paralyzedRounds: options.paralyzedRounds ?? DEFAULT_PARALYZED_ROUNDS,
    };
}

// First-failed-save staging (cone picker NPC auto-leg and PC prompt leg both
// route here via SaveAttackAoeModal): Incapacitated + staged te. NO caster
// concentration, NO damage-wake consumer (stageSleepTargets concentrate:false
// shape, minus the sleep wake hook).
export async function stageParalysisTargets(campaignName, casterName, targetNames, saveDc, options = {}) {
    const staged = [];
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];

    for (const targetName of targetNames) {
        applyCondition(targetName, 'incapacitated', campaignName, false);
        const stagedEffect = stageEffect(targetName, casterName, saveDc, options);
        const existingIdx = effects.findIndex(te => te.effect === PARALYZING_STAGED_TE && targetOf(te) === targetName);
        if (existingIdx >= 0) {
            effects[existingIdx] = stagedEffect;
        } else {
            effects.push(stagedEffect);
        }
        staged.push(targetName);
    }

    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
    return staged;
}

// Player repeats via queued save prompt; NPCs auto-roll inline
// (sleepService resolveSleepRepeatSave shape).
async function resolveRepeatSave({ csCreature, targetName, casterName, saveDc, campaignName, label }) {
    if (csCreature?.type !== 'player') {
        const saveBonus = csCreature?.saveBonuses?.con ?? 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        return { roll, saveBonus, success: (roll + saveBonus) >= saveDc };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc,
        dcSuccess: 'none',
        sourceName: casterName,
        condition: `${label} (repeat save)`,
    });
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: label,
        description: `${targetName} repeats its Constitution save (DC ${saveDc}) at the end of its turn.`,
        promptId,
    }).catch((e) => { console.error('[paralyzingBreathService] Error logging repeat save:', e); });

    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success };
}

// Repeat-save success: strip the staged te + the current stage condition
// (endSleepOnSaveSuccess shape).
function endStagedParalysis({ effects, idx, targetName, casterName, campaignName, skipSync, label, stage }) {
    if (idx >= 0) effects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    removeCondition(targetName, stage, campaignName, skipSync);
    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: capitalize(stage),
        reason: `${label} ends (repeat save succeeded)`,
        sourceName: casterName,
    }).catch((e) => { console.error('[paralyzingBreathService] Error logging condition removal:', e); });
}

// Repeat-save first fail: escalate Incapacitated → Paralyzed with the
// 1-minute (10-round) auto-success clock (applySleepTurnEnd escalation shape).
function escalateToParalyzed({ effects, idx, targetName, casterName, campaignName, skipSync, label, paralyzedRounds }) {
    if (idx >= 0) {
        effects[idx] = { ...effects[idx], stage: 'paralyzed', condition: 'paralyzed' };
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    applyCondition(targetName, 'paralyzed', campaignName, skipSync);
    addExpiration({ attackerName: casterName, targetName, effects: [
        { type: 'condition', condition: 'paralyzed' },
        { type: 'remove_target_effect', effectKey: PARALYZING_STAGED_TE, source: casterName, target: targetName },
    ], campaignName, rounds: paralyzedRounds ?? DEFAULT_PARALYZED_ROUNDS });
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Paralyzed',
        reason: `${label} (failed repeat save)`,
        sourceName: casterName,
        note: `${targetName} is Paralyzed. It repeats the save at the end of each of its turns, ending the effect on itself on a success; after 1 minute it succeeds automatically.`,
    }).catch((e) => { console.error('[paralyzingBreathService] Error logging paralyzed condition:', e); });
}

// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam —
// beside applySleepTurnEnd / applyWeakeningBreathTurnEnd). Repeat save while
// the staged te exists: success ends the whole effect (te + current
// condition); a first fail escalates Incapacitated → Paralyzed with the
// 1-minute (10-round) auto-success clock; a fail while Paralyzed keeps it
// (the clock still auto-succeeds).
export async function applyParalyzingBreathTurnEnd(campaignName, targetName, options = {}) {
    const stagedEffect = findStagedEffect(targetName, campaignName);
    if (!stagedEffect) {
        return { handled: false };
    }

    const skipSync = options.skipSync === true;
    const saveDc = stagedEffect.dc ?? 24;
    const casterName = stagedEffect.source;
    const label = stagedEffect.label || 'Paralyzing Breath';
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const { roll, saveBonus, success } = await resolveRepeatSave({ csCreature, targetName, casterName, saveDc, campaignName, label });
    const total = roll + saveBonus;
    const stage = stagedEffect.stage === 'paralyzed' ? 'paralyzed' : 'incapacitated';

    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = effects.findIndex(te => te.effect === PARALYZING_STAGED_TE && targetOf(te) === targetName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-paralyzing-repeat',
        targetName,
        saveDc,
        saveType: 'CON',
        success,
        roll,
        total,
        saveBonus,
        description: success
            ? `${targetName} succeeded on its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — ${label} ends.`
            : stage === 'incapacitated'
                ? `${targetName} failed its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — becomes Paralyzed.`
                : `${targetName} failed its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — remains Paralyzed (auto-succeeds after 1 minute).`,
    }).catch((e) => { console.error('[paralyzingBreathService] Error logging repeat save result:', e); });

    if (success) {
        endStagedParalysis({ effects, idx, targetName, casterName, campaignName, skipSync, label, stage });
        return { handled: true, success: true, roll, total };
    }

    if (stage === 'paralyzed') {
        return { handled: true, success: false, roll, total };
    }

    escalateToParalyzed({ effects, idx, targetName, casterName, campaignName, skipSync, label, paralyzedRounds: stagedEffect.paralyzedRounds });
    return { handled: true, success: false, roll, total };
}
