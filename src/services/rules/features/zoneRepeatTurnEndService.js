// H3 (§17 hardening): turn-END zone-damage repeat consumer.
// Producers armed zones with `repeatTurnEnd` (MA-0042 lane: Insect Cloud on
// the black-dragon family) while the arm prose confessed "Repeat damage at
// turn end — GM-enforced (no turn-end zone-damage consumer)". That gap dies
// here: at the end of a te-holder's own turn (navigationHandlers
// applyOutgoingTurnEndPasses seam, beside repeatSaveService's condition-only
// pass), every armed te with repeatTurnEnd + a save DC repeats its save —
// NPC auto-rolls inline, PC gets the queued save-listener prompt (indefinite
// wait, no-timers compliant) — and untyped zone damage lands through the
// whirlwind/MA-0367 direct-HP idiom (full on fail, half on success, RAW
// insect-cloud "half damage on a successful save").
//
// Repeatability contract:
// • ENFORCEMENT-GATED (§17): live only while enforcement.mode === 'on' AND
//   enforcement.zones === true — unlike the MA lanes above (which engaged on
//   authored rows unconditionally), this is NEW engine behavior, so L1–4
//   byte parity is absolute: OFF ⇒ zero rolls, zero writes, advisory prose
//   stays truthful.
// • dice/dc/saveType ride the caster tracking key stamped at arm time
//   (`_${effectKey}_${caster}` from SaveAttackAoeModal.armZoneTargets) —
//   the te payload is never mutated (MA byte-inertia preserved).
// • round+effect latch on the victim store stops intra-round double ticks
//   (Next-click races); the §8.3 expiry clocks already strip armed tes.
// • zone OCCUPANCY truth: the te set selected at arm time is the victim
//   set (the picker lane never learns map cells — a creature wandering into
//   a live cloud mid-combat stays GM-adjudicated, logged honestly).

import { cloneDeep } from 'lodash';
import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { getEffectDefinition } from '../../combat/conditions/targetEffectDefinitions.js';
import storage from '../../ui/storage.js';

export const ZONE_REPEAT_LATCH_KEY = '_zoneRepeatTurnEnd_latch';

export function isZonesEnforced(campaignName) {
    const enforcement = getRuntimeValue('campaign', 'enforcement', campaignName);
    return enforcement?.mode === 'on' && enforcement?.zones === true;
}

function trackingKeyFor(te) {
    return `_${te.effect}_${String(te.source || '').replace(/\s+/g, '_')}`;
}

// Dice precedence: te.recurringDie (authored zone.recurring_damage) →
// caster tracking stamp damage (the picker's primary dice, insect-cloud's
// ONLY source) → null (skip with a loud error — never fabricate a die).
function resolveZoneDice(campaignName, te) {
    if (te.recurringDie) return String(te.recurringDie).toLowerCase();
    const stamp = te.source ? getRuntimeValue(te.source, trackingKeyFor(te), campaignName) : null;
    if (stamp?.damage) return String(stamp.damage).toLowerCase();
    return null;
}

function resolveZoneSave(campaignName, te) {
    const stamp = te.source ? getRuntimeValue(te.source, trackingKeyFor(te), campaignName) : null;
    const dc = te.dc ?? stamp?.saveDc ?? null;
    const saveType = stamp?.saveType || te.saveType || null;
    if (dc == null || !saveType) return null;
    return { dc: Number(dc), saveType: String(saveType) };
}

function latchedThisRound(campaignName, targetName, effectKey, round) {
    const latch = getRuntimeValue(targetName, ZONE_REPEAT_LATCH_KEY, campaignName) || {};
    return Number(latch[effectKey]) === Number(round);
}

async function stampLatch(campaignName, targetName, effectKey, round) {
    const latch = getRuntimeValue(targetName, ZONE_REPEAT_LATCH_KEY, campaignName) || {};
    await setRuntimeValue(targetName, ZONE_REPEAT_LATCH_KEY, { ...latch, [effectKey]: Number(round) }, campaignName);
}

// NPC auto-rolls inline (repeatSaveService shape — cs saveBonuses, full-word
// key with 3-letter fallback). PC repeats via the queued save-listener with
// dc_success 'half' (RAW half-on-save); the prompt waits indefinitely.
async function resolveRepeatZoneSave({ campaignName, targetName, te, csCreature, save }) {
    if (csCreature?.type !== 'player') {
        const bonuses = csCreature?.saveBonuses || {};
        const key = save.saveType.toLowerCase();
        const saveBonus = Number(bonuses[key] ?? bonuses[key.substring(0, 3)] ?? 0);
        const roll = Math.floor(Math.random() * 20) + 1;
        return { roll, saveBonus, success: (roll + saveBonus) >= save.dc };
    }
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: save.saveType.toUpperCase().substring(0, 3),
        saveDc: save.dc,
        dcSuccess: 'half',
        condition: `${getEffectDefinition(te.effect)?.label || 'Zone'} (zone repeat save)`,
    });
    const result = await promise;
    return { roll: result.roll ?? 0, saveBonus: result.saveBonus ?? 0, success: result.success };
}

