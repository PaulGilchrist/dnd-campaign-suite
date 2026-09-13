// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './elementalAttunementHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        level: 1,
        class: {
            class_levels: [
                { level: 1, focus_points: 2 },
            ],
        },
        _trackedResources: {
            focusPoints: { current: 2 },
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Elemental Attunement',
        automation: {
            type: 'elemental_attunement',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function setupFetchMock(overlays) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overlays }),
    }));
}

function setupFetchErrorMock() {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
}

// ── handle: elementalAttunementActive already set ──

describe('elementalAttunementHandler - already active', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup when elementalAttunementActive is true', async () => {
        getRuntimeValue.mockReturnValue(true);

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
            mapName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Elemental Attunement');
        expect(result.payload.description).toBe(
            'Elemental Attunement is already active.',
        );
        expect(result.payload.automation).toEqual(
            makeAction().automation,
        );
    });

    it('returns popup when elementalAttunementActive is 1 (truthy)', async () => {
        getRuntimeValue.mockReturnValue(1);

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
            mapName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement is already active.',
        );
    });

    it('returns popup when elementalAttunementActive is a non-empty string', async () => {
        getRuntimeValue.mockReturnValue('fire');

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
            mapName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement is already active.',
        );
    });
});

// ── handle: no focus points remaining ──

describe('elementalAttunementHandler - no focus points', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(false);
    });

    it('returns popup when focusPoints current is 0', async () => {
        const ps = makePlayerStats({
            _trackedResources: { focusPoints: { current: 0 } },
        });

        const result = await handle(
            makeAction(),
            ps,
            campaignName,
            mapName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
        expect(result.payload.automation).toEqual(
            makeAction().automation,
        );
    });

    it('returns popup when focusPoints current is negative', async () => {
        const ps = makePlayerStats({
            _trackedResources: { focusPoints: { current: -1 } },
        });

        const result = await handle(
            makeAction(),
            ps,
            campaignName,
            mapName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });

    it('returns popup when storedFP is 0 (number)', async () => {
        getRuntimeValue.mockReturnValueOnce(false); // elementalAttunementActive
        getRuntimeValue.mockReturnValueOnce(0); // focusPoints

        const ps = makePlayerStats({
            _trackedResources: { focusPoints: { current: 5 } },
        });

        const result = await handle(
            makeAction(),
            ps,
            campaignName,
            mapName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });

    it('returns popup when storedFP is a string "0"', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce('0');

        const ps = makePlayerStats();

        const result = await handle(
            makeAction(),
            ps,
            campaignName,
            mapName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });
});

// ── handle: focus points available → modal ──

describe('elementalAttunementHandler - focus points available', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(false); // elementalAttunementActive
    });

    it('returns modal when focus points are available', async () => {
        getRuntimeValue.mockReturnValueOnce(false); // elementalAttunementActive
        getRuntimeValue.mockReturnValueOnce(2); // focusPoints

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
            mapName,
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('elementalAttunement');
        expect(result.payload.action).toBeDefined();
        expect(result.payload.playerStats).toBeDefined();
        expect(result.payload.campaignName).toBe(campaignName);
        expect(result.payload.mapName).toBe(mapName);
        expect(result.payload.activeOverlay).toBeNull();
    });

    it('passes the action object to the modal payload', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(1);

        const action = makeAction({ name: 'Custom Name', automation: { type: 'custom' } });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.payload.action).toBe(action);
    });

    it('passes playerStats to the modal payload', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(1);

        const ps = makePlayerStats({ name: 'CustomChar', level: 5 });
        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.payload.playerStats).toBe(ps);
    });
});

// ── handle: focus points resolution ──

