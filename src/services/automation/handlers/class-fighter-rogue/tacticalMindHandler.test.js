import { handle } from './tacticalMindHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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

    it('returns popup when no combat context', async () => {
        damageUtils.getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent ability check found');
    });

    it('returns popup when last attack is not an ability check', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 15, bonus: 3, targetAc: 15, hit: true },
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent ability check found');
    });

    it('returns popup when last ability check is not by this player', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'check', attackerName: 'Goblin', d20: 15, bonus: 2, checkName: 'Stealth' },
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent ability check found');
    });

    it('returns popup for natural 20', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 20, bonus: 3, checkName: 'Insight' },
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Natural 20');
    });

    it('shows result with 1d10 bonus when ability check exists', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 8, bonus: 3, checkName: 'Insight' },
        });

        getRuntimeValue.mockReturnValue(2);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Tactical Mind');
        expect(result.payload.description).toContain('11'); // 8 + 3 = 11
    });

    it('expend Second Wind when check succeeds', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 8, bonus: 3, checkName: 'Insight' },
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
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 8, bonus: 3, checkName: 'Insight' },
        });

        getRuntimeValue.mockReturnValue(0);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.payload.description).toContain('No Second Wind uses remaining');
    });

    it('logs ability use entry', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 8, bonus: 3, checkName: 'Insight' },
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
