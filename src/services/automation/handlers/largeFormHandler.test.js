import { handle, isLargeFormActive } from './largeFormHandler.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const mockAction = {
    name: 'Large Form',
    automation: {
        type: 'large_form',
        duration: '10_minutes',
        casting_time: '1_bonus_action',
        resourceCost: 'long_rest',
    },
};

const mockPlayerStats = {
    name: 'Test Character',
    level: 5,
    class: {
        name: 'Giant',
    },
};

describe('Large Form Handler', () => {
    const activeKey = 'largeFormActive';
    const restKey = 'largeFormActive_restUsed';
    const buffsKey = 'activeBuffs';

    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReset();
    });

    it('activates large form when not yet active and level >= 5', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (key === activeKey) return false;
            if (key === restKey) return false;
            if (key === buffsKey) return [];
            return null;
        });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('activated');
        expect(result.payload.description).toContain('Large Form');
        expect(result.payload.description).toContain('10 minutes');
    });

    it('deactivates large form when already active', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (key === activeKey) return true;
            if (key === restKey) return false;
            if (key === buffsKey) return [{ name: 'Large Form', effect: 'large_form' }];
            return null;
        });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('ended');
    });

    it('blocks activation when level < 5', async () => {
        const lowLevelStats = { ...mockPlayerStats, level: 3 };
        runtimeState.getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (key === activeKey) return false;
            if (key === restKey) return false;
            return null;
        });

        const result = await handle(mockAction, lowLevelStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('level 5');
    });

    it('blocks activation when long rest not yet finished', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (key === activeKey) return false;
            if (key === restKey) return true;
            return null;
        });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Long Rest');
    });

    it('isActive returns true when active', () => {
        runtimeState.getRuntimeValue.mockReturnValue(true);
        expect(isLargeFormActive('Test Character', 'test-campaign')).toBe(true);
    });

    it('isActive returns false when not active', () => {
        runtimeState.getRuntimeValue.mockReturnValue(false);
        expect(isLargeFormActive('Test Character', 'test-campaign')).toBe(false);
    });

    it('sets activeBuffs with large_form effect on activation', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (key === activeKey) return false;
            if (key === restKey) return false;
            if (key === buffsKey) return [];
            return null;
        });

        await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            activeKey,
            true,
            'test-campaign'
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            buffsKey,
            expect.arrayContaining([
                expect.objectContaining({ name: 'Large Form', effect: 'large_form' })
            ]),
            'test-campaign'
        );
    });
});
