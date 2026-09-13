// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applySuperiorityDamageBonuses } from './handleSuperiorityBonuses.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

describe('applySuperiorityDamageBonuses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('adds attackRiderDieValue to formula, total, and rolls, then clears the key', () => {
        getRuntimeValue.mockImplementation((_name, key) => key === 'attackRiderDieValue' ? 6 : null);

        const result = applySuperiorityDamageBonuses({ characterName: 'EvasiveFighter', campaignName: 'test-campaign', formula: '1d6+4', total: 8, rolls: [4, 4], context: { damageType: 'piercing' } });

        expect(result.formula).toBe('1d6+4 + 6 [piercing]');
        expect(result.total).toBe(14);
        expect(result.rolls).toEqual([4, 4, 6]);
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'attackRiderDieValue', null, 'test-campaign');
    });

    it('leaves formula untouched when attackRiderDieValue is null', () => {
        const result = applySuperiorityDamageBonuses({ characterName: 'EvasiveFighter', campaignName: 'test-campaign', formula: '1d6+4', total: 8, rolls: [4, 4], context: { damageType: 'piercing' } });

        expect(result.formula).toBe('1d6+4');
        expect(result.total).toBe(8);
    });
});
