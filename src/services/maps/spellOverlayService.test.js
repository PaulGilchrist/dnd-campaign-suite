// @maintained-by-ai
// Lane: spell-overlay service — AoE overlay resolution + map distance badges for the
// spell-target UI. SOLE OWNER (verified by consumer census) of: GET /spell-overlay
// transport, overlay-target prefix resolution, active-map context assembly
// (players+placedItems token merge, closedDoors from door&&!open), feet-per-cell
// distance math, status mapping, and badge bytes.
//
// Cited owners — consumers verify THROUGH the wrapper, never re-drive internals:
//   models/SpellOverlay.test.js ......... hitTestOverlay shape geometry goldens (sphere/cone/
//                                         line/cylinder incl. inclusive radius edge); T6 proves
//                                         only selection + assembly through the real hit-test.
//   maps/lineOfSight.test.js #1172 ...... bresenham cell sequences; T8 pins only the
//                                         distFt = (cells-1) * 5ft arithmetic on top.
//   maps/effectiveWalls.test.js #1169 ... secret-door wall derivation (hidden add/discovered
//                                         remove); T12 checks status bytes through the wrapper.
//   maps/mapsService.test.js #1173 ...... loadMapData transport — boundary-mocked here.
//   map/hooks/useSpellOverlay.test.js ... cut fetch-error/network-error fallback, citing
//                                         this file as owner ("service owner, :70/:75") -> T2/T3.
//   initiative.overlays / *Modal lanes .. boundary-mock fetchSpellOverlays /
//                                         getCreaturesInsideOverlay (consumers, not dupes).
//   automation elementalAttunementHandler prefix resolution delegated here -> T1.
// SSE honesty: this service is fetch-only (no EventSource construction); the app's
// ONE-shared-connection rule (sseClient.js) lives in the consumer lanes. No wall clock:
// overlay lifetime is GM/server-enforced; zero timers here. Real shape math runs
// unmocked (#1137); mocks only at transport/state boundaries. Zero-fetch proofs (#1010),
// exact-byte tables (#903), degenerate honest (#945), byte-flip falsifiers (#967),
// afterEach restoreAllMocks (#1007).
//
// Old->new map (18->13): overlayTargetId x2 -> T1 · fetch-ok x1 -> T2 (+encode bytes) ·
// campaign-missing+non-ok+network-error x3 -> T3 fail-safe table · resolve x1 -> T4
// (exact bytes) · null-attacker+no-overlay-target x2 -> T5 null table (+unlisted, +miss) ·
// inside x1 -> T6 (+edge/out/positionless/placedItem/wiring) · no-map+null-overlay x2 ->
// T7 degenerate table (+load-reject) · los straight x1 -> T8 (+same-cell 0ft) ·
// wall-block+endpoint x2 -> T9 interior-only table (+closedDoors) · statuses no-map+
// attacker-off-map x2 -> T10 guard table (+payload-null, no-pos, reject) · status table x1 ->
// T11 (+inclusive range edge) · wall-block x1 + secret-door hidden/discovered x2 -> T12
// byte-flip table (+open/closed door, this service's own closedDoors bytes) · badges kept.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('./mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../encounters/combatData.js';
import { loadMapData } from './mapsService.js';
import {
    fetchSpellOverlays,
    overlayTargetId,
    getCurrentOverlayTarget,
    getCreaturesInsideOverlay,
    getLosDistanceFeet,
    getTargetMapStatuses,
    distanceBadgeText,
} from './spellOverlayService.js';

const CAMPAIGN = 'test-campaign';

const sphere = { id: 'o1', shape: 'sphere', radiusFt: 20, startGridX: 5, startGridY: 5, angle: 0 };

function mockActiveMap(tokens, walls = [], placedItems = []) {
    getRuntimeValue.mockReturnValue('battle-map');
    loadMapData.mockResolvedValue({ gridSize: 20, walls, players: tokens, placedItems });
}

beforeEach(() => {
    vi.resetAllMocks(); // boundary mocks return undefined until each test arms them — no leak
    vi.spyOn(console, 'error').mockImplementation(() => {}); // silence honest diagnostic rows
});

afterEach(() => {
    vi.restoreAllMocks(); // #1007
    vi.unstubAllGlobals();
});

describe('overlayTargetId', () => {
    it('extracts the id after the overlay- prefix and nulls everything else (T1)', () => {
        expect(overlayTargetId('overlay-abc')).toBe('abc');
        expect(overlayTargetId('overlay-o1')).toBe('o1');
        expect(overlayTargetId('Goblin')).toBeNull();
        expect(overlayTargetId(null)).toBeNull();
        expect(overlayTargetId(undefined)).toBeNull();
    });
});

