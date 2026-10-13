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
 *  - The duration text must PARSE to a finite round count — indefinite
 *    durations ("concentration", "until dismissed") get NO fabricated clock
 *    (MA-1215 discipline: never invent a clock the rules don't author).
 *  - Round conversion reuses the app-wide CLA-334 recipe (minutes×10,
 *    hours×600) — one merged addExpiration (§38, no competing clocks).
 */
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addExpiration, processExpirationList } from './expirationQueue.js';
import { KEY } from './turnStartEffects.js';
import { addEntry } from '../../ui/logService.js';

/** CLA-334 duration→rounds: "2 rounds"→2, "1 minute"→10, "8 hours"→4800.
 *  Initiative-20 lair cadence ("until initiative count 20 on the next round")
 *  maps to rounds:1 — mature at the very next round wrap, where the
 *  round-wrap drain (drainRoundWrapClocks) clears them exactly at the top of
 *  initiative — the nearest engine seam to RAW count 20.
 *  Unparseable/indefinite ⇒ undefined (no clock, never a guess). */
export function clauseDurationRounds(duration) {
    const s = String(duration || '').toLowerCase();
    const rounds = s.match(/(\d+)\s*_?\s*rounds?/);
    if (rounds) return parseInt(rounds[1], 10);
    const long = s.match(/(\d+)\s*(minute|hour)/);
    if (long) return long[2] === 'hour' ? parseInt(long[1], 10) * 600 : parseInt(long[1], 10) * 10;
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
    if (rounds == null) return null;
    addExpiration({ attackerName: ownerName, targetName, effects, campaignName, rounds });
    return rounds;
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
