// @improved-by-ai
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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getMonsterData } = await import('../../../../services/npcs/monsterUtils.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../../services/rules/combat/damageUtils.js');
const { addEntry } = await import('../../../ui/logService.js');

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
        it('returns error popup with exact message when no superiority dice remaining', async () => {
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

        it('returns error popup when stored value is 0 (not null)', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('proceeds when 1 superiority die available', async () => {
            getRuntimeValue.mockReturnValue(1);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
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

        it('defaults to uses_max when no stored value (null)', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Expend 1 Superiority Die');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                3,
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('expend dice uses uses_max from action when stored value is null', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue(null);

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
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('treats string "0" as zero dice (no expenditure)', async () => {
            getRuntimeValue.mockReturnValue('0');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Superiority Dice remaining');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('dice expenditure', () => {
        it('decrements superiority dice by 1', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'superiorityDice',
                2,
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('does not expenditure when error popup is returned', async () => {
            getRuntimeValue.mockReturnValue(0);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('target lookup', () => {
        it('looks up monster data for combat target and includes immunities/resistances/condition immunities', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getMonsterData.mockResolvedValue({
                name: 'Goblin',
                damage_immunities: ['cold'],
                damage_resistances: ['bludgeoning'],
                damage_vulnerabilities: ['piercing'],
                condition_immunities: ['poisoned'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(getMonsterData).toHaveBeenCalledWith('Goblin', null);
            expect(result.payload.description).toContain('Target: Goblin');
            expect(result.payload.description).toContain('Immunities: cold');
            expect(result.payload.description).toContain('Resistances: bludgeoning');
            expect(result.payload.description).toContain('Vulnerabilities: piercing');
            expect(result.payload.description).toContain('Condition Immunities: poisoned');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
                description: expect.stringContaining('Know Your Enemy used by TestFighter against Goblin'),
            }));
        });

        it('handles target not in combat (no combat context)', async () => {
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
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('handles target not in combat when combat context is empty object', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Target: None (not in combat)');
            expect(result.payload.description).toContain('No monster data found for target');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('handles monster data lookup failure', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'PlayerCharacter' });
            getMonsterData.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('No monster data found for target');
            expect(result.payload.description).toContain('player character');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('handles monster with no immunities/resistances/vulnerabilities/conditionImmunities', async () => {
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
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('handles monster data missing vulnerability field', async () => {
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
            expect(result.payload.description).not.toContain('Vulnerabilities:');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('handles combat context throw and still expends dice', async () => {
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
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('handles monster data lookup throw', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'MysteryCreature' });
            getMonsterData.mockRejectedValue(new Error('not found'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Target: MysteryCreature');
            expect(result.payload.description).toContain('No monster data found for target');
            expect(result.payload.description).toContain('player character');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });

        it('handles multiple immunities and resistances', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Lich' });
            getMonsterData.mockResolvedValue({
                name: 'Lich',
                damage_immunities: ['cold', 'radiant', 'necrotic'],
                damage_resistances: ['acid', 'fire'],
                damage_vulnerabilities: ['piercing'],
                condition_immunities: ['charmed', 'exhaustion', 'frightened'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Immunities: cold, radiant, necrotic');
            expect(result.payload.description).toContain('Resistances: acid, fire');
            expect(result.payload.description).toContain('Vulnerabilities: piercing');
            expect(result.payload.description).toContain('Condition Immunities: charmed, exhaustion, frightened');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Know Enemy',
            }));
        });
    });

    describe('result format', () => {
        it('returns popup with correct payload fields', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Know Enemy');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('includes range in description', async () => {
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

        it('uses default range when not provided', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(
                makeAction({ automation: {} }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.description).toContain('Range: 30 ft');
        });

        it('throws when automation is null', async () => {
            await expect(
                handle(makeAction({ automation: null }), makePlayerStats(), 'test-campaign', null)
            ).rejects.toThrow('Cannot read properties of null');
        });

        it('includes action name in description', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Know Enemy: Expend 1 Superiority Die');
        });
    });
});
