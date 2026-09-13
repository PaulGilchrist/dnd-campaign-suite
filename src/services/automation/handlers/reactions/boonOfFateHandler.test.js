// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// Suppress fire-and-forget logService.addEntry rejection warnings from source code
process.on('unhandledRejection', () => {});

import { handle, applyBoonFateChoice } from './boonOfFateHandler.js';
 import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
 import * as diceRoller from '../../../dice/diceRoller.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../dice/diceRoller.js');
vi.mock('../../../rules/combat/rangeCheck.js');
vi.mock('../../../ui/logService.js');
vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

describe('boonOfFateHandler.handle', () => {
    const mockPlayerStats = { name: 'TestFighter', level: 20, class: { name: 'Fighter' } };
    const mockAction = {
        name: 'Improve Fate',
        automation: { type: 'modify_d20_roll', modifier: '2d4', range: '60 ft', canBeBonusOrPenalty: true, recharge: 'initiative_or_short_or_long_rest', casting_time: '1 reaction' },
    };
    const mockCampaignName = 'TestCampaign';
    const mockLastAttack = {
        d20: 8,
        bonus: 5,
        targetAc: 15,
        hit: false,
        attackerName: 'Goblin',
        targetName: 'Player',
        rollType: 'attack',
        saveDc: undefined,
        saveResult: undefined,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue({ total: 6 });
        rangeCheck.isWithinRange.mockResolvedValue(true);
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
            if (propertyName === 'lastAttack') return mockLastAttack;
            if (propertyName === 'boonOfFateUsed') return false;
            return undefined;
        });
    });

    it('should return error popup when boon has already been used', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
            if (key === 'boonOfFateUsed') return true;
            return undefined;
        });
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
            if (propertyName === 'lastAttack') return mockLastAttack;
            if (propertyName === 'boonOfFateUsed') return true;
            return undefined;
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no uses remaining');
        expect(result.payload.description).toContain('Initiative or Short or Long Rest');
    });

    it('should return error popup when no recent D20 test exists', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
            if (propertyName === 'lastAttack') return null;
            if (propertyName === 'boonOfFateUsed') return false;
            return undefined;
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent D20 test found');
    });

    it('should return error popup when no attacker found in last attack', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
            if (propertyName === 'lastAttack') return { d20: 8, bonus: 5, attackerName: null };
            if (propertyName === 'boonOfFateUsed') return false;
            return undefined;
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No attacker found');
    });

    it('should return error popup when attacker is out of range', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
            if (propertyName === 'lastAttack') return mockLastAttack;
            if (propertyName === 'boonOfFateUsed') return false;
            return undefined;
        });
        rangeCheck.isWithinRange.mockResolvedValue(false);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('out of range');
    });

    it('should return error popup when rollExpression fails', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
            if (propertyName === 'lastAttack') return mockLastAttack;
            if (propertyName === 'boonOfFateUsed') return false;
            return undefined;
        });
        diceRoller.rollExpression.mockReturnValue(null);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Roll failed');
    });

    it('should return modal with boonFateChoice for successful invocation', async () => {
        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('boonFateChoice');
        expect(result.payload.roll2d4).toEqual({ total: 6 });
        expect(result.payload.lastAttack).toEqual(mockLastAttack);
        expect(result.payload.attackerName).toBe('Goblin');
        expect(result.payload.eventLabel).toBe('Attack by Goblin');
        expect(result.payload.hitStatus).toBe('Miss');
        expect(result.payload.isAttack).toBe(true);
        expect(result.payload.isSave).toBe(false);
    });

    it('should detect save type from lastAttack fields', async () => {
        const saveAttack = {
            d20: 10,
            bonus: 3,
            saveDc: 14,
            saveResult: 'failure',
            saveType: 'constitution',
            attackerName: 'Dragon',
            targetName: 'Player',
            rollType: 'save',
        };
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
            if (propertyName === 'lastAttack') return saveAttack;
            if (propertyName === 'boonOfFateUsed') return false;
            return undefined;
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.modalName).toBe('boonFateChoice');
        expect(result.payload.eventLabel).toBe('CONSTITUTION by Dragon');
        expect(result.payload.saveStatus).toBe('Failure');
        expect(result.payload.isSave).toBe(true);
    });
});

describe('boonOfFateHandler.applyBoonFateChoice', () => {
    const mockPlayerStats = { name: 'TestFighter', level: 20, class: { name: 'Fighter' } };
    const mockAction = {
        name: 'Improve Fate',
        automation: { type: 'modify_d20_roll', modifier: '2d4', range: '60 ft', canBeBonusOrPenalty: true, recharge: 'initiative_or_short_or_long_rest', casting_time: '1 reaction' },
    };
    const mockCampaignName = 'TestCampaign';
    const mockLastAttack = {
        d20: 8,
        bonus: 5,
        targetAc: 15,
        attackerName: 'Goblin',
        targetName: 'Player',
        rollType: 'attack',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        logService.addEntry.mockResolvedValue(undefined);
        runtimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => { if (propertyName === 'lastAttack') return mockLastAttack; return undefined; });;
    });

    it('should set boonOfFateUsed runtime flag before applying modifier', async () => {
        const result = await applyBoonFateChoice({
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    roll2d4: { total: 6 },
    lastAttack: mockLastAttack,
    mode: 'bonus',
});

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter', 'boonOfFateUsed', true, mockCampaignName
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should apply modifier as bonus to d20 roll', async () => {
        const result = await applyBoonFateChoice({
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    roll2d4: { total: 6 },
    lastAttack: mockLastAttack,
    mode: 'bonus',
});

        expect(result.payload.description).toContain('+6');
        expect(result.payload.description).toContain('Goblin');
        expect(result.payload.description).toContain('d20(8) + 5');
    });

    it('should apply modifier as penalty to d20 roll', async () => {
        const result = await applyBoonFateChoice({
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    roll2d4: { total: 4 },
    lastAttack: mockLastAttack,
    mode: 'penalty',
});

        expect(result.payload.description).toContain('-4');
        expect(result.payload.description).toContain('Goblin');
    });

    it('should log the ability use to campaign log', async () => {
        await applyBoonFateChoice({
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    roll2d4: { total: 6 },
    lastAttack: mockLastAttack,
    mode: 'bonus',
});

        expect(logService.addEntry).toHaveBeenCalledWith(
            mockCampaignName,
            expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Improve Fate',
            })
        );
    });
});
