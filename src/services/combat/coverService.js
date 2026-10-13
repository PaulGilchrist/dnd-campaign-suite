/**
 * Level 5 (L5-003) §8.3 — cover adjudication (last §8.3 category).
 *
 * The grid honesty ladder:
 *  - WALL cells are TOTAL cover — the §8.2 LoS gate already DENIES shots
 *    through them, so walls never become a cover bonus here (a wall is never
 *    "half" of anything in this engine).
 *  - What the engine genuinely lacked: an INTERVENING CREATURE. RAW grants
 *    the target half cover (−2 AC) when at least one combatant other than
 *    attacker and target interposes on the line — and since creatures are
 *    not obstacles in `computeMovementObstacles`, ranged shots previously
 *    sailed through friendly bodies at full AC.
 *  - Three-quarters (−5) requires measuring 75% body obscuration — NOT
 *    computable from a token grid, so it is never fabricated here
 *    (MA-1215 discipline); stacked interveners stay −2, advisory says so.
 *
 * Channel: the gate runs async at the attack/cast click (§8.2 seam), so the
 * −2 is STAMPED to `campaign/_cover_shot` {attacker, target, round} there
 * and read back SYNC by `computeTargetAc` (cached runtime read, Barkskin-
 * style) plus logged once as `enforcement_cover`. Enforcement off or zones
 * flag off ⇒ no stamp, no map consult at the seam, AC math byte-identical.
 */
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { bresenham } from '../maps/lineOfSight.js';
import { rangeToFeet } from '../rules/combat/rangeValidation.js';
import { getCurrentCombatRound } from '../encounters/combatData.js';
import { addEntry } from '../ui/logService.js';

export const COVER_SHOT_KEY = '_cover_shot';
export const HALF_COVER_AC = -2;

// Same touch/diagonal constant the §8.2 gate uses (rangeToFeet('touch')).
const TOUCH_RANGE_FT = rangeToFeet('touch');

function hasPosition(t) {
    return !!t && Number.isFinite(t.gridX) && Number.isFinite(t.gridY);
}

/** Sync pre-check: live for RANGED shots only (melee/adjacency never has an
 *  intervening body). Mirrors isLineOfSightEnforced's range discipline. */
export function isCoverEnforced(campaignName, range) {
    if (!campaignName) return false;
    const enforcement = getRuntimeValue('campaign', 'enforcement');
    if (!enforcement || enforcement.mode !== 'on' || !enforcement.zones) return false;
    const rangeFt = rangeToFeet(range);
    return !(rangeFt == null || rangeFt <= TOUCH_RANGE_FT);
}

/** Pure: first intervening creature token (not attacker, not target, not an
 *  obstacle, must be a placed creature) on the INTERIOR of the ray. */
export function findInterveningCreature({ from, to, tokens, attackerName, targetName }) {
    if (!hasPosition(from) || !hasPosition(to)) return null;
    const line = bresenham(from.gridX, from.gridY, to.gridX, to.gridY);
    for (let i = 1; i < line.length - 1; i++) {
        const cell = `${line[i].x},${line[i].y}`;
        const token = (tokens || []).find((t) =>
            hasPosition(t) && t.name && t.name !== attackerName && t.name !== targetName
            && `${t.gridX},${t.gridY}` === cell);
        if (token) return token;
    }
    return null;
}

/** Stamp the enforced half-cover onto the campaign store (ONE write, §39;
 *  replaced by the next stamped shot). A CLEAR shot writes null — wiping any
 *  stale stamp from earlier in the round so −2 never rides a clean line.
 *  Returns the stamp, or null when nothing is covered. */
export function stampCoverShot({ campaignName, attackerName, targetName, blocker, round }) {
    if (!campaignName || !attackerName || !targetName) return null;
    if (!blocker) {
        setRuntimeValue('campaign', COVER_SHOT_KEY, null, campaignName);
        return null;
    }
    const stamp = {
        attackerName,
        targetName,
        ac: HALF_COVER_AC,
        blocker: blocker.name,
        cell: `${blocker.gridX},${blocker.gridY}`,
        round: round ?? null,
    };
    setRuntimeValue('campaign', COVER_SHOT_KEY, stamp, campaignName);
    return stamp;
}

/** Sync read at the AC seam: an unexpired half-cover stamp for this
 *  attacker→target in this round? */
export function readCoverShot(context, targetName, campaignName, currentRound) {
    if (!targetName) return null;
    const stamp = getRuntimeValue('campaign', COVER_SHOT_KEY, campaignName);
    if (!stamp || stamp.targetName !== targetName) return null;
    const attacker = context?.attackerName || context?.characterName || context?.playerName || null;
    if (attacker && stamp.attackerName !== attacker) return null;
    if (stamp.round != null && currentRound != null && stamp.round !== currentRound) return null;
    return stamp;
}

/** Gate-side adjudication (called only when isCoverEnforced is true): the
 *  players array carries every placed combat token (PCs and NPCs alike);
 *  placed items never interpose. Stamps −2 (or clears the stamp on a clear
 *  line) and logs once per adjudicated shot. */
export function adjudicateCoverShot({ campaignName, attackerName, targetName, from, to, players }) {
    const creatureTokens = (players || []).filter(hasPosition);
    const blocker = findInterveningCreature({ from, to, tokens: creatureTokens, attackerName, targetName });
    const stamp = stampCoverShot({
        campaignName,
        attackerName,
        targetName,
        blocker,
        round: getCurrentCombatRound(campaignName),
    });
    if (stamp) {
        addEntry(campaignName, {
            type: 'enforcement_cover',
            creature: attackerName,
            target: targetName,
            description: `Half cover (−2 AC): ${blocker.name} interposes at (${stamp.cell}) between ${attackerName} and ${targetName} (enforcement: zones).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[coverService:cover-log] failed:', e); });
    }
    return stamp;
}
