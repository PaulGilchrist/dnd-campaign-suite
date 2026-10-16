// @maintained-by-ai
// Source contract for strideOfTheElementsHandler (CLA-400): passive chooser gated on
// elementalAttunementActive — verbatim refusal popup when inactive, strideOfTheElements
// modal with pass-through payload when active, zero runtime writes either way.
// STRIDE_OPTIONS content is owned by StrideOfTheElementsModal.test.jsx (it pins each
// option's label and onConfirm args against this export); not re-pinned here.
// Deterministic pure function over one runtime key — no timers, no pipeline, no te writes.

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './strideOfTheElementsHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makePlayerStats(name = 'TestMonk') {
    return {
        name,
        level: 6,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Stride of the Elements',
        description: 'When you use your Elemental Attunement, you can gain a special movement type.',
        automation: {
            type: 'stride_of_the_elements',
            effect: 'elemental_movement',
            casting_time: 'passive',
        },
        ...overrides,
    };
}

describe('strideOfTheElementsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Gate: reads ONLY elementalAttunementActive (exact-key pin) — any falsy value
    // (unset, false, null) yields the verbatim refusal popup, automation passed through.
    describe.each([
        ['false', () => false],
        ['null', () => null],
        ['undefined', () => undefined],
    ])('gated off when elementalAttunementActive is %s', (_label, impl) => {
        it('returns refusal popup with verbatim description and pass-through automation', async () => {
            getRuntimeValue.mockImplementation((_attackerName, key) => (
                key === 'elementalAttunementActive' ? impl() : null
            ));
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith('TestMonk', 'elementalAttunementActive', campaignName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Stride of the Elements',
                    automationType: 'stride_of_the_elements',
                    description: 'Elemental Attunement must be active to use Stride of the Elements.',
                    automation: action.automation,
                },
            });
        });
    });

    it('opens strideOfTheElements modal with pass-through payload when attunement is active', async () => {
        getRuntimeValue.mockImplementation((_attackerName, key) => (
            key === 'elementalAttunementActive' ? true : null
        ));
        const action = makeAction();
        const playerStats = makePlayerStats();

        const result = await handle(action, playerStats, campaignName);

        expect(getRuntimeValue).toHaveBeenCalledWith('TestMonk', 'elementalAttunementActive', campaignName);
        expect(result).toEqual({
            type: 'modal',
            modalName: 'strideOfTheElements',
            payload: { action, playerStats, campaignName },
        });
    });

    it('writes no runtime state and logs nothing on either branch (zero-spend chooser)', async () => {
        const active = makeAction();
        getRuntimeValue.mockReturnValue(false);
        await handle(active, makePlayerStats(), campaignName);
        getRuntimeValue.mockReturnValue(true);
        await handle(active, makePlayerStats(), campaignName);

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
