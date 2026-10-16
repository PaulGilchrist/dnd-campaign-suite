// @maintained-by-ai: 2026-10-15
// luckyPointHandler lane: spends a Luck Point and arms luckyAdvantageActive /
// luckyDisadvantageActive via setRuntimeValue delegation. Consumption of those
// flags is owned by useLoggedDiceRollAttack.misc-effects.test.js and
// d20RollComputation; the automation-info builder shape is owned by
// automationInfoBuilder/reaction.test.js — neither is re-pinned here.
// Handler attaches .catch to addEntry, so no unhandledRejection suppressor needed.

import { handle } from './luckyPointHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

describe('luckyPointHandler.handle', () => {
    const mockCampaignName = 'TestCampaign';

    function makePlayerStats(overrides = {}) {
        return {
            name: 'TestFighter',
            level: 10,
            feats: ['Lucky'],
            _trackedResources: { luckyPoints: { current: 5, max: 5 } },
            ...overrides,
        };
    }

    // Must MERGE automation overrides, not replace wholesale.
    function makeAction(overrides = {}) {
        const { automation: automationOverrides, ...rest } = overrides;
        return {
            name: 'Lucky Break',
            ...rest,
            automation: {
                type: 'lucky_point',
                effect: 'advantage',
                target: 'd20',
                cost: 1,
                ...(automationOverrides || {}),
            },
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validation', () => {
        it('returns an error popup and writes nothing when runtime luckyPoints is 0', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(result.payload.description).toBe('Requires at least 1 Luck Point. You have 0 remaining.');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('returns an error popup when runtime is unset and no tracked max exists', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats({ _trackedResources: {} }), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(result.payload.description).toBe('Requires at least 1 Luck Point. You have 0 remaining.');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('spending', () => {
        it('spends one point from the runtime value, arms luckyAdvantageActive, returns popup and logs ability_use', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 3;
                return undefined;
            });
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), mockCampaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 2, mockCampaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyAdvantageActive', true, mockCampaignName
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter', 'luckyDisadvantageActive', true, mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(result.payload.description).toBe('Advantage on next d20 test.');
            expect(result.payload.automation).toBe(action.automation);
            expect(logService.addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'Lucky Feat',
                    description: 'TestFighter used Lucky Feat — Advantage active on next d20 test (1 LP spent, 2 LP remaining).',
                })
            );
        });

        it.each([null, undefined])(
            'falls back to tracked max when runtime luckyPoints is %s and spends from max',
            async (emptyValue) => {
                runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                    if (key === 'luckyPoints') return emptyValue;
                    return undefined;
                });

                const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'TestFighter', 'luckyPoints', 4, mockCampaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'TestFighter', 'luckyAdvantageActive', true, mockCampaignName
                );
                expect(result.payload.description).toBe('Advantage on next d20 test.');
            }
        );

        it('arms luckyDisadvantageActive (and not advantage) for the disadvantage effect', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(
                makeAction({ automation: { effect: 'disadvantage' } }),
                makePlayerStats(),
                mockCampaignName
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 0, mockCampaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyDisadvantageActive', true, mockCampaignName
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter', 'luckyAdvantageActive', true, mockCampaignName
            );
            expect(result.payload.name).toBe('Lucky Feat');
            expect(result.payload.description).toBe('Disadvantage on next d20 attack roll against you.');
        });

        it('defaults to the advantage branch when automation.effect is omitted', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(
                makeAction({ automation: { effect: undefined } }),
                makePlayerStats(),
                mockCampaignName
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyAdvantageActive', true, mockCampaignName
            );
            expect(result.payload.description).toBe('Advantage on next d20 test.');
        });
    });

    describe('fire-and-forget resilience', () => {
        it('still completes the spend and returns popup when logService.addEntry rejects', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            logService.addEntry.mockRejectedValueOnce(new Error('Log service unavailable'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 0, mockCampaignName
            );
            expect(logService.addEntry).toHaveBeenCalled();
            await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());
            consoleSpy.mockRestore();
        });
    });
});
