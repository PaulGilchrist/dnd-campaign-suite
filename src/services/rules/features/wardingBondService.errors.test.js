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

describe('wardingBondService error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(...creatures) {
        return { creatures };
    }

    describe('error handling', () => {
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };

        it('calls console.error when addEntry promise rejects', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ]);
            getDistanceFeet.mockReturnValue(30);
            paladin.currentHp = 10;

            const testError = new Error('log failure');
            addEntry.mockReturnValue({
                catch: (fn) => {
                    // Simulate the promise rejecting — fn receives the error
                    fn(testError);
                    return { catch: () => {} };
                },
            });

            applyWardingBond(
                goblin,
                makeCombatSummary(paladin, goblin),
                campaignName,
                5,
            );

            expect(console.error).toHaveBeenCalledWith(
                '[wardingBond] Error:',
                testError,
            );
        });
    });
});
