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
        it('should return null when Create Thrall feature not present', async () => {
            const playerStats = {
                name: 'TestWarlock',
                level: 5,
                class: { class_levels: [{ features: [] }] },
            };

            const result = await handle(makeAction(), playerStats, 'campaign');

            expect(result).toBeNull();
        });

        it('should check both class and subclass features', async () => {
            damageUtils.getCombatContext.mockReturnValue({
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

            expect(result).not.toBeNull();
        });

        it('should return null when tempHp is zero or negative', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            const playerStats = {
                name: 'TestWarlock',
                level: 1,
                class: { class_levels: [{ features: [{ name: 'Create Thrall' }] }] },
                abilities: [
                    { name: 'Charisma', bonus: -10 },
                ],
            };

            const result = await handle(makeAction({ tempHpExpression: 'warlock level + CHA modifier' }), playerStats, 'campaign');

            expect(result).toBeNull();
        });

        it('should return null when no combat context', async () => {
            damageUtils.getCombatContext.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toBeNull();
        });

        it('should return null when no companion found', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                creatures: [{ name: 'Goblin' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toBeNull();
        });

        it('should apply temp HP when companion found', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                creatures: [{ name: 'Aberrant Spirit Companion' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction({ tempHpExpression: '10' }), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Temporary Hit Points');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit Companion',
                '_Aberrant_Spirit_Companion_tempHp',
                10,
                'campaign'
            );
        });

        it('should add campaign log entry', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                creatures: [{ name: 'Aberration Companion' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            await handle(makeAction({ tempHpExpression: '5' }), makePlayerStats(), 'campaign');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: 'Create Thrall',
            }));
        });

        it('should evaluate expression with warlock level and CHA modifier', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction({ tempHpExpression: 'warlock level + CHA modifier' }), makePlayerStats(), 'campaign');

            expect(result).not.toBeNull();
        });

        it('should fall back to dice rolling when expression evaluation fails', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                creatures: [{ name: 'Aberrant Spirit' }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            await handle(makeAction({ tempHpExpression: 'invalid expression !!!' }), makePlayerStats(), 'campaign');

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('invalid expression !!!');
        });

        it('should accumulate temp HP on existing value', async () => {
            damageUtils.getCombatContext.mockReturnValue({
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

        it('should handle companion name with special characters', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                creatures: [{ name: "Aberration's Spirit" }],
            });

            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction({ tempHpExpression: '5' }), makePlayerStats(), 'campaign');

            expect(result).not.toBeNull();
        });
    });
});
