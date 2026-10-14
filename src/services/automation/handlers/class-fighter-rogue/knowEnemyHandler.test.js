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

describe('knowEnemyHandler', () => {
    describe('superiority dice checks', () => {
        it('returns error popup when no superiority dice remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Know Enemy');
            expect(result.payload.description).toBe(
                'Know Enemy: No Superiority Dice remaining. Recharges on a Short or Long Rest.'
            );
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

        it('uses defaultMax or custom uses_max from action when stored value is null', async () => {
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
    });

    describe('target lookup', () => {
        it('looks up monster data for combat target and includes immunities/resistances/vulnerabilities/condition immunities (2024 damage_* schema)', async () => {
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

        it('reveals IRV for legacy-schema monsters storing immunities/resistances/vulnerabilities (CLA-207 Shadow shape)', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Shadow 1' });
            // Real monsters.json "Shadow" entry — no damage_* keys at all;
            // conditions and damage types are mixed inside `immunities`.
            getMonsterData.mockResolvedValue({
                name: 'Shadow',
                immunities: ['Necrotic', 'Poison', 'Exhaustion', 'Frightened', 'Grappled',
                    'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Unconscious'],
                resistances: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
                vulnerabilities: ['Radiant'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Target: Shadow 1');
            expect(result.payload.description).toContain('Immunities: Necrotic, Poison');
            expect(result.payload.description).toContain('Resistances: Acid, Cold, Fire, Lightning, Thunder');
            expect(result.payload.description).toContain('Vulnerabilities: Radiant');
            expect(result.payload.description).toContain('Condition Immunities: Exhaustion, Frightened, Grappled, Paralyzed, Petrified, Poisoned, Prone, Restrained, Unconscious');
            expect(result.payload.description).not.toContain('No immunities, resistances, vulnerabilities, or condition immunities.');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
                description: expect.stringContaining('Immunities: Necrotic, Poison'),
            }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('Vulnerabilities: Radiant'),
            }));
        });

        it('falls back to legacy immunities when damage_immunities key exists but is empty', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Draconic Spirit' });
            // Real monsters.json "Draconic Spirit" — damage_* keys present but empty,
            // legacy immunities populated with condition names.
            getMonsterData.mockResolvedValue({
                name: 'Draconic Spirit',
                damage_immunities: [],
                damage_resistances: ['acid', 'cold', 'fire', 'lightning', 'poison'],
                damage_vulnerabilities: [],
                condition_immunities: [],
                immunities: ['charmed', 'frightened', 'poisoned'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Resistances: acid, cold, fire, lightning, poison');
            expect(result.payload.description).toContain('Condition Immunities: charmed, frightened, poisoned');
            expect(result.payload.description).not.toContain('No immunities, resistances, vulnerabilities, or condition immunities.');
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

        it('handles monster data lookup failure', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'PlayerCharacter' });
            getMonsterData.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('No monster data found for target');
            expect(result.payload.description).toContain('player character');
        });

        it('handles monster with no immunities/resistances/vulnerabilities/condition immunities', async () => {
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
            getCombatContext.mockRejectedValue(new Error('fail'));

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

        it('handles monster data lookup error', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'MysteryCreature' });
            getMonsterData.mockRejectedValue(new Error('not found'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Target: MysteryCreature');
            expect(result.payload.description).toContain('No monster data found for target');
            expect(result.payload.description).toContain('player character');
        });
    });

    describe('result format', () => {
        it('uses custom range when provided, defaults to 30 ft otherwise', async () => {
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

        it('throws when automation is null', async () => {
            await expect(
                handle({ name: 'Know Enemy', automation: null }, makePlayerStats(), 'test-campaign', null)
            ).rejects.toThrow();
        });
    });

    describe('relentless feature', () => {
        it('does not use relentless when superiority dice are available', async () => {
            getRuntimeValue
                .mockReturnValueOnce(1)
                .mockReturnValueOnce(null);

            const playerWithRelentless = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            });

            const result = await handle(makeAction(), playerWithRelentless, 'test-campaign', null);

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

        it('detects relentless passive when present in automation.passives', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(null);
            getCurrentCombatRound.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const playerWithRelentless = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            });

            const result = await handle(makeAction(), playerWithRelentless, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
            expect(result.payload.description).toContain('Rolled d');
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
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(3);
            getCurrentCombatRound.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const playerWithRelentless = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            });

            const result = await handle(makeAction(), playerWithRelentless, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Know Enemy: No Superiority Dice remaining. Recharges on a Short or Long Rest.'
            );
        });

        it('allows relentless in a new round', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(null);
            getCurrentCombatRound.mockReturnValue(5);
            evaluateAutoExpression.mockReturnValue(4);
            rollExpression.mockReturnValue({ total: 3, rolls: [3] });
            getCombatContext.mockResolvedValue(null);

            const playerWithRelentless = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            });

            const result = await handle(makeAction(), playerWithRelentless, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Rolled d');
            expect(result.payload.description).toContain('(Relentless)');
        });

        it('uses dieExpression from action when available for relentless', async () => {
            getRuntimeValue
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(null);
            getCurrentCombatRound.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(4);
            rollExpression.mockReturnValue({ total: 3, rolls: [3] });
            getCombatContext.mockResolvedValue(null);

            const playerWithRelentless = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            });

            const result = await handle(
                makeAction({ automation: { dieExpression: '1d4' } }),
                playerWithRelentless,
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

            const playerWithRelentless = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            });

            const result = await handle(makeAction(), playerWithRelentless, 'test-campaign', null);

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

            const playerWithRelentless = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'relentless' },
                    ],
                },
            });

            const result = await handle(makeAction(), playerWithRelentless, 'test-campaign', null);

            expect(result.payload.description).toContain('Rolled d4 for 4');
        });
    });

    describe('logging', () => {
        it('handles addEntry rejection gracefully', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);
            addEntry.mockReturnValue(Promise.reject(new Error('log failed')));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Know Enemy');
        });
    });

    describe('combat context edge cases', () => {
        it('handles combat context existing but no target found', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Target: None (not in combat)');
            expect(result.payload.description).toContain('No monster data found for target');
        });

        it('handles playerStats without automation property', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), { name: 'TestFighter' }, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
        });
    });
});
