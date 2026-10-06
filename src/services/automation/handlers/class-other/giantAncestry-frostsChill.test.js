// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { vi } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 12, oldHp: 10, newHp: 22 })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'TestHero', hit: true },
        attackerName: 'TestHero',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['slashing'],
    })),
}));

beforeEach(() => { vi.resetAllMocks(); });
import { describe, it, expect } from 'vitest';
import {
    handleFrostsChill,
    handleFrostsChillDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

describe('giantAncestry selection & dispatch', () => {
    describe('handleFrostsChill', () => {
        const option = { name: "Frost's Chill", type: 'damage_with_condition', damage: '1d6', damageType: 'Cold', value: '10_ft' };

        it('deals damage and applies speed reduction', async () => {
            makeUsesMock('frostsChillUses', 3);
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Frost's Chill");
            expect(result.payload.damageType).toBe('Cold');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'frostsChillUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Goblin',
                damageType: 'Cold',
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'condition',
                targetName: 'Goblin',
                condition: 'speed_reduction',
                source: "Frost's Chill",
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('CLA-141 shared gate: refuses a MISS lastAttack with zero spend and logs frosts_chill_refused', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: false },
                attackerName: 'TestHero',
                targetName: 'Goblin',
                totalDamage: 0,
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('missed');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'frostsChillUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'frosts_chill_refused',
                name: "Frost's Chill",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('frostsChillUses', 0);
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
    describe('handleFrostsChillDirect', () => {
        const directAction = {
            name: "Frost's Chill",
            automation: {
                type: 'frosts_chill',
                damage: '1d6',
                damageType: 'Cold',
                condition: 'speed_reduction',
                value: '10_ft',
                trigger: 'hit',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 action',
            },
        };

        it('deals damage and applies speed reduction', async () => {
            makeUsesMock('frostsChillUses', 3);
            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Frost's Chill");
            expect(result.payload.damageType).toBe('Cold');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'frostsChillUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Goblin',
                damageType: 'Cold',
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'condition',
                targetName: 'Goblin',
                condition: 'speed_reduction',
                source: "Frost's Chill",
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('frostsChillUses', 0);
            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
});
