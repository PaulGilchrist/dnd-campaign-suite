/**
 * Level 5 (L5-003) §8.1 — teleport token-move engine.
 *
 * The gap this closes: every teleport feature (Psychic Teleportation,
 * tempTeleport/Misty-Step family, stance/arcane-charge confirms) has always
 * asserted relocation in prose and written ZERO token position — "GM-enforced
 * gridless (no token-movement consumer)". Recon confirmed no imperative
 * token-move helper exists anywhere in the app; this is it.
 *
 * Honesty rule (Code Simplicity / graceful degradation): the destination is
 * DERIVED only from real state — the selected combat target's cell, snapped to
 * the nearest UNOCCUPIED, UNBLOCKED cell within the rolled distance from the
 * origin. No selected target and no grid ⇒ the token does NOT move and the
 * caller keeps its existing advisory prose, exactly as today.
 *
 * Off-switch: enforcement off / tokenMoving off ⇒ applyTeleportTokenMove
 * touches NOTHING (byte-identical Levels 1–4). The write reuses the existing
 * mapsService.saveMapData path, whose server `publish('map-data-*')` already
 * live-animates every open map via useSSESync — no new plumbing.
 */
import { loadMapData, saveMapData } from '../maps/mapsService.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { getDistanceFeet } from '../rules/combat/rangeValidation.js'
import { computeMovementObstacles, findNearestValid } from '../maps/reachability.js'

/** A cell carries a real grid position only when both axes are finite. */
function hasPosition(t) {
    return !!t && Number.isFinite(t.gridX) && Number.isFinite(t.gridY)
}

function findToken(tokens, name) {
    return tokens.find((t) => t.name === name) || null
}

/**
 * Pure destination resolver. Snaps the destination toward `anchor` (the
 * selected target's cell) to the nearest cell that is in-bounds, unoccupied
 * (by any tracked token other than the mover), and unblocked — then checks
 * it is within `maxFeet` of `origin`. Returns null when no honest
 * destination exists (no anchor, or nearest legal landing is out of range):
 * the caller then leaves the token exactly where it is.
 */
export function resolveTeleportCell({ origin, anchor, maxFeet, occupied, obstacles, gridSize }) {
    if (!hasPosition(origin) || !hasPosition(anchor)) return null
    const blocked = obstacles || new Set()
    const landing = findNearestValid(
        anchor.gridX,
        anchor.gridY,
        (x, y) => x >= 0 && y >= 0 && x < gridSize && y < gridSize
            && !blocked.has(`${x},${y}`)
            && !(occupied && occupied.has(`${x},${y}`)),
        gridSize,
    )
    if (!landing) return null
    const dist = getDistanceFeet(origin, { gridX: landing.x, gridY: landing.y })
    if (!Number.isFinite(dist)) return null
    if (Number.isFinite(maxFeet) && dist > maxFeet) return null
    return landing
}

/** Enforcement + active-map preconditions. Returns { reason } when the
 *  token must NOT move (every degrade branch keeps caller prose byte-identical). */
function teleportGate(campaignName, mapName) {
    const enforcement = campaignName ? getRuntimeValue('campaign', 'enforcement') : null
    if (!enforcement || enforcement.mode !== 'on' || !enforcement.tokenMoving) return { reason: 'token-moving-off' }
    const activeMapName = mapName || getRuntimeValue('__map__', 'activeMapName')
    if (!activeMapName) return { reason: 'gridless' }
    return { activeMapName }
}

/** Resolve mover + anchor tokens with real grid positions from map data. */
function resolveTeleportTokens(data, creatureName, anchorName) {
    const tokens = [...(data.players || []), ...(data.placedItems || [])]
    const mover = findToken(data.players || [], creatureName)
    const anchor = findToken(tokens, anchorName)
    if (!hasPosition(mover)) return { reason: 'mover-unplaced' }
    if (!hasPosition(anchor)) return { reason: 'anchor-unplaced' }
    return { mover, anchor, tokens }
}

/** Patch the mover's cell and save — the server publishes map-data-* which
 *  every open map animates via useSSESync. True only on a committed write. */
async function persistTokenMove(campaignName, activeMapName, creatureName, data, landing) {
    try {
        const patched = {
            ...data,
            players: (data.players || []).map((c) =>
                c.name === creatureName ? { ...c, gridX: landing.x, gridY: landing.y } : c
            ),
        }
        await saveMapData(campaignName, activeMapName, patched)
        return true
    } catch (e) {
        console.error('[teleportService] saveMapData failed:', e)
        return false
    }
}

/**
 * Impure write seam. Reads enforcement itself so the OFF fast-path is a hard
 * guarantee. Returns { moved:false, reason } on every degrade branch (token
 * stays put, caller prose unchanged); { moved:true, from, to, distanceFeet }
 * only after a real saveMapData write.
 *
 * @param {object} ctx
 * @param {string} ctx.campaignName
 * @param {string|null} ctx.mapName         active-map name (null ⇒ gridless)
 * @param {string} ctx.creatureName         the teleporting token (by name)
 * @param {string|null} ctx.anchorName      selected combat target (by name)
 * @param {number} ctx.maxFeet             rolled teleport distance in feet
 */
export async function applyTeleportTokenMove({ campaignName, mapName, creatureName, anchorName, maxFeet }) {
    const gate = teleportGate(campaignName, mapName)
    if (gate.reason) return { moved: false, reason: gate.reason }
    if (!anchorName) return { moved: false, reason: 'no-target-selected' }

    let data
    try {
        data = await loadMapData(campaignName, gate.activeMapName)
    } catch (e) {
        console.error('[teleportService] loadMapData failed:', e)
        return { moved: false, reason: 'map-unavailable' }
    }
    if (!data) return { moved: false, reason: 'no-map-data' }

    const ctx = resolveTeleportTokens(data, creatureName, anchorName)
    if (ctx.reason) return { moved: false, reason: ctx.reason }

    const occupied = new Set(
        ctx.tokens.filter((t) => t.name !== creatureName && hasPosition(t)).map((t) => `${t.gridX},${t.gridY}`),
    )
    const obstacles = computeMovementObstacles(data.walls, data.placedItems)
    const gridSize = Number(data.gridSize) || 20

    const landing = resolveTeleportCell({ origin: ctx.mover, anchor: ctx.anchor, maxFeet, occupied, obstacles, gridSize })
    if (!landing) return { moved: false, reason: 'no-legal-landing-in-range' }

    const from = { gridX: ctx.mover.gridX, gridY: ctx.mover.gridY }
    const moved = await persistTokenMove(campaignName, gate.activeMapName, creatureName, data, landing)
    if (!moved) return { moved: false, reason: 'save-failed' }

    return { moved: true, from, to: { gridX: landing.x, gridY: landing.y }, distanceFeet: getDistanceFeet(from, { gridX: landing.x, gridY: landing.y }) }
}
