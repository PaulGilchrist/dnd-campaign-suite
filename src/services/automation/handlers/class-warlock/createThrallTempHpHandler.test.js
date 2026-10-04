// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './createThrallTempHpHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    const { name: actionName, ...automationOverrides } = overrides;
    return {
        name: actionName || 'Create Thrall',
        automation: { type: 'create_thrall', ...automationOverrides },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWarlock',
        level: 14,
        class: {
            class_levels: [{ features: [{ name: 'Create Thrall' }] }],
        },
        abilities: [
            { name: 'Strength', bonus: 4 },
            { name: 'Dexterity', bonus: 3 },
            { name: 'Constitution', bonus: 5 },
            { name: 'Intelligence', bonus: 2 },
            { name: 'Wisdom', bonus: 3 },
            { name: 'Charisma', bonus: 5 },
        ],
        ...overrides,
    };
}

describe('createThrallTempHpHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('feature detection', () => {
        it('should return null when Create Thrall feature not present in class or subclass features', async () => {
            const playerStats = {
                name: 'TestWarlock',
                level: 14,
                class: {
                    class_levels: [{ features: [] }],
                    subclass: { class_levels: [{ features: [] }] },
                },
            };

            const result = await handle(makeAction(), playerStats, campaignName);

            expect(result).toBeNull();
        });

        it('should find Create Thrall in subclass features when not in class features', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const playerStats = {
                name: 'TestWarlock',
                level: 14,
                class: {
                    class_levels: [{ features: [] }],
                    subclass: { class_levels: [{ features: [{ name: 'Create Thrall' }] }] },
                },
                abilities: [{ name: 'Charisma', bonus: 5 }],
            };

            const result = await handle(makeAction(), playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Aberrant Spirit');
        });

        it('should return null when playerStats has no class structure', async () => {
            const result = await handle(makeAction(), { name: 'TestWarlock' }, campaignName);

            expect(result).toBeNull();
        });
    });

    describe('temp HP expression evaluation', () => {
        it('should use default expression when tempHpExpression is not provided', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
        });

        it.each([
            ['warlock level', 'warlock level + CHA modifier'],
            ['warlock_level underscore', 'warlock_level + CHA modifier'],
            ['bare level', 'level + CHA modifier'],
            ['lowercase charisma modifier', 'warlock level + charisma modifier'],
        ])('should evaluate expression with "%s" keyword variant', async (_label, expression) => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(
                makeAction({ tempHpExpression: expression }),
                makePlayerStats(),
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('19 Temporary Hit Points');
        });

        it('should return null when temp HP expression evaluates to zero or negative', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            const playerStats = makePlayerStats({
                abilities: [{ name: 'Charisma', bonus: -20 }],
            });

            const result = await handle(
                makeAction({ tempHpExpression: 'warlock level + CHA modifier' }),
                playerStats,
                campaignName
            );

            expect(result).toBeNull();
        });

        it('should return null when expression evaluates to NaN', async () => {
            const result = await handle(
                makeAction({ tempHpExpression: '0 / 0' }),
                makePlayerStats(),
                campaignName
            );

            expect(result).toBeNull();
        });

        it('should fall back to diceRoller when expression syntax is invalid', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);
            diceRoller.rollExpression.mockReturnValue({ total: 7 });

            const result = await handle(
                makeAction({ tempHpExpression: 'this is not valid JS' }),
                makePlayerStats(),
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(diceRoller.rollExpression).toHaveBeenCalledWith('this is not valid JS');
        });
    });

    describe('combat context resolution', () => {
        it('should return null when no combat context available', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });

        it('should return null when no companion matching aberration found', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }, { name: 'Skeleton' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });

        it('should skip creatures with null name', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: null }, { name: undefined }, { name: 'Goblin' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });

        it('should find companion by case-insensitive "aberration" substring', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'my aberration friend' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('my aberration friend');
        });
    });

    describe('temp HP application', () => {
        it('should apply temp HP and return popup when companion found', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit Companion' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(
                makeAction({ tempHpExpression: '10' }),
                makePlayerStats(),
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Create Thrall');
            expect(result.payload.description).toContain('Aberrant Spirit Companion');
            expect(result.payload.description).toContain('10 Temporary Hit Points');
            expect(result.payload.automation).toEqual({ type: 'create_thrall', tempHpExpression: '10' });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit Companion',
                'tempHp',
                10,
                campaignName
            );
        });

        it('should keep higher existing temp HP instead of accumulating', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(5);

            await handle(
                makeAction({ tempHpExpression: '3' }),
                makePlayerStats(),
                campaignName
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit',
                'tempHp',
                5,
                campaignName
            );
        });

        it('should set new temp HP when it exceeds existing', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(3);

            await handle(
                makeAction({ tempHpExpression: '7' }),
                makePlayerStats(),
                campaignName
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit',
                'tempHp',
                7,
                campaignName
            );
        });

        it('should clamp negative calculated temp HP to zero and return null', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            const result = await handle(
                makeAction({ tempHpExpression: '-5' }),
                makePlayerStats(),
                campaignName
            );

            expect(result).toBeNull();
        });
    });

    describe('logging', () => {
        it('should add campaign log entry with correct details', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberration Companion' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            await handle(
                makeAction({ tempHpExpression: '5' }),
                makePlayerStats(),
                campaignName
            );

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: 'Create Thrall',
                description: 'Create Thrall: Aberration Companion gains 5 Temporary Hit Points.',
                timestamp: expect.any(Number),
            }));
        });

        it('should use custom action name in log entry', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            await handle(
                makeAction({ name: 'Custom Thrall' }),
                makePlayerStats(),
                campaignName
            );

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Custom Thrall',
                description: 'Custom Thrall: Aberrant Spirit gains 19 Temporary Hit Points.',
            }));
        });
    });
});
