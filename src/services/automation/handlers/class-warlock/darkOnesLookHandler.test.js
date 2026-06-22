import { handle } from './darkOnesLookHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    getLastAttackRoll: vi.fn(),
    getLastAbilityCheck: vi.fn(),
    getLastSaveRoll: vi.fn(),
}));
vi.mock('../../../ui/logService.js');

describe('darkOnesLookHandler.handle', () => {
    const mockPlayerStats = {
        name: 'TestWarlock',
        level: 6,
        class: { name: 'Warlock' },
        abilities: [{ name: 'Charisma', bonus: 3 }],
    };
    const mockAction = {
        name: "Dark One's Own Look",
        automation: { type: 'dark_ones_look', diceExpression: '1d10' },
    };
    const mockCampaignName = 'TestCampaign';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return error when no uses remaining', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 0;
            return undefined;
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no uses remaining');
    });

    it('should return error when no recent ability check or saving throw found', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 1;
            return undefined;
        });
        metamagic.getLastAttackRoll.mockReturnValue(null);
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue(null);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent ability check or saving throw');
    });

    it('should handle ability check', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 1;
            return undefined;
        });
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 8, bonus: 5, checkName: 'Stealth check', timestamp: Date.now() - 10000,
        });
        metamagic.getLastSaveRoll.mockReturnValue(null);
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Stealth check');
        expect(result.payload.description).toContain('d20(8) + 5 = 13');
        expect(result.payload.description).toContain('1d10');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestWarlock', 'darkOnesLookUses', 0, mockCampaignName
        );
    });

    it('should handle saving throw', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 1;
            return undefined;
        });
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue({
            d20: 12, bonus: 3, saveType: 'wisdom', timestamp: Date.now() - 10000,
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('WIS');
        expect(result.payload.description).toContain('d20(12) + 3 = 15');
        expect(result.payload.description).toContain('1d10');
    });

    it('should prefer ability check over saving throw when both exist', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 1;
            return undefined;
        });
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 5, bonus: 2, checkName: 'Arcana check', timestamp: Date.now() - 10000,
        });
        metamagic.getLastSaveRoll.mockReturnValue({
            d20: 18, bonus: 4, saveType: 'constitution', timestamp: Date.now() - 10000,
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.payload.description).toContain('Arcana check');
        expect(result.payload.description).not.toContain('CON');
    });

    it('should consume one use on successful activation', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 3;
            return undefined;
        });
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 10, bonus: 4, checkName: 'Perception check', timestamp: Date.now() - 10000,
        });
        logService.addEntry.mockResolvedValue(undefined);

        await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestWarlock', 'darkOnesLookUses', 2, mockCampaignName
        );
    });

    it('should use minimum 1 when CHA modifier is negative', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 1;
            return undefined;
        });
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 15, bonus: 1, checkName: 'Insight check', timestamp: Date.now() - 10000,
        });
        logService.addEntry.mockResolvedValue(undefined);

        const result = await handle(mockAction, { ...mockPlayerStats, abilities: [{ name: 'Charisma', bonus: -4 }] }, mockCampaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Insight check');
    });

    it('should reject stale ability check events', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 1;
            return undefined;
        });
        metamagic.getLastAbilityCheck.mockReturnValue({
            d20: 10, bonus: 2, checkName: 'Athletics', timestamp: Date.now() - 120000,
        });
        metamagic.getLastSaveRoll.mockReturnValue(null);

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.payload.description).toContain('No recent ability check or saving throw');
    });

    it('should reject stale saving throw events', async () => {
        runtimeState.getRuntimeValue.mockImplementation((charName, key, _campName) => {
            if (key === 'darkOnesLookUses') return 1;
            return undefined;
        });
        metamagic.getLastAbilityCheck.mockReturnValue(null);
        metamagic.getLastSaveRoll.mockReturnValue({
            d20: 8, bonus: 3, saveType: 'dexterity', timestamp: Date.now() - 120000,
        });

        const result = await handle(mockAction, mockPlayerStats, mockCampaignName);

        expect(result.payload.description).toContain('No recent ability check or saving throw');
    });
});
