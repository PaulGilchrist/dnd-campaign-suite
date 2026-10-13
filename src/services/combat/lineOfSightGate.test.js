import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));
vi.mock('../maps/mapsService.js', () => ({
    loadMapData: vi.fn(async () => null),
}));
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));
// Obstacle computation belongs to effectiveWalls' own suite — feed a fixed set.
vi.mock('../maps/reachability.js', () => ({
    computeMovementObstacles: vi.fn(() => new Set()),
}));

import { sightBlockedBetween, isLineOfSightEnforced, checkLineOfSight } from './lineOfSightGate.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadMapData } from '../maps/mapsService.js';
import { addEntry } from '../ui/logService.js';
import { computeMovementObstacles } from '../maps/reachability.js';

const ON = { mode: 'on', lineOfSight: true };

function mapWith(over = {}) {
    return {
        gridSize: 20,
        players: [
            { name: 'Archer', gridX: 1, gridY: 1 },
            { name: 'Goblin', gridX: 9, gridY: 1 },
        ],
        placedItems: [],
        walls: new Set(),
        ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    computeMovementObstacles.mockReturnValue(new Set());
});

describe('sightBlockedBetween (pure)', () => {
    it('clear ray ⇒ null', () => {
        expect(sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 5, gridY: 0 }, new Set())).toBeNull();
    });

    it('mid-ray wall ⇒ blocking cell reported', () => {
        const blocked = sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 5, gridY: 0 }, new Set(['3,0']));
        expect(blocked).toEqual({ x: 3, y: 0 });
    });

    it('walls on the ENDPOINTS do not block (adjacency + stand-in-the-same-cell)', () => {
        expect(sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 }, new Set(['0,0', '1,0']))).toBeNull();
    });

    it('diagonal grazing an interior corner is blocked', () => {
        const blocked = sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 4, gridY: 4 }, new Set(['2,2']));
        expect(blocked).toEqual({ x: 2, y: 2 });
    });
});

describe('isLineOfSightEnforced (sync pre-check)', () => {
    it('off ⇒ false with a single flag read (no map traffic)', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(isLineOfSightEnforced('test-campaign', '30 ft')).toBe(false);
        getRuntimeValue.mockReturnValue({ mode: 'off', lineOfSight: true });
        expect(isLineOfSightEnforced('test-campaign', '30 ft')).toBe(false);
    });

    it('on + melee/touch/unknown ranges ⇒ false; ranged/sight ⇒ true', () => {
        getRuntimeValue.mockReturnValue(ON);
        expect(isLineOfSightEnforced('test-campaign', '5 ft.')).toBe(false);
        expect(isLineOfSightEnforced('test-campaign', 'touch')).toBe(false);
        expect(isLineOfSightEnforced('test-campaign', 'self')).toBe(false);
        expect(isLineOfSightEnforced('test-campaign', null)).toBe(false);
        expect(isLineOfSightEnforced('test-campaign', '30 ft')).toBe(true);
        expect(isLineOfSightEnforced('test-campaign', 'sight')).toBe(true);
    });
});

describe('checkLineOfSight', () => {
    it('enforcement off ⇒ allowed, gated:false, ZERO map I/O', async () => {
        getRuntimeValue.mockReturnValue(null);
        const popup = vi.fn();
        const r = await checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '30 ft', setPopupHtml: popup });
        expect(r).toEqual({ allowed: true, gated: false });
        expect(loadMapData).not.toHaveBeenCalled();
        expect(popup).not.toHaveBeenCalled();
    });

    it('gridless (no active map) ⇒ allowed passthrough', async () => {
        getRuntimeValue.mockImplementation((store, key) => (store === 'campaign' ? ON : key === 'activeMapName' ? null : null));
        const r = await checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '30 ft' });
        expect(r.allowed).toBe(true);
        expect(loadMapData).not.toHaveBeenCalled();
    });

    it('clear line ⇒ allowed with gated:true', async () => {
        getRuntimeValue.mockImplementation((store) => (store === 'campaign' ? ON : 'battle-arena'));
        loadMapData.mockResolvedValue(mapWith());
        const r = await checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '90 ft' });
        expect(r).toEqual({ allowed: true, gated: true });
    });

    it('wall between ⇒ denied: popup + enforcement_denied log bucket lineOfSight', async () => {
        getRuntimeValue.mockImplementation((store) => (store === 'campaign' ? ON : 'battle-arena'));
        loadMapData.mockResolvedValue(mapWith());
        computeMovementObstacles.mockReturnValue(new Set(['5,1']));
        const popup = vi.fn();
        const r = await checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '90 ft', setPopupHtml: popup, source: 'attack-row' });
        expect(r.allowed).toBe(false);
        expect(r.reason).toContain('no line of sight');
        expect(popup).toHaveBeenCalledWith(expect.stringContaining('behind a wall at (5,1)'));
        const denied = addEntry.mock.calls[0][1];
        expect(denied).toMatchObject({ type: 'enforcement_denied', creature: 'Archer', target: 'Goblin', bucket: 'lineOfSight', source: 'attack-row' });
    });

    it('map fetch failure degrades to ALLOW (GM keeps the fiction), never a false deny', async () => {
        getRuntimeValue.mockImplementation((store) => (store === 'campaign' ? ON : 'battle-arena'));
        loadMapData.mockRejectedValue(new Error('offline'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = await checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '90 ft' });
        expect(r.allowed).toBe(true);
        spy.mockRestore();
    });

    it('pre-resolved positions (cast chokepoint) skip token lookup but still adjudicate', async () => {
        getRuntimeValue.mockImplementation((store) => (store === 'campaign' ? ON : 'battle-arena'));
        loadMapData.mockResolvedValue(mapWith({ players: [] }));
        computeMovementObstacles.mockReturnValue(new Set(['4,4']));
        const r = await checkLineOfSight({
            campaignName: 'test-campaign',
            attackerName: 'Archer',
            targetName: 'Goblin',
            range: '90 ft',
            fromPos: { gridX: 2, gridY: 4 },
            toPos: { gridX: 6, gridY: 4 },
        });
        expect(r.allowed).toBe(false);
    });
});
