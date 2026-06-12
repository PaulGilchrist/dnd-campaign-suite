import { handle, handleSummon } from './warBondHandler.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

const mockPlayerStats = { name: 'TestFighter' };
const mockCampaignName = 'test-campaign';

describe('warBondHandler', () => {
    describe('handle', () => {
        it('returns popup with no bonded weapons message when no weapons bonded', async () => {
            const getRV = vi.fn(() => []);
            const setRV = vi.fn();
            getRuntimeValue.mockImplementation(getRV);
            setRuntimeValue.mockImplementation(setRV);

            const action = {
                name: 'War Bond',
                automation: {
                    type: 'war_bond_summon',
                    action: 'bonus_action',
                    bondedWeaponCount: 2,
                    casting_time: '1 bonus action',
                },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    automationType: 'war_bond_summon',
                    description: 'No bonded weapons. Bond a weapon first (up to 2).',
                    automation: action.automation,
                },
            });
        });

        it('returns popup with single weapon summoned when only one bonded weapon', async () => {
            const getRV = vi.fn((name, key) => key === 'warBondWeapons' ? ['Longsword'] : undefined);
            const setRV = vi.fn();
            getRuntimeValue.mockImplementation(getRV);
            setRuntimeValue.mockImplementation(setRV);

            const action = {
                name: 'War Bond',
                automation: {
                    type: 'war_bond_summon',
                    action: 'bonus_action',
                    bondedWeaponCount: 2,
                    casting_time: '1 bonus action',
                },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(setRV).toHaveBeenCalledWith(
                'TestFighter',
                'warBondSummoned',
                'Longsword',
                mockCampaignName
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    automationType: 'war_bond_summon',
                    description: 'War Bond: Longsword is summoned to your hand.',
                    automation: action.automation,
                },
            });
        });

        it('returns modal with weapon selection when multiple bonded weapons', async () => {
            const getRV = vi.fn((name, key) => key === 'warBondWeapons' ? ['Longsword', 'Battleaxe'] : undefined);
            const setRV = vi.fn();
            getRuntimeValue.mockImplementation(getRV);
            setRuntimeValue.mockImplementation(setRV);

            const action = {
                name: 'War Bond',
                automation: {
                    type: 'war_bond_summon',
                    action: 'bonus_action',
                    bondedWeaponCount: 2,
                    casting_time: '1 bonus action',
                },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'warBondSummon',
                payload: {
                    action,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    bondedWeapons: ['Longsword', 'Battleaxe'],
                    maxBonded: 2,
                },
            });
        });

        it('respects custom bondedWeaponCount from automation', async () => {
            const getRV = vi.fn((name, key) => key === 'warBondWeapons' ? ['Longsword', 'Battleaxe', 'Spear'] : undefined);
            const setRV = vi.fn();
            getRuntimeValue.mockImplementation(getRV);
            setRuntimeValue.mockImplementation(setRV);

            const action = {
                name: 'War Bond',
                automation: {
                    type: 'war_bond_summon',
                    action: 'bonus_action',
                    bondedWeaponCount: 3,
                    casting_time: '1 bonus action',
                },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'warBondSummon',
                payload: {
                    action,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    bondedWeapons: ['Longsword', 'Battleaxe', 'Spear'],
                    maxBonded: 3,
                },
            });
        });
    });

    describe('handleSummon', () => {
        it('returns popup with selected weapon summoned', async () => {
            const setRV = vi.fn();
            setRuntimeValue.mockImplementation(setRV);

            const action = {
                name: 'War Bond',
                automation: {
                    type: 'war_bond_summon',
                    action: 'bonus_action',
                    bondedWeaponCount: 2,
                    casting_time: '1 bonus action',
                },
            };

            const result = await handleSummon(action, mockPlayerStats, mockCampaignName, 'Longsword');

            expect(setRV).toHaveBeenCalledWith(
                'TestFighter',
                'warBondSummoned',
                'Longsword',
                mockCampaignName
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    automationType: 'war_bond_summon',
                    description: 'War Bond: Longsword is summoned to your hand.',
                    automation: action.automation,
                },
            });
        });

        it('returns error popup when no weapon selected', async () => {
            const setRV = vi.fn();
            setRuntimeValue.mockImplementation(setRV);

            const action = {
                name: 'War Bond',
                automation: {
                    type: 'war_bond_summon',
                    action: 'bonus_action',
                    bondedWeaponCount: 2,
                    casting_time: '1 bonus action',
                },
            };

            const result = await handleSummon(action, mockPlayerStats, mockCampaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    description: 'No weapon selected.',
                    automation: action.automation,
                },
            });
        });
    });
});
