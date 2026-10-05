// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { skipTargetChoice } from './destructiveStrideHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// CLA-113: skip still grants the numeric +20 speed_boost buff (CLA-067 lane).
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestMonk',
        level: 5,
        class: {
            class_levels: [
                { level: 1, martial_arts_die: 4 },
                { level: 5, martial_arts_die: 6 },
            ],
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Destructive Stride',
        automation: {
            type: 'destructive_stride',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('destructiveStrideHandler — skipTargetChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a popup with skip description', async () => {
        const result = await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Destructive Stride');
        expect(result.payload.description).toBe('Destructive Stride activated — Speed +20 ft, no damage dealt.');
    });

    it('sets destructiveStrideActive to true', async () => {
        await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'destructiveStrideActive',
            true,
            campaignName,
        );
    });

    it('does not call setRuntimeValue for damage type — active flag + CLA-113 speed_buff only', async () => {
        await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        const calledArgs = runtimeState.setRuntimeValue.mock.calls;
        expect(calledArgs.map(a => a[1])).toEqual(['destructiveStrideActive', 'activeBuffs']);
    });

    it('CLA-113: grants numeric +20 speed_boost buff with name-scoped expiry clock', async () => {
        const { addExpiration } = await import('../../../rules/effects/expirations.js');
        await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(a => a[1] === 'activeBuffs');
        expect(buffsCall[2]).toEqual([
            { name: 'Destructive Stride', effect: 'speed_boost', speedBonus: 20, duration: 'until_end_of_turn' },
        ]);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: 'TestMonk',
            effects: [{ type: 'remove_active_buff', buffName: 'Destructive Stride' }],
            campaignName,
            expireOnCreatureName: 'TestMonk',
        }));
    });

    it('logs the ability use to campaign log', async () => {
        await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Destructive Stride',
            description: 'Destructive Stride activated — Speed +20 ft (speed_boost) until end of turn, no target chosen.',
            timestamp: expect.any(Number),
        }));
    });

    it('includes automation in popup payload', async () => {
        const result = await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('includes automationType in popup payload', async () => {
        const result = await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.automationType).toBe('destructive_stride');
    });

    it('catches and logs errors from addEntry without throwing', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        logService.addEntry.mockRejectedValue(new Error('log failure'));

        const result = await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('works with custom action name', async () => {
        const action = { name: 'Custom Stride', automation: { type: 'destructive_stride' } };
        const result = await skipTargetChoice(action, makePlayerStats(), campaignName);

        expect(result.payload.name).toBe('Custom Stride');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            abilityName: 'Custom Stride',
        }));
    });

    it('works with different player name', async () => {
        const stats = { name: 'OtherMonk', level: 5, class: { class_levels: [] } };
        await skipTargetChoice(makeAction(), stats, campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'OtherMonk',
            'destructiveStrideActive',
            true,
            campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            characterName: 'OtherMonk',
        }));
    });
});
