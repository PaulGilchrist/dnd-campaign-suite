// Shared AC computation for attack rolls (hit resolution and roll logging).

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { readCoverShot } from '../../services/combat/coverService.js';

// SP-013: Barkskin floor: AC can't be less than 17 (2024; display consumers
// displayCreatureUtils.js / CharSummary.jsx stamp 17). FLOOR semantics, NOT an
// additive buff — shield/staff/warding bonuses still fold on top in
// computeEffectiveAc (hitResolution.js), mirroring how getShieldAcBonus /
// getParryAcBonus ride the defender's activeBuffs channel.
export function isBarkskinAcFloorActive(targetName, campaignName) {
    if (!targetName || !campaignName) return false;
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return Array.isArray(activeBuffs) && activeBuffs.some(b => b && b.effect === 'barkskin');
}

// RAW no-stacking law (PHB 2024 "Cover": "when a target has cover from more
// than one source, only the greatest degree applies") across the COVER
// CHANNEL INTERSECTION: the §8.3 enforcement-zones stamp (campaign
// `_cover_shot`, +2 half cover) vs the furniture/prop cover riding the shot
// context (contextBuilder-map → context.coverAcBonus, added later by
// computeEffectiveAc in hitResolution.js). The stamp only folds when it BEATS
// the context bonus; whenever the context bonus is ≥ the stamp it carries the
// single applied cover instead, so the two lanes never sum (+4 on one shot).
// A winning stamp folds INTO THE CONTEXT COVER CHANNEL (coverAcBonus/
// coverLevel/coverReason, mirrored on the furniture lane's shape) instead of
// bumping targetAc: the stored row keeps targetAc RAW and carries the applied
// bonus + tier + blocking-creature reason itself, so `targetAc + coverAcBonus`
// (the audit message's arithmetic) equals the AC the resolver adjudicated AND
// the enforcement-folded row annotates in the same chip vocabulary as the
// furniture row (`vs AC 17 (1/2 Cover +2 AC)`) — one accessor tells the whole
// story, no bare bumped `vs AC 17`.
function foldStampCover(context, target, campaignName) {
    // An auto-denied line (full-cover AUTO-MISS / out-of-range AUTO-MISS) is
    // already decided — a half-cover bonus can never rescue it, so the stamp
    // stays off the row and its face stays byte-identical.
    if (context.isAutoMiss) return;
    const contextCoverAcBonus = Number(context.coverAcBonus) || 0;
    const stamp = readCoverShot(context, target.name, campaignName, getCurrentCombatRound(campaignName));
    if (!stamp || stamp.ac <= contextCoverAcBonus) return;
    context.coverAcBonus = stamp.ac;
    // The §8.3 gate only ever stamps half cover (+2, HALF_COVER_AC) — three-
    // quarters needs 75% obscuration, never fabricated from a token grid.
    context.coverLevel = 'half';
    // Name the blocking creature ('FeyRanger'-style) so prose/search/AI see the
    // source — mirrors finalizeCover's furniture law: set only when unset.
    if (!context.coverReason) context.coverReason = stamp.blocker;
}

export function computeTargetAc(context, target, characters, campaignName) {
    if (context?.rollType !== 'attack' || !target) {
        return undefined;
    }
    let targetAc;
    if (target.type === 'player') {
        const playerChar = (characters || []).find(c => c.name === target.name);
        const playerComputed = playerChar?.computedStats || playerChar;
        targetAc = playerComputed?.armorClass ?? playerChar?.armorClass;
    } else {
        targetAc = target.ac;
    }
    if (typeof targetAc !== 'number') {
        throw new Error(`[AC] Target "${target.name}" has no AC defined.`);
    }
    if (isBarkskinAcFloorActive(target.name, campaignName)) {
        targetAc = Math.max(targetAc, 17);
    }
    // L5-003 §8.3 cover: half-cover stamp armed by the LoS/cover gate at
    // this shot's click (sync cached read). A winning stamp rides the context
    // cover channel (stacks ON TOP of the Barkskin floor — floor is a base-AC
    // rule; +2 is a circumstance bonus added by computeEffectiveAc), never a
    // bumped targetAc. Matched by attacker + target + round; clear shots write
    // null so a clean line never gains the bonus. Zones off ⇒ stamp never
    // written ⇒ byte-parity.
    foldStampCover(context, target, campaignName);
    return targetAc;
}