function victimHp({ csCreature, targetName, campaignName }) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0);
    return Number(csCreature.currentHp ?? csCreature.hit_points?.current ?? 0);
}

function victimMaxHp({ csCreature, targetName, campaignName }) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0);
    return Number(csCreature.maxHp ?? 0);
}

// Untyped direct-HP loss (whirlwind/MA-0367 idiom): PC → runtime
// currentHitPoints; monster → detached combatSummary through the
// serialized write queue.
async function applyZoneHpLoss({ cs, csCreature, targetName, newHp, campaignName }) {
    if (csCreature.type === 'player') {
        await setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);
        return;
    }
    const detached = cloneDeep(cs);
    const row = (detached.creatures || []).find(c => c.name === targetName);
    if (!row) return;
    row.currentHp = newHp;
    if (row.hit_points && typeof row.hit_points === 'object') row.hit_points.current = newHp;
    setCombatSummaryCache(detached, campaignName);
    storage.set('combatSummary', detached, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

async function tickOneZone({ campaignName, targetName, te, cs, round }) {
    if (latchedThisRound(campaignName, targetName, te.effect, round)) return null;
    const die = resolveZoneDice(campaignName, te);
    const save = resolveZoneSave(campaignName, te);
    if (!die || !save) {
        console.error(`[zoneRepeatTurnEnd] armed te "${te.effect}" on ${targetName} lacks dice or save/dc — skipping (GM-enforced residual). te=${JSON.stringify(te)}`);
        return null;
    }
    const csCreature = (cs.creatures || []).find(c => c.name === targetName);
    if (!csCreature) return null;
    const currentHp = victimHp({ csCreature, targetName, campaignName });
    if (!(currentHp > 0)) return null;

    await stampLatch(campaignName, targetName, te.effect, round);

    const { roll, saveBonus, success } = await resolveRepeatZoneSave({ campaignName, targetName, te, csCreature, save });
    const rolled = rollExpression(die);
    const raw = rolled ? Number(rolled.total) : 0;
    const damage = success ? Math.floor(raw / 2) : raw;
    const newHp = Math.max(0, currentHp - damage);
    if (damage > 0) await applyZoneHpLoss({ cs, csCreature, targetName, newHp, campaignName });

    await logZoneTick({ campaignName, targetName, te, save, die, roll, saveBonus, success, raw, damage, newHp, csCreature });
    return { effect: te.effect, success, raw, damage, newHp };
}

async function logZoneTick({ campaignName, targetName, te, save, die, roll, saveBonus, success, raw, damage, newHp, csCreature }) {
    const label = getEffectDefinition(te.effect)?.label || String(te.effect).replace(/_/g, ' ');
    const total = roll + saveBonus;
    await addEntry(campaignName, {
        type: 'save_result',
        characterName: targetName,
        rollType: 'zone-repeat-save',
        targetName,
        saveDc: save.dc,
        saveType: save.saveType,
        success,
        roll,
        total,
        saveBonus,
        description: success
            ? `${targetName} succeeded its turn-end ${save.saveType} save vs ${label} (DC ${save.dc}, rolled ${roll} + ${saveBonus} = ${total}) — half of ${raw} (${damage}) damage.`
            : `${targetName} failed its turn-end ${save.saveType} save vs ${label} (DC ${save.dc}, rolled ${roll} + ${saveBonus} = ${total}) — takes ${damage} damage (${die}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[zoneRepeatTurnEnd:save]', e); });

    if (damage <= 0) return;
    await addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        sourceName: te.source || undefined,
        delta: -damage,
        currentHp: newHp,
        maxHp: victimMaxHp({ csCreature, targetName, campaignName }),
        isHealing: false,
        isUnconscious: newHp <= 0,
        note: `${label} turn-end repeat damage ${damage} (${die}${success ? ', halved by save' : ''}) from ${te.source || 'a lair zone'}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[zoneRepeatTurnEnd:hp]', e); });
}

// Turn-END consumer (navigationHandlers.applyOutgoingTurnEndPasses seam).
// OFF ⇒ zero reads beyond the enforcement flag, zero writes (L1–4 parity).
export async function applyZoneRepeatTurnEnd(campaignName, targetName) {
    if (!campaignName || !targetName) return { handled: false };
    if (!isZonesEnforced(campaignName)) return { handled: false };

    const stored = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const tes = stored.filter(te => te && te.target === targetName && te.repeatTurnEnd === true);
    if (tes.length === 0) return { handled: false };

    const cs = await loadCombatSummary(campaignName);
    if (!cs?.creatures) return { handled: false };
    const round = Number(cs.round ?? 1) || 1;

    const results = [];
    for (const te of tes) {
        const outcome = await tickOneZone({ campaignName, targetName, te, cs, round });
        if (outcome) results.push(outcome);
    }
    return { handled: true, results };
}
