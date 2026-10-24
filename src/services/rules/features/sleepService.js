import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { hasTranceTrait } from '../effects/tranceRules.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';
import { executeHandler } from '../../automation/index.js';

export const SLEEP_TE_EFFECT = 'sleep_staged';

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function targetOf(te) {
    return Array.isArray(te?.target) ? te.target[0] : te?.target;
}

// fix#343 (#1414 te-source collision class, reader half; fix#112 weakeningBreath
// precedent): ALL instances of the key on the target — every distinct-source te
// adjudicates its OWN ladder at its OWN dc/saveType. Identity law: the registry
// dedups target+effect+source (targetEffectDefinitions.js:1508-1509) and every
// producer stamps te.source=casterName (stageSleepEffect :108; sleepHandler.js:194
// casterName=playerStats.name :107; SaveAttackAoeModal :766 same) — census proved
// producers complete, so this is a purely reader-side fix. Pre-fix `.find` picked
// the first row and silently adjudicated a second dragon's CON ladder at the
// spell's (or another dragon's) dc envelope.
function findSleepEffects(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.filter(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName);
}

function sleepIndex(effects, targetName, casterName) {
    return effects.findIndex(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName && te.source === casterName);
}

// Sibling-ladder guard (fix#343): conditions are TARGET-scoped stores — while
// another source's sleep ladder on the same target still rides `stage`
// (strict lowercase — the :197 gate law), the stored condition belongs to it.
function siblingSleepHoldsStage(effects, targetName, stage) {
    return effects.some(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName && te.stage === stage);
}

function blocksSleepViaImmunities(immunities) {
    return immunities.includes('exhaustion') || immunities.includes('magical sleep');
}

const SLEEP_IMMUNE_MONSTER_TYPES = ['undead', 'construct'];

function playerSleepImmunity(csCreature, characters) {
    const character = (characters || []).find(ch => ch.name === csCreature.name);
    const stats = character?.computedStats || character;
    if (!stats) return false;
    if (hasTranceTrait(stats)) return true;
    return blocksSleepViaImmunities((stats.immunities || []).map(lower));
}

function monsterDataSleepImmunity(monster) {
    const conditionImmunities = (monster.condition_immunities || monster.immunities || []).map(lower);
    return conditionImmunities.includes('exhaustion');
}

