// @maintained-by-ai: 2026-10-15 — deterministic mocked-seam lane; runtime store, dice,
// log, damage and findLastAttack are mocked, so only the Storm's Thunder handler
// composition runs under test. No churn needed unless the handler contract moves.
//
// REAL isWithinRange seam: unlike giantAncestry-stormsThunder.range.test.js (which
// mocks rangeCheck.js), this lane runs the REAL isWithinRange end-to-end. With the
// mocked runtime store there is no activeMapName, so it exercises the lenient
// no-grid/no-map fallback (rangeCheck.js:17) feeding the success lanes. If that
// fallback ever stops returning true, both success rows here fail — keep them.
//
// Range lane owns: range-arg pins (isWithinRange called with 60), the full-string
// stormsThunderRangeRefusal pin, and the ability_use spend log. Not duplicated here.
//
// Family recipe (mirrors giantAncestry-frostsChill.test.js): gate refusal branches
// are pinned ONCE, through dispatch — handleStormsThunder and handleStormsThunderDirect
// call the identical shared stormsThunderTargetGate / ancestryNoUsesPopup, so the
// direct lane keeps only its distinct log composition (lowercase 'thunder damage' via
// its own addEntry, vs the shared logAncestryDamageRoll helper's 'Thunder damage')
// plus one wiring refusal (the null-attackerName branch, pinned nowhere else).
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
import { rollExpression } from '../../../dice/diceRoller.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';

const option = { name: "Storm's Thunder", type: 'reaction_damage', damage: '1d8', damageType: 'Thunder', range: '60_ft' };

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

// Valid trigger: Orc hit TestHero for damage — the shared stormsThunderTargetGate
// passes and the REAL isWithinRange falls through its lenient no-map fallback.
function mockValidTriggerAgainstHero() {
    findLastAttack.mockResolvedValue({
        attackEvent: { rollType: 'attack', attackerName: 'Orc' },
        attackerName: 'Orc',
        targetName: 'TestHero',
        totalDamage: 10,
    });
}

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

describe('giantAncestry selection & dispatch', () => {
    describe('handleStormsThunder', () => {
        it('deals thunder damage to attacker when giant was target (real isWithinRange, lenient no-map fallback)', async () => {
            makeUsesMock('stormsThunderUses', 3);
            mockValidTriggerAgainstHero();
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'damage',
                    name: "Storm's Thunder",
                    formula: '1d8',
                    rolls: [5],
                    total: 5,
                    finalDamage: 5,
                    damageApplied: true,
                    targetName: 'Orc',
                    targetCurrentHp: 15,
                    damageType: 'Thunder',
                },
            });
            // One write only — the exact-key use spend (no targetEffects on this trait).
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(rollExpression).toHaveBeenCalledWith('1d8');
            // Shared logAncestryDamageRoll helper — capitalised 'Thunder damage'.
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                name: "Storm's Thunder Damage",
                targetName: 'Orc',
                damageType: 'Thunder',
                total: 5,
                formula: '1d8',
                rolls: [5],
                description: "TestHero used Storm's Thunder to deal 5 Thunder damage to Orc.",
            }));
        });

        it('refuses with zero spend when there is no lastAttack', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Storm's Thunder requires a recent attack where you were the target and took damage.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when the player was not the target', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            });

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Storm's Thunder can only be used when you were the target of the attack and took damage.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when no damage was dealt', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 0,
            });

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Storm's Thunder requires that you took damage from the attack. No damage was dealt.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with no gate probe and zero spend when no uses remain', async () => {
            makeUsesMock('stormsThunderUses', 0);
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Storm's Thunder has no uses remaining. Uses will reset on the next Long Rest.");
            expect(findLastAttack).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('handleStormsThunderDirect', () => {
        it('derives formula from action.automation, spends an exact-key use, and logs its own composition (real isWithinRange, lenient no-map fallback)', async () => {
            makeUsesMock('stormsThunderUses', 3);
            mockValidTriggerAgainstHero();
            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'damage',
                    name: "Storm's Thunder",
                    formula: '1d8',
                    rolls: [5],
                    total: 5,
                    finalDamage: 5,
                    damageApplied: true,
                    targetName: 'Orc',
                    targetCurrentHp: 15,
                    damageType: 'Thunder',
                },
            });
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(rollExpression).toHaveBeenCalledWith('1d8');
            // Direct owns its damage-roll log — lowercase 'thunder damage', distinct from
            // the shared logAncestryDamageRoll helper's 'Thunder damage' used by dispatch.
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                name: "Storm's Thunder Damage",
                targetName: 'Orc',
                damageType: 'Thunder',
                total: 5,
                formula: '1d8',
                rolls: [5],
                description: "TestHero used Storm's Thunder to deal 5 thunder damage to Orc.",
            }));
        });

        it('runs the shared stormsThunderTargetGate at the direct entry — null attackerName refuses with zero spend', async () => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: null,
                targetName: 'TestHero',
                totalDamage: 10,
            });

            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Storm's Thunder requires a target. No attacker found from the last attack.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
