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

export async function isSleepImmune(campaignName, csCreature, characters) {
    if (!csCreature) return false;

    const monsterType = lower(csCreature.monsterType);
    if (monsterType === 'undead' || monsterType === 'construct') return true;

    const csImmunities = (csCreature.immunities || []).map(lower);
    if (blocksSleepViaImmunities(csImmunities)) return true;

    if (csCreature.type === 'player') {
        const character = (characters || []).find(ch => ch.name === csCreature.name);
        const stats = character?.computedStats || character;
        if (stats) {
            if (hasTranceTrait(stats)) return true;
            const immunities = (stats.immunities || []).map(lower);
            if (blocksSleepViaImmunities(immunities)) return true;
        }
        return false;
    }

    const monster = await getMonsterData(csCreature.name);
    if (monster) {
        const conditionImmunities = (monster.condition_immunities || monster.immunities || []).map(lower);
        if (conditionImmunities.includes('exhaustion')) return true;
    }
    return false;
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

export async function stageSleepTargets(campaignName, casterName, targetNames, saveDc) {
    const staged = [];
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];

    for (const targetName of targetNames) {
        applyCondition(targetName, 'incapacitated', campaignName, false);

        const sleepEffect = {
            target: targetName,
            effect: SLEEP_TE_EFFECT,
            source: casterName,
            condition: 'incapacitated',
            stage: 'incapacitated',
            dc: saveDc,
            saveType: 'WIS',
            duration: 'concentration',
        };
        const existingIdx = effects.findIndex(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName);
        if (existingIdx >= 0) {
            effects[existingIdx] = sleepEffect;
        } else {
            effects.push(sleepEffect);
        }
        staged.push(targetName);
    }

    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

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

export async function applySleepTurnEnd(campaignName, targetName, options = {}) {
    const sleepEffect = findSleepEffect(targetName, campaignName);
    if (!sleepEffect || sleepEffect.stage !== 'incapacitated') {
        return { handled: false };
    }

    const skipSync = options.skipSync === true;
    const saveDc = sleepEffect.dc ?? 10;
    const casterName = sleepEffect.source;
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    let roll;
    let saveBonus = 0;
    let success;

    if (csCreature?.type === 'player') {
        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'WIS',
            saveDc,
            dcSuccess: 'none',
            sourceName: casterName,
            condition: 'Sleep (repeat save)',
        });
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Sleep',
            description: `${targetName} repeats its Wisdom save (DC ${saveDc}) at the end of its turn.`,
            promptId,
        }).catch((e) => { console.error('[sleepService] Error logging repeat save:', e); });

        const saveResult = await promise;
        roll = saveResult.roll ?? 0;
        saveBonus = saveResult.saveBonus ?? 0;
        success = saveResult.success;
    } else {
        saveBonus = csCreature?.saveBonuses?.wis ?? 0;
        roll = Math.floor(Math.random() * 20) + 1;
        success = (roll + saveBonus) >= saveDc;
    }

    const total = roll + saveBonus;
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = effects.findIndex(te => te.effect === SLEEP_TE_EFFECT && targetOf(te) === targetName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-sleep-repeat',
        targetName,
        saveDc,
        saveType: 'WIS',
        success,
        roll,
        total,
        saveBonus,
        description: success
            ? `${targetName} succeeded on its repeat Wisdom save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — Sleep ends.`
            : `${targetName} failed its repeat Wisdom save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — falls Unconscious.`,
    }).catch((e) => { console.error('[sleepService] Error logging repeat save result:', e); });

    if (success) {
        if (idx >= 0) effects.splice(idx, 1);
        setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
        removeCondition(targetName, 'incapacitated', campaignName, skipSync);
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Incapacitated',
            reason: 'Sleep spell ends (repeat save succeeded)',
        }).catch((e) => { console.error('[sleepService] Error logging condition removal:', e); });
        return { handled: true, success: true, roll, total };
    }

    if (idx >= 0) {
        effects[idx] = { ...effects[idx], stage: 'unconscious', condition: 'unconscious' };
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    removeCondition(targetName, 'incapacitated', campaignName, skipSync);
    applyCondition(targetName, 'unconscious', campaignName, skipSync);
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'unconscious' },
        { type: 'remove_target_effect', effectKey: SLEEP_TE_EFFECT, source: casterName, target: targetName },
    ], campaignName, 10);
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Unconscious',
        reason: 'Sleep spell (failed repeat save)',
        sourceName: casterName,
        note: `${targetName} falls Unconscious until the spell ends. The spell ends early if ${targetName} takes damage or someone within 5 feet uses an action to shake it awake.`,
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

export async function triggerSleep(spell, metaCtx, playerStats, campaignName, mapName, characters) {
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
