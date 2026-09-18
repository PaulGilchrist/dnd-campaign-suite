import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';
import { registerTargetEffect } from '../../combat/conditions/targetEffectDefinitions.js';

// MA-0374: Beholder Eye Rays — per-ray failed-save grants + the two
// repeat-save ladders (Paralyzing Ray end-of-turn repeat with the 1-minute
// auto-success clock; Petrification Ray Restrained → Petrified two-stage).
// paralyzingBreathService (MA-0248) / frightfulPresenceService (MA-0048)
// shapes; distinct te keys so the Silver Dragon breath ladders stay inert.
// One addExpiration clock per ray grant (playbook §5 — never two racing
// clocks). Expiry rounds: minutes×10 / hours×600 (CLA-334).

export const EYE_RAY_PARALYZED_TE = 'eye_ray_paralyzed';
export const EYE_RAY_PETRIFYING_TE = 'eye_ray_petrifying';

const TE_VALUE_DEFAULTS = { telekinetic_movement: 30 };

function lower(value) {
    return String(value ?? '').toLowerCase();
}

function capitalize(word) {
    const s = String(word || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function targetOf(te) {
    return Array.isArray(te?.target) ? te.target[0] : te?.target;
}

function applyCondition(targetName, condition, campaignName, skipSync = false) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    if (conditions.some(c => lower(c) === lower(condition))) return;
    setRuntimeValue(targetName, 'activeConditions', [...conditions, condition], campaignName, skipSync);
}

function removeCondition(targetName, condition, campaignName, skipSync = false) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const filtered = conditions.filter(c => lower(c) !== lower(condition));
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName, skipSync);
    }
}

function removeStagedTe(campaignName, targetName, effectKey, attackerName) {
    const effects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const idx = effects.findIndex(te => te.effect === effectKey && targetOf(te) === targetName && te.source === attackerName);
    if (idx >= 0) effects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName, true);
}

// Failed-save grants for the picked ray (invoked from saveProcessing on a
// failed save; damage + plain condition legs ride the standard seam).
export async function applyEyeRayFailedGrants({ campaignName, attackerName, targetName, ray }) {
    if (!ray || !targetName) return;
    if (ray.ladder === 'paralyzed') return stageParalyzedRay({ campaignName, attackerName, targetName, ray });
    if (ray.ladder === 'petrification') return stagePetrificationRay({ campaignName, attackerName, targetName, ray });

    const teGrants = Array.isArray(ray.te_grants) ? ray.te_grants : [];
    for (const effectKey of teGrants) {
        const extra = {};
        const value = TE_VALUE_DEFAULTS[effectKey];
        if (value != null) extra.value = value;
        extra.saveType = String(ray.save_ability || '').toUpperCase();
        registerTargetEffect(campaignName, targetName, effectKey, attackerName, extra);
    }
    const rounds = Number(ray.clock_rounds);
    if (Number.isFinite(rounds) && rounds > 0) {
        const effects = teGrants.map(effectKey => ({ type: 'remove_target_effect', effectKey, source: attackerName, target: targetName }));
        for (const cond of (ray.conditions || [])) {
            effects.push({ type: 'condition', condition: cond });
        }
        addExpiration({ attackerName, targetName, effects, campaignName, rounds });
    }
}

async function stageParalyzedRay({ campaignName, attackerName, targetName, ray }) {
    applyCondition(targetName, 'paralyzed', campaignName);
    registerTargetEffect(campaignName, targetName, EYE_RAY_PARALYZED_TE, attackerName, {
        dc: ray.save_dc ?? 16,
        saveType: 'CON',
        stage: 'paralyzed',
        duration: 'repeat_save_each_turn_end',
    });
    addExpiration({ attackerName, targetName, campaignName, rounds: 10, effects: [
        { type: 'condition', condition: 'paralyzed' },
        { type: 'remove_target_effect', effectKey: EYE_RAY_PARALYZED_TE, source: attackerName, target: targetName },
    ] });
    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Paralyzed',
        sourceName: attackerName,
        sourceAbility: 'Paralyzing Ray (Eye Rays)',
        note: 'Repeats the CON save at the end of each of its turns, ending the effect on itself on a success; after 1 minute it succeeds automatically.',
        timestamp: Date.now(),
    }).catch(e => console.error('[beholderEyeRayService:paralyzed-granted]', e));
}

async function stagePetrificationRay({ campaignName, attackerName, targetName, ray }) {
    applyCondition(targetName, 'restrained', campaignName);
    registerTargetEffect(campaignName, targetName, EYE_RAY_PETRIFYING_TE, attackerName, {
        dc: ray.save_dc ?? 16,
        saveType: 'CON',
        stage: 'restrained',
        duration: 'ladder_until_repeat_save',
    });
    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Restrained',
        sourceName: attackerName,
        sourceAbility: 'Petrification Ray (Eye Rays)',
        note: 'First failure — Restrained; repeats the CON save at the end of its next turn, a second failure Petrifies it instead.',
        timestamp: Date.now(),
    }).catch(e => console.error('[beholderEyeRayService:petrify-stage1]', e));
}

