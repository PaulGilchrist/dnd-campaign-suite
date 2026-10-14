import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './stepsOfTheFeyHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationExpressions.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

const campaignName = 'TestCampaign';
const playerName = 'TestWarlock';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Charisma', bonus: 2 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Steps of the Fey',
        automation: {
            type: 'free_cast',
            uses_expression: 'CHA modifier_min_1',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function setupUses(uses) {
    getRuntimeValue.mockImplementation((_name, key, _campaign) => {
        if (key === '_Steps_of_the_Fey_freeCastCount') return uses;
        return null;
    });
    evaluateAutoExpression.mockReturnValue(1);
}

function setupCombatContext(context) {
    getCombatContext.mockResolvedValue(context);
}

describe('stepsOfTheFeyHandler.handle', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('guard: remaining uses check', () => {
        it('returns popup when no free uses remaining (count is 0)', async () => {
            setupUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steps of the Fey');
            expect(result.payload.description).toContain('No free uses');
            expect(result.payload.description).toContain('Long Rest');
            expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_Steps_of_the_Fey_freeCastCount', campaignName);
        });

        it('uses evaluated expression result for uses when runtime value is null', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(2);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.newCount).toBe(2);
        });
    });

    describe('guard: combat context', () => {
        it('returns popup with Misty Step trigger when no creatures in combat', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.triggerMistyStep).toBe(true);
            expect(result.payload.description).toContain('No creatures in combat');
        });

        it('returns popup when combat context is null or missing creatures', async () => {
            setupUses(1);
            setupCombatContext(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.triggerMistyStep).toBe(true);
            expect(result.payload.description).toContain('No creatures in combat');
        });
    });

    describe('guard: eligible targets', () => {
        it('returns popup when only warlock is in combat', async () => {
            setupUses(1);
            setupCombatContext({
                creatures: [{ name: playerName, type: 'player', currentHp: 20, maxHp: 20 }],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.triggerMistyStep).toBe(true);
            expect(result.payload.description).toContain('No other creatures in combat');
        });

        it('filters out the warlock from eligible targets', async () => {
            setupUses(1);
            setupCombatContext({
                creatures: [
                    { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
                    { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 20 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.targets.length).toBe(2);
            expect(result.payload.targets.every(t => t.name !== playerName)).toBe(true);
        });

        it('filters out creatures matching the warlock name', async () => {
            setupUses(1);
            setupCombatContext({
                creatures: [
                    { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
                    { name: playerName, type: 'npc', currentHp: 5, maxHp: 10 },
                    { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.targets.length).toBe(1);
            expect(result.payload.targets[0].name).toBe('Goblin');
        });

        it('returns popup when all creatures in combat are the warlock', async () => {
            setupUses(1);
            setupCombatContext({
                creatures: [
                    { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
                    { name: playerName, type: 'npc', currentHp: 5, maxHp: 10 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.triggerMistyStep).toBe(true);
        });
    });

    describe('modal return for creature selection', () => {
        it('returns modal with correct payload structure', async () => {
            setupUses(1);
            setupCombatContext({
                creatures: [
                    { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 20 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.mode).toBe('stepsOfTheFey');
            expect(result.payload.targets).toHaveLength(2);
            expect(result.payload.saveDc).toBe(13);
            expect(result.payload.featureName).toBe('Steps of the Fey');
            expect(result.payload.newCount).toBe(1);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
        });

        it('uses currentCount from runtime value in newCount', async () => {
            setupUses(3);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.newCount).toBe(3);
        });

        it('uses action.name as featureName when provided', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });
            const action = makeAction({ name: 'Custom Feature' });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.featureName).toBe('Custom Feature');
        });
    });

    describe('save DC calculation', () => {
        it('calculates save DC with proficiency and CHA bonus', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.saveDc).toBe(13); // 8 + 2 (CHA) + 3 (prof)
        });

        it('defaults to 8 when proficiency is missing', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats({ proficiency: undefined }), campaignName, null);

            expect(result.payload.saveDc).toBe(10); // 8 + 2 (CHA) + 0
        });

        it('defaults to 8 when Charisma bonus is missing', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats({ abilities: [] }), campaignName, null);

            expect(result.payload.saveDc).toBe(11); // 8 + 0 (no CHA) + 3 (prof)
        });

        it('uses first matching CHA ability when multiple abilities exist', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(
                makeAction(),
                makePlayerStats({ abilities: [{ name: 'Strength', bonus: 4 }, { name: 'Charisma', bonus: 5 }] }),
                campaignName,
                null
            );

            expect(result.payload.saveDc).toBe(16); // 8 + 5 (CHA) + 3 (prof)
        });
    });
});
