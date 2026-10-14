import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyWardingBond } from './wardingBondService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockReturnValue({ catch: (fn) => fn() }),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

describe('wardingBondService edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(...creatures) {
        return { creatures };
    }

    describe('edge cases', () => {
        it('handles wardDamage of 0 — logs entry with delta -0 but no HP change', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
            const goblin = { name: 'Goblin' };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                0,
            );

            // Production code does not guard against wardDamage === 0
            // Math.max(0, 10 - 0) = 10, so HP unchanged but entry is logged
            expect(paladin.currentHp).toBe(10);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                delta: -0,
            }));
        });

        it('handles negative wardDamage — increases HP', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            const paladin = { name: 'Paladin', currentHp: 5, maxHp: 10 };
            const goblin = { name: 'Goblin' };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                -3,
            );

            // Math.max(0, 5 - (-3)) = Math.max(0, 8) = 8
            expect(paladin.currentHp).toBe(8);
        });

        it('handles multiple warding_bond buffs — uses the first match', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'shield' },
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
                { effect: 'warding_bond', sourceCharacter: 'Wizard' },
            ]);
            getDistanceFeet.mockReturnValue(30);

            const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
            const wizard = { name: 'Wizard', currentHp: 8, maxHp: 8 };
            const goblin = { name: 'Goblin' };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, wizard, goblin),
                campaignName,
                5,
            );

            // First warding_bond buff found has sourceCharacter 'Paladin'
            expect(paladin.currentHp).toBe(5);
            expect(wizard.currentHp).toBe(8);
        });
    });
});
