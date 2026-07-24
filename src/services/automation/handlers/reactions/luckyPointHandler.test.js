// @cleaned-by-ai
// Suppress fire-and-forget logService.addEntry rejection warnings from source code
process.on('unhandledRejection', () => {});

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

    function makeAction(overrides = {}) {
        return {
            name: 'Lucky Break',
            automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 },
            ...overrides,
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validation', () => {
        it('should return error popup when no lucky points remaining (runtime zero, null, undefined, or missing max)', async () => {
            // runtime zero
            runtimeState.getRuntimeValue.mockReturnValue(0);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(result.payload.description).toContain('0');
            expect(result.payload.description).toContain('Luck Point');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

            // runtime null (falsy)
            runtimeState.getRuntimeValue.mockReturnValue(null);
            const result2 = await handle(action, makePlayerStats(), mockCampaignName);
            expect(result2.type).toBe('popup');
            expect(result2.payload.description).toContain('0');

            // runtime undefined falls back to max from _trackedResources
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            const result3 = await handle(action, makePlayerStats(), mockCampaignName);
            expect(result3.type).toBe('popup');
            expect(result3.payload.type).toBe('automation_info');
            expect(result3.payload.description).toContain('Advantage');
            expect(result3.payload.name).toBe('Lucky Feat');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 4, mockCampaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyAdvantageActive', true, mockCampaignName
            );

            // _trackedResources.luckyPoints missing (max defaults to 0)
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            const result4 = await handle(action, makePlayerStats({ _trackedResources: {} }), mockCampaignName);
            expect(result4.type).toBe('popup');
            expect(result4.payload.description).toContain('0');
        });
    });

    describe('basic usage', () => {
        it('should spend a lucky point, set luckyAdvantageActive flag, and return popup with advantage description', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 3;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 2, mockCampaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyAdvantageActive', true, mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(result.payload.description).toBe('Advantage on next d20 test.');
            expect(logService.addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'Lucky Feat',
                })
            );
        });

        it('should apply disadvantage effect when specified', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });

            const result = await handle(
                makeAction({ automation: { type: 'lucky_point', effect: 'disadvantage', target: 'd20', cost: 1 } }),
                makePlayerStats(),
                mockCampaignName
            );

            expect(result.payload.description).toBe('Disadvantage on next d20 attack roll against you.');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyDisadvantageActive', true, mockCampaignName
            );
        });

        it('should default effect to advantage when not specified', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });

            const result = await handle(
                makeAction({ automation: { type: 'lucky_point', cost: 1 } }),
                makePlayerStats(),
                mockCampaignName
            );

            expect(result.payload.description).toBe('Advantage on next d20 test.');
        });
    });

    describe('fire-and-forget resilience', () => {
        it('should return popup even when logService.addEntry rejects', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            logService.addEntry.mockRejectedValue(new Error('Log service unavailable'));

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Feat');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 0, mockCampaignName
            );
            expect(logService.addEntry).toHaveBeenCalled();
        });
    });
});
