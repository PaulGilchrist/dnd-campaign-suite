import { handle } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'STR', bonus: 4 },
        { name: 'DEX', bonus: 2 },
        { name: 'CON', bonus: 1 },
        { name: 'INT', bonus: 0 },
        { name: 'WIS', bonus: 0 },
        { name: 'CHA', bonus: 0 },
    ],
    level: 15,
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

const makeAction = (auto = {}) => ({
    name: 'Test Maneuver',
    automation: {
        type: 'combat_superiority',
        saveType: 'WIS',
        saveAbility: 'STR',
        saveDc: 'ability',
        dieExpression: 'superiority_die',
        uses_max: 4,
        ...auto,
    },
});

describe('combatSuperiorityHandler – Relentless', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 5 });
    });

    it('should detect relentless passive', async () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'relentless', name: 'Relentless' },
                ],
            },
        });
        const action = makeAction();

        const result = await handle(action, playerStats, 'test-campaign', 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Relentless');
        expect(result.payload.description).toContain('1d8');
    });

    it('should not expend a superiority die when relentless is used', async () => {
        getRuntimeValue.mockImplementation((playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });

        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'relentless', name: 'Relentless' },
                ],
            },
        });
        const action = makeAction();

        await handle(action, playerStats, 'test-campaign', 'test-map');

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'TestFighter',
            'superiorityDice',
            expect.any(Number),
            'test-campaign'
        );
    });

    it('should roll 1d8 instead of superiority die when relentless is used', async () => {
        getRuntimeValue.mockImplementation((playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });
        rollExpression.mockReturnValueOnce({ total: 7 }).mockReturnValue({ total: 5 });

        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'relentless', name: 'Relentless' },
                ],
            },
        });
        const action = makeAction();

        const result = await handle(action, playerStats, 'test-campaign', 'test-map');

        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.payload.description).toContain('7');
        expect(result.payload.description).toContain('Relentless');
    });

    it('should track relentless used this turn', async () => {
        getRuntimeValue.mockImplementation((playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return 1;
            return undefined;
        });

        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'relentless', name: 'Relentless' },
                ],
            },
        });
        const action = makeAction();

        const result = await handle(action, playerStats, 'test-campaign', 'test-map');

        expect(result.payload.description).toContain('10');
        expect(result.payload.description).not.toContain('Relentless');
    });

    it('should allow relentless again on a new round', async () => {
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockImplementation((playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return 1;
            return undefined;
        });
        rollExpression.mockReturnValueOnce({ total: 3 }).mockReturnValue({ total: 5 });

        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'relentless', name: 'Relentless' },
                ],
            },
        });
        const action = makeAction();

        const result = await handle(action, playerStats, 'test-campaign', 'test-map');

        expect(result.payload.description).toContain('3');
        expect(result.payload.description).toContain('Relentless');
    });

    it('should not use relentless when passive is not present', async () => {
        getRuntimeValue.mockImplementation((playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            return undefined;
        });

        const playerStats = makePlayerStats();
        const action = makeAction();

        const result = await handle(action, playerStats, 'test-campaign', 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No Superiority Dice remaining');
    });

    it('should not set relentlessUsedRound when relentless is not active', async () => {
        getRuntimeValue.mockImplementation((playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 6 });

        const playerStats = makePlayerStats();
        const action = makeAction();

        await handle(action, playerStats, 'test-campaign', 'test-map');

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'TestFighter',
            'relentlessUsedRound',
            expect.any(Number),
            'test-campaign'
        );
    });
});
