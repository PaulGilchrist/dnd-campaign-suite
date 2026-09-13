import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hitTestOverlay } from '../../models/SpellOverlay.js';
import { bresenham } from './lineOfSight.js';
import { loadMapData } from './mapsService.js';

const FEET_PER_CELL = 5;

export const OVERLAY_TARGET_PREFIX = 'overlay-';

export const overlayTargetId = (targetName) =>
    typeof targetName === 'string' && targetName.startsWith(OVERLAY_TARGET_PREFIX)
        ? targetName.slice(OVERLAY_TARGET_PREFIX.length)
        : null;

export async function fetchSpellOverlays(campaignName) {
    if (!campaignName) return [];
    try {
        const response = await fetch(`/spell-overlay?campaign=${encodeURIComponent(campaignName)}`);
        if (!response.ok) return [];
        const { overlays } = await response.json();
        return Array.isArray(overlays) ? overlays : [];
    } catch (error) {
        console.error('[spellOverlayService] Failed to fetch spell overlays:', error);
        return [];
    }
}

export function getActiveMapName() {
    return getRuntimeValue('__map__', 'activeMapName') || null;
}

export async function getCurrentOverlayTarget(campaignName, attackerName) {
    if (!attackerName) return null;
    // Lazy: combatData transitively loads the automation registry — only needed when overlay-targeting.
    const { getCombatSummary } = await import('../encounters/combatData.js');
    const targetName = getCombatSummary(campaignName)?.creatures?.find(c => c.name === attackerName)?.targetName;
    const id = overlayTargetId(targetName);
    if (!id) return null;
    const overlays = await fetchSpellOverlays(campaignName);
    return overlays.find(o => o.id === id) || null;
}

const hasGridPos = t => !!t && Number.isFinite(t.gridX) && Number.isFinite(t.gridY);

async function loadActiveMapContext(campaignName) {
    const activeMapName = getActiveMapName(campaignName);
    if (!activeMapName) return null;
    try {
        const data = await loadMapData(campaignName, activeMapName);
        if (!data) return null;
        const tokens = [...(data.players || []), ...(data.placedItems || [])];
        if (!tokens.some(hasGridPos)) return null;
        const walls = new Set(Array.from(data.walls || []));
        const closedDoors = new Set(
            (data.placedItems || [])
                .filter(i => i.type === 'door' && !i.open)
                .map(i => `${i.gridX},${i.gridY}`)
        );
        return { tokens, walls, closedDoors };
    } catch (error) {
        console.error('[spellOverlayService] Failed to load active map data:', error);
        return null;
    }
}

export async function getCreaturesInsideOverlay(campaignName, overlay, targetNames) {
    if (!overlay) return [];
    const context = await loadActiveMapContext(campaignName);
    if (!context) return [];
    const names = new Set(targetNames);
    return context.tokens
        .filter(t => hasGridPos(t) && names.has(t.name) && hitTestOverlay(overlay, t.gridX, t.gridY))
        .map(t => t.name);
}

export function getLosDistanceFeet(from, to, walls, closedDoors) {
    const cells = bresenham(from.gridX, from.gridY, to.gridX, to.gridY);
    const blocked = cells.some((cell, i) =>
        i > 0 && i < cells.length - 1 && (walls.has(`${cell.x},${cell.y}`) || closedDoors.has(`${cell.x},${cell.y}`))
    );
    return { distFt: (cells.length - 1) * FEET_PER_CELL, blocked };
}

export function distanceBadgeText({ status, distFt }) {
    if (status === 'off-map') return 'Off map';
    if (status === 'blocked') return `Blocked · ${distFt} ft`;
    return `${status === 'in' ? 'In range' : 'Out of range'} · ${distFt} ft`;
}

/**
 * Resolve per-target map status for distance badges.
 * Returns null when no active map/attacker position exists (no badges shown).
 * Each entry: { status: 'in' | 'out' | 'off-map' | 'blocked', distFt }
 */
export async function getTargetMapStatuses(campaignName, attackerName, targetNames, rangeFt) {
    const context = await loadActiveMapContext(campaignName);
    if (!context) return null;
    const attacker = context.tokens.find(t => t.name === attackerName && hasGridPos(t));
    if (!attacker) return null;
    const statuses = {};
    for (const name of targetNames) {
        const target = context.tokens.find(t => t.name === name && hasGridPos(t));
        if (!target) {
            statuses[name] = { status: 'off-map', distFt: null };
            continue;
        }
        const { distFt, blocked } = getLosDistanceFeet(attacker, target, context.walls, context.closedDoors);
        if (blocked) {
            statuses[name] = { status: 'blocked', distFt };
        } else {
            statuses[name] = { status: rangeFt == null || distFt <= rangeFt ? 'in' : 'out', distFt };
        }
    }
    return statuses;
}
