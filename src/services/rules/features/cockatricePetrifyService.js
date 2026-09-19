import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

// MA-0501: Cockatrice Petrifying Bite. A composite attack+save row — the
// 1d4+1 Piercing damage rides the ATTACK HIT (dc_success:"full" so a
// successful rider save still pays full damage, MA-0367 mode); the CON save
// (DC 11) gates only the petrify ladder. First failed save → Restrained +
// staged te; the target repeats the save at the end of its next turn while
// Restrained (success ends it); a SECOND failure — repeat save OR a fresh
// bite on an already-Restrained target — Petrifies for 24 hours
// (petrified_hours×600 rounds clock, CLA-334 hours×600).
//
// paralyzingBreathService (MA-0248) / beholderEyeRayService petrification
// ladder (MA-0374) shapes — own registered te key so the Silver Dragon and
// Beholder ladders stay inert. Never prose-parsed: arms ONLY on the
// authored structured staged_petrify key.

export const PETRIFYING_BITE_STAGED_TE = 'petrifying_bite_staged';
const DEFAULT_PETRIFIED_ROUNDS = 14400; // 24 hours × 600 rounds (CLA-334)

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function targetOf(te) {
    return Array.isArray(te?.target) ? te.target[0] : te?.target;
}

function findStagedEffect(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.find(te => te.effect === PETRIFYING_BITE_STAGED_TE && targetOf(te) === targetName) || null;
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
        effect: PETRIFYING_BITE_STAGED_TE,
        source: casterName,
        condition: 'restrained',
        stage: 'restrained',
        dc: saveDc,
        saveType: String(options.saveType || 'CON').toUpperCase(),
        duration: 'ladder_until_second_failure',
        label: options.label || 'Petrifying Bite',
        petrifiedRounds: options.petrifiedRounds ?? DEFAULT_PETRIFIED_ROUNDS,
    };
}

// Second failure: Restrained → Petrified for petrified_hours (ONE clock,
// playbook §5), te retired so no further repeat saves fire (playbook §70:
// Petrified 24h persists by clock, no rescue-engine consumer).
function escalateToPetrified({ effects, idx, targetName, casterName, campaignName, skipSync, label, petrifiedRounds }) {
    if (idx >= 0) effects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    removeCondition(targetName, 'restrained', campaignName, skipSync);
    applyCondition(targetName, 'petrified', campaignName, skipSync);
    addExpiration({ attackerName: casterName, targetName, effects: [
        { type: 'condition', condition: 'petrified' },
    ], campaignName, rounds: petrifiedRounds ?? DEFAULT_PETRIFIED_ROUNDS });
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Petrified',
        reason: `${label} (second failed save)`,
        sourceName: casterName,
        note: `Second failure — Petrified instead of Restrained, for ${(petrifiedRounds ?? DEFAULT_PETRIFIED_ROUNDS) / 600} hours.`,
    }).catch((e) => { console.error('[cockatricePetrifyService] Error logging petrified condition:', e); });
}

// Failed rider-save grant (NPC inline seam handleNpcSaveDamage + PC prompt
// seam saveProcessing both route here). No staged te → first failure:
// Restrained + ladder armed. Already Restrained-staged → second failure:
// Petrified 24 hours. Byte-inert unless context.stagedPetrify authored.
export async function stagePetrifyingBiteTargets({ campaignName, casterName, targetNames, saveDc, options = {}, skipSync = false }) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const label = options.label || 'Petrifying Bite';
    const staged = [];

    for (const targetName of targetNames) {
        const idx = effects.findIndex(te => te.effect === PETRIFYING_BITE_STAGED_TE && targetOf(te) === targetName);
        const alreadyPetrified = (getRuntimeValue(targetName, 'activeConditions', campaignName) || []).some(c => lower(c) === 'petrified');
        if (alreadyPetrified) continue;
        if (idx >= 0) {
            escalateToPetrified({ effects, idx, targetName, casterName, campaignName, skipSync, label, petrifiedRounds: options.petrifiedRounds });
            staged.push(targetName);
            continue;
        }
        applyCondition(targetName, 'restrained', campaignName, skipSync);
        effects.push(stageEffect(targetName, casterName, saveDc, options));
        staged.push(targetName);
        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Restrained',
            reason: `${label} (failed save)`,
            sourceName: casterName,
            note: 'First failure — Restrained; repeats the CON save at the end of its next turn, ending the effect on itself on a success; a second failure Petrifies it for 24 hours.',
        }).catch((e) => { console.error('[cockatricePetrifyService] Error logging restrained condition:', e); });
    }

    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
    return staged;
}

// Player repeats via queued save prompt; NPCs auto-roll inline
// (paralyzingBreathService.resolveRepeatSave shape).
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
    }).catch((e) => { console.error('[cockatricePetrifyService] Error logging repeat save:', e); });

    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success };
}

// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam —
// beside applyParalyzingBreathTurnEnd). Only the Restrained stage repeats the
// save ("repeats the save at the end of its next turn if it is still
// Restrained"); success sheds Restrained + retires the ladder, a failure is
// the second failure → Petrified 24 hours (clock). Petrified stage never
// repeats — it expires on the petrified_hours clock.
export async function applyPetrifyingBiteTurnEnd(campaignName, targetName, options = {}) {
    const stagedEffect = findStagedEffect(targetName, campaignName);
    if (!stagedEffect || stagedEffect.stage !== 'restrained') {
        return { handled: false };
    }

    const skipSync = options.skipSync === true;
    const saveDc = stagedEffect.dc ?? 11;
    const casterName = stagedEffect.source;
    const label = stagedEffect.label || 'Petrifying Bite';
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);

    const { roll, saveBonus, success } = await resolveRepeatSave({ csCreature, targetName, casterName, saveDc, campaignName, label });
    const total = roll + saveBonus;

    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = effects.findIndex(te => te.effect === PETRIFYING_BITE_STAGED_TE && targetOf(te) === targetName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-petrifying-repeat',
        targetName,
        saveDc,
        saveType: 'CON',
        success,
        roll,
        total,
        saveBonus,
        description: success
            ? `${targetName} succeeded on its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — ${label} ends.`
            : `${targetName} failed its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — becomes Petrified for 24 hours.`,
    }).catch((e) => { console.error('[cockatricePetrifyService] Error logging repeat save result:', e); });

    if (success) {
        if (idx >= 0) effects.splice(idx, 1);
        setRuntimeValue('campaign', 'targetEffects', effects, campaignName, skipSync);
        removeCondition(targetName, 'restrained', campaignName, skipSync);
        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Restrained',
            reason: `${label} ends (repeat save succeeded)`,
            sourceName: casterName,
        }).catch((e) => { console.error('[cockatricePetrifyService] Error logging condition removal:', e); });
        return { handled: true, success: true, roll, total };
    }

    escalateToPetrified({ effects, idx, targetName, casterName, campaignName, skipSync, label, petrifiedRounds: stagedEffect.petrifiedRounds });
    return { handled: true, success: false, roll, total };
}
