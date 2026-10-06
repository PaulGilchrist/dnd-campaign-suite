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

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
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
    // CLA-169: attackerRollGate (shared Fire's Burn lane, CLA-141) requires
    // attackEvent.hit===true — the valid trigger is a HIT that dealt damage.
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
    handleHillsTumble,
    handleHillsTumbleDirect,
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
    describe('handleHillsTumble', () => {
        const option = { name: "Hill's Tumble", type: 'auto_effect', trigger: 'melee_hit', effect: 'disadvantage_next_attack' };

        it('applies disadvantage_next_attack targetEffect', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'hillsTumbleUses') return 3;
                return null;
            });
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Goblin');
            expect(result.payload.description).toContain('Disadvantage');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hillsTumbleUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestHero',
                    // CLA-169: RAW duration "before the end of its next turn"
                    duration: 'until_end_of_next_turn',
                }),
            ]), 'campaign', true);
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Hill's Tumble",
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'condition',
                targetName: 'Goblin',
                condition: 'Disadvantage on next attack',
                source: "Hill's Tumble",
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue(null);
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('replaces existing disadvantage_next_attack from same source', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'hillsTumbleUses') return 3;
                if (key === 'targetEffects') return [
                    { target: 'Goblin', effect: 'disadvantage_next_attack', source: 'TestHero' },
                ];
                return null;
            });
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Disadvantage');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hillsTumbleUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestHero',
                    // CLA-169: RAW duration "before the end of its next turn"
                    duration: 'until_end_of_next_turn',
                }),
            ]), 'campaign', true);
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('hillsTumbleUses', 0);
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
    describe('handleHillsTumbleDirect', () => {
        const directAction = {
            name: "Hill's Tumble",
            automation: {
                type: 'hills_tumble',
                trigger: 'melee_hit',
                effect: 'disadvantage_next_attack',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 action',
            },
        };

        it('applies disadvantage_next_attack targetEffect', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'hillsTumbleUses') return 3;
                return null;
            });
            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Goblin');
            expect(result.payload.description).toContain('Disadvantage');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hillsTumbleUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestHero',
                    // CLA-169: RAW duration "before the end of its next turn"
                    duration: 'until_end_of_next_turn',
                }),
            ]), 'campaign', true);
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Hill's Tumble",
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'condition',
                targetName: 'Goblin',
                condition: 'Disadvantage on next attack',
                source: "Hill's Tumble",
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue(null);
            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('replaces existing disadvantage_next_attack from same source', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'hillsTumbleUses') return 3;
                if (key === 'targetEffects') return [
                    { target: 'Goblin', effect: 'disadvantage_next_attack', source: 'TestHero' },
                ];
                return null;
            });
            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Disadvantage');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'hillsTumbleUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestHero',
                    // CLA-169: RAW duration "before the end of its next turn"
                    duration: 'until_end_of_next_turn',
                }),
            ]), 'campaign', true);
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('hillsTumbleUses', 0);
            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
});
