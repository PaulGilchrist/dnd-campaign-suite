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
        expect(result.payload.description).toContain('No recent D20 test found');
    });

    it('should mark as used and return popup when attack roll is fresh', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'strokeOfLuckUsed') return false;
            return undefined;
        });
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { d20: 8, bonus: 5, targetName: 'TestRogue', hit: false, timestamp: Date.now() },
            attackerName: 'Goblin',
            targetName: 'TestRogue',
            primaryDamage: 10,
            secondaryDamage: 0,
            totalDamage: 10,
            damageTypes: ['Slashing'],
        });
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


});
