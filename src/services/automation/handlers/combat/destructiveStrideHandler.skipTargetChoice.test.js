// @maintained-by-ai
// Destructive Stride — skipTargetChoice lane (last of quad; siblings cover
// handle / applyDamageTypeChoice / applyTargetChoice in their own files).
// Production-live: the Skip flow in DestructiveStrideModal.jsx (line 29) and
// CharActionModals.jsx (line 364) call this directly — component suites mock
// the handler, so this file is the behavioural oracle for the skip lane.
// Deterministic contract pins: exact popup return (own popup string per handle
// lane), exact setRuntimeValue table (active flag + CLA-113 numeric +20
// speed_boost, CLA-067 lane), name-scoped addExpiration delegation, the own
// campaign-log line, and addEntry-rejection resilience. grantStrideSpeedBuff
// dedupe internals are pinned by the applyDamageTypeChoice lane (shared
// private helper) and are not re-covered here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { skipTargetChoice } from './destructiveStrideHandler.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
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

const SPEED_BUFF = {
    name: 'Destructive Stride',
    effect: 'speed_boost',
    speedBonus: 20,
    duration: 'until_end_of_turn',
};

// skipTargetChoice reads only playerStats.name — no level/class dependency.
function makePlayerStats(overrides = {}) {
    return {
        name: 'TestMonk',
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

    it('returns the exact popup contract with the own skip description', async () => {
        const action = makeAction();

        const result = await skipTargetChoice(action, makePlayerStats(), campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Destructive Stride',
                automationType: 'destructive_stride',
                description: 'Destructive Stride activated — Speed +20 ft, no damage dealt.',
                automation: action.automation,
            },
        });
    });

    it('writes exactly active flag + CLA-113 speed_buff and registers the name-scoped expiry clock', async () => {
        await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        // No damage-type write on the skip lane — exact two-set table.
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
            ['TestMonk', 'destructiveStrideActive', true, campaignName],
            ['TestMonk', 'activeBuffs', [SPEED_BUFF], campaignName],
        ]);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'TestMonk',
            targetName: 'TestMonk',
            effects: [{ type: 'remove_active_buff', buffName: 'Destructive Stride' }],
            campaignName,
            rounds: undefined,
            expireOnCreatureName: 'TestMonk',
        });
    });

    it('logs the skip activation with the exact campaign-log line', async () => {
        await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Destructive Stride',
            description: 'Destructive Stride activated — Speed +20 ft (speed_boost) until end of turn, no target chosen.',
            timestamp: expect.any(Number),
        }));
    });

    it('passes action and player names through popup and log', async () => {
        const result = await skipTargetChoice(
            makeAction({ name: 'Custom Stride' }),
            makePlayerStats({ name: 'OtherMonk' }),
            campaignName,
        );

        expect(result.payload.name).toBe('Custom Stride');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'OtherMonk', 'destructiveStrideActive', true, campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            characterName: 'OtherMonk',
            abilityName: 'Custom Stride',
        }));
    });

    it('swallows addEntry rejection — still returns the popup and logs console.error', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        logService.addEntry.mockRejectedValueOnce(new Error('log failure'));

        const result = await skipTargetChoice(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[DestructiveStride] Error logging skip:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });
});
