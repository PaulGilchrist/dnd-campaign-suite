/**
 * Level 5 (L5-003) §8.3 — duration-clock producer (triage category #1).
 *
 * The CONSUMER half of the expiry system is long done: every turn boundary
 * (`expireStaleEffects` at navigationHandlers/sseHandlers ticks) drains each
 * owner's `pendingExpirations` and runs `clearExpirationEffects` (~45 clear
 * types incl. remove_target_effect / remove_summoned_creatures /
 * clear_runtime_value). The GAP was producer-side: monster zone/summon/aura
 * lanes registered targetEffects with authored duration PROSE but never a
 * clock — the badge stood until manual removal ("…expiry GM-enforced").
 *
 * This module closes that gap honestly:
 *  - enforcement OFF or `zones` flag off ⇒ returns null with ZERO writes —
 *    byte-identical Levels 1–4 (no extra runtime traffic at all).
 *  - The duration text must PARSE — sub-minute durations ("2 rounds",
 *    initiative-count-20) arm finite round clocks; indefinite durations
 *    ("concentration", "until dismissed") get NO fabricated clock
 *    (MA-1215 discipline: never invent a clock the rules don't author).
 *  - no-timers plan T3 (AGENTS.md): authored durations ≥1 MINUTE are
 *    COMBAT-SCOPED (`until: 'combat'`, rounds Infinity) — never round
 *    countdowns. They end only at a new initiative roll, a short rest, or a
 *    long rest via the sweep seams below. (CLA-334 minutes×10/hours×600
 *    retired for these; one merged addExpiration §38.)
 */
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addExpiration, processExpirationList, sweepCombatScopedExpirations } from './expirationQueue.js';
import { KEY } from './turnStartEffects.js';
import { addEntry } from '../../ui/logService.js';

/** Duration→rounds for SUB-MINUTE authored durations only: "2 rounds"→2.
 *  Initiative-20 lair cadence ("until initiative count 20 on the next round")
 *  maps to rounds:1 — mature at the very next round wrap, where the
 *  round-wrap drain (drainRoundWrapClocks) clears them exactly at the top of
 *  initiative — the nearest engine seam to RAW count 20.
 *  ≥1 MINUTE durations return undefined HERE — they are COMBAT-SCOPED, not
 *  countdowns (no-timers plan T3, AGENTS.md): see clauseCombatScopedDuration.
 *  Unparseable/indefinite ⇒ undefined (no clock, never a guess). */
export function clauseDurationRounds(duration) {
    const s = String(duration || '').toLowerCase();
    const rounds = s.match(/(\d+)\s*_?\s*rounds?/);
    if (rounds) return parseInt(rounds[1], 10);
    const long = s.match(/(\d+)\s*(minute|hour)/);
    if (long) return undefined; // ≥1 minute ⇒ combat-scoped, never a round countdown
    const initIdx = s.indexOf('initiative');
    if (initIdx >= 0) {
        // Guard: "until the dragon uses this lair action again or dies; mud
        // hardens at initiative count 20" is BOUNDED BY RE-CREST, not by the
        // initiative clause — never clock those to the cadence.
        const boundedBy = ['again', 'dies', 'dismissed'].map((t) => s.indexOf(t)).filter((i) => i >= 0);
        if (boundedBy.length && Math.min(...boundedBy) < initIdx) return undefined;
        return 1;
    }
    return undefined;
}

/** no-timers plan T3: authored durations of ≥1 MINUTE are combat-scoped —
 *  they last the WHOLE combat and end only at a new initiative roll, a short
 *  rest, or a long rest (sweepCombatScopedExpirations). The old CLA-334
 *  minutes×10/hours×600 round countdowns are retired for these. */
export function clauseCombatScopedDuration(duration) {
    return /(\d+)\s*(minute|hour)/.test(String(duration || '').toLowerCase());
}

/** One log-prose recipe for every armed-clock consumer. */
export function durationArmNote(armedRounds) {
    return armedRounds === 'combat'
        ? 'combat-scoped — lasts the whole combat, swept at the next initiative roll or a rest (enforcement: zones)'
        : `${armedRounds} rounds (enforcement: zones)`;
}

/** True only while enforcement.mode==='on' AND the zones flag is on. */
export function zonesClockEnforcementLive(campaignName) {
    if (!campaignName) return false;
    const enforcement = getRuntimeValue('campaign', 'enforcement');
    return !!enforcement && enforcement.mode === 'on' && !!enforcement.zones;
}

/**
 * Arm one engine expiry clock for an authored duration — ONLY when the
 * zones enforcement flag is live and the duration parses. Returns the armed
 * rounds, or null (no clock — advisory stays as written).
 *
 * @param {object} ctx
 * @param {string} ctx.campaignName
 * @param {string} ctx.ownerName     store the clock rides on (the caster)
 * @param {string} ctx.targetName    clearExpirationEffects' target name
 * @param {Array}  ctx.effects       clearExpirationEffects effect entries
 * @param {string|null} ctx.durationText  authored duration ('1 minute'…)
 */
