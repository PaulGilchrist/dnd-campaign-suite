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

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('overlayTargetId', () => {
    it('extracts id from overlay-prefixed target names', () => {
        expect(overlayTargetId('overlay-abc')).toBe('abc');
    });

    it('returns null for non-overlay names', () => {
        expect(overlayTargetId('Goblin')).toBeNull();
        expect(overlayTargetId(null)).toBeNull();
        expect(overlayTargetId(undefined)).toBeNull();
    });
});

describe('fetchSpellOverlays', () => {
    it('fetches from /spell-overlay and unwraps overlays array', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ overlays: [{ id: 'o1' }] }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const overlays = await fetchSpellOverlays(CAMPAIGN);

        expect(fetchMock).toHaveBeenCalledWith(`/spell-overlay?campaign=${CAMPAIGN}`);
        expect(overlays).toEqual([{ id: 'o1' }]);
    });

    it('returns empty array when campaign missing', async () => {
        expect(await fetchSpellOverlays(null)).toEqual([]);
    });

    it('returns empty array on non-ok response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        expect(await fetchSpellOverlays(CAMPAIGN)).toEqual([]);
    });

    it('returns empty array on network error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
        expect(await fetchSpellOverlays(CAMPAIGN)).toEqual([]);
    });
});

describe('getCurrentOverlayTarget', () => {
    it('returns null when attacker has no overlay target', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Wizard', targetName: 'Goblin' }] });
        expect(await getCurrentOverlayTarget(CAMPAIGN, 'Wizard')).toBeNull();
    });

    it('returns null when attacker unknown', async () => {
        expect(await getCurrentOverlayTarget(CAMPAIGN, null)).toBeNull();
    });

    it('resolves overlay by id from the overlay endpoint', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Wizard', targetName: 'overlay-o1' }] });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ overlays: [{ id: 'o1', shape: 'sphere', radiusFt: 20, startGridX: 5, startGridY: 5, angle: 0 }] }),
        }));

        const overlay = await getCurrentOverlayTarget(CAMPAIGN, 'Wizard');
        expect(overlay).toMatchObject({ id: 'o1' });
    });
});

const sphere = { id: 'o1', shape: 'sphere', radiusFt: 20, startGridX: 5, startGridY: 5, angle: 0 };

function mockActiveMap(tokens, walls = []) {
    getRuntimeValue.mockReturnValue('battle-map');
    loadMapData.mockResolvedValue({ gridSize: 20, walls, players: tokens, placedItems: [] });
}

describe('getCreaturesInsideOverlay', () => {
    it('returns target names whose tokens hit-test inside the overlay', async () => {
        mockActiveMap([
            { name: 'Goblin', gridX: 5, gridY: 5 },
            { name: 'Wizard', gridX: 5, gridY: 6 },
            { name: 'Farling', gridX: 15, gridY: 15 },
        ]);

        const inside = await getCreaturesInsideOverlay(CAMPAIGN, sphere, ['Goblin', 'Wizard', 'Farling']);
        expect(inside.sort()).toEqual(['Goblin', 'Wizard']);
    });

    it('returns [] when no map is active', async () => {
        getRuntimeValue.mockReturnValue(null);
        expect(await getCreaturesInsideOverlay(CAMPAIGN, sphere, ['Goblin'])).toEqual([]);
    });

    it('returns [] when overlay is null', async () => {
        expect(await getCreaturesInsideOverlay(CAMPAIGN, null, ['Goblin'])).toEqual([]);
    });
});

describe('getLosDistanceFeet', () => {
    it('measures straight path distance in feet', () => {
        const { distFt, blocked } = getLosDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), new Set());
        expect(distFt).toBe(15);
        expect(blocked).toBe(false);
    });

    it('is blocked by an intermediate wall cell', () => {
        const { distFt, blocked } = getLosDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(['1,0']), new Set());
        expect(blocked).toBe(true);
        expect(distFt).toBe(15);
    });

    it('is not blocked by walls at the endpoints', () => {
        const { blocked } = getLosDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(['0,0', '3,0']), new Set());
        expect(blocked).toBe(false);
    });
});

describe('getTargetMapStatuses', () => {
    it('returns null when no map is active', async () => {
        getRuntimeValue.mockReturnValue(null);
        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Goblin'], 60)).toBeNull();
    });

    it('returns null when attacker is not on the map', async () => {
        mockActiveMap([{ name: 'Goblin', gridX: 2, gridY: 2 }]);
        expect(await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Goblin'], 60)).toBeNull();
    });

    it('marks in range, out of range, and off-map targets', async () => {
        mockActiveMap([
            { name: 'Wizard', gridX: 0, gridY: 0 },
            { name: 'Near', gridX: 2, gridY: 0 },
            { name: 'Far', gridX: 18, gridY: 0 },
        ]);

        const statuses = await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Near', 'Far', 'Unplaced'], 30);
        expect(statuses.Near).toEqual({ status: 'in', distFt: 10 });
        expect(statuses.Far).toEqual({ status: 'out', distFt: 90 });
        expect(statuses.Unplaced).toEqual({ status: 'off-map', distFt: null });
    });

    it('marks blocked targets behind walls', async () => {
        mockActiveMap([
            { name: 'Wizard', gridX: 0, gridY: 0 },
            { name: 'Caged', gridX: 4, gridY: 0 },
        ], ['2,0']);

        const statuses = await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Caged'], 60);
        expect(statuses.Caged.status).toBe('blocked');
    });

    it('treats unknown range as always in range', async () => {
        mockActiveMap([
            { name: 'Wizard', gridX: 0, gridY: 0 },
            { name: 'Far', gridX: 18, gridY: 0 },
        ]);

        const statuses = await getTargetMapStatuses(CAMPAIGN, 'Wizard', ['Far'], null);
        expect(statuses.Far.status).toBe('in');
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