// Turn-END repeat-save consumer (navigationHandlers.applyOutgoingTurnEndPasses
// seam): Paralyzing Ray ladder repeats the CON save at the end of each of the
// target's turns (auto-success rides the rounds:10 expiration clock);
// Petrification ladder resolves at the end of the next turn — success sheds
// Restrained, a second failure becomes Petrified.
export async function applyEyeRaysTurnEnd(campaignName, targetName, options = {}) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const te = effects.find(te2 => (te2.effect === EYE_RAY_PARALYZED_TE || te2.effect === EYE_RAY_PETRIFYING_TE) && targetOf(te2) === targetName);
    if (!te) return { handled: false };

    const skipSync = options.skipSync === true;
    const saveDc = te.dc ?? 16;
    const attackerName = te.source;
    const cs = getCombatSummary(campaignName);
    const csCreature = cs?.creatures?.find(c => c.name === targetName);
    const { roll, saveBonus, success } = await resolveEyeRayRepeatSave({ csCreature, targetName, attackerName, saveDc, campaignName, te });
    const total = roll + saveBonus;

    await addEntry(campaignName, {
        type: 'save_result',
        characterName: attackerName,
        rollType: te.effect === EYE_RAY_PETRIFYING_TE ? 'save-petrification-repeat' : 'save-paralyzing-repeat',
        targetName,
        saveDc,
        saveType: 'CON',
        success,
        roll,
        total,
        saveBonus,
        description: describeRepeatSave({ te, targetName, roll, saveBonus, total, success, saveDc }),
        timestamp: Date.now(),
    }).catch(e => console.error('[beholderEyeRayService:repeat-save-log]', e));

    if (success) {
        removeStagedTe(campaignName, targetName, te.effect, attackerName);
        removeCondition(targetName, te.effect === EYE_RAY_PETRIFYING_TE ? 'restrained' : 'paralyzed', campaignName, skipSync);
        await addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: capitalize(te.effect === EYE_RAY_PETRIFYING_TE ? 'restrained' : 'paralyzed'),
            reason: 'Eye Ray repeat save succeeded',
            sourceName: attackerName,
            timestamp: Date.now(),
        }).catch(e => console.error('[beholderEyeRayService:repeat-success]', e));
        return { handled: true, success: true, roll, total };
    }

    if (te.effect === EYE_RAY_PETRIFYING_TE) {
        removeStagedTe(campaignName, targetName, te.effect, attackerName);
        removeCondition(targetName, 'restrained', campaignName);
        applyCondition(targetName, 'petrified', campaignName);
        await addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Petrified',
            sourceName: attackerName,
            sourceAbility: 'Petrification Ray (Eye Rays)',
            note: 'Second failure — Petrified instead of Restrained.',
            timestamp: Date.now(),
        }).catch(e => console.error('[beholderEyeRayService:petrify-stage2]', e));
    }
    return { handled: true, success: false, roll, total };
}

function describeRepeatSave({ te, targetName, roll, saveBonus, total, success, saveDc }) {
    if (success) {
        return `${targetName} succeeded on its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — the Eye Ray effect ends.`;
    }
    if (te.effect === EYE_RAY_PETRIFYING_TE) {
        return `${targetName} failed its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — becomes Petrified.`;
    }
    return `${targetName} failed its repeat Constitution save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total}) — remains Paralyzed (auto-succeeds after 1 minute).`;
}

// PC targets get the queued save prompt; NPC/monster targets auto-roll their
// authored CON bonus (paralyzingBreathService.resolveRepeatSave shape).
async function resolveEyeRayRepeatSave({ csCreature, targetName, attackerName, saveDc, campaignName, te }) {
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
        sourceName: attackerName,
        condition: te.effect === EYE_RAY_PETRIFYING_TE ? 'Petrification Ray (repeat save)' : 'Paralyzing Ray (repeat save)',
    });
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: attackerName,
        abilityName: te.effect === EYE_RAY_PETRIFYING_TE ? 'Petrification Ray (Eye Rays)' : 'Paralyzing Ray (Eye Rays)',
        description: `${targetName} repeats its Constitution save (DC ${saveDc}) at the end of its turn.`,
        promptId,
        timestamp: Date.now(),
    }).catch(e => console.error('[beholderEyeRayService:repeat-prompt]', e));
    const saveResult = await promise;
    return { roll: saveResult.roll ?? 0, saveBonus: saveResult.saveBonus ?? 0, success: saveResult.success };
}
