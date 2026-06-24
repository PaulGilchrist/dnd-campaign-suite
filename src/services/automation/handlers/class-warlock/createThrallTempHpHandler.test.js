// @improved-by-ai
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

const makeAction = (auto = {}) => ({
    name: 'Create Thrall',
    automation: { type: 'create_thrall', ...auto },
});

const makePlayerStats = (overrides = {}) => ({
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
});

describe('createThrallTempHpHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue({ total: 5 });
    });

    describe('handle', () => {
        it('should return null when Create Thrall feature not present in class features', async () => {
            const playerStats = {
                name: 'TestWarlock',
                level: 5,
                class: { class_levels: [{ features: [] }] },
            };

            const result = await handle(makeAction(), playerStats, 'campaign');

            expect(result).toBeNull();
        });

        it('should return null when Create Thrall feature not present in subclass features', async () => {
            const playerStats = {
                name: 'TestWarlock',
                level: 14,
                class: {
                    class_levels: [{ features: [] }],
                    subclass: { class_levels: [{ features: [] }] },
                },
            };

            const result = await handle(makeAction(), playerStats, 'campaign');

            expect(result).toBeNull();
        });

        it('should find Create Thrall in subclass features when not in class features', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            const playerStats = {
                name: 'TestWarlock',
                level: 14,
                class: {
                    class_levels: [{ features: [] }],
                    subclass: { class_levels: [{ features: [{ name: 'Create Thrall' }] }] },
                },
                abilities: [{ name: 'Charisma', bonus: 5 }],
            };

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), playerStats, 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Aberrant Spirit');
            expect(result.payload.description).toContain('Temporary Hit Points');
        });

        it('should return null when temp HP expression evaluates to zero', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            const playerStats = makePlayerStats({
                abilities: [
                    { name: 'Charisma', bonus: -10 },
                ],
            });

            const result = await handle(makeAction({ tempHpExpression: 'warlock level + CHA modifier' }), playerStats, 'campaign');

            expect(result).toBeNull();
        });

        it('should return null when temp HP expression evaluates to negative', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            const playerStats = makePlayerStats({
                abilities: [
                    { name: 'Charisma', bonus: -20 },
                ],
            });

            const result = await handle(makeAction({ tempHpExpression: 'warlock level + CHA modifier' }), playerStats, 'campaign');

            expect(result).toBeNull();
        });

        it('should return null when no combat context available', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toBeNull();
        });

        it('should return null when combat context has no creatures', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toBeNull();
        });

        it('should return null when no companion matching aberration found', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }, { name: 'Skeleton' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toBeNull();
        });

        it('should apply temp HP and return popup when companion found', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit Companion' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction({ tempHpExpression: '10' }), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Create Thrall');
            expect(result.payload.description).toContain('Aberrant Spirit Companion');
            expect(result.payload.description).toContain('10 Temporary Hit Points');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit Companion',
                '_Aberrant_Spirit_Companion_tempHp',
                10,
                'campaign'
            );
        });

        it('should use default expression when tempHpExpression is not provided', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('13 Temporary Hit Points');
        });

        it('should add campaign log entry with correct details', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberration Companion' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            await handle(makeAction({ tempHpExpression: '5' }), makePlayerStats(), 'campaign');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: 'Create Thrall',
                description: 'Create Thrall: Aberration Companion gains 5 Temporary Hit Points.',
                timestamp: expect.any(Number),
            }));
        });

        it('should evaluate expression with warlock level and CHA modifier', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction({ tempHpExpression: 'warlock level + CHA modifier' }), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('13 Temporary Hit Points');
        });

        it('should fall back to dice rolling when expression evaluation fails', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction({ tempHpExpression: 'invalid expression !!!' }), makePlayerStats(), 'campaign');

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('invalid expression !!!');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('5 Temporary Hit Points');
        });

        it('should accumulate temp HP on existing value', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(5);

            await handle(makeAction({ tempHpExpression: '3' }), makePlayerStats(), 'campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit',
                '_Aberrant_Spirit_tempHp',
                8,
                'campaign'
            );
        });

        it('should handle companion name with special characters in tempHpKey', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: "Aberration's Spirit" }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction({ tempHpExpression: '5' }), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                "Aberration's Spirit",
                "_Aberration's_Spirit_tempHp",
                5,
                'campaign'
            );
        });

        it('should return null when dice rolling also fails', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);
            diceRoller.rollExpression.mockReturnValue(undefined);

            const result = await handle(makeAction({ tempHpExpression: 'invalid !!!' }), makePlayerStats(), 'campaign');

            expect(result).toBeNull();
        });

        it('should handle missing class and subclass gracefully', async () => {
            const playerStats = {
                name: 'TestWarlock',
                level: 14,
            };

            const result = await handle(makeAction(), playerStats, 'campaign');

            expect(result).toBeNull();
        });

        it('should handle missing abilities array gracefully', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const playerStats = makePlayerStats({
                abilities: undefined,
            });

            const result = await handle(makeAction(), playerStats, 'campaign');

            expect(result.type).toBe('popup');
        });
    });
});
