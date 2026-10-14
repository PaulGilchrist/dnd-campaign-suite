import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { isRegenerateActive } from './regenerateHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

describe('isRegenerateActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return true when regenerateActive is true', () => {
        getRuntimeValue.mockReturnValue(true);

        const result = isRegenerateActive('Goblin', campaignName);
        expect(result).toBe(true);
    });

    it('should return false when regenerateActive is false', () => {
        getRuntimeValue.mockReturnValue(false);

        const result = isRegenerateActive('Goblin', campaignName);
        expect(result).toBe(false);
    });

    it('should return false when regenerateActive is null', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = isRegenerateActive('Goblin', campaignName);
        expect(result).toBe(false);
    });

    it('should return false when regenerateActive is undefined', () => {
        getRuntimeValue.mockReturnValue(undefined);

        const result = isRegenerateActive('Goblin', campaignName);
        expect(result).toBe(false);
    });

    it('should return false when regenerateActive is 0', () => {
        getRuntimeValue.mockReturnValue(0);

        const result = isRegenerateActive('Goblin', campaignName);
        expect(result).toBe(false);
    });

    it('should return false when regenerateActive is empty string', () => {
        getRuntimeValue.mockReturnValue('');

        const result = isRegenerateActive('Goblin', campaignName);
        expect(result).toBe(false);
    });

    it('should pass correct arguments to getRuntimeValue', () => {
        getRuntimeValue.mockReturnValue(true);

        isRegenerateActive('Orc', campaignName);

        expect(getRuntimeValue).toHaveBeenCalledWith('Orc', 'regenerateActive', campaignName);
    });
});
