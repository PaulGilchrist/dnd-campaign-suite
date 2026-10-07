// CLA-200 regression — once-per-Divine-Smite latch.
// A single Divine Smite cast arms ONE 2d8+level Channel Divinity THP pool.
// After the distributor is CONFIRMED (inspiringSmiteUsedToken stamped == the
// cast's inspiringSmiteCastToken), re-clicking the gated "Inspiring Smite:"
// row must be REFUSED — no fresh roll, no modal, no second Channel Divinity
// spend. A NEW Divine Smite cast (fresh castToken via the service) re-arms.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(() => 30),
}));

vi.mock('../../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const dispatchedEvents = {};
const originalDispatch = window.dispatchEvent.bind(window);
window.dispatchEvent = vi.fn((event) => {
    dispatchedEvents[event.type] = event;
    return originalDispatch(event);
});

import { handle } from './inspiringSmiteHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';
const playerName = 'ElderPaladin';

function makeAction() {
    return {
        name: 'Inspiring Smite',
        automation: { type: 'post_cast_inspiring_smite', range: '30 ft', casting_time: 'passive' },
    };
}

function makeStats() {
    return {
        name: playerName,
        level: 20,
        automation: { passives: [] },
        class: { class_levels: [{ level: 20, channel_divinity: 3 }] },
    };
}

function divineSmiteRuntime({ castToken, usedToken }) {
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'lastAttack') {
            return { attackName: 'Divine Smite', attackerName: playerName };
        }
        if (key === playerName && prop === 'channelDivinityCharges') return 3;
        if (key === playerName && prop === 'selectedAllies') return [playerName, 'FeyRanger', 'War_Cleric'];
        if (key === playerName && prop === 'inspiringSmiteCastToken') return castToken;
        if (key === playerName && prop === 'inspiringSmiteUsedToken') return usedToken;
        return undefined;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(dispatchedEvents)) delete dispatchedEvents[key];
});

describe('Inspiring Smite once-per-cast latch (CLA-200)', () => {
    it('first click after a fresh Divine Smite cast opens the distributor', async () => {
        divineSmiteRuntime({ castToken: 1000, usedToken: undefined });

        const result = await handle(makeAction(), makeStats(), campaignName, null);

        expect(result).toBeNull();
        const event = dispatchedEvents['inspiring-smite-pending'];
        expect(event).toBeDefined();
        expect(event.detail.castToken).toBe(1000);
        expect(event.detail.channelDivinityCharges).toBe(3);
    });

    it('re-click after CONFIRM (usedToken === castToken) is refused — no modal, no re-roll', async () => {
        divineSmiteRuntime({ castToken: 1000, usedToken: 1000 });

        const result = await handle(makeAction(), makeStats(), campaignName, null);

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/already been used for this Divine Smite/);
        expect(dispatchedEvents['inspiring-smite-pending']).toBeUndefined();
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            characterName: playerName,
            description: expect.stringContaining('inspiring_smite_refused'),
        }));
    });

    it('a NEW Divine Smite cast (fresh castToken) re-arms the distributor', async () => {
        divineSmiteRuntime({ castToken: 2000, usedToken: 1000 });

        const result = await handle(makeAction(), makeStats(), campaignName, null);

        expect(result).toBeNull();
        const event = dispatchedEvents['inspiring-smite-pending'];
        expect(event).toBeDefined();
        expect(event.detail.castToken).toBe(2000);
    });

    it('stamps a castToken when none exists so the latch is not defeated on legacy rows', async () => {
        divineSmiteRuntime({ castToken: undefined, usedToken: undefined });
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makeStats(), campaignName, null);

        expect(result).toBeNull();
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName, 'inspiringSmiteCastToken', expect.any(Number), campaignName
        );
        const event = dispatchedEvents['inspiring-smite-pending'];
        expect(event.detail.castToken).toEqual(expect.any(Number));
    });
});
