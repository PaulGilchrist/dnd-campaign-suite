import { handle, getPortentDice, setPortentDice, refreshPortentDice } from './portentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { getLastAttackRoll, getLastAbilityCheck, getLastSaveRoll } from '../../../../hooks/useMetamagic.js';
import { rollD20 } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/useMetamagic.js', () => ({
    getLastAttackRoll: vi.fn(),
    getLastAbilityCheck: vi.fn(),
    getLastSaveRoll: vi.fn(),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

const mockPlayerStats = {
    name: 'TestWizard',
    level: 3,
    class: { class_levels: [{ level: 3 }] },
};

const mockAction = {
    name: 'Portent',
    automation: { type: 'portent', effect: 'portent', casting_time: 'passive' },
};

const mockCampaignName = 'test-campaign';

function setupMocks() {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    setRuntimeValue.mockReturnValue(undefined);
    getLastAttackRoll.mockReturnValue(null);
    getLastAbilityCheck.mockReturnValue(null);
    getLastSaveRoll.mockReturnValue(null);
    rollD20.mockReturnValue(10);
    addEntry.mockReturnValue({ catch: () => {} });
}

describe('Portent Handler', () => {
    beforeEach(setupMocks);

    describe('getPortentDice', () => {
        it('returns empty array when no stored value', () => {
            getRuntimeValue.mockReturnValue(null);
            const dice = getPortentDice('TestWizard', 'test-campaign');
            expect(dice).toEqual([]);
        });

        it('returns parsed array from JSON string', () => {
            getRuntimeValue.mockReturnValue('[15, 8]');
            const dice = getPortentDice('TestWizard', 'test-campaign');
            expect(dice).toEqual([15, 8]);
        });

        it('returns array directly if already parsed', () => {
            getRuntimeValue.mockReturnValue([12, 5, 18]);
            const dice = getPortentDice('TestWizard', 'test-campaign');
            expect(dice).toEqual([12, 5, 18]);
        });
    });

    describe('setPortentDice', () => {
        it('stores dice as JSON string', () => {
            setPortentDice('TestWizard', [10, 15], 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[10,15]', 'test-campaign');
        });
    });

    describe('refreshPortentDice', () => {
        it('rolls 2 dice at level 3', async () => {
            rollD20.mockReturnValueOnce(12).mockReturnValueOnce(7);
            const dice = await refreshPortentDice('TestWizard', 'test-campaign', mockPlayerStats);
            expect(dice).toHaveLength(2);
            expect(dice).toContain(12);
            expect(dice).toContain(7);
        });

        it('rolls 3 dice at level 14+', async () => {
            const highLevelStats = { ...mockPlayerStats, level: 14 };
            rollD20.mockReturnValueOnce(1).mockReturnValueOnce(20).mockReturnValueOnce(13);
            const dice = await refreshPortentDice('TestWizard', 'test-campaign', highLevelStats);
            expect(dice).toHaveLength(3);
            expect(dice).toContain(1);
            expect(dice).toContain(20);
            expect(dice).toContain(13);
        });
    });

    describe('handle - no dice remaining', () => {
        it('returns popup when no portent dice', async () => {
            getRuntimeValue.mockReturnValue(null);
            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No foretelling rolls remaining');
        });
    });

    describe('handle - no recent d20 test', () => {
        it('returns popup when no recent attack/check/save', async () => {
            getRuntimeValue.mockReturnValue('[15, 8]');
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue(null);
            getLastSaveRoll.mockReturnValue(null);

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('handle - successful use', () => {
        it('uses highest portent die on recent ability check', async () => {
            getRuntimeValue.mockReturnValue('[15, 8]');
            getLastAbilityCheck.mockReturnValue({
                d20: 4,
                bonus: 5,
                checkName: 'Stealth check',
                timestamp: Date.now() - 1000,
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Portent d20(15)');
            expect(result.payload.description).toContain('Original d20(4)');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[8]', 'test-campaign');
            expect(addEntry).toHaveBeenCalled();
        });

        it('uses highest portent die on recent save', async () => {
            getRuntimeValue.mockReturnValue('[12, 6]');
            getLastSaveRoll.mockReturnValue({
                d20: 3,
                bonus: 4,
                saveType: 'wisdom',
                timestamp: Date.now() - 1000,
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.payload.description).toContain('Portent d20(12)');
            expect(result.payload.description).toContain('Original d20(3)');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[6]', 'test-campaign');
        });

        it('uses highest portent die on recent attack', async () => {
            getRuntimeValue.mockReturnValue('[10, 3]');
            getLastAttackRoll.mockReturnValue({
                d20: 2,
                bonus: 6,
                targetName: 'Goblin',
                hit: false,
                timestamp: Date.now() - 1000,
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.payload.description).toContain('Portent d20(10)');
            expect(result.payload.description).toContain('Original d20(2)');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'portentDice', '[3]', 'test-campaign');
        });

        it('handles stale events', async () => {
            getRuntimeValue.mockReturnValue('[15, 8]');
            getLastAbilityCheck.mockReturnValue({
                d20: 4,
                bonus: 5,
                checkName: 'Athletics check',
                timestamp: Date.now() - 120000,
            });

            const result = await handle(mockAction, mockPlayerStats, mockCampaignName);
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });
});