describe('fetchSpellOverlays', () => {
    it('GETs /spell-overlay?campaign=<encoded> and unwraps overlays byte-exact (T2)', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ overlays: [sphere] }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ overlays: [] }) });
        vi.stubGlobal('fetch', fetchMock);

        expect(await fetchSpellOverlays(CAMPAIGN)).toEqual([sphere]);
        expect(await fetchSpellOverlays('Ice Wind Peak')).toEqual([]);
        expect(fetchMock.mock.calls).toEqual([
            ['/spell-overlay?campaign=test-campaign'],
            ['/spell-overlay?campaign=Ice%20Wind%20Peak'],
        ]);
    });

    it('fail-safe table: zero fetch without campaign, [] on non-ok/reject/non-array (T3)', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false })
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ overlays: 'nope' }) });
        vi.stubGlobal('fetch', fetchMock);

        expect(await fetchSpellOverlays(null)).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled(); // zero-fetch guard before I/O (#1010)
        expect(await fetchSpellOverlays(CAMPAIGN)).toEqual([]); // non-ok
        expect(await fetchSpellOverlays(CAMPAIGN)).toEqual([]); // network reject
        expect(await fetchSpellOverlays(CAMPAIGN)).toEqual([]); // non-array payload (#959)
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(console.error).toHaveBeenCalledTimes(1); // only the throw path logs; fallbacks stay quiet
    });
});

describe('getCurrentOverlayTarget', () => {
    it('resolves the attackers overlay by id, distinguishing decoys (T4)', async () => {
        getCombatSummary.mockReturnValue({ creatures: [
            { name: 'Warlord', targetName: 'overlay-o1' },
            { name: 'Wizard', targetName: 'overlay-o2' },
        ] });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ overlays: [sphere, { id: 'o2', shape: 'cone', distanceFt: 60 }] }),
        }));

        expect(await getCurrentOverlayTarget(CAMPAIGN, 'Wizard')).toEqual({ id: 'o2', shape: 'cone', distanceFt: 60 });
    });

    it('null table: no attacker, unlisted attacker, plain target, stale overlay id (T5)', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        expect(await getCurrentOverlayTarget(CAMPAIGN, null)).toBeNull();
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Wizard', targetName: 'Goblin' }] });
        expect(await getCurrentOverlayTarget(CAMPAIGN, 'Wizard')).toBeNull(); // plain target
        expect(await getCurrentOverlayTarget(CAMPAIGN, 'Unlisted')).toBeNull(); // no combat entry
        expect(fetchMock).not.toHaveBeenCalled(); // only overlay-prefixed targets reach the network

        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Wizard', targetName: 'overlay-ghost' }] });
        fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ overlays: [sphere] }) });
        expect(await getCurrentOverlayTarget(CAMPAIGN, 'Wizard')).toBeNull(); // id absent from payload
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('getCreaturesInsideOverlay', () => {
    it('returns names of placed tokens hit-testing the overlay, map order (T6)', async () => {
        // hitTestOverlay geometry owned by models/SpellOverlay.test.js — here: selection + assembly
        mockActiveMap(
            [
                { name: 'Goblin', gridX: 5, gridY: 5 }, // center — in
                { name: 'Wizard', gridX: 5, gridY: 6 }, // 5 ft — in
                { name: 'Farling', gridX: 15, gridY: 15 }, // far — out
                { name: 'Ghost' }, // no grid pos — skipped, not a crash (#945)
            ],
            [],
            [
                { name: 'Rim', type: 'rubble', gridX: 5, gridY: 9 }, // exactly 20 ft — inclusive edge (#903)
                { name: 'BarelyOut', type: 'rubble', gridX: 5, gridY: 10 }, // 25 ft — out
            ]
        );

        const inside = await getCreaturesInsideOverlay(
            CAMPAIGN, sphere, ['Goblin', 'Wizard', 'Farling', 'Ghost', 'Rim', 'BarelyOut']);
        expect(inside).toEqual(['Goblin', 'Wizard', 'Rim']); // deterministic map order, no sort needed
        expect(getRuntimeValue).toHaveBeenCalledWith('__map__', 'activeMapName'); // server-first wiring
        expect(loadMapData).toHaveBeenCalledWith(CAMPAIGN, 'battle-map');
    });

    it('degenerate table: [] on null overlay, no active map, or map load failure (T7)', async () => {
        expect(await getCreaturesInsideOverlay(CAMPAIGN, null, ['Goblin'])).toEqual([]);
        expect(loadMapData).not.toHaveBeenCalled(); // short-circuits before any I/O (#1010)

        getRuntimeValue.mockReturnValue(null);
        expect(await getCreaturesInsideOverlay(CAMPAIGN, sphere, ['Goblin'])).toEqual([]);
        expect(loadMapData).not.toHaveBeenCalled(); // no map name — no fetch

        getRuntimeValue.mockReturnValue('battle-map');
        loadMapData.mockRejectedValue(new Error('boom'));
        expect(await getCreaturesInsideOverlay(CAMPAIGN, sphere, ['Goblin'])).toEqual([]);
        expect(console.error).toHaveBeenCalledTimes(1); // catch path logs honestly
    });
});

