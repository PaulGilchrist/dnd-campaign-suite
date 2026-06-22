import { handle } from './luckyPointHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../ui/logService.js');
vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

describe('luckyPointHandler.handle', () => {
    const mockPlayerStats = { name: 'TestFighter', level: 10, feats: [{ name: 'Lucky' }], _trackedResources: { luckyPoints: { current: 5, max: 5 } } };
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
        damageUtils.getCombatContext.mockResolvedValue({ lastAttack: null });

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
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 8, bonus: 5, targetName: 'Goblin', hit: false }
        });
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
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 7, bonus: 3, checkName: 'Stealth' }
        });
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
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'save', attackerName: 'TestFighter', d20: 5, bonus: 2, saveType: 'CON' }
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
        // lastAttack is always an attack, so attack takes priority
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 3, bonus: 5, targetName: 'Orc', hit: false }
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(
            { name: 'Advantage', automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 } },
            mockPlayerStats,
            mockCampaignName
        );

        expect(result.payload.description).toContain('Attack vs AC Orc');
    });
});
