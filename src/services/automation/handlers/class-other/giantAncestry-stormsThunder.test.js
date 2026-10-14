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
        attackEvent: { rollType: 'attack', attackerName: 'TestHero' },
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
    handleStormsThunder,
    handleStormsThunderDirect,
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
    describe('handleStormsThunder', () => {
        const option = { name: "Storm's Thunder", type: 'reaction_damage', damage: '1d8', damageType: 'Thunder', range: '60_ft' };

        it('deals thunder damage to attacker when giant was target', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 10,
            });
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.targetName).toBe('Orc');
            expect(result.payload.damageType).toBe('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Orc',
                damageType: 'Thunder',
            }));
        });

        it('returns popup when player was not the target', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            });

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('you were the target');
        });

        it('returns popup when no damage was dealt', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 0,
            });

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('took damage');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stormsThunderUses', 0);
            const stormsThunderOption = { name: "Storm's Thunder", type: 'reaction_damage', damage: '3d8', damageType: 'Thunder' };
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', stormsThunderOption);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('recent attack');
        });
    });
    describe('handleStormsThunderDirect', () => {
        const directAction = {
            name: "Storm's Thunder",
            automation: {
                type: 'storms_thunder',
                damage: '1d8',
                damageType: 'Thunder',
                range: '60_ft',
                trigger: 'damage_received_within_range',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 reaction',
            },
        };

        it('deals thunder damage to attacker when giant was target', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 10,
            });
            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.targetName).toBe('Orc');
            expect(result.payload.damageType).toBe('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Orc',
                damageType: 'Thunder',
            }));
        });

        it('returns popup when player was not the target', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            });

            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('you were the target');
        });

        it('returns popup when no damage was dealt', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 0,
            });

            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('took damage');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stormsThunderUses', 0);
            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('recent attack');
        });

        it('returns popup when no attackerName in lastAttack', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: null,
                targetName: 'TestHero',
                totalDamage: 10,
            });

            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });
    });
});
