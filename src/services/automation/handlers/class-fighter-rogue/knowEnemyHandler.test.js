import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './knowEnemyHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getMonsterData } = await import('../../../../services/npcs/monsterUtils.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../../services/rules/combat/damageUtils.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestFighter',
        level: 5,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Know Enemy',
        automation: {
            type: 'know_enemy',
            uses_max: 4,
            range: '30 ft',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('knowEnemyHandler', () => {
    describe('superiority dice checks', () => {
        it('returns error when no superiority dice remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Superiority Dice remaining');
        });

        it('proceeds when 1 superiority die available', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('No Superiority Dice remaining');
        });

        it('defaults to uses_max when no stored value', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('No Superiority Dice remaining');
        });

        it('uses defaultMax of 4 when automation missing uses_max', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                makeAction({ automation: { range: '60 ft' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('No Superiority Dice remaining');
        });
    });

    describe('dice expenditure', () => {
        it('decrements superiority dice by 1', async () => {
            getRuntimeValue.mockReturnValue(3);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                2,
                'test-campaign'
            );
        });
    });

    describe('target lookup', () => {
        it('looks up monster data for combat target', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getMonsterData.mockResolvedValue({
                name: 'Goblin',
                damage_immunities: ['cold'],
                damage_resistances: ['bludgeoning'],
                damage_vulnerabilities: [],
                condition_immunities: ['poisoned'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(getMonsterData).toHaveBeenCalledWith('Goblin', null);
            expect(result.payload.description).toContain('Immunities: cold');
            expect(result.payload.description).toContain('Resistances: bludgeoning');
            expect(result.payload.description).toContain('Condition Immunities: poisoned');
        });

        it('handles target not in combat', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);
            getMonsterData.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Target: None (not in combat)');
            expect(result.payload.description).toContain('No monster data found');
        });

        it('handles monster data lookup failure', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'PlayerCharacter' });
            getMonsterData.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('No monster data found');
            expect(result.payload.description).toContain('player character');
        });

        it('handles monster with no immunities/resistances', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Skeleton' });
            getMonsterData.mockResolvedValue({
                name: 'Skeleton',
                damage_immunities: [],
                damage_resistances: [],
                damage_vulnerabilities: [],
                condition_immunities: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('No immunities, resistances, vulnerabilities');
        });

        it('handles missing vulnerability field', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Zombie' });
            getMonsterData.mockResolvedValue({
                name: 'Zombie',
                damage_immunities: ['poison'],
                damage_resistances: [],
                condition_immunities: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Immunities: poison');
        });

        it('handles combat context throw', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockRejectedValue(new Error('fail'));
            getMonsterData.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Target: None (not in combat)');
        });
    });

    describe('result format', () => {
        it('returns popup with correct fields', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Know Enemy');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('includes range in description', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await handle(
                makeAction({ automation: { range: '60 ft' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.description).toContain('Range: 60 ft');
        });

        it('uses default range when not provided', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await handle(
                makeAction({ automation: {} }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.description).toContain('Range: 30 ft');
        });
    });
});
