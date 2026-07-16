import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, hasGloriousDefenseActive } from './gloriousDefenseHandler.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as logService from '../../../ui/logService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as infoPopupModule from '../../common/infoPopup.js';

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
    rollbackDamage: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/infoPopup.js', () => ({
    infoPopup: vi.fn((name, description, automation, extraProps) => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name,
                description,
                automation,
            },
        };
        if (extraProps) {
            Object.assign(result, extraProps);
        }
        return result;
    }),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

const campaignName = 'test-campaign';
const playerName = 'Test Paladin';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 7,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        attacks: [
            { name: 'Longsword', type: 'Action', range: 5, hitBonus: 7, damage: '1d8+3', damageType: 'Slashing' },
        ],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Glorious Defense',
        automation: {
            type: 'glorious_defense',
            effect: 'ac_bonus',
            range: '10_ft',
            casting_time: '1 reaction',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('gloriousDefenseHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'gloriousDefenseUses') return 4;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        damageRollback.rollbackDamage.mockResolvedValue(0);
    });

    describe('handle — no uses remaining', () => {
        it('should deny when uses are 0', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'gloriousDefenseUses') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
        });
    });

    describe('handle — no recent attack', () => {
        it('should deny when no attack event exists', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll found');
        });

        it('should deny when attack dealt no damage', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('dealt no damage');
        });

        it('should allow attacks targeting any creature within range', async () => {
            // d20(15) + 7 = 22 vs newAc(16+3=19) → still hits
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: 'Ally Character',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('still hits despite your Glorious Defense');
            expect(result.payload.description).toContain('Ally Character');
        });
    });

    describe('handle — CHA bonus not enough', () => {
        it('should show popup when attack still hits with CHA modifier', async () => {
            // d20(15) + 7 = 22 vs newAc(16+3=19) → still hits
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('still hits despite your Glorious Defense');
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handle — attack already missed', () => {
        it('should show popup when original attack already missed', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 3, bonus: 2, targetAc: 16, hit: false },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 5,
                secondaryDamage: 0,
                totalDamage: 5,
                damageTypes: ['slashing'],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already missed');
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });
    });

    describe('handle — hit becomes miss (counterattack)', () => {
        it('should rollback damage and return attack_roll when CHA bonus causes miss', async () => {
            // d20(12) + 7 = 19 vs newAc(16+3=19) → still hits, need different values
            // Use d20(9) + 7 = 16 vs newAc(16+3=19) → miss!
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 9, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Longsword');
            expect(result.payload.targetName).toBe('Goblin');
            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith('Goblin', playerName, campaignName, 'Glorious Defense');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 3, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Glorious Defense',
                targetName: 'Goblin',
            }));
        });

        it('should use attackerName from lastAttack as counterattack target', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 9, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Red Dragon',
                targetName: playerName,
                primaryDamage: 15,
                secondaryDamage: 5,
                totalDamage: 20,
                damageTypes: ['fire', 'slashing'],
            });
            damageRollback.rollbackDamage.mockResolvedValue(20);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.targetName).toBe('Red Dragon');
        });

        it('should log damage negated when rollback succeeds', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 9, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('10 damage was negated'),
            }));
        });

        it('should handle zero damage rollback gracefully', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 9, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });
            damageRollback.rollbackDamage.mockResolvedValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('attack_roll');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 3, campaignName);
        });

        it('should fall back to first attack when no melee attacks available', async () => {
            const stats = makePlayerStats({
                attacks: [
                    { name: 'Longbow', type: 'Action', range: 150, hitBonus: 7, damage: '1d8+3' },
                ],
            });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 9, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.attack.name).toBe('Longbow');
        });

        it('should return popup when no attacks at all', async () => {
            const stats = makePlayerStats({ attacks: [] });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 9, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No melee attack available');
        });

        it('should use minimum +1 when CHA modifier is negative', async () => {
            const stats = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: -2 }] });
            // d20(16) + 7 = 23 vs newAc(16+1=17) → still hits
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 16, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Goblin',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('still hits');
            expect(result.payload.description).toContain('CHA modifier (1)');
        });

        it('should use attacker name from attack event when missing', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 9, bonus: 7, targetAc: 16, hit: true },
                attackerName: null,
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['slashing'],
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('attack_roll');
            expect(result.payload.targetName).toBe('Unknown creature');
        });
    });

    describe('handle — popup content', () => {
        it('should include attacker name in description', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Orc',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['bludgeoning'],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Orc');
        });

        it('should include d20 roll details in description', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Orc',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['bludgeoning'],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('d20(15)');
            expect(result.payload.description).toContain('+ 7');
        });

        it('should show new AC with CHA modifier in description', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Orc',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['bludgeoning'],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('vs AC 19');
        });

        it('should pass automation config through to popup', async () => {
            const action = makeAction();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Orc',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['bludgeoning'],
            });

            await handle(action, makePlayerStats(), campaignName, null);

            expect(infoPopupModule.infoPopup).toHaveBeenCalledWith('Glorious Defense', expect.any(String), action.automation);
        });
    });

    describe('handle — custom action name', () => {
        it('should use custom action name from action object', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: Date.now(), d20: 15, bonus: 7, targetAc: 16, hit: true },
                attackerName: 'Orc',
                targetName: playerName,
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['bludgeoning'],
            });

            const result = await handle(makeAction({ name: 'My Glorious Defense' }), makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('My Glorious Defense');
            expect(result.payload.description).toContain('<b>My Glorious Defense</b>');
        });
    });

    describe('hasGloriousDefenseActive', () => {
        it('should return true when subclass is Oath of Glory', () => {
            const stats = {
                class: { name: 'Paladin', major: { name: 'Oath of Glory' } },
            };
            expect(hasGloriousDefenseActive(stats)).toBe(true);
        });

        it('should return true when subclass field is used', () => {
            const stats = {
                class: { name: 'Paladin', subclass: { name: 'Oath of Glory' } },
            };
            expect(hasGloriousDefenseActive(stats)).toBe(true);
        });

        it('should return false for other Paladin subclasses', () => {
            const stats = {
                class: { name: 'Paladin', major: { name: 'Oath of Devotion' } },
            };
            expect(hasGloriousDefenseActive(stats)).toBe(false);
        });

        it('should return false for non-Paladins', () => {
            const stats = {
                class: { name: 'Cleric', major: { name: 'Life Domain' } },
            };
            expect(hasGloriousDefenseActive(stats)).toBe(false);
        });

        it('should handle null/undefined/empty inputs', () => {
            expect(hasGloriousDefenseActive(null)).toBe(false);
            expect(hasGloriousDefenseActive(undefined)).toBe(false);
            expect(hasGloriousDefenseActive({})).toBe(false);
            expect(hasGloriousDefenseActive({ class: {} })).toBe(false);
            expect(hasGloriousDefenseActive({ class: { name: 'Paladin' } })).toBe(false);
        });
    });
});