export async function isSleepImmune(campaignName, csCreature, characters) {
    if (!csCreature) return false;

    if (SLEEP_IMMUNE_MONSTER_TYPES.includes(lower(csCreature.monsterType))) return true;
    if (blocksSleepViaImmunities((csCreature.immunities || []).map(lower))) return true;

    if (csCreature.type === 'player') {
        return playerSleepImmunity(csCreature, characters);
    }

    const monster = await getMonsterData(csCreature.name);
    return monster ? monsterDataSleepImmunity(monster) : false;
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

const SAVE_TYPE_WORDS = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

// Accepts 'WIS' or 'Wisdom'; defaults keep the Sleep spell byte-identical.
function saveTypeAbbr(saveType) {
    const s = String(saveType || 'wis').toLowerCase();
    if (SAVE_TYPE_WORDS[s]) return s;
    return Object.keys(SAVE_TYPE_WORDS).find(k => SAVE_TYPE_WORDS[k].toLowerCase() === s) || 'wis';
}

function saveTypeWord(saveType) {
    return SAVE_TYPE_WORDS[saveTypeAbbr(saveType)] || String(saveType || 'Wisdom');
}

// MA-0068: options parameterize monster Sleep Breath staging (CON save, no
// caster concentration, 10-minute Unconscious = 100 rounds CLA-334). Every
// default reproduces the Sleep spell shape byte-identically.
// fix#343-C adjudication of the cited "sparse-te spell-shape leak" (was
// :98-99, these ?? lines): NO shape guard added — provably consistent
// without one. Both in-game producers always stamp the FULL shape
// (stageSleepEffect :124-138: saveType/label/logLabel/unconsciousRounds
// every write), so a sparse te reaching a reader can ONLY be a GM manual
// add, and the GM adder field set for sleep_staged is ['source','dc']
// (targetEffectDefinitions.js:533) under label 'Sleep' — a badge the GM
// added with no saveType IS the spell face by registry definition. The
// defaults honor its declared shape; there is no byte to distinguish a
// mis-added BREATH intent, so a guard would invent policy (owner lane:
// adder breath-intent fields, if ever wanted).
function sleepStageSpec(options = {}) { // demoted #1420 census: ZERO external importers — callers stageSleepTargets :141 / applySleepTurnEnd per-instance loop only; test pins ride the public stageSleepTargets surface (#82-class twin of fix#297's getInspiringSmitePassives)
    const concentrate = options.concentrate !== false;
    return {
        concentrate,
        label: options.label || 'Sleep',
        logLabel: options.logLabel || 'Sleep spell',
        unconsciousRounds: options.unconsciousRounds ?? 10,
        saveType: saveTypeAbbr(options.saveType || 'WIS').toUpperCase(),
        duration: concentrate ? 'concentration' : (options.duration || 'staged_until_repeat_save'),
    };
}

function stageSleepEffect(targetName, casterName, saveDc, spec) {
    return {
        target: targetName,
        effect: SLEEP_TE_EFFECT,
        source: casterName,
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: saveDc,
        saveType: spec.saveType,
        duration: spec.duration,
        label: spec.label,
        logLabel: spec.logLabel,
        unconsciousRounds: spec.unconsciousRounds,
    };
}

export async function stageSleepTargets(campaignName, casterName, targetNames, saveDc, options = {}) {
    const spec = sleepStageSpec(options);
    const staged = [];
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];

    for (const targetName of targetNames) {
        applyCondition(targetName, 'incapacitated', campaignName, false);
        const sleepEffect = stageSleepEffect(targetName, casterName, saveDc, spec);
        // fix#343: source-matched dedup (registry law registerTargetEffect
        // :1508-1509). The CALLER knows its own source: casterName is
        // stageSleepTargets' 2nd parameter — sleepHandler.js:194 passes
        // playerStats.name (:107, the spell caster); SaveAttackAoeModal.jsx:766
        // passes the breathing dragon's name. Same-source re-cast RESETS this
        // caster's ladder (in-place replace); a DIFFERENT-source staging now
        // COEXISTS as its own ladder instead of silently clobbering the other
        // producer's CON/100-round breath envelope (pre-fix spell-vs-dragon
        // clobber pin flipped at sleepService.test.js #439/#1295).
        const existingIdx = sleepIndex(effects, targetName, casterName);
        if (existingIdx >= 0) {
            effects[existingIdx] = sleepEffect;
        } else {
            effects.push(sleepEffect);
        }
        staged.push(targetName);
    }

    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    if (!spec.concentrate) return staged;

    const cs = getCombatSummary(campaignName);
    if (cs?.creatures) {
        const caster = cs.creatures.find(c => c.name === casterName);
        if (caster && caster.concentration?.spell !== 'Sleep') {
            addConcentration(cs, casterName, 'Sleep', saveDc);
            storage.set('combatSummary', cs, campaignName);
        }
    }

    return staged;
}

// Player repeats via queued save prompt; NPCs auto-roll inline.
async function resolveSleepRepeatSave({ csCreature, targetName, casterName, saveDc, campaignName, spec }) {
    if (csCreature?.type !== 'player') {
        const saveBonus = csCreature?.saveBonuses?.[saveTypeAbbr(spec.saveType)] ?? 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        return { roll, saveBonus, success: (roll + saveBonus) >= saveDc };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: spec.saveType,
        saveDc,
        dcSuccess: 'none',
        sourceName: casterName,
        condition: `${spec.label} (repeat save)`,
    });
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: spec.label,
        description: `${targetName} repeats its ${saveTypeWord(spec.saveType)} save (DC ${saveDc}) at the end of its turn.`,
        promptId,
    }).catch((e) => { console.error('[sleepService] Error logging repeat save:', e); });

    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success };
}

