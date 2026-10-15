// @maintained-by-ai
// Know Your Enemy (CLA-286): popup composition, superiority-dice accounting
// (knowEnemy owns uses_max reading on the maneuver-attack lane), round-keyed
// relentless latch, and target→IRV display glue. IRV schema resolution itself
// is covered canonically in monsterIrvUtils.test.js — only the display glue
// is tested here. Popup strings use toContain tolerance; full-string pins for
// the shared no-dice warning live in combatSuperiorityUtils.test.js.
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

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getMonsterData } = await import('../../../../services/npcs/monsterUtils.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../../services/rules/combat/damageUtils.js');
const { addEntry } = await import('../../../ui/logService.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationService.js');
const { rollExpression } = await import('../../../../services/dice/diceRoller.js');
const { getCurrentCombatRound } = await import('../../../../services/encounters/combatData.js');

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

function makePlayerWithRelentless() {
    return makePlayerStats({
        automation: {
            passives: [
                { type: 'passive_rule', effect: 'relentless' },
            ],
        },
    });
}

describe('knowEnemyHandler', () => {
    describe('superiority dice checks', () => {
        it('returns error popup when no superiority dice remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Know Enemy');
            expect(result.payload.description).toContain('No Superiority Dice remaining');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('proceeds when 1 superiority die available', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Know Enemy');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                0,
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('uses uses_max from action when stored value is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                3,
                'test-campaign'
            );
        });

        it('uses custom uses_max when stored value is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            await handle(
                makeAction({ automation: { uses_max: 6 } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                5,
                'test-campaign'
            );
        });

        it('defaults uses_max to 4 and range to 30 ft when automation omits them', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(
                { name: 'Know Enemy', automation: { type: 'know_enemy' } },
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                3,
                'test-campaign'
            );
            expect(result.payload.description).toContain('Range: 30 ft');
        });
    });

    describe('target lookup and IRV display glue', () => {
        it('looks up monster data for combat target and renders IRV lines (2024 damage_* schema)', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Adult Blue Dracolich' });
            // Real monsters.json 2024-batch shape (only 118/605 monsters use damage_* keys)
            getMonsterData.mockResolvedValue({
                name: 'Adult Blue Dracolich',
                damage_immunities: ['lightning', 'poison'],
                damage_resistances: ['necrotic'],
                damage_vulnerabilities: [],
                condition_immunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
                resistances: null,
                vulnerabilities: null,
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(getMonsterData).toHaveBeenCalledWith('Adult Blue Dracolich', null);
            expect(result.payload.description).toContain('Target: Adult Blue Dracolich');
            expect(result.payload.description).toContain('Immunities: lightning, poison');
            expect(result.payload.description).toContain('Resistances: necrotic');
            expect(result.payload.description).toContain('Condition Immunities: charmed, exhaustion, frightened, paralyzed, poisoned');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
                description: expect.stringContaining('Know Your Enemy used by TestFighter against Adult Blue Dracolich'),
            }));
        });

        it('handles target not in combat', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Target: None (not in combat)');
            expect(result.payload.description).toContain('No monster data found for target');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                2,
                'test-campaign'
            );
        });

        it('handles combat context existing but no target found', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Target: None (not in combat)');
            expect(result.payload.description).toContain('No monster data found for target');
        });

        it('handles monster data lookup returning null', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'PlayerCharacter' });
            getMonsterData.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('No monster data found for target');
            expect(result.payload.description).toContain('player character');
        });

        it('handles monster with no IRV data', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Human' });
            getMonsterData.mockResolvedValue({
                name: 'Human',
                damage_immunities: [],
                damage_resistances: [],
                damage_vulnerabilities: [],
                condition_immunities: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain(
                'No immunities, resistances, vulnerabilities, or condition immunities.'
            );
        });

        it('handles combat context error and still expends dice', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockRejectedValueOnce(new Error('fail'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Target: None (not in combat)');
            expect(result.payload.description).toContain('No monster data found for target');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                2,
                'test-campaign'
            );
        });

        it('handles monster data lookup rejection', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'MysteryCreature' });
            getMonsterData.mockRejectedValueOnce(new Error('not found'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Target: MysteryCreature');
            expect(result.payload.description).toContain('No monster data found for target');
            expect(result.payload.description).toContain('player character');
        });

        it('uses custom range when provided', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(
                makeAction({ automation: { range: '60 ft' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.description).toContain('Range: 60 ft');
        });

        it('handles playerStats without automation property', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), { name: 'TestFighter' }, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
        });
    });

    describe('edge cases', () => {
        it('throws when automation is null', async () => {
            await expect(
                handle({ name: 'Know Enemy', automation: null }, makePlayerStats(), 'test-campaign', null)
            ).rejects.toThrow();
        });

        it('handles addEntry rejection gracefully', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);
            addEntry.mockRejectedValueOnce(new Error('log failed'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Know Enemy');
        });
    });

    describe('relentless feature', () => {
        it('does not use relentless when superiority dice are available', async () => {
            getRuntimeValue
                .mockReturnValueOnce(1)
                .mockReturnValueOnce(null);

            const result = await handle(makeAction(), makePlayerWithRelentless(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
            expect(result.payload.description).not.toContain('Relentless');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                0,
                'test-campaign'
            );
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                'relentlessUsedRound',
                expect.any(Number),
                'test-campaign'
            );
        });

        it('detects relentless passive when latch is empty and arms the latch', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)   // superiorityDice
                .mockReturnValueOnce(null); // relentlessUsedRound — never used
            getCurrentCombatRound.mockReturnValue(3);
            evaluateAutoExpression.mockReturnValue(4);
            rollExpression.mockReturnValue({ total: 4, rolls: [4] });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerWithRelentless(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
            expect(result.payload.description).toContain('Rolled d4 for 4');
            expect(result.payload.description).toContain('(Relentless)');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'relentlessUsedRound',
                3,
                'test-campaign'
            );
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                expect.any(Number),
                'test-campaign'
            );
        });

        it('does not allow relentless more than once per round', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)  // superiorityDice
                .mockReturnValueOnce(3); // relentlessUsedRound — already spent this round
            getCurrentCombatRound.mockReturnValue(3);

            const result = await handle(makeAction(), makePlayerWithRelentless(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Superiority Dice remaining');
            expect(result.payload.description).not.toContain('Relentless');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('allows relentless in a new round and re-arms at the new round', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)  // superiorityDice
                .mockReturnValueOnce(2); // relentlessUsedRound — latched last round
            getCurrentCombatRound.mockReturnValue(5);
            evaluateAutoExpression.mockReturnValue(4);
            rollExpression.mockReturnValue({ total: 4, rolls: [4] });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerWithRelentless(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Rolled d4 for 4');
            expect(result.payload.description).toContain('(Relentless)');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'relentlessUsedRound',
                5,
                'test-campaign'
            );
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                expect.any(Number),
                'test-campaign'
            );
        });

        it('uses dieExpression from action when available for relentless', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(null);
            getCurrentCombatRound.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(4);
            rollExpression.mockReturnValue({ total: 3, rolls: [3] });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(
                makeAction({ automation: { dieExpression: '1d4' } }),
                makePlayerWithRelentless(),
                'test-campaign',
                null
            );

            expect(evaluateAutoExpression).toHaveBeenCalledWith('1d4', expect.any(Object));
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(result.payload.description).toContain('Rolled d3 for 3');
        });

        it('falls back to superiority_die when no dieExpression for relentless', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(null);
            getCurrentCombatRound.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(4);
            rollExpression.mockReturnValue({ total: 2, rolls: [2] });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerWithRelentless(), 'test-campaign', null);

            expect(evaluateAutoExpression).toHaveBeenCalledWith('superiority_die', expect.any(Object));
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(result.payload.description).toContain('Rolled d2 for 2');
        });

        it('handles rollExpression returning null for relentless', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(null);
            getCurrentCombatRound.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(4);
            rollExpression.mockReturnValue(null);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerWithRelentless(), 'test-campaign', null);

            expect(result.payload.description).toContain('Rolled d4 for 4');
        });
    });
});
