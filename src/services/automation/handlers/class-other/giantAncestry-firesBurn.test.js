// @maintained-by-ai: 2026-10-15 — deterministic mocked-seam lane; every external
// module (runtime store, dice, log, damage, findLastAttack) is mocked, so only the
// handler composition runs under test and no churn is needed unless the Fire's Burn
// handler contract itself moves.
//
// Seam vs. giantAncestry-firesBurn.regression.test.js: THIS lane MOCKS findLastAttack
// and owns the steady-state gate consumption + exact-key `firesBurnUses` spend pins.
// The regression sibling runs the REAL findLastAttack parser against campaign.lastAttack
// record shapes (CLA-141 defect locks: miss / no-damage / stale skill-roll refusals
// with zero spend) — no parser-shape tests live here.
//
// The firesBurnUses exact-key spend is pinned once per ENTRY POINT (twice total) by
// design: dispatch derives optName from `option.name`, direct hardcodes "Fire's Burn"
// and composes its own log string (lowercase 'fire damage' vs the shared helper's
// 'Fire damage'), so each entry point needs its own end-to-end pin.
//
// Gate refusal branches are pinned once, through dispatch — handleFiresBurn and
// handleFiresBurnDirect call the identical shared attackerRollGate, so the direct
// lane keeps only one refusal to prove its wiring plus its distinct log composition.
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

import {
    handleFiresBurn,
    handleFiresBurnDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';

// resetAllMocks restores the factory defaults above (incl. the full-hit findLastAttack
// record) after per-test mockResolvedValue overrides, and clears call counts.
beforeEach(() => { vi.resetAllMocks(); });

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

describe('giantAncestry Fire\'s Burn (mocked findLastAttack seam)', () => {
    const option = { name: "Fire's Burn", type: 'damage', damage: '1d10', damageType: 'Fire' };

    describe('handleFiresBurn (dispatch, option-driven)', () => {
        it('deals option-derived 1d10 Fire damage, consumes an exact-key use, and logs', async () => {
            makeUsesMock('firesBurnUses', 3);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload).toEqual({
                type: 'damage',
                name: "Fire's Burn",
                formula: '1d10',
                rolls: [5],
                total: 5,
                finalDamage: 5,
                damageApplied: true,
                targetName: 'Goblin',
                targetCurrentHp: 15,
                damageType: 'Fire',
            });
            expect(rollExpression).toHaveBeenCalledTimes(1);
            expect(rollExpression).toHaveBeenCalledWith('1d10');
            expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'Goblin', 5, ['Fire'], {
                campaignName: 'campaign',
                characters: [],
                ignoreResistance: false,
                attackerName: 'TestHero',
            });
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'firesBurnUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'roll',
                rollType: 'damage',
                name: "Fire's Burn Damage",
                characterName: 'TestHero',
                targetName: 'Goblin',
                damageType: 'Fire',
                total: 5,
                formula: '1d10',
                rolls: [5],
                description: 'TestHero used Fire\'s Burn to deal 5 Fire damage to Goblin.',
            });
        });

        it('refuses with zero spend when there is no lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Fire's Burn requires a recent attack. Use it after hitting a creature.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when the last attack was made by another creature', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Fire's Burn can only be used after you make an attack. Wait for your turn.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when the last roll was not an attack roll', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Fire's Burn can only be used after an attack roll.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when the last attack has no target', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Fire's Burn requires a target. No target found from the last attack.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with zero spend and no gate probe when no uses remain', async () => {
            makeUsesMock('firesBurnUses', 0);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Fire's Burn has no uses remaining. Uses will reset on the next Long Rest.");
            expect(findLastAttack).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleFiresBurnDirect (fire_burn automation type)', () => {
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

        it('derives formula from action.automation, consumes an exact-key use, and logs its own composition', async () => {
            makeUsesMock('firesBurnUses', 3);
            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload).toEqual({
                type: 'damage',
                name: "Fire's Burn",
                formula: '1d10',
                rolls: [5],
                total: 5,
                finalDamage: 5,
                damageApplied: true,
                targetName: 'Goblin',
                targetCurrentHp: 15,
                damageType: 'Fire',
            });
            expect(rollExpression).toHaveBeenCalledTimes(1);
            expect(rollExpression).toHaveBeenCalledWith('1d10');
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'firesBurnUses', 2, 'campaign');
            // Direct owns its log composition — lowercase 'fire damage', distinct from
            // the shared logAncestryDamageRoll helper used by dispatch.
            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'roll',
                rollType: 'damage',
                name: "Fire's Burn Damage",
                characterName: 'TestHero',
                targetName: 'Goblin',
                damageType: 'Fire',
                total: 5,
                formula: '1d10',
                rolls: [5],
                description: 'TestHero used Fire\'s Burn to deal 5 fire damage to Goblin.',
            });
        });

        it('runs the shared attackerRollGate at the direct entry with zero spend', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Fire's Burn can only be used after you make an attack. Wait for your turn.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
