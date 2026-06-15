import { handle } from './luckyPointHandler.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';
import * as metamagic from '../../../../hooks/useMetamagic.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/useRuntimeState.js');
vi.mock('../../../../hooks/useMetamagic.js');
vi.mock('../../../ui/logService.js');

describe('luckyPointHandler.handle', () => {
    const mockPlayerStats = { name: 'TestFighter', level: 10, feats: [{ name: 'Lucky' }], _luckyPointsMax: 5 };
    const mockCampaignName = 'TestCampaign';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return error when no Lucid Points remaining', async () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);

        const result = await handle(
            { name: 'Advantage', automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('0');
    });

    it('should return error when no recent D20 test found', async () => {
        runtimeState.getRuntimeValue.mockReturnValue(3);
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue(null);

        const result = await handle(
            { name: 'Advantage', automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent D20 test found');
    });

    it('should spend a Lucid Point and return popup when attack roll is fresh', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'luckyPoints') return 3;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue({
            d20: 8, bonus: 5, targetName: 'Goblin', hit: false, timestamp: Date.now() - 30000,
        });
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue(null);
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(
            { name: 'Advantage', automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter', 'luckyPoints', 2, mockCampaignName
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Attack vs AC Goblin');
        expect(result.payload.description).toContain('Advantage');
        expect(logService.addEntry).toHaveBeenCalled();
    });

    it('should handle ability check', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'luckyPoints') return 2;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 7, bonus: 3, checkName: 'Stealth', timestamp: Date.now() - 10000,
        });
        metamagic.getLastSaveRoll.mockReturnValue(null);
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(
            { name: 'Advantage', automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Stealth');
    });

    it('should handle saving throw', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'luckyPoints') return 1;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue({
            d20: 5, bonus: 2, saveType: 'CON', timestamp: Date.now() - 10000,
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(
            { name: 'Disadvantage', automation: { type: 'lucky_point', effect: 'disadvantage', target: 'attack_roll', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('CON save');
    });

    it('should prefer attack roll over ability check and save', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'luckyPoints') return 5;
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

        const result = await handle(
            { name: 'Advantage', automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(result.payload.description).toContain('Attack vs AC Orc');
    });

    it('should reject stale events (>60s old)', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'luckyPoints') return 5;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue({
            d20: 3, bonus: 5, targetName: 'Orc', hit: false, timestamp: Date.now() - 120000,
        });
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue(null);

        const result = await handle(
            { name: 'Advantage', automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(result.payload.description).toContain('No recent D20 test found');
    });
});
