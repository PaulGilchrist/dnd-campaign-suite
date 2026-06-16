import { handle } from './boonOfFateHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../../hooks/combat/useMetamagic.js');
vi.mock('../../../ui/logService.js');

describe('boonOfFateHandler.handle', () => {
    const mockPlayerStats = { name: 'TestFighter', level: 20, class: { name: 'Fighter' } };
    const mockAction = {
        name: 'Improve Fate',
        automation: { type: 'modify_d20_roll', modifier: '2d4', range: '60 ft', canBeBonusOrPenalty: true, recharge: 'initiative_or_short_or_long_rest', casting_time: '1 bonus action' },
    };
    const mockCampaignName = 'TestCampaign';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return error when already used', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'boonOfFateUsed') return true;
            return undefined;
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no uses remaining');
        expect(result.payload.description).toContain('Initiative or Short or Long Rest');
    });

    it('should return error when no recent D20 test found', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'boonOfFateUsed') return false;
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

    it('should mark as used and return popup when attack roll is fresh', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'boonOfFateUsed') return false;
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
            'TestFighter', 'boonOfFateUsed', true, mockCampaignName
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Improve Fate');
        expect(result.payload.description).toContain('Attack vs AC Goblin');
        expect(logService.addEntry).toHaveBeenCalled();
    });

    it('should handle ability check', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'boonOfFateUsed') return false;
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
            if (key === 'boonOfFateUsed') return false;
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
        expect(result.payload.description).toContain('DEX save');
    });

    it('should prefer attack roll over ability check and save', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'boonOfFateUsed') return false;
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
            if (key === 'boonOfFateUsed') return false;
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

    it('should use empty checkName fallback', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'boonOfFateUsed') return false;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 10, bonus: 2, checkName: null, timestamp: Date.now() - 10000,
        });
        metamagic.getLastSaveRoll.mockReturnValue(null);
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Ability check');
    });
});
