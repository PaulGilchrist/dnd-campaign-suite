// @maintained-by-ai
/**
 * Teleport EXECUTION lane (§8.1) — teleportService.js contract.
 *
 * OWNED HERE: teleport semantics — destination snap (beyond-occupied/blocked
 * anchor ring), the maxFeet gate as STRAIGHT-LINE budget from origin (the
 * teleport-walks-no-path bypass), honest degrade reasons, and the exact
 * saveMapData(campaign, map, patched) tuple + from/to stamp bytes.
 *
 * CITED, NOT DRIVEN: BFS neighbour/tie ordering and grid-cost math belong to
 * reachability.test.js (#1017); getDistanceFeet belongs to
 * rangeValidation.test.js. Handler CALL lanes (mock this service, assert the
 * invocation) live in psychicTeleportationHandler.test.js,
 * tempTeleportHandler.test.js, reactionDebuffHandler.branchesOfTheTree.test.js.
 *
 * Old → new map:
 *  - "enforcement OFF" + "tokenMoving OFF"  → consolidated "enforcement off (3 inputs)"
 *  - "gridless" + "no target selected"      → consolidated "before any map I/O"
 *  - (new) honest-degrade table: no-map-data / map-unavailable /
 *    mover-unplaced / anchor-unplaced / no-legal-landing-in-range
 *  - "respects obstacles when snapping"     → semantic (unblocked + ring pushed out),
 *    exact {x:6,y:0} tie byte dropped (belongs to reachability's BFS order)
 *  - "lands on nearest UNOCCUPIED"          → strengthened landing-key assertion
 *  - "null when beyond rolled distance"     → strengthened with Euclidean-vs-walk pair
 *  - happy path                             → strengthened: exact tuple, co-located
 *    token byte-identical, single save, distanceFeet consistency
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resolveTeleportCell, applyTeleportTokenMove } from './teleportService.js';
import { loadMapData, saveMapData } from '../maps/mapsService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
// getDistanceFeet import dropped fix#363 #1224 — it existed only for the old
// :180 self-compare; the helper is CITED-not-driven (rangeValidation.test.js).

vi.mock('../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

const GRID = 20;
const open = () => new Set();
const ON = { mode: 'on', tokenMoving: true };

// Deterministic baseline every test: every mock re-armed, no rejection leaks.
beforeEach(() => {
    getRuntimeValue.mockReset().mockReturnValue(null);
    loadMapData.mockReset().mockResolvedValue(null);
    saveMapData.mockReset().mockResolvedValue({ ok: true });
});

describe('resolveTeleportCell — destination semantics (snap + straight-line budget)', () => {
    it('null without a real position on either the origin or the anchor', () => {
        expect(resolveTeleportCell({ origin: null, anchor: { gridX: 5, gridY: 5 }, maxFeet: 100, gridSize: GRID })).toBeNull();
        expect(resolveTeleportCell({ origin: { gridX: 0, gridY: 0 }, anchor: {}, maxFeet: 100, gridSize: GRID })).toBeNull();
    });

    it('lands on a cell adjacent to the anchor, never on the anchor occupied by the target', () => {
        const occupied = new Set(['4,0']); // the target occupies the anchor
        const cell = resolveTeleportCell({
            origin: { gridX: 0, gridY: 0 },
            anchor: { gridX: 4, gridY: 0 },
            maxFeet: 100,
            occupied,
            obstacles: open(),
            gridSize: GRID,
        });
        expect(cell).toBeTruthy();
        expect(`${cell.x},${cell.y}`).not.toBe('4,0');
        expect(Math.abs(cell.x - 4) + Math.abs(cell.y - 0)).toBe(1);
    });

    it('maxFeet gates straight-line feet from origin — a diagonal landing inside budget still teleports', () => {
        // origin (0,0) → landing (3,3): √18 cells ≈ 21.2 ft. A walked path
        // would cost 30 ft (owned by reachability #1017) — teleport pays
        // distance, not path: 25 ft budget must land ON the free anchor...
        const args = {
            origin: { gridX: 0, gridY: 0 },
            anchor: { gridX: 3, gridY: 3 },
            occupied: open(),
            obstacles: open(),
            gridSize: GRID,
        };
        expect(resolveTeleportCell({ ...args, maxFeet: 25 })).toEqual({ x: 3, y: 3 });
        // ...and the same landing must be refused at 20 ft.
        expect(resolveTeleportCell({ ...args, maxFeet: 20 })).toBeNull();
    });

    it('a sealed anchor ring pushes the landing outside the blocked ring (legal cell, unoccupied)', () => {
        const obstacles = new Set(['4,0', '3,0', '5,0', '4,-1', '4,1', '3,-1', '5,-1', '3,1', '5,1']);
        const occupied = new Set(['4,0']);
        const cell = resolveTeleportCell({
            origin: { gridX: 0, gridY: 0 },
            anchor: { gridX: 4, gridY: 0 },
            maxFeet: 100,
            occupied,
            obstacles,
            gridSize: GRID,
        });
        expect(cell).toBeTruthy();
        const key = `${cell.x},${cell.y}`;
        expect(obstacles.has(key)).toBe(false);
        expect(occupied.has(key)).toBe(false);
        // the entire anchor ring is blocked, so any honest landing is ≥2 out
        expect(Math.abs(cell.x - 4) + Math.abs(cell.y - 0)).toBeGreaterThanOrEqual(2);
    });
});

describe('applyTeleportTokenMove — execution seam (exact save tuple, honest degrades)', () => {
    const hero = { id: 'hero', name: 'Hero', gridX: 2, gridY: 3 };
    const gob = { id: 'gob', name: 'Goblin', gridX: 5, gridY: 3 };
    const mapWith = (over = {}) => ({
        gridSize: GRID,
        players: [hero, gob],
        placedItems: [],
        walls: new Set(),
        ...over,
    });

    it('enforcement off (absent, mode≠on, or tokenMoving off) ⇒ token-moving-off, ZERO map I/O', async () => {
        const off = [null, undefined, { mode: 'off', tokenMoving: true }, { ...ON, tokenMoving: false }];
        for (const enforcement of off) {
            getRuntimeValue.mockReturnValue(enforcement);
            const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 });
            expect(r).toEqual({ moved: false, reason: 'token-moving-off' });
        }
        expect(loadMapData).not.toHaveBeenCalled();
        expect(saveMapData).not.toHaveBeenCalled();
    });

    it('degrades before any map I/O: no active map ⇒ gridless, no selected target ⇒ no-target-selected', async () => {
        getRuntimeValue.mockImplementation((store) => (store === 'campaign' ? ON : null));
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: null, creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 }))
            .resolves.toEqual({ moved: false, reason: 'gridless' });

        getRuntimeValue.mockReturnValue(ON);
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: null, maxFeet: 100 }))
            .resolves.toEqual({ moved: false, reason: 'no-target-selected' });

        expect(loadMapData).not.toHaveBeenCalled();
        expect(saveMapData).not.toHaveBeenCalled();
    });

    it('degrades honestly with an exact reason and never a partial write', async () => {
        getRuntimeValue.mockReturnValue(ON);
        loadMapData.mockResolvedValue(null);
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 }))
            .resolves.toEqual({ moved: false, reason: 'no-map-data' });

        loadMapData.mockRejectedValue(new Error('boom'));
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 }))
            .resolves.toEqual({ moved: false, reason: 'map-unavailable' });

        loadMapData.mockResolvedValue(mapWith({ players: [{ id: 'hero', name: 'Hero' }, gob] }));
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 }))
            .resolves.toEqual({ moved: false, reason: 'mover-unplaced' });

        loadMapData.mockResolvedValue(mapWith({ players: [hero, { id: 'gob', name: 'Goblin', gridX: 5 }] }));
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 }))
            .resolves.toEqual({ moved: false, reason: 'anchor-unplaced' });

        // budget so tight even the nearest legal landing (≥10 ft away) is out of range
        loadMapData.mockResolvedValue(mapWith());
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 5 }))
            .resolves.toEqual({ moved: false, reason: 'no-legal-landing-in-range' });

        expect(saveMapData).not.toHaveBeenCalled();
    });

    it('happy path ⇒ exactly one saveMapData(campaign, map) carrying the mover at an anchor-adjacent cell, all other tokens byte-identical', async () => {
        getRuntimeValue.mockReturnValue(ON);
        loadMapData.mockResolvedValue(mapWith());
        const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 });

        expect(r.moved).toBe(true);
        expect(r.from).toEqual({ gridX: 2, gridY: 3 }); // fromCell stamp, byte-exact
        expect(Math.abs(r.to.gridX - gob.gridX) + Math.abs(r.to.gridY - gob.gridY)).toBe(1); // never on the target
        // fix#363 #1224: self-compare (same getDistanceFeet call the production
        // :142 makes) replaced by LITERAL expected, derived from the law:
        // findNearestValid BFS dequeues anchor (5,3) — occupied by gob — then its
        // FIRST neighbor [x+1,y] = (6,3) (reachability.js neighbor order), unoccupied
        // and in-bounds (no walls/placedItems in this fixture). |6-2| = 4 cells x
        // FEET_PER_CELL 5 (rangeValidation.js:3) = 20 ft.
        expect(r.to).toEqual({ gridX: 6, gridY: 3 });
        expect(r.distanceFeet).toBe(20);

        expect(saveMapData).toHaveBeenCalledTimes(1);
        const [campaign, mapName, patched] = saveMapData.mock.calls[0];
        expect([campaign, mapName]).toEqual(['test-campaign', 'battle-arena']);
        expect(patched.players.find((p) => p.id === 'hero')).toMatchObject({ gridX: r.to.gridX, gridY: r.to.gridY });
        expect(patched.players.find((p) => p.id === 'gob')).toEqual(gob); // co-located token survives untouched
    });

    it('save failure ⇒ { moved:false, reason:"save-failed" } — never claims a move', async () => {
        getRuntimeValue.mockReturnValue(ON);
        loadMapData.mockResolvedValue(mapWith());
        saveMapData.mockRejectedValue(new Error('boom'));
        await expect(applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 }))
            .resolves.toEqual({ moved: false, reason: 'save-failed' });
    });
});