describe('getLosDistanceFeet', () => {
    // bresenham cell sequences owned by maps/lineOfSight.test.js #1172 — pure math, zero mocks (#1137)
    it('measures (cells - 1) * 5 ft along the ray, same-cell honest (T8)', () => {
        expect(getLosDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), new Set()))
            .toEqual({ distFt: 15, blocked: false });
        expect(getLosDistanceFeet({ gridX: 2, gridY: 2 }, { gridX: 2, gridY: 2 }, new Set(), new Set()))
            .toEqual({ distFt: 0, blocked: false }); // degenerate same-cell (#945)
    });

    it('obstacles block only strictly between endpoints — walls and closedDoors both (T9)', () => {
        expect(getLosDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(['1,0']), new Set()).blocked).toBe(true); // mid wall
        expect(getLosDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), new Set(['2,0'])).blocked).toBe(true); // mid closed door
        expect(getLosDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(['0,0', '3,0']), new Set(['0,0', '3,0'])).blocked).toBe(false); // endpoints never block
    });
});

describe('getTargetMapStatuses', () => {
    it('null guard table: no map, missing payload, no placed tokens, attacker off-map, load reject (T10)', async () => {
        getRuntimeValue.mockReturnValue(null);
        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Goblin'], 60)).toBeNull();
        expect(loadMapData).not.toHaveBeenCalled(); // guards resolve before I/O (#1010)

        getRuntimeValue.mockReturnValue('battle-map');
        loadMapData.mockResolvedValue(null);
        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Goblin'], 60)).toBeNull(); // missing payload

        mockActiveMap([{ name: 'Ghost' }]); // nothing with grid coords
        expect(await getTargetMapStatuses(CAMPAIGN, 'Ghost', ['Ghost'], 60)).toBeNull();

        mockActiveMap([{ name: 'Goblin', gridX: 2, gridY: 2 }]);
        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Goblin'], 60)).toBeNull(); // attacker absent

        loadMapData.mockRejectedValue(new Error('boom'));
        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Goblin'], 60)).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1); // only the reject row logs; guards stay quiet
    });

    it('exact status table: in, inclusive range edge, out, off-map, unknown range always in (T11)', async () => {
        mockActiveMap([
            { name: 'Wizard', gridX: 0, gridY: 0 },
            { name: 'Near', gridX: 2, gridY: 0 }, // 10 ft
            { name: 'Edge', gridX: 6, gridY: 0 }, // exactly 30 ft at range 30 — in (#903)
            { name: 'Far', gridX: 18, gridY: 0 }, // 90 ft
        ]);

        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Near', 'Edge', 'Far', 'Unplaced'], 30)).toEqual({
            Near: { status: 'in', distFt: 10 },
            Edge: { status: 'in', distFt: 30 },
            Far: { status: 'out', distFt: 90 },
            Unplaced: { status: 'off-map', distFt: null },
        });

        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Far'], null)).toEqual({
            Far: { status: 'in', distFt: 90 }, // rangeFt null = always in
        });
    });

    it('blocked/clear status bytes: wall, closed vs open door, hidden vs discovered secret door (T12)', async () => {
        // effectiveWalls derivation owned by maps/effectiveWalls.test.js #1169; closedDoors
        // (door && !open) is assembled here — open/closed and hidden/discovered byte flips falsify (#967).
        // One obstacle per ray from (10,10) so rays never share a blocker.
        mockActiveMap(
            [
                { name: 'Wizard', gridX: 10, gridY: 10 },
                { name: 'Walled', gridX: 14, gridY: 10 }, // E ray: wall at (12,10)
                { name: 'Caged', gridX: 10, gridY: 14 }, // N ray: closed door at (10,12)
                { name: 'Open', gridX: 16, gridY: 4 }, // SE ray: open door at (12,8) — clear
                { name: 'Sneaky', gridX: 18, gridY: 18 }, // NE ray: hidden secret door at (13,13)
                { name: 'Found', gridX: 6, gridY: 14 }, // SW ray: discovered secret door at (8,12) — clear
            ],
            ['12,10'],
            [
                { type: 'door', gridX: 10, gridY: 12, open: false },
                { type: 'door', gridX: 12, gridY: 8, open: true },
                { type: 'secretDoor', gridX: 13, gridY: 13, visible: false },
                { type: 'secretDoor', gridX: 8, gridY: 12, visible: true },
            ]
        );

        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Walled', 'Caged', 'Open', 'Sneaky', 'Found'], null)).toEqual({
            Walled: { status: 'blocked', distFt: 20 },
            Caged: { status: 'blocked', distFt: 20 },
            Open: { status: 'in', distFt: 30 },
            Sneaky: { status: 'blocked', distFt: 40 },
            Found: { status: 'in', distFt: 20 },
        });
    });
});

describe('distanceBadgeText', () => {
    it('formats each status', () => {
        expect(distanceBadgeText({ status: 'off-map', distFt: null })).toBe('Off map');
        expect(distanceBadgeText({ status: 'blocked', distFt: 20 })).toBe('Blocked · 20 ft');
        expect(distanceBadgeText({ status: 'in', distFt: 10 })).toBe('In range · 10 ft');
        expect(distanceBadgeText({ status: 'out', distFt: 90 })).toBe('Out of range · 90 ft');
    });
});
