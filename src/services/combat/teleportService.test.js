import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../maps/mapsService.js', () => ({
    loadMapData: vi.fn(async () => null),
    saveMapData: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));

import { resolveTeleportCell, applyTeleportTokenMove } from './teleportService.js';
import { loadMapData, saveMapData } from '../maps/mapsService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const GRID = 20;
const open = () => new Set();

beforeEach(() => vi.clearAllMocks());

describe('resolveTeleportCell (§8.1, pure)', () => {
    it('null when origin or anchor lacks a real position', () => {
        expect(resolveTeleportCell({ origin: null, anchor: { gridX: 5, gridY: 5 }, maxFeet: 100, gridSize: GRID })).toBeNull();
        expect(resolveTeleportCell({ origin: { gridX: 0, gridY: 0 }, anchor: {}, maxFeet: 100, gridSize: GRID })).toBeNull();
    });

    it('lands on the nearest UNOCCUPIED cell near the anchor (never on it)', () => {
        const cell = resolveTeleportCell({
            origin: { gridX: 0, gridY: 0 },
            anchor: { gridX: 4, gridY: 0 },
            maxFeet: 100,
            occupied: new Set(['4,0']), // the target occupies the anchor
            obstacles: open(),
            gridSize: GRID,
        });
        expect(cell).toBeTruthy();
        expect(cell).not.toEqual({ x: 4, y: 0 });
        expect(Math.abs(cell.x - 4) + Math.abs(cell.y - 0)).toBe(1); // adjacent to anchor
    });

    it('null when the nearest legal landing is beyond the rolled distance', () => {
        const cell = resolveTeleportCell({
            origin: { gridX: 0, gridY: 0 },
            anchor: { gridX: 15, gridY: 0 }, // 75 ft away
            maxFeet: 20,
            occupied: open(),
            obstacles: open(),
            gridSize: GRID,
        });
        expect(cell).toBeNull();
    });

    it('respects obstacles when snapping', () => {
        // anchor ring sealed by obstacles ⇒ no legal landing
        const obstacles = new Set(['4,0', '3,0', '5,0', '4,-1', '4,1', '3,-1', '5,-1', '3,1', '5,1']);
        const cell = resolveTeleportCell({
            origin: { gridX: 0, gridY: 0 },
            anchor: { gridX: 4, gridY: 0 },
            maxFeet: 100,
            occupied: new Set(['4,0']),
            obstacles,
            gridSize: GRID,
        });
        // BFS passes through blocked cells but only lands on valid ones —
        // the ring pushes the landing two cells out on the +x side.
        expect(cell).toEqual({ x: 6, y: 0 });
    });
});

describe('applyTeleportTokenMove (§8.1, persisted)', () => {
    const mapWith = (over = {}) => ({
        gridSize: GRID,
        players: [
            { id: 'hero', name: 'Hero', gridX: 2, gridY: 3 },
            { id: 'gob', name: 'Goblin', gridX: 5, gridY: 3 },
        ],
        placedItems: [],
        walls: new Set(),
        ...over,
    });

    const ON = { mode: 'on', tokenMoving: true };

    it('enforcement OFF ⇒ zero map I/O, token unmoved', async () => {
        getRuntimeValue.mockReturnValue(null);
        const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 });
        expect(r).toEqual({ moved: false, reason: 'token-moving-off' });
        expect(loadMapData).not.toHaveBeenCalled();
        expect(saveMapData).not.toHaveBeenCalled();
    });

    it('enforcement ON but tokenMoving OFF ⇒ unmoved', async () => {
        getRuntimeValue.mockReturnValue({ mode: 'on', tokenMoving: false });
        const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 });
        expect(r.moved).toBe(false);
        expect(saveMapData).not.toHaveBeenCalled();
    });

    it('gridless (no active map) ⇒ unmoved', async () => {
        // store-aware mock: enforcement lives in 'campaign', map state in '__map__'
        getRuntimeValue.mockImplementation((store) => (store === 'campaign' ? ON : null));
        const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: null, creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 });
        expect(r).toEqual({ moved: false, reason: 'gridless' });
    });

    it('no target selected ⇒ unmoved', async () => {
        getRuntimeValue.mockReturnValue(ON);
        const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: null, maxFeet: 100 });
        expect(r).toEqual({ moved: false, reason: 'no-target-selected' });
    });

    it('happy path ⇒ saves the patched players with the token near the anchor', async () => {
        getRuntimeValue.mockReturnValue(ON);
        loadMapData.mockResolvedValue(mapWith());
        const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 });
        expect(r.moved).toBe(true);
        expect(r.from).toEqual({ gridX: 2, gridY: 3 });
        // landed on a cell adjacent to the goblin (never on it)
        expect(Math.abs(r.to.gridX - 5) + Math.abs(r.to.gridY - 3)).toBe(1);
        const saved = saveMapData.mock.calls[0];
        expect(saved[0]).toBe('test-campaign');
        expect(saved[2].players.find((p) => p.name === 'Hero')).toMatchObject({ gridX: r.to.gridX, gridY: r.to.gridY });
    });

    it('save failure ⇒ moved:false, reason save-failed (never claims a move)', async () => {
        getRuntimeValue.mockReturnValue(ON);
        loadMapData.mockResolvedValue(mapWith());
        saveMapData.mockRejectedValue(new Error('boom'));
        const r = await applyTeleportTokenMove({ campaignName: 'test-campaign', mapName: 'battle-arena', creatureName: 'Hero', anchorName: 'Goblin', maxFeet: 100 });
        expect(r).toEqual({ moved: false, reason: 'save-failed' });
    });
});
