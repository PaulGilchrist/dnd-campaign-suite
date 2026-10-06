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
    handleFiresBurn,
    handleFiresBurnDirect,
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
    describe('handleFiresBurn', () => {
        const option = { name: "Fire's Burn", type: 'damage', damage: '1d10', damageType: 'Fire' };

        it('deals damage and consumes use', async () => {
            makeUsesMock('firesBurnUses', 3);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Fire's Burn");
            expect(result.payload.damageType).toBe('Fire');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'firesBurnUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                targetName: 'Goblin',
                damageType: 'Fire',
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('firesBurnUses', 0);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
    describe('handleFiresBurnDirect', () => {
        const directAction = {
            name: "Fire's Burn",
            automation: {
                type: 'fire_burn',
                damage: '1d10',
                damageType: 'Fire',
                trigger: 'hit',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 action',
            },
        };

        it('deals damage and consumes use', async () => {
            makeUsesMock('firesBurnUses', 3);
            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Fire's Burn");
            expect(result.payload.damageType).toBe('Fire');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'firesBurnUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                targetName: 'Goblin',
                damageType: 'Fire',
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('firesBurnUses', 0);
            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
});