describe('elementalAttunementHandler - focus points resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(false); // elementalAttunementActive
    });

    it('uses stored focusPoints from runtime when available', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(3);

        const ps = makePlayerStats({
            _trackedResources: { focusPoints: { current: 10 } },
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it('falls back to _trackedResources when storedFP is null', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            _trackedResources: { focusPoints: { current: 4 } },
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it('uses max focus points when _trackedResources is missing', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            _trackedResources: {},
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it('uses max focus points from class level when _trackedResources is missing entirely', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            _trackedResources: undefined,
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it('blocks when _trackedResources focusPoints current is 0', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            _trackedResources: { focusPoints: { current: 0 } },
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });

    it('treats storedFP as number via Number() coercion', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce('5');

        const ps = makePlayerStats();

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });
});

// ── handle: overlay fetching ──

describe('elementalAttunementHandler - overlay fetching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        getRuntimeValue
            .mockReturnValueOnce(false) // elementalAttunementActive
            .mockReturnValueOnce(1); // focusPoints
    });

    it('fetches spell overlays when targetName starts with overlay-', async () => {
        setupFetchMock([
            { id: 'abc123', name: 'Fire Overlay' },
            { id: 'def456', name: 'Water Overlay' },
        ]);

        const action = makeAction({ targetName: 'overlay-abc123' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(global.fetch).toHaveBeenCalledWith(
            `/spell-overlay?campaign=${campaignName}`,
        );
        expect(result.payload.activeOverlay).toEqual({
            id: 'abc123',
            name: 'Fire Overlay',
        });
    });

    it('returns null activeOverlay when no matching overlay is found', async () => {
        setupFetchMock([
            { id: 'overlay-abc123', name: 'Fire Overlay' },
        ]);

        const action = makeAction({ targetName: 'overlay-nonexistent' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.payload.activeOverlay).toBeNull();
    });

    it('returns null activeOverlay when fetch fails', async () => {
        setupFetchErrorMock();

        const action = makeAction({ targetName: 'overlay-abc123' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.payload.activeOverlay).toBeNull();
    });

    it('does not fetch overlays when targetName does not start with overlay-', async () => {
        setupFetchMock([]);

        const action = makeAction({ targetName: 'Goblin' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.payload.activeOverlay).toBeNull();
    });

    it('does not fetch overlays when targetName is undefined', async () => {
        setupFetchMock([]);

        const action = makeAction({ targetName: undefined });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.payload.activeOverlay).toBeNull();
    });

    it('does not fetch overlays when targetName is null', async () => {
        setupFetchMock([]);

        const action = makeAction({ targetName: null });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.payload.activeOverlay).toBeNull();
    });

    it('does not fetch overlays when targetName is an empty string', async () => {
        setupFetchMock([]);

        const action = makeAction({ targetName: '' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.payload.activeOverlay).toBeNull();
    });

    it('does not fetch overlays when action has no targetName property', async () => {
        setupFetchMock([]);

        const action = makeAction();
        delete action.targetName;
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.payload.activeOverlay).toBeNull();
    });

    it('handles empty overlays array from API', async () => {
        setupFetchMock([]);

        const action = makeAction({ targetName: 'overlay-abc123' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.payload.activeOverlay).toBeNull();
    });

    it('passes overlay data through to modal payload correctly', async () => {
        const overlayData = {
            id: 'xyz',
            name: 'Test Overlay',
            properties: { element: 'fire' },
        };
        setupFetchMock([overlayData]);

        const action = makeAction({ targetName: 'overlay-xyz' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.payload.activeOverlay).toBe(overlayData);
    });
});

// ── handle: class level lookup ──

describe('elementalAttunementHandler - class level lookup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(false);
    });

    it('finds focus_points from matching class level', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            level: 3,
            class: {
                class_levels: [
                    { level: 1, focus_points: 1 },
                    { level: 2, focus_points: 2 },
                    { level: 3, focus_points: 3 },
                ],
            },
            _trackedResources: {},
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it('blocks when class_level focus_points is 0 and no stored FP', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            level: 1,
            class: {
                class_levels: [
                    { level: 1, focus_points: 0 },
                ],
            },
            _trackedResources: {},
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });

    it('handles missing class_levels gracefully', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            class: {
                class_levels: [],
            },
            _trackedResources: {},
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });

    it('handles undefined class gracefully', async () => {
        getRuntimeValue.mockReturnValueOnce(false);
        getRuntimeValue.mockReturnValueOnce(null);

        const ps = makePlayerStats({
            class: undefined,
            _trackedResources: {},
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });
});
