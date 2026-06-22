import { handle } from './boonOfFateHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../../services/automation/common/damageRollback.js');
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
            if (key === 'boonOfFateUsed') return false;
            return undefined;
        });
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { d20: 8, bonus: 5, targetName: 'TestFighter', hit: false, timestamp: Date.now() - 30000 },
            attackerName: 'Goblin',
            targetName: 'TestFighter',
            primaryDamage: 10,
            secondaryDamage: 0,
            totalDamage: 10,
            damageTypes: ['Slashing'],
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter', 'boonOfFateUsed', true, mockCampaignName
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Improve Fate');
        expect(result.payload.description).toContain('Attack vs AC TestFighter');
        expect(logService.addEntry).toHaveBeenCalled();
    });


});
