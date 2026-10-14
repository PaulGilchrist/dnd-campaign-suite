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
        totalDamage: 10,
        ...overrides,
    };
}

function setupModalMocks(overrides = {}) {
    findLastAttack.mockResolvedValue(makeRecentAttack(overrides.attack));
    buildSaveDc.mockReturnValue(overrides.saveDc !== undefined ? overrides.saveDc : 15);
    evaluateAutoExpression.mockReturnValue(overrides.uses !== undefined ? overrides.uses : 1);
    getRuntimeValue.mockReturnValue(overrides.runtimeValue !== undefined ? overrides.runtimeValue : 1);
    getCombatContext.mockResolvedValue(overrides.combatContext !== undefined ? overrides.combatContext : {
        creatures: [
            { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
            { name: 'WarlockGirl', type: 'player', currentHp: 20, maxHp: 20 },
        ],
    });
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe('mistyEscapeHandler', () => {
    describe('guard: no recent damage', () => {
        const testCases = [
            { attack: { attackEvent: null, targetName: null, totalDamage: 0 }, description: 'no attackEvent' },
            { attack: { targetName: 'OtherPlayer' }, description: 'damage taken by different target' },
            { attack: { totalDamage: 0, primaryDamage: 0 }, description: 'zero totalDamage' },
        ];

        for (const { attack, description } of testCases) {
            it(`returns popup when ${description}`, async () => {
                findLastAttack.mockResolvedValue(makeRecentAttack(attack));

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('No recent damage taken');
            });
        }
    });

    describe('modal return', () => {
        it('returns modal with mode, targets, and saveDc when damage was taken', async () => {
            setupModalMocks();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.mode).toBe('mistyEscape');
            expect(result.payload.title).toBe('Misty Step');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.featureName).toBe('Misty Escape');
            expect(result.payload.newCount).toBe(1);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
            expect(result.payload.targets.length).toBe(1);
            expect(result.payload.targets[0].name).toBe('Goblin');
            expect(result.payload.action).toBeDefined();
            expect(result.payload.playerStats).toBeDefined();
        });

        it('returns modal with empty targets when combat context is null or has no creatures', async () => {
            setupModalMocks({ combatContext: null });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.payload.targets).toEqual([]);
        });

        it('filters out the player from eligible targets', async () => {
            setupModalMocks({
                combatContext: {
                    creatures: [
                        { name: 'WarlockGirl', type: 'player', currentHp: 20, maxHp: 20 },
                        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
                        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 20 },
                    ],
                },
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.targets.length).toBe(2);
            expect(result.payload.targets.every(t => t.name !== 'WarlockGirl')).toBe(true);
        });

        it('uses usesMax when getRuntimeValue returns undefined or zero', async () => {
            setupModalMocks({ runtimeValue: undefined });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.newCount).toBe(1);
        });

        it('respects custom saveType and feature name from automation config', async () => {
            setupModalMocks({ saveDc: 17 });

            const result = await handle(
                makeAction({ name: 'Shadow Blink', automation: { saveType: 'CHA' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.featureName).toBe('Shadow Blink');
            expect(result.payload.saveDc).toBe(17);
        });

        it('uses custom uses_expression from automation config', async () => {
            setupModalMocks({ uses: 3 });

            await handle(
                makeAction({ automation: { uses_expression: '2d4' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d4', expect.any(Object));
        });
    });

    describe('logging', () => {
        it('logs ability use with correct type, character, and feature name', async () => {
            setupModalMocks();

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'WarlockGirl',
                abilityName: 'Misty Escape',
            }));
        });

        it('logs with custom feature name', async () => {
            setupModalMocks();

            await handle(makeAction({ name: 'My Misty Escape' }), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'My Misty Escape',
            }));
        });

        it('does not throw when logging fails', async () => {
            setupModalMocks();
            addEntry.mockImplementation(() => Promise.reject(new Error('log failed')));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
        });
    });
});
