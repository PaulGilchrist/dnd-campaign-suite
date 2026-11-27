// @maintained-by-ai 2026-11-26
// Deterministic mocked-seam lane; every external module (runtime store, dice, log,
// damage, findLastAttack, expirations) is mocked, so only the Storm's Thunder handler
// composition runs under test and no churn is needed unless the handler contract moves.
//
// REAL isWithinRange seam: unlike giantAncestry-stormsThunder.range.test.js (which
// mocks rangeCheck.js), this lane runs the REAL isWithinRange end-to-end. With the
// mocked runtime store there is no activeMapName, so it exercises the lenient
// no-grid/no-map fallback feeding the success lanes. If that fallback ever stops
// returning true, both success tests here fail — keep them. The range lane owns the
// range-arg pins (isWithinRange called with 60), the full-string stormsThunderRange
// refusal pin, the storms_thunder_refused log row (the ONLY logged refusal branch
// on this trait — stormsThunderTargetGate is entirely unlogged), and the ability_use
// spend log. Not duplicated here; this lane only asserts the total addEntry count.
//
// Family recipe (mirrors giantAncestry-firesBurn.test.js / giantAncestry-frostsChill.
// test.js): the shared stormsThunderTargetGate's four UNLOGGED info-branch refusals
// ride one assertion-identical it.each table through dispatch (payload.name +
// addExpiration zero-probes — Storm's Thunder stamps no targetEffect and no clock).
// The direct lane keeps a single refusal pin to prove the shared gate is wired at
// the direct entry, plus its distinct log composition (lowercase 'thunder damage'
// via its own addEntry, vs the shared logAncestryDamageRoll helper's 'Thunder
// damage'). The dispatch happy path runs it.each([[3,2],[1,0]]) to prove the spend
// is a plain currentUses - 1 with no clamp at 1.
//
// The option fixture is the real authored GIANT_OPTIONS entry via getOptionByName —
// disk-is-authority, the exact object the selection flow ships to the handler.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Not a tested collaborator: the handler chain loads the real automationService
// module at import time; this factory stubs that deep load only.
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

// Not a tested collaborator: the dispatch/traits modules import applyHealing at
// module scope (Stone's Endurance lane); this factory keeps that deep load out.
vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 12, oldHp: 10, newHp: 22 })),
}));

// Not a tested collaborator: giantAncestryUtils imports addExpiration at module
// scope for the Frost's Chill / Hill's Tumble clocks. Storm's Thunder stamps no
// clock — the zero-probes below pin that contract against future drift.
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    // Valid default trigger: Orc hit TestHero for damage — the shared
    // stormsThunderTargetGate passes and the REAL isWithinRange falls through
    // its lenient no-map fallback.
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'Orc' },
        attackerName: 'Orc',
        targetName: 'TestHero',
        totalDamage: 10,
    })),
}));

import {
    handleStormsThunder,
    handleStormsThunderDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';
import { getOptionByName } from './giantAncestryOptions.js';

// resetAllMocks restores the factory defaults above (incl. the valid Orc→TestHero
// trigger record) after per-test mockResolvedValue overrides, and clears call counts.
beforeEach(() => { vi.resetAllMocks(); });

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

describe('giantAncestry Storm\'s Thunder (mocked findLastAttack seam)', () => {
    // Production option shape: the real authored GIANT_OPTIONS entry that
    // getOptionByName() hands to the dispatch handler.
    const option = getOptionByName("Storm's Thunder");

    describe('handleStormsThunder (dispatch, option-driven)', () => {
        it.each([[3, 2], [1, 0]])('retaliates with option-derived 1d8 Thunder damage on the attacker, spends %i→%i on the exact key, and logs (real isWithinRange, lenient no-map fallback)', async (uses, remaining) => {
            makeUsesMock('stormsThunderUses', uses);
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
                    targetOldHp: 20,
                    targetCurrentHp: 15,
                    damageType: 'Thunder',
                },
            });
            expect(rollExpression).toHaveBeenCalledTimes(1);
            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'Orc', 5, ['Thunder'], {
                campaignName: 'campaign',
                characters: [],
                ignoreResistance: false,
                attackerName: 'TestHero',
            });
            // One write only — the exact-key use spend (no targetEffects on this trait).
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', remaining, 'campaign');
            // Two logs: ability_use spend (content owned by the range lane) + the
            // shared logAncestryDamageRoll helper — capitalised 'Thunder damage'.
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenCalledWith('campaign', {
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
            });
        });

        // Unlogged stormsThunderTargetGate info branches — one assertion-identical
        // table; only the branch input and the Storm's Thunder-worded message differ.
        it.each([
            ['there is no lastAttack', { attackEvent: null },
                "Storm's Thunder requires a recent attack where you were the target and took damage."],
            ['the player was not the target', {
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
                totalDamage: 10,
            },
            "Storm's Thunder can only be used when you were the target of the attack and took damage."],
            ['no damage was dealt', {
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 0,
            },
            "Storm's Thunder requires that you took damage from the attack. No damage was dealt."],
            ['the last attack has no attacker name', {
                attackEvent: { rollType: 'attack' },
                attackerName: null,
                targetName: 'TestHero',
                totalDamage: 10,
            },
            "Storm's Thunder requires a target. No attacker found from the last attack."],
        ])('refuses with zero spend when %s', async (_case, lastAttack, description) => {
            makeUsesMock('stormsThunderUses', 3);
            findLastAttack.mockResolvedValue(lastAttack);

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Storm's Thunder");
            expect(result.payload.description).toBe(description);
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('refuses with no gate probe and zero spend when no uses remain', async () => {
            makeUsesMock('stormsThunderUses', 0);
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Storm's Thunder");
            expect(result.payload.description).toBe("Storm's Thunder has no uses remaining. Uses will reset on the next Long Rest.");
            expect(findLastAttack).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('handleStormsThunderDirect (storms_thunder automation type)', () => {
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

        it('derives formula from action.automation, spends an exact-key use, and logs its own composition (real isWithinRange, lenient no-map fallback)', async () => {
            makeUsesMock('stormsThunderUses', 3);
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
                    targetOldHp: 20,
                    targetCurrentHp: 15,
                    damageType: 'Thunder',
                },
            });
            expect(rollExpression).toHaveBeenCalledTimes(1);
            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            // Direct owns its damage-roll log — lowercase 'thunder damage', distinct from
            // the shared logAncestryDamageRoll helper's 'Thunder damage' used by dispatch.
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenCalledWith('campaign', {
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
            });
        });

        // Single wiring pin: proves the shared stormsThunderTargetGate runs at the
        // direct entry (branch content owned by the dispatch table above).
        it('runs the shared stormsThunderTargetGate at the direct entry with zero spend', async () => {
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
            expect(result.payload.name).toBe("Storm's Thunder");
            expect(result.payload.description).toBe("Storm's Thunder requires a target. No attacker found from the last attack.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });
    });
});