export function armDurationClockIfEnforced(ctx) {
    const { campaignName, ownerName, targetName, effects, durationText } = ctx;
    if (!campaignName || !ownerName || !Array.isArray(effects) || effects.length === 0) return null;
    if (!zonesClockEnforcementLive(campaignName)) return null;
    const rounds = clauseDurationRounds(durationText);
    if (rounds != null) {
        addExpiration({ attackerName: ownerName, targetName, effects, campaignName, rounds });
        return rounds;
    }
    // no-timers T3: authored ≥1 minute ⇒ combat-scoped, never a countdown.
    if (clauseCombatScopedDuration(durationText)) {
        addExpiration({ attackerName: ownerName, targetName, effects, campaignName, rounds: Infinity, until: 'combat' });
        return 'combat';
    }
    return null;
}

/**
 * no-timers plan T4 seams — combat-scoped sweeps.
 *
 * NEW COMBAT (a fresh initiative roll): every combat-scoped clock across ALL
 * stores ends — the previous combat is over. Enforcement off / zones off ⇒
 * ZERO writes (byte-identical L1–4).
 */
export async function sweepNewCombatClocks(campaignName) {
    if (!campaignName || !zonesClockEnforcementLive(campaignName)) return 0;
    const swept = sweepCombatScopedExpirations({ campaignName });
    if (swept > 0) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'enforcement_clock_expired',
            characterName: 'Campaign',
            description: `New initiative roll: ${swept} combat-scoped effect${swept === 1 ? '' : 's'} ended (enforcement: zones).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[zoneDurationClock:new-combat-sweep-log]', e); });
    }
    return swept;
}

/**
 * REST seams (short & long): the resting creature's combat-scoped clocks end
 * — rests are explicit player actions, one of the three boundaries the
 * turn-based principle names. Unconditional by design: combat-scoped entries
 * are only ever written while enforcement is armed, so enforcement-off play
 * has nothing to sweep and stays byte-identical.
 */
export async function sweepRestClocks(campaignName, restKind) {
    if (!campaignName) return 0;
    const swept = sweepCombatScopedExpirations({ campaignName });
    if (swept > 0) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'enforcement_clock_expired',
            characterName: 'Campaign',
            description: `${restKind === 'long' ? 'Long' : 'Short'} rest: ${swept} combat-scoped effect${swept === 1 ? '' : 's'} ended (enforcement: zones).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[zoneDurationClock:rest-sweep-log]', e); });
    }
    return swept;
}

/**
 * §8.3 rank 3 — the initiative-count-20 cadence seam.
 *
 * Lair zones ("lasts until initiative count 20 on the next round") mature at
 * the round WRAP — the top of initiative, which is exactly where the tracker
 * fires count 20 in this engine (the lair entries have no token of their own).
 * The normal consumers only drain a store when its OWNER or TARGET becomes
 * active, so a lair zone would linger until some creature's boundary later in
 * the round. This pass drains every round-matured clock across ALL stores at
 * the wrap, independent of activity — clearExpirationEffects handlers are
 * idempotent, and expireOnCreatureName anchors are untouched here (activeName
 * is null ⇒ only pure round clocks mature).
 *
 * Enforcement OFF / zones off ⇒ ZERO writes (byte-identical L1–4).
 * Returns the number of expired clock entries (0 = nothing happened).
 */
export function drainRoundWrapClocks({ campaignName, roundToSet }) {
    if (!campaignName) return 0;
    if (!zonesClockEnforcementLive(campaignName)) return 0;
    const currentRound = Number.isFinite(roundToSet) ? roundToSet : getCurrentCombatRound(campaignName);
    let drained = 0;
    const allKeys = getAllStoreKeys() || [];
    for (const key of allKeys) {
        if (typeof key !== 'string') continue;
        const list = getRuntimeValue(key, KEY);
        if (!Array.isArray(list) || !list.length) continue;
        const { processed, expiredCount, changed } = processExpirationList(list, currentRound, key, campaignName, null);
        if (changed) {
            setRuntimeValue(key, KEY, processed, campaignName);
            drained += expiredCount;
        }
    }
    if (drained > 0) {
        addEntry(campaignName, {
            type: 'automation',
            automationType: 'enforcement_clock_expired',
            characterName: 'Campaign',
            description: `Initiative-20 cadence: ${drained} zone/effect clock${drained === 1 ? '' : 's'} expired at the round-${currentRound} wrap (enforcement: zones).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[zoneDurationClock:round-wrap-drain-log]', e); });
    }
    return drained;
}
