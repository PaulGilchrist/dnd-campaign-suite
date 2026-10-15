// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Merge overrides (never replace the automation block wholesale).
function makeAction(overrides = {}) {
    const { automation = {}, ...rest } = overrides;
    return {
        name: 'Elemental Attunement',
        ...rest,
        automation: { type: 'elemental_attunement', ...automation },
    };
}

// Key-router over runtime — never positional chains.
// elementalAttunementActive / focusPoints are the handler's only two reads;
// activation-state canon belongs to the attunement modal lane, this file
// pins only this handler's read of the canonical keys.
function mockRuntime({ active = false, focusPoints = undefined } = {}) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'elementalAttunementActive') return active;
        if (key === 'focusPoints') return focusPoints;
        return undefined;
    });
}

function stubFetchOverlays(overlays) {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overlays }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ── already-active gate ──

describe('elementalAttunementHandler - already active', () => {
    it('returns automation_info popup for any truthy elementalAttunementActive, without reading focus points', async () => {
        for (const active of [true, 1, 'fire']) {
            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((_name, key) =>
                key === 'elementalAttunementActive' ? active : undefined);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Elemental Attunement',
                    description: 'Elemental Attunement is already active.',
                    automation: { type: 'elemental_attunement' },
                },
            });
            // no-side-effect guard: early return reads only the gate key
            expect(getRuntimeValue).toHaveBeenCalledTimes(1);
            expect(getRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer', 'elementalAttunementActive', campaignName,
            );
        }
    });
});

// ── focus points gate ──

describe('elementalAttunementHandler - focus points gate', () => {
    it('opens elementalAttunement modal with full payload when stored focus points are positive', async () => {
        mockRuntime({ focusPoints: 2 });

        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'elementalAttunement',
            payload: {
                action,
                playerStats,
                campaignName,
                mapName,
                activeOverlay: null,
            },
        });
        // exact-key pins for both canonical runtime reads
        expect(getRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer', 'elementalAttunementActive', campaignName,
        );
        expect(getRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer', 'focusPoints', campaignName,
        );
    });

    it.each([0, '0', -1])(
        'blocks when stored focusPoints is %p',
        async (fp) => {
            mockRuntime({ focusPoints: fp });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Elemental Attunement',
                    description: 'Elemental Attunement: No Focus Points remaining.',
                    automation: { type: 'elemental_attunement' },
                },
            });
        },
    );

    it('interpolates the action name into the block description', async () => {
        mockRuntime({ focusPoints: 0 });

        const result = await handle(
            makeAction({ name: 'Custom Surge' }),
            makePlayerStats(),
            campaignName,
            mapName,
        );

        expect(result.payload.description).toBe('Custom Surge: No Focus Points remaining.');
    });

    it('accepts numeric-string stored focus points', async () => {
        mockRuntime({ focusPoints: '5' });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
    });
});

// ── focus points fallback chain (stored → tracked → class max) ──

describe('elementalAttunementHandler - focus points fallback chain', () => {
    it('falls back to tracked resources when stored FP is null, beating a zero class max', async () => {
        mockRuntime({ focusPoints: null });

        const ps = makePlayerStats({
            class: { class_levels: [{ level: 1, focus_points: 0 }] },
            _trackedResources: { focusPoints: { current: 4 } },
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it('blocks when tracked focus points are 0 and stored FP is null', async () => {
        mockRuntime({ focusPoints: null });

        const ps = makePlayerStats({
            _trackedResources: { focusPoints: { current: 0 } },
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });

    it.each([
        ['empty object', {}],
        ['undefined', undefined],
    ])('defaults to class max FP when _trackedResources is %s', async (_label, tracked) => {
        mockRuntime({ focusPoints: null });

        const ps = makePlayerStats({ _trackedResources: tracked });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it('resolves max FP from the class level exactly matching the character level', async () => {
        mockRuntime({ focusPoints: null });

        // level-1 has 0 FP; only the level-3 entry can unblock.
        const ps = makePlayerStats({
            level: 3,
            class: {
                class_levels: [
                    { level: 1, focus_points: 0 },
                    { level: 3, focus_points: 3 },
                ],
            },
            _trackedResources: undefined,
        });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('modal');
    });

    it.each([
        ['empty class_levels', { class: { class_levels: [] } }],
        ['undefined class', { class: undefined }],
    ])('blocks with no focus points when class data has %s', async (_label, overrides) => {
        mockRuntime({ focusPoints: null });

        const ps = makePlayerStats({ ...overrides, _trackedResources: {} });

        const result = await handle(makeAction(), ps, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'Elemental Attunement: No Focus Points remaining.',
        );
    });
});

// ── overlay resolution (delegation lane: spellOverlayService owns prefix
//    parsing, URL, and failure handling — this pins only the gate + payload
//    injection through overlayTargetId/fetchSpellOverlays) ──

describe('elementalAttunementHandler - overlay resolution', () => {
    it('resolves an overlay- target to the matching overlay object in the modal payload', async () => {
        mockRuntime({ focusPoints: 2 });
        const fireOverlay = { id: 'abc123', name: 'Fire Overlay' };
        const fetchMock = stubFetchOverlays([
            { id: 'def456', name: 'Water Overlay' },
            fireOverlay,
        ]);

        const action = makeAction({ targetName: 'overlay-abc123' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.type).toBe('modal');
        expect(result.payload.activeOverlay).toBe(fireOverlay);
    });

    it('returns null activeOverlay when no overlay matches the id', async () => {
        mockRuntime({ focusPoints: 2 });
        stubFetchOverlays([{ id: 'abc123', name: 'Fire Overlay' }]);

        const action = makeAction({ targetName: 'overlay-nonexistent' });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.activeOverlay).toBeNull();
    });

    it.each([
        ['a plain target name', 'Goblin'],
        ['no targetName', undefined],
    ])('does not fetch overlays when targetName is %s', async (_label, targetName) => {
        mockRuntime({ focusPoints: 2 });
        const fetchMock = stubFetchOverlays([]);

        const result = await handle(makeAction({ targetName }), makePlayerStats(), campaignName, mapName);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.type).toBe('modal');
        expect(result.payload.activeOverlay).toBeNull();
    });
});
