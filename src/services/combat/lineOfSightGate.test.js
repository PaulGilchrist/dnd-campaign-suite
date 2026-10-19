// @maintained-by-ai
// L5-003 §8.2 lane — combat/lineOfSightGate.js: the enforcement-mode GATE WRAPPER for
// ranged attacks/casts (master switch campaign.enforcement.lineOfSight, consulted at the
// attack/spell seams). Distinct from the §8.3 cover CHANNEL, owned by coverService.test.js
// (#_cover_shot stamp, bresenham scan, −2 half cover — #1013): every fixture here omits
// `zones`, so the cover branch never fires and this lane never writes the store.
//
// Contract here (gate truth table + denial plumbing, not ray math):
//   sightBlockedBetween     — pure INTERIOR-only ray, FIRST blocker wins (the cell
//                             sequence itself is owned by maps/lineOfSight.test.js).
//   isLineOfSightEnforced   — sync pre-check callers use to keep the OFF path fully sync.
//   checkLineOfSight        — async seam: exact verdict bytes, popup + enforcement_denied
//                             audit on deny, fail-open ALLOW on every unresolvable grid.
//
// Family map — owned ELSEWHERE, cited not re-driven:
//   maps/lineOfSight.test.js                            — bresenham + computeVisibility cells.
//   combat/coverService.test.js                       — cover geometry/channel (#1013).
//   hooks/combat/useSpellCastExecutor.castAction.test.js   — spell seam wiring (gate mocked).
//   components/char-sheet/useCharActionsAttackHandlers.test.js — attack seam wiring (gate mocked).
//
// Store keys consulted (census): 'campaign'.'enforcement' + '__map__'.'activeMapName'.
// This gate never writes — stampCoverShot writes belong to coverService's suite.
//
// Old→new: 4 ray tests → 1 truth table · separate off-tests → master-off span over both
// entry points (#989) · gridless + unplaced-token folded into one unresolvable-ALLOW test ·
// toContain/toMatchObject → exact bytes (#995) · new rows: los-flag-off, touch boundary,
// campaignName guard, read census (#967), console.error on fetch-fail, default source byte.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../maps/mapsService.js', () => ({
    loadMapData: vi.fn(async () => null),
}));
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));
// Walls→blockers-set computation belongs to reachability's own suite — identity feed here.
vi.mock('../maps/reachability.js', () => ({
    computeMovementObstacles: vi.fn((walls) => walls),
}));

import { sightBlockedBetween, isLineOfSightEnforced, checkLineOfSight } from './lineOfSightGate.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadMapData } from '../maps/mapsService.js';
import { addEntry } from '../ui/logService.js';
import { computeMovementObstacles } from '../maps/reachability.js';

// No `zones` key ⇒ isCoverEnforced stays false and the cover branch never fires (#1013).
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

// Key-routed store: only the exact store.key bytes the gate actually consults.
function gateStore(enforcement, activeMapName = 'battle-arena') {
    getRuntimeValue.mockImplementation((store, key) => {
        if (store === 'campaign' && key === 'enforcement') return enforcement;
        if (store === '__map__' && key === 'activeMapName') return activeMapName;
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    computeMovementObstacles.mockImplementation((walls) => walls);
});

describe('sightBlockedBetween (pure interior ray)', () => {
    it('clear ⇒ null · interior hit ⇒ FIRST blocker along the ray · endpoint walls never block', () => {
        expect(sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 5, gridY: 0 }, new Set())).toBeNull();
        // interior scan order: 4,0 painted first in the Set, but the first hit along the ray wins
        expect(sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 5, gridY: 0 }, new Set(['4,0', '3,0']))).toEqual({ x: 3, y: 0 });
        expect(sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 }, new Set(['0,0', '1,0']))).toBeNull();
        expect(sightBlockedBetween({ gridX: 0, gridY: 0 }, { gridX: 4, gridY: 4 }, new Set(['2,2']))).toEqual({ x: 2, y: 2 });
    });
});

