import { handle, isActive, deactivate } from './dragonWingsHandler.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';
import * as metamagic from '../../../../hooks/useMetamagic.js';
import * as classFeatures from '../../../character/classFeatures.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const mockAction = {
    name: 'Dragon Wings',
    automation: {
        type: 'dragon_wings',
        action: 'bonus_action',
        duration: '1_hour',
        flySpeed: 60,
        hover: true,
        uses: 1,
        recharge: 'long_rest',
        resourceCost: 'sorcery_points',
        restoreCost: 3,
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

describe('Dragon Wings Handler', () => {
    const activeKey = getRuntimeKey('Test Character', 'dragonWingsActive');
    const usesKey = getRuntimeKey('Test Character', 'dragonWingsUses');
    const restKey = getRuntimeKey('Test Character', 'dragonWingsRestTimestamp');

    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReset();
    });

    it('activates dragon wings when not yet active', async () => {
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
        expect(result.payload.description).toContain('Fly Speed 60');
    });

    it('deactivates dragon wings when already active', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === activeKey) return true;
            if (key === usesKey) return undefined;
            if (key === 'activeBuffs') {
                return [{ name: 'Dragon Wings', effect: 'dragon_wings' }];
            }
            return null;
        });

        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('deactivated');
    });

    it('returns error when no uses remaining and insufficient SP', async () => {
        const recentRest = Date.now() - 3600000; // 1 hour ago
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === activeKey) return false;
            if (key === usesKey) return 0;
            if (key === restKey) return recentRest;
            return null;
        });

        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 2 });
        mockPlayerStats.resources.sorcery_points.current = 1;

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('no uses remaining');
        expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('restores dragon wings by spending 3 SP when no uses remaining', async () => {
        const recentRest = Date.now() - 3600000; // 1 hour ago
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === activeKey) return false;
            if (key === usesKey) return 0;
            if (key === restKey) return recentRest;
            return null;
        });

        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
        mockPlayerStats.resources.sorcery_points.current = 10;

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('restored');
        expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(
            'Test Character',
            3,
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

    it('deactivates dragon wings', () => {
        deactivate('Test Character', 'test-campaign');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Character',
            activeKey,
            false,
            'test-campaign'
        );
    });
});
