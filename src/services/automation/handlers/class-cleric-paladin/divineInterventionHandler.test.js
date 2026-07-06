// @improved-by-ai
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

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Player One',
        rules: '2024',
        _trackedResources: {
            divineInterventionUses: { current: 1 },
        },
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Divine Intervention',
        automation,
    };
}

function mockUses(uses) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'divineInterventionUses') return uses;
        if (key === '_divineInterventionWishCooldown') return null;
        return null;
    });
}

function mockUsesWithCooldown(uses, cooldown) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'divineInterventionUses') return uses;
        if (key === '_divineInterventionWishCooldown') return cooldown;
        return null;
    });
}

describe('divineInterventionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle()', () => {
        it('should return popup when uses are exhausted and no cooldown is active', async () => {
            mockUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Divine Intervention',
                    description: 'Divine Intervention is expended. It recharges after a Long Rest.',
                },
            });
        });

        it('should return popup with cooldown message when Wish cooldown is active', async () => {
            mockUsesWithCooldown(0, 3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

            expect(result.payload.description).toBe('Divine Intervention (Wish) is on cooldown. 3 long rests remaining.');
        });

        it('should fallback to _trackedResources when stored uses is null', async () => {
            getRuntimeValue.mockReturnValue(null);
            loadSpells.mockResolvedValue([]);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

            expect(result.type).toBe('modal');
        });

        it('should default to 1 use when both stored and tracked resources are absent', async () => {
            getRuntimeValue.mockReturnValue(null);
            loadSpells.mockResolvedValue([]);
            const stats = makePlayerStats({ _trackedResources: {} });

            const result = await handle(makeAction(), stats, campaignName, 'TestMap');

            expect(result.type).toBe('modal');
        });

        it('should return modal with filtered Cleric spells for normal Divine Intervention', async () => {
            mockUses(1);
            const mockSpells = [
                { name: 'Cure Wounds', classes: ['Cleric'], level: 1, casting_time: '1 Action' },
                { name: 'Greater Restore', classes: ['Cleric'], level: 5, casting_time: '1 Action' },
                { name: 'Flame Strike', classes: ['Cleric'], level: 5, casting_time: '1 Action' },
                { name: 'Holy Word', classes: ['Cleric'], level: 7, casting_time: '1 Action' },
                { name: 'Something Else', classes: ['Wizard'], level: 1, casting_time: '1 Action' },
                { name: 'Reaction Spell', classes: ['Cleric'], level: 1, casting_time: '1 Reaction' },
                { name: 'No Classes', level: 1, casting_time: '1 Action' },
            ];
            loadSpells.mockResolvedValue(mockSpells);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'divineIntervention',
                payload: {
                    featureName: 'Divine Intervention',
                    isGreater: false,
                    eligibleSpells: [mockSpells[0], mockSpells[1], mockSpells[2]],
                    playerStats: expect.objectContaining({ name: 'Player One' }),
                    campaignName,
                },
            });
            expect(loadSpells).toHaveBeenCalledWith('2024');
        });

        it('should use playerStats.rules when set', async () => {
            mockUses(1);
            loadSpells.mockResolvedValue([]);

            await handle(makeAction(), makePlayerStats({ rules: '5e' }), campaignName, 'TestMap');

            expect(loadSpells).toHaveBeenCalledWith('5e');
        });

        it('should default to 2024 rules when playerStats.rules is falsy', async () => {
            mockUses(1);
            loadSpells.mockResolvedValue([]);

            await handle(makeAction(), makePlayerStats({ rules: null }), campaignName, 'TestMap');

            expect(loadSpells).toHaveBeenCalledWith('2024');
        });

        it('should return empty eligibleSpells when no spells match', async () => {
            mockUses(1);
            loadSpells.mockResolvedValue([
                { name: 'Wish', classes: ['Wizard'], level: 9, casting_time: '1 Action' },
            ]);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

            expect(result.payload.eligibleSpells).toEqual([]);
        });

        it('should return modal with only Wish for Greater Divine Intervention', async () => {
            mockUses(1);
            const wishSpell = { name: 'Wish', level: 9, classes: ['Wizard', 'Sorcerer'], casting_time: '1 Action' };
            loadSpells.mockResolvedValue([
                wishSpell,
                { name: 'Cure Wounds', classes: ['Cleric'], level: 1, casting_time: '1 Action' },
            ]);

            const result = await handle(makeAction({ upgradeTo: 'wish' }), makePlayerStats(), campaignName, 'TestMap');

            expect(result.payload.isGreater).toBe(true);
            expect(result.payload.eligibleSpells).toEqual([wishSpell]);
        });
    });

    describe('onSpellSelected()', () => {
        it('should return null if uses are exhausted', async () => {
            mockUses(0);
            const result = await onSpellSelected(makeAction(), makePlayerStats(), campaignName, { name: 'Cure Wounds' });
            expect(result).toBeNull();
        });

        it('should default to 1 use when stored is null and tracked resources has current', async () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({ _trackedResources: { divineInterventionUses: { current: 1 } } });

            const result = await onSpellSelected(makeAction(), stats, campaignName, { name: 'Cure Wounds' });

            expect(result.type).toBe('spell_selected');
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', 'divineInterventionUses', 0, campaignName, true);
        });

        it('should decrement uses and return success for normal spell selection', async () => {
            mockUses(1);
            const selectedSpell = { name: 'Cure Wounds' };

            const result = await onSpellSelected(makeAction(), makePlayerStats(), campaignName, selectedSpell);

            expect(result).toEqual({
                type: 'spell_selected',
                spell: selectedSpell,
                skipSlotCost: true,
                skipMaterialComponents: true,
                rechargeMessage: 'until you finish a Long Rest.',
                name: 'Divine Intervention',
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', 'divineInterventionUses', 0, campaignName, true);
        });

        it('should decrement uses correctly when starting from 2 uses', async () => {
            mockUses(2);
            const selectedSpell = { name: 'Cure Wounds' };

            const result = await onSpellSelected(makeAction(), makePlayerStats(), campaignName, selectedSpell);

            expect(result).toEqual({
                type: 'spell_selected',
                spell: selectedSpell,
                skipSlotCost: true,
                skipMaterialComponents: true,
                rechargeMessage: 'until you finish a Long Rest.',
                name: 'Divine Intervention',
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', 'divineInterventionUses', 1, campaignName, true);
        });

        it('should handle Greater Divine Intervention when Wish is selected', async () => {
            mockUses(1);
            const action = makeAction({ upgradeTo: 'wish' });
            const selectedSpell = { name: 'Wish' };

            vi.spyOn(Math, 'random').mockReturnValue(0.25);

            const result = await onSpellSelected(action, makePlayerStats(), campaignName, selectedSpell);

            // (0.25 * 4) + 1 = 2. Total = 2+2=4.
            expect(result.rechargeMessage).toBe('until you finish 4 Long Rests.');
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', '_divineInterventionWishCooldown', 4, campaignName, true);
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', 'divineInterventionUses', -1, campaignName, true);

            vi.restoreAllMocks();
        });

        it('should handle minimum cooldown (2) when both d4 rolls are 1', async () => {
            mockUses(1);
            const action = makeAction({ upgradeTo: 'wish' });
            const selectedSpell = { name: 'Wish' };

            vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0*4)+1 = 1, total = 1+1 = 2

            const result = await onSpellSelected(action, makePlayerStats(), campaignName, selectedSpell);

            expect(result.rechargeMessage).toBe('until you finish 2 Long Rests.');
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', '_divineInterventionWishCooldown', 2, campaignName, true);

            vi.restoreAllMocks();
        });

        it('should handle maximum cooldown (8) when both d4 rolls are 4', async () => {
            mockUses(1);
            const action = makeAction({ upgradeTo: 'wish' });
            const selectedSpell = { name: 'Wish' };

            vi.spyOn(Math, 'random').mockReturnValue(0.99); // floor(0.99*4)+1 = 4, total = 4+4 = 8

            const result = await onSpellSelected(action, makePlayerStats(), campaignName, selectedSpell);

            expect(result.rechargeMessage).toBe('until you finish 8 Long Rests.');
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', '_divineInterventionWishCooldown', 8, campaignName, true);

            vi.restoreAllMocks();
        });

        it('should treat Wish spell selection as normal if not Greater Divine Intervention', async () => {
            mockUses(1);
            const action = makeAction({ upgradeTo: 'something_else' });
            const selectedSpell = { name: 'Wish' };

            const result = await onSpellSelected(action, makePlayerStats(), campaignName, selectedSpell);

            expect(result.rechargeMessage).toBe('until you finish a Long Rest.');
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', 'divineInterventionUses', 0, campaignName, true);
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Player One',
                '_divineInterventionWishCooldown',
                expect.any(Number),
                campaignName,
                true,
            );
        });

        it('should not set cooldown when spell is not Wish even if upgradeTo is wish', async () => {
            mockUses(1);
            const action = makeAction({ upgradeTo: 'wish' });
            const selectedSpell = { name: 'Cure Wounds' };

            const result = await onSpellSelected(action, makePlayerStats(), campaignName, selectedSpell);

            expect(result.rechargeMessage).toBe('until you finish a Long Rest.');
            expect(setRuntimeValue).toHaveBeenCalledWith('Player One', 'divineInterventionUses', 0, campaignName, true);
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Player One',
                '_divineInterventionWishCooldown',
                expect.any(Number),
                campaignName,
                true,
            );
        });
    });
});
