// @maintained-by-ai — deterministic: handler is a pure FP-gate (stored FP →
// _trackedResources → maxFP fallback, < 2 blocks, else deduct 2 + open modal).
// All deps mocked at module boundary; modal internals owned by ElementalBurstModal.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

function makeAction() {
    return {
        name: 'Elemental Burst',
        automation: { type: 'elemental_burst' },
    };
}

// Key-router over runtime — focusPoints is the handler's only read.
function mockFP(fp) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return fp;
        return undefined;
    });
}

let dispatchSpy;

beforeEach(() => {
    vi.clearAllMocks();
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
});

afterEach(() => {
    dispatchSpy.mockRestore();
});

// ── Tests ────────────────────────────────────────────────────────

describe('elementalBurstHandler', () => {
    describe('insufficient FP — blocked popup, no side effects', () => {
        it('blocks at stored FP 0 with full popup contract and never writes FP or dispatches', async () => {
            mockFP(0);

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
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(dispatchSpy).not.toHaveBeenCalled();
        });

        it('blocks when stored FP is null, tracked resources are absent, and no class level matches (maxFP 0)', async () => {
            mockFP(null);

            const ps = makePlayerStats({
                level: 3,
                class: { class_levels: [{ level: 1, focus_points: 2 }] },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Focus Points');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('sufficient FP — modal contract and deduction', () => {
        it('opens at the FP = 2 boundary with full modal payload and deducts to 0', async () => {
            mockFP(2);

            const action = makeAction();
            const ps = makePlayerStats();
            const result = await handle(action, ps, campaignName, mapName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'elementalBurst',
                payload: {
                    action,
                    playerStats: ps,
                    campaignName,
                    mapName,
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                0,
                campaignName,
            );
        });

        it('reads the canonical focusPoints key and deducts 2 from stored FP', async () => {
            mockFP(5);

            const action = makeAction();
            await handle(action, makePlayerStats(), campaignName, mapName);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                3,
                campaignName,
            );
        });

        it('prefers stored FP over _trackedResources when both exist', async () => {
            mockFP(3);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: { current: 100 } },
            });

            const action = makeAction();
            await handle(action, ps, campaignName, mapName);

            // stored 3 wins over tracked 100 — deducts to 1, not 98
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                1,
                campaignName,
            );
        });

        it('coerces a string-stored FP before deducting', async () => {
            mockFP('8');

            const action = makeAction();
            await handle(action, makePlayerStats(), campaignName, mapName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                6,
                campaignName,
            );
        });

        it('prefers _trackedResources.current over maxFP when stored FP is absent', async () => {
            mockFP(undefined);

            const ps = makePlayerStats({
                _trackedResources: { focusPoints: { current: 3 } },
            });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            // tracked 3 wins over maxFP 6 — deducts to 1, not 4
            expect(result.type).toBe('modal');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                1,
                campaignName,
            );
        });

        it('falls back to maxFP when stored FP and _trackedResources are both absent', async () => {
            mockFP(undefined);

            const ps = makePlayerStats({ _trackedResources: null });

            const action = makeAction();
            const result = await handle(action, ps, campaignName, mapName);

            // maxFP is 6, so 6 - 2 = 4
            expect(result.type).toBe('modal');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                4,
                campaignName,
            );
        });

        it('resolves maxFP from the class_levels entry matching playerStats.level', async () => {
            mockFP(undefined);

            const ps = makePlayerStats({ level: 1, _trackedResources: null });

            const action = makeAction();
            await handle(action, ps, campaignName, mapName);

            // level 1 -> focus_points 2, so 2 - 2 = 0
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'focusPoints',
                0,
                campaignName,
            );
        });

        it('dispatches focus-points-updated on window after deducting', async () => {
            mockFP(5);

            const action = makeAction();
            await handle(action, makePlayerStats(), campaignName, mapName);

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'focus-points-updated' }),
            );
        });
    });
});