// Successful repeat save: strip THIS source's staged Sleep te (+ Incapacitated
// unless a sibling ladder still rides that stage — fix#343 guard).
function endSleepOnSaveSuccess({ targetName, casterName, campaignName, skipSync, logLabel }) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = sleepIndex(effects, targetName, casterName);
    if (idx >= 0) effects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    if (!siblingSleepHoldsStage(effects, targetName, 'incapacitated')) {
        removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    }
    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: 'Incapacitated',
        reason: `${logLabel} ends (repeat save succeeded)`,
    }).catch((e) => { console.error('[sleepService] Error logging condition removal:', e); });
}

// Failed stage-1 repeat save: escalate THIS source's te to Unconscious with
// its own clock + logs (fix#343: triple-match so a sibling dragon's te on the
// same target is never the row edited).
function escalateSleepTe({ targetName, casterName, campaignName, skipSync, spec }) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = sleepIndex(effects, targetName, casterName);
    if (idx >= 0) {
        effects[idx] = { ...effects[idx], stage: 'unconscious', condition: 'unconscious' };
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    if (!siblingSleepHoldsStage(effects, targetName, 'incapacitated')) {
        removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    }
    applyCondition(targetName, 'unconscious', campaignName, skipSync);
    addExpiration({ attackerName: casterName, targetName, effects: [
        { type: 'condition', condition: 'unconscious' },
        { type: 'remove_target_effect', effectKey: SLEEP_TE_EFFECT, source: casterName, target: targetName },
    ], campaignName, rounds: spec.unconsciousRounds });
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Unconscious',
        reason: `${spec.logLabel} (failed repeat save)`,
        sourceName: casterName,
        note: `${targetName} falls Unconscious. The effect ends early if ${targetName} takes damage or someone within 5 feet uses an action to shake it awake.`,
    }).catch((e) => { console.error('[sleepService] Error logging unconscious condition:', e); });
}

// Turn-END repeat save (#1414 fix#343, fix#112 per-source-instance shape):
// every sleep_staged te on the OUTGOING creature at stage 'incapacitated'
// repeats its OWN save at its OWN dc/saveType — spell ladders (WIS) and
// breath ladders (CON, #1378 dual-face key) never inherit each other's
// envelope anymore. Instances process sequentially in store order; a PC under
// two sleep sources gets two queued prompts, each waiting indefinitely
// (turn-based, no-clock law). A sourceless te cannot be attributed — REFUSED
// LOUDLY (no-fallbacks law; producers always stamp te.source :108).
// Sparse te still defaults to the spell shape — registry-consistent, the
// GM adder offers only ['source','dc'] (targetEffectDefinitions.js:533), so
// a te missing saveType/unconsciousRounds IS the spell by definition
// (breath producers always stamp CON/rounds). #1295's saveType-discriminator
// note retired: source is now the ladder identity; saveType stays the badge's
// face, never the ladder's owner.
export async function applySleepTurnEnd(campaignName, targetName, options = {}) {
    const sleepEffects = findSleepEffects(targetName, campaignName).filter(te => te.stage === 'incapacitated');
    if (!sleepEffects.length) {
        return { handled: false };
    }

    const skipSync = options.skipSync === true;
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const results = [];
    for (const sleepEffect of sleepEffects) {
        const casterName = sleepEffect.source;
        if (casterName == null) {
            console.error(`[sleepService] sourceless ${SLEEP_TE_EFFECT} te on ${targetName} — refusing to adjudicate its ladder`);
            continue;
        }
        const saveDc = sleepEffect.dc ?? 10;
        const spec = sleepStageSpec({
            saveType: sleepEffect.saveType,
            label: sleepEffect.label,
            logLabel: sleepEffect.logLabel,
            unconsciousRounds: sleepEffect.unconsciousRounds,
        });

        const { roll, saveBonus, success } = await resolveSleepRepeatSave({ csCreature, targetName, casterName, saveDc, campaignName, spec });
        const total = roll + saveBonus;

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-sleep-repeat',
            targetName,
            saveDc,
            saveType: spec.saveType,
            success,
            roll,
            total,
            saveBonus,
            description: success
                ? `${targetName} succeeded on its repeat ${saveTypeWord(spec.saveType)} save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — ${spec.label} ends.`
                : `${targetName} failed its repeat ${saveTypeWord(spec.saveType)} save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — falls Unconscious.`,
        }).catch((e) => { console.error('[sleepService] Error logging repeat save result:', e); });

        if (success) {
            endSleepOnSaveSuccess({ targetName, casterName, campaignName, skipSync, logLabel: spec.logLabel });
        } else {
            escalateSleepTe({ targetName, casterName, campaignName, skipSync, spec });
        }
        results.push({ source: casterName, success, roll, total });
    }

    if (!results.length) return { handled: false };
    return { handled: true, results };
}

