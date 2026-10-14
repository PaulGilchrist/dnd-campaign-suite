import { handle } from './shadowyDodgeHandler.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as logService from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
    rollbackDamage: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ round: 1, creatures: [] }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

const APPLIED_ATTACK_KEY = '_ShadowyDodge_appliedAttack';
const USED_ROUND_KEY = '_ShadowyDodge_usedRound';

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Rogue',
    level: 15,
    ...overrides,
});

const makeAction = (overrides = {}) => ({
    name: 'Shadowy Dodge',
    automation: {
        type: 'shadowy_dodge',
        trigger: 'after_attack_roll_against_you',
        range: '30_ft',
        casting_time: '1 reaction',
        ...overrides.automation,
    },
    ...overrides,
});

function makeAttack(overrides = {}) {
    return {
        attackEvent: { timestamp: 5000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14, ...overrides.attackEvent },
        attackerName: 'Goblin',
        targetName: 'Test Rogue',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['slashing'],
        ...overrides.result,
    };
}

describe('shadowyDodgeHandler', () => {
    let originalRandom;

    beforeEach(() => {
        vi.clearAllMocks();
        originalRandom = Math.random;
        Math.random = vi.fn();
        getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
        getRuntimeValue.mockReturnValue(undefined);
        isWithinRange.mockResolvedValue(true);
        damageRollback.rollbackDamage.mockResolvedValue(0);
    });

    afterAll(() => {
        Math.random = originalRandom;
    });

    function mockRandom(values) {
        let index = 0;
        Math.random.mockImplementation(() => values[index++] ?? 0.5);
    }

    describe('handle', () => {
        it('should return popup when no recent attack exists (null result or null attackEvent)', async () => {
            damageRollback.findLastAttack.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack roll against you found');
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should propagate error when findLastAttack throws', async () => {
            damageRollback.findLastAttack.mockRejectedValue(new Error('database error'));

            await expect(handle(makeAction(), makePlayerStats(), 'test-campaign', null))
                .rejects.toThrow('database error');
        });

        it('should simulate disadvantage and show miss when second roll causes failure', async () => {
            mockRandom([0.05]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack());

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Shadowy Dodge');
            expect(result.payload.description).toContain('Attacker: Goblin');
            expect(result.payload.description).toContain('Original roll: d20(15)');
            expect(result.payload.description).toContain('Disadvantage (second d20:');
            expect(result.payload.description).toContain('Teleported 30 feet');
            expect(result.payload.description).toContain('now misses');
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Rogue',
                abilityName: 'Shadowy Dodge',
            }));
        });

        it('should show "still hits" when disadvantage attack also hits and not rollback damage', async () => {
            mockRandom([0.95]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                attackEvent: { d20: 18, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
                result: { attackerName: 'Orc', primaryDamage: 12, totalDamage: 12, damageTypes: ['bludgeoning'] },
            }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Orc');
            expect(result.payload.description).toContain('still hits');
            expect(result.payload.description).toContain('Teleported 30 feet');
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should show "already missed" when original attack missed', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                attackEvent: { d20: 3, bonus: 2, targetAc: 14, hit: false, effectiveAc: 14 },
                result: { primaryDamage: 0, totalDamage: 0, damageTypes: [] },
            }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('already missed');
            expect(result.payload.description).toContain('Disadvantage has no additional effect');
            expect(result.payload.description).toContain('Teleported 30 feet');
        });

        it('should rollback damage and show negated message when hit→miss', async () => {
            mockRandom([0.05]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack());
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith('Goblin', 'Test Rogue', 'test-campaign', 'Shadowy Dodge');
            expect(result.payload.description).toContain('Damage negated: 10 HP restored');
            expect(result.payload.description).toContain('Teleported 30 feet');
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('10 damage was negated'),
            }));
        });

        it('should use effectiveAc when present, falling back to targetAc', async () => {
            mockRandom([0.5, 0.5]);

            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                attackEvent: { timestamp: 5000, d20: 10, bonus: 5, targetAc: 13, hit: true, effectiveAc: 16 },
            }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('vs AC 16');

            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                attackEvent: { timestamp: 6000, d20: 10, bonus: 5, targetAc: 13, hit: true, effectiveAc: undefined },
            }));

            const result2 = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result2.payload.description).toContain('vs AC 13');
        });

        it('should use custom action name when provided', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack());

            const result = await handle(makeAction({ name: 'Custom Dodge' }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Custom Dodge');
            expect(result.payload.description).toContain('<b>Custom Dodge</b>');
        });

        it('should log ability_use with attacker as targetName', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                result: { attackerName: 'Red Dragon', primaryDamage: 15, secondaryDamage: 5, totalDamage: 20, damageTypes: ['fire'] },
            }));

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Rogue',
                abilityName: 'Shadowy Dodge',
                targetName: 'Red Dragon',
                description: expect.stringContaining('used Shadowy Dodge (Reaction) on Red Dragon'),
            }));
        });

        it('should handle addEntry rejection gracefully without throwing', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack());
            logService.addEntry.mockRejectedValue(new Error('log write failed'));

            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Shadowy Dodge');
            expect(result.payload.description).toContain('Teleported 30 feet');
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Rogue',
                abilityName: 'Shadowy Dodge',
            }));
            expect(consoleSpy).toHaveBeenCalledWith('[shadowyDodge] Error:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should use default featureName when action.name is falsy', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack());

            const result = await handle({ automation: {} }, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Shadowy Dodge');
            expect(result.payload.description).toContain('<b>Shadowy Dodge</b>');
        });

        it('should use "Unknown creature" when attackerName is missing', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                result: { attackerName: null },
            }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Attacker: Unknown creature');
        });

        it('should handle null AC (effectiveAc and targetAc both absent)', async () => {
            mockRandom([0.05]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                attackEvent: { timestamp: 5000, d20: 10, bonus: 5, hit: true, targetAc: undefined, effectiveAc: undefined },
            }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('vs AC —');
            expect(result.payload.description).toContain('N/A');
            expect(result.payload.description).toContain('Teleported 30 feet');
        });
    });

    describe('CLA-310 reaction gates', () => {
        beforeEach(() => {
            isWithinRange.mockResolvedValue(true);
            getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
            getRuntimeValue.mockReturnValue(undefined);
        });

        it('first dodge fires, stamps the attack-instance + round latches, and logs once', async () => {
            mockRandom([0.05]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({ attackEvent: { timestamp: 7000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }));
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('now misses');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Rogue', APPLIED_ATTACK_KEY, '7000', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Rogue', USED_ROUND_KEY, 1, 'test-campaign');
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
        });

        it('refuses a second click on the SAME attack instance: Reaction already used, no roll, no heal, no log', async () => {
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({ attackEvent: { timestamp: 7000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === APPLIED_ATTACK_KEY) return '7000';
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Reaction already used');
            expect(result.payload.description).toContain('already dodged this attack roll');
            expect(Math.random).not.toHaveBeenCalled();
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses a NEW attack in the same round (round latch) without rolling', async () => {
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({ attackEvent: { timestamp: 8000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === USED_ROUND_KEY) return 1;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('already used Shadowy Dodge this round');
            expect(result.payload.description).toContain('Reaction is spent');
            expect(Math.random).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('re-arms on a different attack in a later round', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({ attackEvent: { timestamp: 9000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }));
            getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === APPLIED_ATTACK_KEY) return '7000';
                if (key === USED_ROUND_KEY) return 1;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Disadvantage (second d20:');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Rogue', APPLIED_ATTACK_KEY, '9000', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Rogue', USED_ROUND_KEY, 2, 'test-campaign');
        });

        it('still refuses the stale dodged attack even in a later round', async () => {
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({ attackEvent: { timestamp: 7000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }));
            getCombatContext.mockResolvedValue({ round: 3, creatures: [] });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === APPLIED_ATTACK_KEY) return '7000';
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Reaction already used');
            expect(Math.random).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when the holder was not the target (target gate unchanged)', async () => {
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({ result: { targetName: 'HexWarlock' } }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('No recent attack roll against you found');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('refuses when the attacker is the holder (stale self-overwritten lastAttack)', async () => {
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                attackEvent: { timestamp: 7000, attackerName: 'Test Rogue', targetName: 'Test Rogue', d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
                result: { attackerName: 'Test Rogue' },
            }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('cannot attack yourself');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('refuses when the attacker is beyond 30 feet on an active map', async () => {
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({ attackEvent: { timestamp: 7000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }));
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('not within 30 feet');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('falls back to roll-signature identity when lastAttack has no timestamp', async () => {
            mockRandom([0.5]);
            damageRollback.findLastAttack.mockResolvedValue(makeAttack({
                attackEvent: { timestamp: undefined, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
            }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Disadvantage (second d20:');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Rogue', APPLIED_ATTACK_KEY, 'd20:15+7:Goblin', 'test-campaign');
        });
    });
});
