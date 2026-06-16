import { handle, confirmPhantasmalCreatures } from './phantasmalCreaturesHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

describe('phantasmalCreaturesHandler', () => {
    const mockPlayerStats = { name: 'Test Wizard' };
    const mockCampaignName = 'test-campaign';
    const mockAction = {
        name: 'Phantasmal Creatures',
        automation: {
            type: 'phantasmal_creatures',
            casting_time: 'passive',
            alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'],
            freeCastSpells: ['Summon Beast', 'Summon Fey'],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: true,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal when free casts are available', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'phantasmalCreatures',
                payload: {
                    action: mockAction,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    noConcentrationOption: true,
                },
            });
        });

        it('should return popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Phantasmal Creatures',
                    description: 'No free casts remaining. Finish a Long Rest to regain them.',
                    automation: mockAction.automation,
                },
            });
        });

        it('should default to usesMax when runtime value is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'phantasmalCreatures',
                payload: {
                    action: mockAction,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    noConcentrationOption: true,
                },
            });
        });
    });

    describe('confirmPhantasmalCreatures', () => {
        it('should decrement free cast count and return info', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmPhantasmalCreatures(mockAction, mockPlayerStats, mockCampaignName, true);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Wizard',
                '_Phantasmal_Creatures_freeCastCount',
                0,
                mockCampaignName,
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Phantasmal Creatures',
                    description: expect.stringContaining('Free cast of Summon Beast or Summon Fey (0 remaining)'),
                    automation: expect.objectContaining({ halvedHp: true }),
                },
            });
        });

        it('should return error when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmPhantasmalCreatures(mockAction, mockPlayerStats, mockCampaignName, true);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Phantasmal Creatures',
                    description: 'No free casts remaining. Finish a Long Rest to regain them.',
                    automation: mockAction.automation,
                },
            });
        });
    });
});
