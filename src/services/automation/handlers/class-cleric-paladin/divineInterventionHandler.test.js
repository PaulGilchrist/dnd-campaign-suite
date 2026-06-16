import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, onSpellSelected } from './divineInterventionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpells: vi.fn(),
}));

describe('divineInterventionHandler', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'TestMap';
    let playerStats;
    let action;

    beforeEach(() => {
        vi.clearAllMocks();

        playerStats = {
            name: 'Player One',
            rules: '2024',
            _trackedResources: {
                divineInterventionUses: { current: 1 }
            }
        };

        action = {
            name: 'Divine Intervention',
            automation: {}
        };
    });

    describe('handle()', () => {
        it('should return popup when uses are exhausted and no cooldown is active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'divineInterventionUses') return 0;
                if (key === '_divineInterventionWishCooldown') return null;
                return null;
            });

            const result = await handle(action, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'Divine Intervention is expended. It recharges after a Long Rest.',
                },
            });
        });

        it('should return popup when uses are exhausted and Wish cooldown is active (single rest)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'divineInterventionUses') return 0;
                if (key === '_divineInterventionWishCooldown') return 1;
                return null;
            });

            const result = await handle(action, playerStats, campaignName, mapName);

            expect(result.payload.description).toContain('Divine Intervention (Wish) is on cooldown. 1 long rest remaining.');
        });

        it('should return popup when uses are exhausted and Wish cooldown is active (multiple rests)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'divineInterventionUses') return 0;
                if (key === '_divineInterventionWishCooldown') return 3;
                return null;
            });

            const result = await handle(action, playerStats, campaignName, mapName);

            expect(result.payload.description).toContain('Divine Intervention (Wish) is on cooldown. 3 long rests remaining.');
        });

        it('should return modal with filtered Cleric spells for normal Divine Intervention', async () => {
            getRuntimeValue.mockReturnValue(1);
            const mockSpells = [
                { name: 'Cure Wounds', classes: ['Cleric'], level: 1, casting_time: '1 Action' },
                { name: 'Greater Restore', classes: ['Cleric'], level: 5, casting_time: '1 Action' },
                { name: 'Flame Strike', classes: ['Cleric'], level: 5, casting_time: '1 Action' },
                { name: 'Holy Word', classes: ['Cleric'], level: 7, casting_time: '1 Action' }, // too high level
                { name: 'Something Else', classes: ['Wizard'], level: 1, casting_time: '1 Action' }, // wrong class
                { name: 'Reaction Spell', classes: ['Cleric'], level: 1, casting_time: 'Reaction' }, // reaction
            ];
            loadSpells.mockResolvedValue(mockSpells);

            const result = await handle(action, playerStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'divineIntervention',
                payload: {
                    featureName: action.name,
                    isGreater: false,
                    eligibleSpells: mockSpells.filter(s => s.name === 'Cure Wounds' || s.name === 'Greater Restore' || s.name === 'Flame Strike'),
                    playerStats,
                    campaignName,
                },
            });
            expect(loadSpells).toHaveBeenCalledWith('2024');
        });

        it('should return modal with only Wish for Greater Divine Intervention', async () => {
            getRuntimeValue.mockReturnValue(1);
            action.automation.upgradeTo = 'wish';
            const mockSpells = [
                { name: 'Wish', level: 9, classes: ['Wizard', 'Sorcerer'], casting_time: '1 Action' },
                { name: 'Cure Wounds', classes: ['Cleric'], level: 1, casting_time: '1 Action' },
            ];
            loadSpells.mockResolvedValue(mockSpells);

            const result = await handle(action, playerStats, campaignName, mapName);

            expect(result.payload.isGreater).toBe(true);
            expect(result.payload.eligibleSpells).toEqual([mockSpells[0]]);
        });
    });

    describe('onSpellSelected()', () => {
        it('should return null if uses are exhausted', async () => {
            getRuntimeValue.mockReturnValue(0);
            const result = await onSpellSelected(action, playerStats, campaignName, { name: 'Cure Wounds' });
            expect(result).toBeNull();
        });

        it('should decrement uses and return success for normal spell selection', async () => {
            getRuntimeValue.mockReturnValue(1);
            const selectedSpell = { name: 'Cure Wounds' };

            const result = await onSpellSelected(action, playerStats, campaignName, selectedSpell);

            expect(result).toEqual({
                type: 'spell_selected',
                spell: selectedSpell,
                skipSlotCost: true,
                skipMaterialComponents: true,
                rechargeMessage: 'until you finish a Long Rest.',
                name: action.name,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, 'divineInterventionUses', 0, campaignName, true);
        });

        it('should handle Greater Divine Intervention when Wish is selected', async () => {
            getRuntimeValue.mockReturnValue(1);
            action.automation.upgradeTo = 'wish';
            const selectedSpell = { name: 'Wish' };

            // Mock random to get predictable cooldown
            vi.spyOn(Math, 'random').mockReturnValue(0.25); // (0.25 * 4) + 1 = 2. Total = 2+2=4.

            const result = await onSpellSelected(action, playerStats, campaignName, selectedSpell);

            expect(result.rechargeMessage).toBe('until you finish 4 Long Rests.');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, '_divineInterventionWishCooldown', 4, campaignName, true);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, 'divineInterventionUses', -1, campaignName, true);
        });

        it('should treat Wish spell selection as normal if not Greater Divine Intervention', async () => {
             getRuntimeValue.mockReturnValue(1);
             action.automation.upgradeTo = 'something_else';
             const selectedSpell = { name: 'Wish' };

             const result = await onSpellSelected(action, playerStats, campaignName, selectedSpell);

             expect(result.rechargeMessage).toBe('until you finish a Long Rest.');
             expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, 'divineInterventionUses', 0, campaignName, true);
             expect(setRuntimeValue).not.toHaveBeenCalledWith(playerStats.name, '_divineInterventionWishCooldown', expect.any(Number), campaignName, true);
        });
    });
});
