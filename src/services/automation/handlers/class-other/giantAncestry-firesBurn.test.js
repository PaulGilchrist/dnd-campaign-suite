// @maintained-by-ai 2026-11-26 — deterministic mocked-seam lane; every external
// module (runtime store, dice, log, damage, findLastAttack) is mocked, so only the
// handler composition runs under test and no churn is needed unless the Fire's Burn
// handler contract itself moves.
//
// Seam vs. giantAncestry-firesBurn.regression.test.js: THIS lane MOCKS findLastAttack
// and owns the steady-state gate consumption + exact-key `firesBurnUses` spend pins.
// The regression sibling runs the REAL findLastAttack parser against campaign.lastAttack
// record shapes (CLA-141 defect locks) — no parser-shape tests live here. The logged
// miss / no-damage refusals (attackerHitRefusal branch, fires_burn_refused log row) are
// locked there against the real parser and are NOT re-pinned here; only the four
// UNLOGGED ancestryInfoPopup gate branches are pinned here.
//
// The firesBurnUses exact-key spend is pinned per ENTRY POINT by design: dispatch
// derives optName from `option.name`, direct hardcodes "Fire's Burn" and composes its
// own log string (lowercase 'fire damage' vs the shared helper's 'Fire damage'), so
// each entry point needs its own end-to-end pin. The dispatch happy path runs
// it.each([[3,2],[1,0]]) (cloudsJaunt-lane pattern) to prove the spend is a plain
// currentUses - 1 with no clamp at 1.
//
// Gate refusal branches: handleFiresBurn and handleFiresBurnDirect call the identical
// shared attackerRollGate, so the refusal branches ride one assertion-identical
// it.each table through dispatch, and the direct lane keeps a single refusal pin to
// prove its wiring plus its distinct log composition.
//
// Fire's Burn has NO save-for-half: the handler deals full damage with no SavePrompt
// dispatch, so there is no save-shape pin on this seam. The option fixture is derived
// from real GIANT_OPTIONS data via getOptionByName — the exact object
// handleDirectType/selection flow ships to the handler (disk-is-authority).
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

// Not a tested collaborator: damageRollback → conditionSaveService loads the real
// automationService module at import time; this factory stubs that deep load only.
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
import { getOptionByName } from './giantAncestryOptions.js';

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
    // Production option shape: the real authored GIANT_OPTIONS entry that
    // getOptionByName() hands to the dispatch handler.
    const option = getOptionByName("Fire's Burn");

    describe('handleFiresBurn (dispatch, option-driven)', () => {
        it.each([[3, 2], [1, 0]])('deals option-derived 1d10 Fire damage, spends %i→%i on the exact key, and logs', async (uses, remaining) => {
            makeUsesMock('firesBurnUses', uses);
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
                targetOldHp: 20,
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
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'firesBurnUses', remaining, 'campaign');
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

        // Unlogged attackerRollGate branches — one assertion-identical table; only the
        // branch input and the Fire's Burn-worded message differ per row.
        it.each([
            ['there is no lastAttack', { attackEvent: null },
                "Fire's Burn requires a recent attack. Use it after hitting a creature."],
            ['the last attack was made by another creature', {
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'Orc',
                targetName: 'Goblin',
            },
            "Fire's Burn can only be used after you make an attack. Wait for your turn."],
            ['the last roll was not an attack roll', {
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            },
            "Fire's Burn can only be used after an attack roll."],
            ['the last attack has no target', {
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'TestHero',
                targetName: null,
            },
            "Fire's Burn requires a target. No target found from the last attack."],
        ])('refuses with zero spend when %s', async (_case, lastAttack, description) => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue(lastAttack);

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Fire's Burn");
            expect(result.payload.description).toBe(description);
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
                targetOldHp: 20,
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
