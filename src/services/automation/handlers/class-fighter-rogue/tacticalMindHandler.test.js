import { handle } from './tacticalMindHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { getLastAbilityCheck } from '../../../../hooks/useMetamagic.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/useMetamagic.js', () => ({
    getLastAbilityCheck: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makeAction = (overrides = {}) => ({
    name: 'Tactical Mind',
    automation: {
        type: 'tactical_mind',
        trigger: 'failed_ability_check',
        target: 'ability_check',
        bonusExpression: '1d10',
        resourceCost: 'second_wind',
        casting_time: 'passive',
        ...overrides,
    },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    level: 2,
    class: {
        class_levels: [{ level: 2, second_wind: 2 }],
    },
    ...overrides,
});

describe('tacticalMindHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup when no recent ability check', async () => {
        getLastAbilityCheck.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent ability check found');
    });

    it('returns popup when ability check is stale', async () => {
        getLastAbilityCheck.mockReturnValue({
            d20: 8,
            bonus: 3,
            checkName: 'Insight',
            timestamp: Date.now() - 120000,
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No recent ability check found');
    });

    it('returns popup for natural 20', async () => {
        getLastAbilityCheck.mockReturnValue({
            d20: 20,
            bonus: 3,
            checkName: 'Insight',
            timestamp: Date.now(),
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Natural 20');
    });

    it('shows result with 1d10 bonus when ability check exists', async () => {
        getLastAbilityCheck.mockReturnValue({
            d20: 8,
            bonus: 3,
            checkName: 'Insight',
            timestamp: Date.now(),
        });

        getRuntimeValue.mockReturnValue(2);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Tactical Mind');
        expect(result.payload.description).toContain('11'); // 8 + 3 = 11
    });

    it('expend Second Wind when check succeeds', async () => {
        getLastAbilityCheck.mockReturnValue({
            d20: 8,
            bonus: 3,
            checkName: 'Insight',
            timestamp: Date.now(),
        });

        getRuntimeValue.mockReturnValue(2);

        await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'secondWindUses',
            1,
            'test-campaign'
        );
    });

    it('does not expend Second Wind when no uses remain', async () => {
        getLastAbilityCheck.mockReturnValue({
            d20: 8,
            bonus: 3,
            checkName: 'Insight',
            timestamp: Date.now(),
        });

        getRuntimeValue.mockReturnValue(0);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.payload.description).toContain('No Second Wind uses remaining');
    });

    it('logs ability use entry', async () => {
        getLastAbilityCheck.mockReturnValue({
            d20: 8,
            bonus: 3,
            checkName: 'Insight',
            timestamp: Date.now(),
        });

        getRuntimeValue.mockReturnValue(2);

        await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Tactical Mind',
        }));
    });
});
