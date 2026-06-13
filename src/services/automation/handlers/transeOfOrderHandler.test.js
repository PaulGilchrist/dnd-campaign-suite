import { handle, isActive, deactivate } from './transeOfOrderHandler.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';
import * as metamagic from '../../../hooks/useMetamagic.js';
import * as classFeatures from '../../character/classFeatures.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const mockAction = {
    name: 'Transe of Order',
    automation: {
        type: 'transe_of_order',
        action: 'bonus_action',
        duration: '1_minute',
        restoreCost: 5,
    },
};

const mockPlayerStats = {
    name: 'Test Character',
    level: 14,
    class: {
        name: 'Sorcerer',
        class_levels: [{ level: 14 }],
    },
    resources: {
        sorcery_points: { current: 10 },
    },
};

function getRuntimeKey(playerName, key) {
    return playerName.toLowerCase().replace(/\s+/g, '') + '_' + key;
}

describe('Transe of Order Handler', () => {
    const activeKey = getRuntimeKey('Test Character', 'transeOfOrderActive');
    const usesKey = getRuntimeKey('Test Character', 'transeOfOrderUses');
    const restKey = getRuntimeKey('Test Character', 'transeOfOrderRestTimestamp');

    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReset();
    });

    it('activates transe of order when not yet active', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === activeKey) return false;
            if (key === usesKey) return undefined;
            return null;
        });

        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('activated');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            activeKey,
            true,
            'test-campaign'
        );
    });

    it('returns error when no uses remaining and insufficient SP', async () => {
        const recentRest = Date.now() - 3600000; // 1 hour ago
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === activeKey) return false;
            if (key === usesKey) return 0;
            if (key === getRuntimeKey('Test Character', 'transeOfOrderRestTimestamp')) return recentRest;
            return null;
        });

        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });
        mockPlayerStats.resources.sorcery_points.current = 2;

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('no uses remaining');
        expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('restores transe of order by spending 5 SP when no uses remaining', async () => {
        const recentRest = Date.now() - 3600000; // 1 hour ago
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === activeKey) return false;
            if (key === usesKey) return 0;
            if (key === getRuntimeKey('Test Character', 'transeOfOrderRestTimestamp')) return recentRest;
            return null;
        });

        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
        mockPlayerStats.resources.sorcery_points.current = 10;

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('restored');
        expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(
            'Test Character',
            5,
            'test-campaign'
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            restKey,
            expect.any(Number),
            'test-campaign'
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            usesKey,
            1,
            'test-campaign'
        );
    });

    it('isActive returns true when active', () => {
        runtimeState.getRuntimeValue.mockReturnValue(true);
        expect(isActive('Test Character')).toBe(true);
    });

    it('isActive returns false when not active', () => {
        runtimeState.getRuntimeValue.mockReturnValue(false);
        expect(isActive('Test Character')).toBe(false);
    });

    it('deactivates transe of order', () => {
        deactivate('Test Character', 'test-campaign');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            activeKey,
            false,
            'test-campaign'
        );
    });
});