describe('isLineOfSightEnforced (sync pre-check)', () => {
    it('OFF rows ⇒ false: store missing · master off · los flag absent · no campaign (zero reads)', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(isLineOfSightEnforced('test-campaign', '30 ft')).toBe(false);
        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'enforcement');

        getRuntimeValue.mockReturnValue({ mode: 'off', lineOfSight: true });
        expect(isLineOfSightEnforced('test-campaign', '30 ft')).toBe(false);

        getRuntimeValue.mockReturnValue({ mode: 'on' }); // master on, los channel flag absent
        expect(isLineOfSightEnforced('test-campaign', '30 ft')).toBe(false);

        getRuntimeValue.mockClear();
        expect(isLineOfSightEnforced(null, '30 ft')).toBe(false);
        expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('ON ⇒ melee/touch/8-ft-boundary/unknown range false, ranged/sight/numeric true — reads ONLY campaign.enforcement', () => {
        gateStore(ON);
        for (const range of ['5 ft.', '8 ft', 'touch', 'self', 'special', null]) {
            expect(isLineOfSightEnforced('test-campaign', range)).toBe(false);
        }
        for (const range of ['30 ft', 'sight', 60]) {
            expect(isLineOfSightEnforced('test-campaign', range)).toBe(true);
        }
        const consulted = [...new Set(getRuntimeValue.mock.calls.map(([store, key]) => `${store}.${key}`))];
        expect(consulted).toEqual(['campaign.enforcement']);
    });
});

describe('checkLineOfSight', () => {
    it('OFF spans master-off AND melee: exact {allowed:true,gated:false} with ZERO popup/log/write/map I/O', async () => {
        const legs = [
            [null, '30 ft'],
            [{ mode: 'off', lineOfSight: true }, '30 ft'],
            [{ mode: 'on' }, '30 ft'],
            [ON, '5 ft'],
        ];
        for (const [enforcement, range] of legs) {
            gateStore(enforcement);
            const popup = vi.fn();
            expect(isLineOfSightEnforced('test-campaign', range)).toBe(false);
            await expect(checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range, setPopupHtml: popup }))
                .resolves.toEqual({ allowed: true, gated: false });
            expect(popup).not.toHaveBeenCalled();
        }
        expect(loadMapData).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('grid UNRESOLVABLE degrades to exact ALLOW: no active map (never fetches) · unplaced tokens (never scans blockers)', async () => {
        gateStore(ON, null);
        await expect(checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '30 ft' }))
            .resolves.toEqual({ allowed: true, gated: false });
        expect(loadMapData).not.toHaveBeenCalled();

        gateStore(ON);
        loadMapData.mockResolvedValue(mapWith({ players: [] }));
        await expect(checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '30 ft' }))
            .resolves.toEqual({ allowed: true, gated: false });
        expect(loadMapData).toHaveBeenCalledWith('test-campaign', 'battle-arena');
        expect(computeMovementObstacles).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('map fetch FAILURE degrades to exact ALLOW + ONE console.error, never a false deny, never a log', async () => {
        gateStore(ON);
        loadMapData.mockRejectedValue(new Error('offline'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '30 ft' }))
            .resolves.toEqual({ allowed: true, gated: false });
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('clear line ⇒ exact {allowed:true,gated:true} — no popup, no denial log', async () => {
        gateStore(ON);
        loadMapData.mockResolvedValue(mapWith());
        const popup = vi.fn();
        await expect(checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '90 ft', setPopupHtml: popup }))
            .resolves.toEqual({ allowed: true, gated: true });
        expect(popup).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('wall between ⇒ DENY: exact reason + popup + full enforcement_denied payload · token leg (source label) and pre-resolved-position leg (default source)', async () => {
        gateStore(ON);
        loadMapData.mockResolvedValue(mapWith({ walls: new Set(['5,1']) }));
        const popup = vi.fn();
        await expect(checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '90 ft', setPopupHtml: popup, source: 'attack-row' }))
            .resolves.toEqual({ allowed: false, reason: 'Goblin is behind a wall at (5,1) — no line of sight.' });
        expect(popup).toHaveBeenCalledWith('Goblin is behind a wall at (5,1) — no line of sight.');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied', creature: 'Archer', target: 'Goblin', bucket: 'lineOfSight', source: 'attack-row',
            reason: 'Goblin is behind a wall at (5,1) — no line of sight.',
        });

        // cast chokepoint: fromPos/toPos skip token lookup (empty players) but adjudicate identically; source defaults to 'action'
        addEntry.mockClear();
        loadMapData.mockResolvedValue(mapWith({ players: [], walls: new Set(['4,4']) }));
        await expect(checkLineOfSight({ campaignName: 'test-campaign', attackerName: 'Archer', targetName: 'Goblin', range: '90 ft', fromPos: { gridX: 2, gridY: 4 }, toPos: { gridX: 6, gridY: 4 } }))
            .resolves.toEqual({ allowed: false, reason: 'Goblin is behind a wall at (4,4) — no line of sight.' });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied', creature: 'Archer', target: 'Goblin', bucket: 'lineOfSight', source: 'action',
            reason: 'Goblin is behind a wall at (4,4) — no line of sight.',
        });
    });
});
