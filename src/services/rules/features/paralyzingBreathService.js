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
// fix#343 (#1390 te-source collision class): readers are now SOURCE-AWARE —
// every staged te on a target adjudicates its own ladder (fix#112 mirror);
// the turn-END returns { handled, results[] }, one row per source instance.

export const PARALYZING_STAGED_TE = 'paralyzing_staged';
const DEFAULT_PARALYZED_ROUNDS = 10;

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function targetOf(te) {
    // #1390 array-branch deleted (writers census QED, fix#285 shape): sole te
    // constructor is stageEffect below — `target: targetName` SCALAR, armed by
    // stageParalysisTargets one name at a time (SaveAttackAoeModal.jsx:812
    // passes [targetName] as a NAME list, each its own te). ZERO producers ever
    // write an array-shaped target for paralyzing_staged te, in src or tests.
    return te?.target;
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

// fix#343 (#1390/#1295 te-source collision class, reader half): identity law
// is target+effect+source (registerTargetEffect, targetEffectDefinitions.js
// :1508-1509; registry fields for paralyzing_staged include 'source' :549)
// and EVERY producer stamps te.source=source: casterName (:73 — the attacker
// dragon's combat-instance name, SaveAttackAoeModal.jsx:812 casterName:
// playerStats.name). Producers were audited complete this pass, so the fix
// is purely reader-side, the exact fix#112 weakeningBreath precedent: ALL
// instances per target adjudicate their OWN ladder at their OWN dc, and
// every mutation triple-matches (effect && target && source, strict ===,
// #1517 null canon). Pre-fix the source-blind find/findIndex let a second
// same-named dragon's ladder silently replace/inherit the first dragon's te.
function findStagedEffects(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.filter(te => te.effect === PARALYZING_STAGED_TE && targetOf(te) === targetName);
}

function stagedIndex(effects, targetName, casterName) {
    return effects.findIndex(te => te.effect === PARALYZING_STAGED_TE && targetOf(te) === targetName && te.source === casterName);
}

// #1390 quirk preserved: any stage that is not lowercase 'paralyzed' rides
// the stage-1 (Incapacitated) leg.
function derivedStage(te) {
    return te.stage === 'paralyzed' ? 'paralyzed' : 'incapacitated';
}

// Sibling-ladder guard (fix#343 corollary of fix#112 two-ladders-two-DCs):
// conditions are TARGET-scoped stores — while ANOTHER source's ladder on the
// same target still rides `stage`, that stored condition belongs to it and
// one dragon's repeat-save outcome must not strip it.
function siblingHoldsStage(effects, targetName, stage) {
    return effects.some(te => te.effect === PARALYZING_STAGED_TE && targetOf(te) === targetName && derivedStage(te) === stage);
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
        // fix#343: source-matched dedup — the CALLER knows its own source:
        // casterName is stageParalysisTargets' 2nd parameter (SaveAttackAoeModal
        // :812 passes casterName: playerStats.name — the breathing dragon). A
        // same-source re-stage RESETS this dragon's ladder; a DIFFERENT-source
        // re-stage now COEXISTS as its own ladder (two ladders, two DCs)
        // instead of silently overwriting the first dragon's te envelope.
        const existingIdx = stagedIndex(effects, targetName, casterName);
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

// Repeat-save success: strip THIS source's staged te (+ the current stage
// condition, unless a sibling ladder on the same target still rides it) —
// endSleepOnSaveSuccess shape, fix#112 AND-triple strip mirror
// (weakeningBreathService.js:118-124, clearExpirationEffects.js:255-261).
function endStagedParalysis({ targetName, casterName, campaignName, skipSync, label, stage }) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = stagedIndex(effects, targetName, casterName);
    if (idx >= 0) effects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    if (!siblingHoldsStage(effects, targetName, stage)) {
        removeCondition(targetName, stage, campaignName, skipSync);
    }
    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: capitalize(stage),
        reason: `${label} ends (repeat save succeeded)`,
        sourceName: casterName,
    }).catch((e) => { console.error('[paralyzingBreathService] Error logging condition removal:', e); });
}

// Repeat-save first fail: escalate THIS source's te Incapacitated → Paralyzed
// with the 1-minute (10-round) auto-success clock (applySleepTurnEnd escalation
// shape). The te mutation triple-matches so a sibling dragon's te on the same
// target is never the row edited (fix#343).
function escalateToParalyzed({ targetName, casterName, campaignName, skipSync, label, paralyzedRounds }) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = stagedIndex(effects, targetName, casterName);
    if (idx >= 0) {
        effects[idx] = { ...effects[idx], stage: 'paralyzed', condition: 'paralyzed' };
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    if (!siblingHoldsStage(effects, targetName, 'incapacitated')) {
        removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    }
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
// beside applySleepTurnEnd / applyWeakeningBreathTurnEnd). #1390 fix#343: the
// caller seam carries NO dragon identity (campaignName + outgoing creature
// only), so the ladder is adjudicated PER SOURCE INSTANCE — every
// paralyzing_staged te on the target repeats its own save at its own dc;
// success strips that instance's own te + logs its own source; a first fail
// escalates Incapacitated → Paralyzed with the 1-minute (10-round) auto-success
// clock; a fail while Paralyzed keeps it (that clock still auto-succeeds).
// Instances process sequentially in store order; a PC under two dragons gets
// two queued prompts, each waiting indefinitely (turn-based, no-clock law).
// A sourceless te cannot be attributed to any dragon — REFUSED LOUDLY
// (no-fallbacks law; producers always stamp te.source :73, so a sourceless
// row is a GM/orphan artifact the GM must resolve; it never ladders).
export async function applyParalyzingBreathTurnEnd(campaignName, targetName, options = {}) {
    const stagedEffects = findStagedEffects(targetName, campaignName);
    if (!stagedEffects.length) {
        return { handled: false };
    }

    const skipSync = options.skipSync === true;
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const results = [];
    for (const stagedEffect of stagedEffects) {
        const casterName = stagedEffect.source;
        if (casterName == null) {
            console.error(`[paralyzingBreathService] sourceless ${PARALYZING_STAGED_TE} te on ${targetName} — refusing to adjudicate its ladder`);
            continue;
        }
        const saveDc = stagedEffect.dc ?? 24;
        const label = stagedEffect.label || 'Paralyzing Breath';
        const stage = derivedStage(stagedEffect);

        const { roll, saveBonus, success } = await resolveRepeatSave({ csCreature, targetName, casterName, saveDc, campaignName, label });
        const total = roll + saveBonus;

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
            endStagedParalysis({ targetName, casterName, campaignName, skipSync, label, stage });
        } else if (stage === 'paralyzed') {
            // remains Paralyzed — write-inert, that clock still auto-succeeds.
        } else {
            escalateToParalyzed({ targetName, casterName, campaignName, skipSync, label, paralyzedRounds: stagedEffect.paralyzedRounds });
        }
        results.push({ source: casterName, success, roll, total });
    }

    if (!results.length) return { handled: false };
    return { handled: true, results };
}
