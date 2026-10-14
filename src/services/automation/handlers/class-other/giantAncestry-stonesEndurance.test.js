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
    handleStonesEndurance,
    handleStonesEnduranceDirect,
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
    describe('handleStonesEndurance', () => {
        const option = { name: "Stone's Endurance", type: 'damage_reduction', reductionExpression: '1d10 + CON modifier' };

        it('heals when giant was target and took damage', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 15,
            });
            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('Healed');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'healing',
                characterName: 'TestHero',
            }));
        });

        it('returns popup when player was not the target', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            });

            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('you were the target');
        });

        it('returns popup when no damage was dealt', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 0,
            });

            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('took damage');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stonesEnduranceUses', 0);
            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('recent attack');
        });
    });
    describe('handleStonesEnduranceDirect', () => {
        const directAction = {
            name: "Stone's Endurance",
            automation: {
                type: 'stones_endurance',
                reductionExpression: '1d12 + CON modifier',
                trigger: 'damage_received',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 reaction',
            },
        };

        it('heals when giant was target and took damage', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 15,
            });
            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('Healed');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'healing',
                characterName: 'TestHero',
            }));
        });

        it('returns popup when player was not the target', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            });

            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('you were the target');
        });

        it('returns popup when no damage was dealt', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 0,
            });

            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('took damage');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stonesEnduranceUses', 0);
            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('recent attack');
        });
    });
});
