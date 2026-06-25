// @improved-by-ai
import { handle } from './tacticalMindHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
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

const mockCheck = (overrides = {}) => ({
    rollType: 'check',
    attackerName: 'TestFighter',
    d20: 8,
    bonus: 3,
    checkName: 'Insight',
    ...overrides,
});

describe('tacticalMindHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(null);
    });

    describe('early exit — no valid ability check', () => {
        it('returns popup when no combat context exists', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Tactical Mind');
            expect(result.payload.description).toContain('No recent ability check found');
            expect(result.payload.description).toContain('TestFighter');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns popup when last roll is an attack, not an ability check', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 15, bonus: 3, targetAc: 15, hit: true },
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent ability check found');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns popup when ability check was made by a different character', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'Goblin', d20: 15, bonus: 2, checkName: 'Stealth' },
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent ability check found');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('early exit — natural 20', () => {
        it('returns popup indicating natural 20 needs no bonus', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 20, bonus: 3, checkName: 'Insight' },
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Tactical Mind');
            expect(result.payload.description).toContain('Natural 20');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('early exit — no Second Wind uses', () => {
        it('returns popup when no Second Wind uses remain and resets to max', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: mockCheck({ d20: 8 }),
            });
            getRuntimeValue.mockReturnValueOnce(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Second Wind uses remaining');
            // Handler resets uses to max when current is 0, then max is also 0
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 0, 'test-campaign');
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('resets second wind to max when uses are depleted before applying bonus', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: mockCheck({ d20: 5 }),
            });
            getRuntimeValue.mockReturnValueOnce(0);

            const playerStats = {
                name: 'TestFighter',
                level: 2,
                class: {
                    class_levels: [{ level: 1, second_wind: 1 }, { level: 2, second_wind: 3 }],
                },
            };

            await handle(makeAction(), playerStats, 'test-campaign', null);

            // Should have reset to max (3) first
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 3, 'test-campaign');
            // Then should have decremented to 2
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 2, 'test-campaign');
        });
    });

    describe('successful application', () => {
        it('returns popup with original and modified totals for a failed check', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: mockCheck({ d20: 8 }),
            });
            getRuntimeValue.mockReturnValue(2);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Tactical Mind');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Tactical Mind');
            expect(result.payload.description).toContain('Insight');
            expect(result.payload.description).toContain('d20(8)');
            expect(result.payload.description).toContain('+ 3 = 11');
            expect(result.payload.description).toContain('+1d10');
            expect(result.payload.description).toContain('<b>');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('expend one Second Wind use on successful application', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: mockCheck({ d20: 5 }),
            });
            getRuntimeValue.mockReturnValue(2);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 1, 'test-campaign');
        });

        it('logs an ability_use entry to the campaign log', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: mockCheck({ d20: 5 }),
            });
            getRuntimeValue.mockReturnValue(2);
            addEntry.mockResolvedValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Mind',
                timestamp: expect.any(Number),
            }));
        });

        it('works with rollType "skill" as well as "check"', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'skill', attackerName: 'TestFighter', d20: 6, bonus: 4, checkName: 'Stealth' },
            });
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Stealth');
            expect(result.payload.description).toContain('d20(6)');
            expect(result.payload.description).toContain('+ 4 = 10');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 0, 'test-campaign');
        });
    });
});
