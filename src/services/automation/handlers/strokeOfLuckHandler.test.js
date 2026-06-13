import { handle } from './strokeOfLuckHandler.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';
import * as metamagic from '../../../hooks/useMetamagic.js';
import * as logService from '../../ui/logService.js';

vi.mock('../../../hooks/useRuntimeState.js');
vi.mock('../../../hooks/useMetamagic.js');
vi.mock('../../ui/logService.js');

describe('strokeOfLuckHandler.handle', () => {
    const mockPlayerStats = { name: 'TestRogue', level: 20, class: { name: 'Rogue' } };
    const mockAction = {
        name: 'Stroke of Luck',
        automation: { type: 'stroke_of_luck', target: 'd20', recharge: 'short_or_long_rest' },
    };
    const mockCampaignName = 'TestCampaign';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return error when already used', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return true;
            return undefined;
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no uses remaining');
    });

    it('should return error when no recent D20 test found', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return false;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue(null);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent D20 test found');
    });

    it('should mark as used and return popup when attack roll is stale', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return false;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue({
            d20: 8, bonus: 5, targetName: 'Goblin', hit: false, timestamp: Date.now() - 30000,
        });
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue(null);
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue', 'strokeOfLuckUsed', true, mockCampaignName
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Stroke of Luck');
        expect(logService.addEntry).toHaveBeenCalled();
    });

    it('should handle ability check', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return false;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 7, bonus: 3, checkName: 'Stealth', timestamp: Date.now() - 10000,
        });
        metamagic.getLastSaveRoll.mockReturnValue(null);
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Stealth');
    });

    it('should handle saving throw', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return false;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue({
            d20: 5, bonus: 2, saveType: 'DEX', timestamp: Date.now() - 10000,
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('DEX');
    });

    it('should prefer attack roll over ability check and save', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return false;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue({
            d20: 3, bonus: 5, targetName: 'Orc', hit: false, timestamp: Date.now() - 10000,
        });
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 8, bonus: 3, checkName: 'Athletics', timestamp: Date.now() - 10000,
        });
        metamagic.getLastSaveRoll.mockReturnValue({
            d20: 4, bonus: 2, saveType: 'CON', timestamp: Date.now() - 10000,
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.payload.description).toContain('Attack vs AC Orc');
    });

    it('should reject stale events (>60s old)', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return false;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue({
            d20: 3, bonus: 5, targetName: 'Orc', hit: false, timestamp: Date.now() - 120000,
        });
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue(null);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.payload.description).toContain('No recent D20 test found');
    });
});
