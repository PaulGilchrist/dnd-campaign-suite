// @improved-by-ai
import { handle } from './strokeOfLuckHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../../services/automation/common/damageRollback.js');
vi.mock('../../../ui/logService.js');

describe('strokeOfLuckHandler.handle', () => {
    const mockPlayerStats = { name: 'TestRogue', level: 20, class: { name: 'Rogue' } };
    const mockAction = {
        name: 'Stroke of Luck',
        automation: { type: 'stroke_of_luck', target: 'd20', recharge: 'short_or_long_rest' },
    };
    const mockCampaignName = 'TestCampaign';

    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(undefined);
        logService.addEntry.mockResolvedValue(undefined);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    });

    it('should return info popup when already used after rest', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(true);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Stroke of Luck');
        expect(result.payload.description).toContain('no uses remaining');
        expect(result.payload.description).toContain('Short or Long Rest');
        expect(result.payload.automation).toEqual(mockAction.automation);
        expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return info popup when no recent D20 attack found', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(false);
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: null,
            attackerName: null,
            targetName: null,
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: [],
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Stroke of Luck');
        expect(result.payload.description).toContain('No recent D20 test found');
        expect(result.payload.description).toContain('TestRogue');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return info popup when last attack was not against this character', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(false);
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { d20: 8, bonus: 5, targetName: 'OtherPC', hit: false, timestamp: Date.now() },
            attackerName: 'Goblin',
            targetName: 'OtherPC',
            primaryDamage: 10,
            secondaryDamage: 0,
            totalDamage: 10,
            damageTypes: ['Slashing'],
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent D20 test found');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should convert a failed D20 roll to a 20 and mark as used', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(false);
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { d20: 3, bonus: 7, targetName: 'Goblin', hit: false, timestamp: Date.now() },
            attackerName: 'Goblin',
            targetName: 'TestRogue',
            primaryDamage: 10,
            secondaryDamage: 0,
            totalDamage: 10,
            damageTypes: ['Slashing'],
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue', 'strokeOfLuckUsed', true, mockCampaignName
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Stroke of Luck');
        expect(result.payload.description).toContain('Stroke of Luck');
        expect(result.payload.description).toContain('d20(3)');
        expect(result.payload.description).toContain('+ 7 = 10');
        expect(result.payload.description).toContain('d20(20)');
        expect(result.payload.description).toContain('<strong>27</strong>');
        expect(logService.addEntry).toHaveBeenCalled();
    });

    it('should return popup indicating already succeeded when attack already hit', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(false);
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { d20: 15, bonus: 7, targetName: 'Goblin', hit: true, timestamp: Date.now() },
            attackerName: 'Goblin',
            targetName: 'TestRogue',
            primaryDamage: 10,
            secondaryDamage: 0,
            totalDamage: 10,
            damageTypes: ['Slashing'],
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Already succeeded');
        expect(result.payload.description).toContain('no effect');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue', 'strokeOfLuckUsed', true, mockCampaignName
        );
    });

    it('should propagate errors from setRuntimeValue', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(false);
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { d20: 1, bonus: 5, targetName: 'Goblin', hit: false, timestamp: Date.now() },
            attackerName: 'Goblin',
            targetName: 'TestRogue',
            primaryDamage: 10,
            secondaryDamage: 0,
            totalDamage: 10,
            damageTypes: ['Slashing'],
        });
        runtimeState.setRuntimeValue.mockRejectedValue(new Error('Network failure'));

        await expect(
            handle(mockAction, mockPlayerStats, mockCampaignName)
        ).rejects.toThrow('Network failure');
    });

    it('should propagate errors from findLastAttack', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(false);
        damageRollback.findLastAttack.mockRejectedValue(new Error('Database unavailable'));

        await expect(
            handle(mockAction, mockPlayerStats, mockCampaignName)
        ).rejects.toThrow('Database unavailable');
    });

    it('should use unknown when targetName is missing from attackEvent', async () => {
        runtimeState.getRuntimeValue.mockReturnValueOnce(false);
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { d20: 5, bonus: 3, hit: false, timestamp: Date.now() },
            attackerName: 'Skeleton',
            targetName: 'TestRogue',
            primaryDamage: 5,
            secondaryDamage: 0,
            totalDamage: 5,
            damageTypes: ['Piercing'],
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.payload.description).toContain('AC unknown');
        expect(result.payload.description).toContain('d20(5)');
        expect(result.payload.description).toContain('+ 3 = 8');
        expect(result.payload.description).toContain('d20(20)');
        expect(result.payload.description).toContain('<strong>23</strong>');
    });
});
