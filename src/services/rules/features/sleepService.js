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

function findSleepEffect(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.find(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName) || null;
}

export function getSleepEffect(targetName, campaignName) {
    return findSleepEffect(targetName, campaignName);
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
export function sleepStageSpec(options = {}) {
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
        const existingIdx = effects.findIndex(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName);
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

// Successful repeat save: strip the staged Sleep effect and Incapacitated.
function endSleepOnSaveSuccess({ effects, idx, targetName, campaignName, skipSync, logLabel }) {
    if (idx >= 0) effects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: 'Incapacitated',
        reason: `${logLabel} ends (repeat save succeeded)`,
    }).catch((e) => { console.error('[sleepService] Error logging condition removal:', e); });
}

export async function applySleepTurnEnd(campaignName, targetName, options = {}) {
    const sleepEffect = findSleepEffect(targetName, campaignName);
    if (!sleepEffect || sleepEffect.stage !== 'incapacitated') {
        return { handled: false };
    }

    const skipSync = options.skipSync === true;
    const saveDc = sleepEffect.dc ?? 10;
    const casterName = sleepEffect.source;
    const spec = sleepStageSpec({
        saveType: sleepEffect.saveType,
        label: sleepEffect.label,
        logLabel: sleepEffect.logLabel,
        unconsciousRounds: sleepEffect.unconsciousRounds,
    });
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const { roll, saveBonus, success } = await resolveSleepRepeatSave({ csCreature, targetName, casterName, saveDc, campaignName, spec });

    const total = roll + saveBonus;
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = effects.findIndex(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName);

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
        endSleepOnSaveSuccess({ effects, idx, targetName, campaignName, skipSync, logLabel: spec.logLabel });
        return { handled: true, success: true, roll, total };
    }

    if (idx >= 0) {
        effects[idx] = { ...effects[idx], stage: 'unconscious', condition: 'unconscious' };
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    removeCondition(targetName, 'incapacitated', campaignName, skipSync);
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

    return { handled: true, success: false, roll, total };
}

export function wakeSleepTarget(campaignName, targetName, reason, options = {}) {
    const sleepEffect = findSleepEffect(targetName, campaignName);
    if (!sleepEffect) return false;

    const skipSync = options.skipSync === true;
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const filtered = effects.filter(te => !(te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName));
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, skipSync);
    removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    removeCondition(targetName, 'unconscious', campaignName, skipSync);

    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: sleepEffect.condition === 'unconscious' ? 'Unconscious' : 'Incapacitated',
        reason: `Sleep ends (${reason})`,
        sourceName: sleepEffect.source,
    }).catch((e) => { console.error('[sleepService] Error logging sleep wake:', e); });

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
