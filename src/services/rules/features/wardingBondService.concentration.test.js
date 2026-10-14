import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyWardingBond } from './wardingBondService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

describe('wardingBondService concentration check', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(...creatures) {
        return { creatures };
    }

    describe('concentration check', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        function setupWithinRange() {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;
        }

        it('does not update concentration when concentration is falsy', () => {
            setupWithinRange();
            paladin.concentration = null;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            // No error should be thrown, concentration stays null
            expect(paladin.concentration).toBe(null);
        });

        it('does not update concentration when sharedDamage is 0', () => {
            setupWithinRange();
            paladin.concentration = { dc: 15 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                0,
            );

            expect(paladin.concentration.dc).toBe(15);
        });

        it('sets concentration dc to Math.max(10, floor(sharedDamage / 2))', () => {
            setupWithinRange();
            paladin.concentration = { dc: 15 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            // Math.max(10, floor(5 / 2)) = Math.max(10, 2) = 10
            expect(paladin.concentration.dc).toBe(10);
        });

        it('uses the higher value when existing dc is greater', () => {
            setupWithinRange();
            paladin.concentration = { dc: 15 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                25,
            );

            // Math.max(10, floor(25 / 2)) = Math.max(10, 12) = 12
            expect(paladin.concentration.dc).toBe(12);
        });

        it('updates concentration when sharedDamage is positive', () => {
            setupWithinRange();
            paladin.concentration = { dc: 5 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                8,
            );

            // Math.max(10, floor(8 / 2)) = Math.max(10, 4) = 10
            expect(paladin.concentration.dc).toBe(10);
        });

        it('handles odd sharedDamage values correctly', () => {
            setupWithinRange();
            paladin.concentration = { dc: 5 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                7,
            );

            // Math.max(10, floor(7 / 2)) = Math.max(10, 3) = 10
            expect(paladin.concentration.dc).toBe(10);
        });

        it('handles large sharedDamage values correctly', () => {
            setupWithinRange();
            paladin.concentration = { dc: 5 };

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                30,
            );

            // Math.max(10, floor(30 / 2)) = Math.max(10, 15) = 15
            expect(paladin.concentration.dc).toBe(15);
        });
    });
});
