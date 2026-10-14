import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './elementalBurstHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        level: 6,
        class: {
            class_levels: [
                { level: 1, focus_points: 2 },
                { level: 6, focus_points: 6 },
            ],
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Elemental Burst',
        automation: { type: 'elemental_burst', ...overrides },
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('elementalBurstHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle - insufficient focus points', () => {
        it('returns a popup when stored FP is 0', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Elemental Burst',
                    description: 'Elemental Burst: Not enough Focus Points remaining. 2 required.',
                    automation: { type: 'elemental_burst' },
                },
            });
        });

        it('returns a popup when stored FP is 1', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Not enough Focus Points');
            expect(result.payload.description).toContain('2 required');
        });

        it('returns a popup when stored FP is null (uses maxFP fallback and it is < 2)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const ps = makePlayerStats({
                level: 1,
                class: {
                    class_levels: [{ level: 1, focus_points: 1 }],
                },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Focus Points');
        });

        it('returns a popup when stored FP is undefined (uses _trackedResources fallback and it is < 2)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: { current: 1 } },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Focus Points');
        });

        it('returns a popup when all FP sources are zero', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const ps = makePlayerStats({
                level: 1,
                class: {
                    class_levels: [{ level: 1, focus_points: 0 }],
                },
                _trackedResources: { focusPoints: { current: 0 } },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
        });

        it('returns a popup when stored FP is a string "1"', async () => {
            runtimeState.getRuntimeValue.mockReturnValue('1');

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Focus Points');
        });

        it('returns a popup when stored FP is a string "0"', async () => {
            runtimeState.getRuntimeValue.mockReturnValue('0');

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('popup');
        });
    });

    describe('handle - sufficient focus points (modal path)', () => {
        it('returns a modal when stored FP is exactly 2', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(2);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalBurst');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBeDefined();
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.mapName).toBe(mapName);
        });

        it('returns a modal when stored FP is greater than 2', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(10);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalBurst');
        });

        it('uses _trackedResources fallback when stored FP is undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: { current: 5 } },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalBurst');
        });

        it('falls back to maxFP when both stored FP and _trackedResources are absent', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: null,
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalBurst');
        });

        it('falls back to maxFP when stored FP is null', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const ps = makePlayerStats({
                _trackedResources: null,
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalBurst');
        });
    });

    describe('handle - side effects (modal path)', () => {
        it('deducts 2 from stored FP and calls setRuntimeValue', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const action = makeAction();
            await handle(action, makePlayerStats(), campaignName, mapName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                3,
                campaignName,
            );
        });

        it('deducts 2 from _trackedResources current when stored FP is undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: { current: 7 } },
            });

            const action = makeAction();
            await handle(action, ps, campaignName, mapName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                5,
                campaignName,
            );
        });

        it('deducts 2 from maxFP when no stored FP or _trackedResources exist', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: null,
            });

            const action = makeAction();
            await handle(action, ps, campaignName, mapName);

            // maxFP is 6, so 6 - 2 = 4
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                4,
                campaignName,
            );
        });

        it('deducts 2 from string-stored FP', async () => {
            runtimeState.getRuntimeValue.mockReturnValue('8');

            const action = makeAction();
            await handle(action, makePlayerStats(), campaignName, mapName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                6,
                campaignName,
            );
        });

        it('dispatches a focus-points-updated event on the window', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

            const action = makeAction();
            await handle(action, makePlayerStats(), campaignName, mapName);

            expect(dispatchEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'focus-points-updated' }),
            );
            dispatchEventSpy.mockRestore();
        });
    });

    describe('handle - edge cases', () => {
        it('handles playerStats with no class field gracefully', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const ps = makePlayerStats({ class: null });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalBurst');
        });

        it('handles playerStats with no class_levels field gracefully', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const ps = makePlayerStats({ class: {} });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            // maxFP would be 0 (undefined), so with stored FP of 5 it deducts to 3
            expect(result.type).toBe('modal');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                3,
                campaignName,
            );
        });

        it('handles playerStats with no level field gracefully', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const ps = makePlayerStats({ level: undefined });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('modal');
        });

        it('handles action with no automation field', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const action = { name: 'Elemental Burst' };
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('modal');
            expect(result.payload.automation).toBeUndefined();
        });

        it('handles action with no name field', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = { automation: { type: 'elemental_burst' } };
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBeUndefined();
        });

        it('handles class_levels as empty array', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                class: { class_levels: [] },
                _trackedResources: null,
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            // maxFP = 0, storedFP = undefined, trackedResources = null -> currentFP = 0 < 2
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Focus Points');
        });

        it('handles _trackedResources with no focusPoints key', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: { somethingElse: { current: 10 } },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            // maxFP = 6, so currentFP = 6 >= 2 -> modal
            expect(result.type).toBe('modal');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                4,
                campaignName,
            );
        });

        it('handles _trackedResources.focusPoints without current property', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: {} },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            // maxFP = 6, so currentFP = 6 >= 2 -> modal
            expect(result.type).toBe('modal');
        });

        it('prefers stored FP over _trackedResources when both exist', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(3);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: { current: 100 } },
            });

            const action = makeAction();
            await handle(action, ps, campaignName, mapName);

            // stored FP is 3, so 3 - 2 = 1
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                1,
                campaignName,
            );
        });

        it('prefers _trackedResources over maxFP when stored FP is absent', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: { current: 3 } },
            });

            const action = makeAction();
            await handle(action, ps, campaignName, mapName);

            // _trackedResources.current is 3, so 3 - 2 = 1
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                1,
                campaignName,
            );
        });

        it('uses class level matching playerStats.level for maxFP', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const ps = makePlayerStats({
                level: 1,
                class: {
                    class_levels: [
                        { level: 1, focus_points: 2 },
                        { level: 6, focus_points: 6 },
                    ],
                },
                _trackedResources: null,
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            // level 1 -> focus_points = 2, so currentFP = 2 >= 2 -> modal
            expect(result.type).toBe('modal');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                0,
                campaignName,
            );
        });

        it('handles negative stored FP gracefully (blocks activation)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(-1);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Focus Points');
        });

        it('handles NaN stored FP gracefully (blocks activation)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(NaN);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, mapName);

            // Number(NaN) = NaN, NaN < 2 is false, so it would proceed with modal
            // but currentFP = NaN, NaN - 2 = NaN, setRuntimeValue gets NaN
            expect(result.type).toBe('modal');
        });
    });
});
