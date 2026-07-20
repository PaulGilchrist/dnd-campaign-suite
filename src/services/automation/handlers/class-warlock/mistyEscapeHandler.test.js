// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './mistyEscapeHandler.js';

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

const { findLastAttack } = await import('../../common/damageRollback.js');
const { addEntry } = await import('../../../ui/logService.js');
const { buildSaveDc } = await import('../../common/savePrompt.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationExpressions.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'WarlockGirl',
        abilities: [{ name: 'CHA', bonus: 4 }],
        proficiency: 3,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Misty Escape',
        automation: {
            type: 'misty_escape',
            saveDc: 15,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makeRecentAttack(overrides = {}) {
    return {
        attackEvent: { timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: 'WarlockGirl',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Fire'],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(15);
    getCombatContext.mockResolvedValue({ creatures: [] });
    evaluateAutoExpression.mockReturnValue(1);
});

describe('mistyEscapeHandler', () => {
    describe('guard: no recent damage', () => {
        it('returns popup when no recent damage taken', async () => {
            const testCases = [
                { attack: { attackEvent: null, targetName: null, totalDamage: 0 } },
                { attack: { targetName: 'OtherPlayer' } },
                { attack: { totalDamage: 0, primaryDamage: 0 } },
            ];

            for (const { attack } of testCases) {
                findLastAttack.mockResolvedValue(makeRecentAttack(attack));

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('No recent damage taken');
            }
        });
    });

    describe('modal return', () => {
        function setupSuccessfulHandler() {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            buildSaveDc.mockReturnValue(15);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
                    { name: 'WarlockGirl', type: 'player', currentHp: 20, maxHp: 20 },
                ],
            });
            getRuntimeValue.mockReturnValue(1);
        }

        it('returns modal with mode and targets when damage was taken', async () => {
            setupSuccessfulHandler();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.mode).toBe('mistyEscape');
            expect(result.payload.title).toBe('Misty Step');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.featureName).toBe('Misty Escape');
            expect(result.payload.newCount).toBe(1);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
            // Should filter out the warlock from targets
            expect(result.payload.targets.length).toBe(1);
            expect(result.payload.targets[0].name).toBe('Goblin');
        });

        it('returns modal with empty targets when no creatures in combat', async () => {
            setupSuccessfulHandler();
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('mistyEscape');
            expect(result.payload.targets).toEqual([]);
        });

        it('returns modal with zero count when no uses remaining', async () => {
            setupSuccessfulHandler();
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('mistyEscape');
            expect(result.payload.newCount).toBe(0);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
        });

        it('respects custom saveType and feature name from automation config', async () => {
            setupSuccessfulHandler();
            buildSaveDc.mockReturnValue(17);

            const result = await handle(
                makeAction({ name: 'Shadow Blink', automation: { saveType: 'CHA' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.featureName).toBe('Shadow Blink');
            expect(result.payload.saveDc).toBe(17);
        });
    });

    describe('logging', () => {
        it('logs ability use with correct type, character, and feature name', async () => {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            buildSaveDc.mockReturnValue(15);
            getRuntimeValue.mockReturnValue(1);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'WarlockGirl',
                abilityName: 'Misty Escape',
            }));
        });

        it('logs with custom feature name', async () => {
            findLastAttack.mockResolvedValue(makeRecentAttack());
            buildSaveDc.mockReturnValue(15);
            getRuntimeValue.mockReturnValue(1);

            await handle(makeAction({ name: 'My Misty Escape' }), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'My Misty Escape',
            }));
        });
    });
});
