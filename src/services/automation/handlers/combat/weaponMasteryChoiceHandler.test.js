import { handle, applyMasterySelection, WEAPON_MASTER_KEY } from './weaponMasteryChoiceHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

describe('weaponMasteryChoiceHandler', () => {
    const mockPlayerStats = { name: 'Test Character' };
    const mockCampaignName = 'test-campaign';

    describe('handle', () => {
        it('returns a modal when no existing selection', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = {
                automation: {
                    type: 'weapon_mastery_choice',
                    masteryProperties: ['Push', 'Topple', 'Sap'],
                },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'weaponMasteryChoice',
                payload: {
                    action,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    masteryProperties: ['Push', 'Topple', 'Sap'],
                },
            });
        });

        it('returns a popup when existing selection exists', async () => {
            getRuntimeValue.mockReturnValue('Push');

            const action = {
                automation: {
                    type: 'weapon_mastery_choice',
                    masteryProperties: ['Push', 'Topple', 'Sap'],
                },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Push');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                mockPlayerStats.name,
                WEAPON_MASTER_KEY,
                'Push',
                mockCampaignName
            );
        });

        it('returns a modal when existing selection is not in masteryProperties', async () => {
            getRuntimeValue.mockReturnValue('Cleave');

            const action = {
                automation: {
                    type: 'weapon_mastery_choice',
                    masteryProperties: ['Push', 'Topple', 'Sap'],
                },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('weaponMasteryChoice');
        });
    });

    describe('applyMasterySelection', () => {
        it('stores the chosen mastery and returns a popup', async () => {
            const result = await applyMasterySelection('Topple', mockPlayerStats, mockCampaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                mockPlayerStats.name,
                WEAPON_MASTER_KEY,
                'Topple',
                mockCampaignName
            );
            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: mockPlayerStats.name,
                abilityName: 'Weapon Master - Mastery Property',
                description: 'Selected mastery property: Topple',
            });
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Weapon Master',
                    description: 'Mastery property set to: Topple. This will be applied to your next attack.',
                },
            });
        });

        it('returns null when masteryName is empty', async () => {
            const result = await applyMasterySelection('', mockPlayerStats, mockCampaignName);
            expect(result).toBeNull();
        });

        it('returns null when masteryName is null', async () => {
            const result = await applyMasterySelection(null, mockPlayerStats, mockCampaignName);
            expect(result).toBeNull();
        });
    });
});