export function wakeSleepTarget(campaignName, targetName, reason, options = {}) {
    const sleepEffects = findSleepEffects(targetName, campaignName);
    if (!sleepEffects.length) return false;

    const skipSync = options.skipSync === true;
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    // fix#343 adjudication for this reader: effect+target-wide strip STAYS.
    // Every disk sleep row reads "the effect ends early if the target takes
    // damage or someone ... shakes it awake" — a wake event ends EVERY sleep
    // instance on the target simultaneously, by target scope, not source
    // scope; the callers carry no effect-source to match anyway
    // (applyDamage.js:1059 passes the SLEEPER + damage, never the waking
    // aggro's ladder owner). Source-filtering here would strand losing
    // ladders' te behind cleared conditions. Per-instance consequence of
    // multi-source coexistence: each retired te logs its OWN source/stage.
    const filtered = effects.filter(te => !(te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName));
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, skipSync);
    removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    removeCondition(targetName, 'unconscious', campaignName, skipSync);

    for (const te of sleepEffects) {
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: te.condition === 'unconscious' ? 'Unconscious' : 'Incapacitated',
            reason: `Sleep ends (${reason})`,
            sourceName: te.source,
        }).catch((e) => { console.error('[sleepService] Error logging sleep wake:', e); });
    }

    return true;
}

export function wakeSleepOnDamage(campaignName, targetName, damageDealt) {
    if (!(damageDealt > 0)) return false;
    return wakeSleepTarget(campaignName, targetName, 'target took damage');
}

export async function triggerSleep({ spell, metaCtx, playerStats, campaignName, mapName, characters }) {
    let spellSaveDc;
    if (metaCtx?.spellSaveDc == null) {
        if (playerStats.spellAbilities?.saveDc == null) {
            if (playerStats.proficiency == null) {
                console.error('[sleepService] triggerSleep: playerStats.proficiency is missing');
                throw new Error('playerStats.proficiency is required for sleep spell');
            }
            spellSaveDc = 8 + playerStats.proficiency;
        } else {
            spellSaveDc = playerStats.spellAbilities.saveDc;
        }
    } else {
        spellSaveDc = metaCtx.spellSaveDc;
    }

    const action = {
        name: spell.name,
        automation: {
            type: 'sleep',
            saveDc: spellSaveDc,
            saveType: 'WIS',
        },
        spell,
        metaCtx: { ...(metaCtx || {}), spellSaveDc },
        spellSlotLevel: (() => {
            if (metaCtx?.slotLevel == null && spell.level == null) {
                console.error('[sleepService] triggerSleep: slot level is missing (metaCtx.slotLevel and spell.level)');
                throw new Error('slot level is required for sleep spell');
            }
            return metaCtx?.slotLevel || spell.level;
        })(),
    };

    try {
        return await executeHandler(action, playerStats, campaignName, mapName, characters);
    } catch (e) {
        console.error(`[sleepService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
