// @improved-by-ai
import { handle } from './shadowyDodgeHandler.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as logService from '../../../ui/logService.js';
import * as infoPopupModule from '../../common/infoPopup.js';

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
    rollbackDamage: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/infoPopup.js', () => ({
    infoPopup: vi.fn((name, description, automation) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description,
            automation,
        },
    })),
}));

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

describe('shadowyDodgeHandler', () => {
    let originalRandom;

    beforeEach(() => {
        vi.clearAllMocks();
        originalRandom = Math.random;
        Math.random = vi.fn();
    });

    afterAll(() => {
        Math.random = originalRandom;
    });

    function mockRandom(values) {
        let index = 0;
        Math.random.mockImplementation(() => values[index++] ?? 0.5);
    }

    describe('handle', () => {
        it('should return popup when no recent attack exists or target does not match player', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack roll against you found');
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should simulate disadvantage and show miss when second roll causes failure', async () => {
            mockRandom([0.05]);
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });

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

        it('should show "still hits" when disadvantage attack also hits', async () => {
            mockRandom([0.95]);
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 18, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
                attackerName: 'Orc',
                targetName: 'Test Rogue',
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['bludgeoning'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Orc');
            expect(result.payload.description).toContain('still hits');
        });

        it('should show "already missed" when original attack missed', async () => {
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 3, bonus: 2, targetAc: 14, hit: false, effectiveAc: 14 },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('already missed');
            expect(result.payload.description).toContain('Disadvantage has no additional effect');
        });

        it('should use effectiveAc when present, falling back to targetAc', async () => {
            mockRandom([0.5]);
            const freshTimestamp = Date.now();

            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 10, bonus: 5, targetAc: 13, hit: true, effectiveAc: 16 },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 6,
                secondaryDamage: 0,
                totalDamage: 6,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('vs AC 16');

            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 10, bonus: 5, targetAc: 13, hit: true },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 6,
                secondaryDamage: 0,
                totalDamage: 6,
                damageTypes: [],
            });

            const result2 = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result2.payload.description).toContain('vs AC 13');
        });

        it('should use custom action name when provided', async () => {
            mockRandom([0.5]);
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 10, bonus: 5, targetAc: 13, hit: true },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 6,
                secondaryDamage: 0,
                totalDamage: 6,
                damageTypes: [],
            });

            const result = await handle(makeAction({ name: 'Custom Dodge' }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Custom Dodge');
            expect(result.payload.description).toContain('<b>Custom Dodge</b>');
        });

        it('should log ability_use with attacker as targetName', async () => {
            mockRandom([0.5]);
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 10, bonus: 5, targetAc: 13, hit: true },
                attackerName: 'Red Dragon',
                targetName: 'Test Rogue',
                primaryDamage: 15,
                secondaryDamage: 5,
                totalDamage: 20,
                damageTypes: ['fire'],
            });

            await handle(makeAction(), makePlayerStats(), 'my-campaign', null);

            expect(logService.addEntry).toHaveBeenCalledWith('my-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Rogue',
                abilityName: 'Shadowy Dodge',
                targetName: 'Red Dragon',
            }));
        });

        it('should rollback damage and show negated message when hit→miss', async () => {
            mockRandom([0.05]);
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith('Goblin', 'Test Rogue', 'test-campaign', 'Shadowy Dodge');
            expect(result.payload.description).toContain('Damage negated: 10 HP restored');
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('10 damage was negated'),
            }));
        });

        it('should not call rollbackDamage when original attack already missed', async () => {
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 3, bonus: 2, targetAc: 14, hit: false, effectiveAc: 14 },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should not call rollbackDamage when attack still hits with disadvantage', async () => {
            mockRandom([0.95]);
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 18, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
                attackerName: 'Orc',
                targetName: 'Test Rogue',
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['bludgeoning'],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should pass automation config through to popup payload', async () => {
            mockRandom([0.5]);
            const freshTimestamp = Date.now();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: freshTimestamp, d20: 10, bonus: 5, targetAc: 13, hit: true },
                attackerName: 'Goblin',
                targetName: 'Test Rogue',
                primaryDamage: 6,
                secondaryDamage: 0,
                totalDamage: 6,
                damageTypes: [],
            });

            const action = makeAction();
            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(infoPopupModule.infoPopup).toHaveBeenCalledWith('Shadowy Dodge', expect.any(String), action.automation);
        });
    });
});
