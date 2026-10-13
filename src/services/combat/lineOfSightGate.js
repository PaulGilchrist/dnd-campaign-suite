/**
 * Level 5 (L5-003) §8.2 — line-of-sight gate.
 *
 * Turns the "target must be seen" requirement from GM adjudication into an
 * engine check for RANGED attacks/casts when `enforcement.lineOfSight` is
 * on: a target behind a wall (via `computeEffectiveWalls` — painted walls,
 * undiscovered secret doors, closed doors) is denied with a reason, popup
 * and `enforcement_denied` audit entry, exactly mirroring assertCanAct's
 * denial plumbing.
 *
 * Honesty rules:
 *  - Melee + 5-ft adjacency are UNAFFECTED (plan §8.2): ranges that parse
 *    to ≤ the touch range (8 ft — same constant rangeCheck uses for
 *    diagonals) never consult the map.
 *  - Unknown/unparseable ranges (self, special, missing) never adjudicate —
 *    the gate only speaks when the rules give it a number.
 *  - Gridless / no map / unplaced creatures degrade to ALLOW (GM carries
 *    the fiction), never to a false deny.
 *  - Enforcement off (default) ⇒ single in-memory flag read, ZERO map
 *    traffic — byte-identical Levels 1–4.
 *
 * The blocked-test is Bresenham over INTERIOR cells (endpoints excluded):
 * diagonal shots grazing a corner cell are blocked — the conservative call
 * a GM makes at the table with a straightedge; finer corner-gazing rules
 * are parked (§16).
 */
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadMapData } from '../maps/mapsService.js';
import { bresenham } from '../maps/lineOfSight.js';
import { computeMovementObstacles } from '../maps/reachability.js';
import { rangeToFeet } from '../rules/combat/rangeValidation.js';
import { addEntry } from '../ui/logService.js';

// Same touch/diagonal constant rangeValidation uses (rangeToFeet('touch')).
const TOUCH_RANGE_FT = rangeToFeet('touch'); // 8

function hasPosition(t) {
    return !!t && Number.isFinite(t.gridX) && Number.isFinite(t.gridY);
}

/** Pure: first blocking wall cell on the ray between (exclusive) endpoints,
 *  or null when the path is clear. */
export function sightBlockedBetween(from, to, blockers) {
    const line = bresenham(from.gridX, from.gridY, to.gridX, to.gridY);
    for (let i = 1; i < line.length - 1; i++) {
        if (blockers.has(`${line[i].x},${line[i].y}`)) return line[i];
    }
    return null;
}

/** Sync pre-check: is LoS enforcement live for this range right now?
 *  Callers use it to keep the OFF path FULLY synchronous (no deferred
 *  continuation) — only an enforced ranged attempt takes the async route. */
export function isLineOfSightEnforced(campaignName, range) {
    const enforcement = campaignName ? getRuntimeValue('campaign', 'enforcement') : null;
    if (!enforcement || enforcement.mode !== 'on' || !enforcement.lineOfSight) return false;
    const rangeFt = rangeToFeet(range);
    return !(rangeFt == null || rangeFt <= TOUCH_RANGE_FT);
}

/**
 * @param {object} ctx
 * @param {string} ctx.campaignName
 * @param {string} ctx.attackerName
 * @param {string} ctx.targetName
 * @param {string|number|null} ctx.range      the attack/spell range as written
 * @param {Function} [ctx.setPopupHtml]       deny-reason UI sink
 * @param {string} [ctx.source]               call-site label for the audit log
 * @param {{gridX,gridY}} [ctx.fromPos]       pre-resolved attacker cell (skips token lookup)
 * @param {{gridX,gridY}} [ctx.toPos]         pre-resolved target cell
 */
export async function checkLineOfSight(ctx) {
    const { campaignName, attackerName, targetName, range, setPopupHtml, source = 'action' } = ctx;

    // Fast path — enforcement off / melee / unknown range is today's
    // behavior, untouched (zero map traffic).
    if (!isLineOfSightEnforced(campaignName, range)) return { allowed: true, gated: false };

    const activeMapName = getRuntimeValue('__map__', 'activeMapName');
    if (!activeMapName) return { allowed: true, gated: false };

    let data;
    try {
        data = await loadMapData(campaignName, activeMapName);
    } catch (e) {
        console.error('[lineOfSightGate] loadMapData failed:', e);
        return { allowed: true, gated: false };
    }
    if (!data) return { allowed: true, gated: false };

    const tokens = [...(data.players || []), ...(data.placedItems || [])];
    const from = ctx.fromPos || tokens.find((t) => t.name === attackerName);
    const to = ctx.toPos || tokens.find((t) => t.name === targetName);
    if (!hasPosition(from) || !hasPosition(to)) return { allowed: true, gated: false };

    const blockers = computeMovementObstacles(data.walls, data.placedItems);
    const blockedAt = sightBlockedBetween(from, to, blockers);
    if (!blockedAt) return { allowed: true, gated: true };

    const reason = `${targetName} is behind a wall at (${blockedAt.x},${blockedAt.y}) — no line of sight.`;
    if (typeof setPopupHtml === 'function') setPopupHtml(reason);
    if (campaignName) {
        addEntry(campaignName, {
            type: 'enforcement_denied',
            creature: attackerName,
            target: targetName,
            bucket: 'lineOfSight',
            source,
            reason,
        }).catch((e) => { console.error('[lineOfSightGate] denial log failed:', e); });
    }
    return { allowed: false, reason };
}
