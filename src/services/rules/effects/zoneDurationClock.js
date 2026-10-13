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
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from './expirationQueue.js';

/** CLA-334 duration→rounds: "2 rounds"→2, "1 minute"→10, "8 hours"→4800.
 *  Unparseable/indefinite ⇒ undefined (no clock, never a guess). */
export function clauseDurationRounds(duration) {
    const s = String(duration || '').toLowerCase();
    const rounds = s.match(/(\d+)\s*_?\s*rounds?/);
    if (rounds) return parseInt(rounds[1], 10);
    const long = s.match(/(\d+)\s*(minute|hour)/);
    if (long) return long[2] === 'hour' ? parseInt(long[1], 10) * 600 : parseInt(long[1], 10) * 10;
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
