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

describe('wardingBondService log entry creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(...creatures) {
        return { creatures };
    }

    describe('log entry creation', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        function setupWithinRange() {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;
        }

        it('logs an hp_change entry with correct type', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
            }));
        });

        it('logs with correct targetName (caster name)', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Paladin',
            }));
        });

        it('logs with correct delta (negative damage)', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                delta: -5,
            }));
        });

        it('logs with correct currentHp after damage', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                currentHp: 5,
            }));
        });

        it('logs with correct maxHp', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                maxHp: 10,
            }));
        });

        it('logs isHealing as false', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                isHealing: false,
            }));
        });

        it('logs isUnconscious as false when HP remains above 0', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                isUnconscious: false,
            }));
        });

        it('logs isUnconscious as true when HP drops to 0', () => {
            setupWithinRange();
            paladin.currentHp = 5;

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                isUnconscious: true,
            }));
        });

        it('logs abilityName as "Warding Bond"', () => {
            setupWithinRange();

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Warding Bond',
            }));
        });
    });
});
