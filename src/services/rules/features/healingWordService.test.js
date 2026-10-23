// @maintained-by-ai
/**
 * healingWordService lane — TRIGGER ENVELOPE + STORE-CANON CAPS (movement determination below).
 *
 * LIVE export: triggerHealingWord has THREE production callers (grep src):
 *   useSimpleSpellHandlers.js:223 (runHealingWord), useComplexSpellHandlers.js:34
 *   (handleHealingWordConfirm), spellCastService/execution/index.js:341.
 *   NOT the greaterRestoration #1370 dead-export pattern — the bonus-action confirm
 *   flow routes through this trigger, so it stays live.
 * Secondary exports resolveCurrentHp / markFortifiedHealthIfApplied have ZERO
 * external importers (the same-named functions in handlePlainDamage.js:396 and
 * automation healingHandler.js:170 are private twins, not imports) — export
 * keyword DROPPED #1371 (demoted to module-locals, rec executed); they stay
 * pinned here only through the triggerHealingWord path.
 *
 * MOVEMENT-INTERACTION DETERMINATION: the service writes NO movement key and has
 * NO runtime-store reads beyond 'currentHitPoints' (strict fake below throws on any
 * other read — machine proof). RAW "move before/after the bonus action" is not
 * modeled here; ordering lives in the caller lanes (useSpellMetamagicFlow.*), which
 * vi.mock this module. No 'healing_word' te key exists in targetEffectDefinitions.js
 * (registry read). No clocks anywhere in this lane.
 *
 * HEAL-MATH BOUNDARY: expression-ladder resolution is owned VERBATIM by
 * spellDamageUtils.test.js:180 — resolveHealExpression(disk5e('Healing Word'), 1, 5)
 * === '1d4+5' (auto-hit identity at :108/:118). This lane does NOT re-pin heal math:
 * disk rows flow in opaquely and only MOD-substitution at the call-site of
 * rollExpression is byte-pinned.
 *
 * Store key: 'currentHitPoints' canonical (#1367-68 pair, foresight/heal model).
 * skipSync audit: this lane performs ZERO setRuntimeValue calls (mock module would
 * throw-free-fail via strict fake if it did); writes flow through mocked
 * applyHealingToTarget / markFortifiedHealthUsed, arg-pinned once each.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHealingWord } from './healingWordService.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

// ── Mocks (module boundaries only — dice is mocked so this lane never rolls) ──

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
    applyHealingRerollOnes: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(),
    hasHealingMaximizationForTarget: vi.fn(),
    hasRerollHealingOnes: vi.fn(),
    markFortifiedHealthUsed: vi.fn(),
}));

import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { rollExpression, rollExpressionMaximized, applyHealingRerollOnes } from '../../dice/diceRoller.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximizationForTarget, hasRerollHealingOnes, markFortifiedHealthUsed } from '../../combat/automation/automationService.js';

// ── Canon helpers ─────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';

function diskRow(spells, name) {
    const spell = spells.find(s => s.name === name);
    if (!spell) throw new Error(`spell missing from disk: ${name}`);
    return spell;
}
const hw5e = diskRow(spells5e, 'Healing Word');
const hw2024 = diskRow(spells2024, 'Healing Word');

function makePlayerStats(overrides = {}) {
    return {
        name: 'Cleric',
        hitPoints: 30,
        spellAbilities: { modifier: 3, spellCastingAbility: 'Charisma' },
        abilities: [{ name: 'Charisma', bonus: 3 }],
        proficiency: 2,
        level: 1,
        ...overrides,
    };
}

const csFull = () => ({ round: 1, creatures: [{ name: 'Ally', maxHp: 30, currentHp: 10 }] });

// ── Strict argument-keyed store fake ─────────────────────────

let store;
function seedStore(entity, value, campaign = CAMPAIGN) {
    store.set(`${entity}|${campaign}`, value);
}

let dispatchSpy;
let consoleSpy;

beforeEach(() => {
    vi.resetAllMocks();
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // explicit re-seed after reset — default world: 30 max, stored 10, one Ally
    store = new Map([['Ally|test-campaign', '10']]);
    getRuntimeValue.mockImplementation((entity, key, campaign) => {
        if (key !== 'currentHitPoints') {
            throw new Error(`unexpected store key read: ${key} (healingWord reads only currentHitPoints)`);
        }
        const v = store.get(`${entity}|${campaign}`);
        if (v === undefined) {
            throw new Error(`unexpected store read: ${entity}@${campaign}`);
        }
        return v;
    });
    getCombatContext.mockResolvedValue(csFull());
    getTargetFromAttacker.mockReturnValue({ name: 'Ally' });
    rollExpression.mockReturnValue(null);
    rollExpressionMaximized.mockReturnValue(null);
    applyHealingRerollOnes.mockReturnValue({ displayRolls: null, originalRolls: null });
    hasHealingMaximizationForTarget.mockReturnValue(false);
    hasRerollHealingOnes.mockReturnValue(false);
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    markFortifiedHealthUsed.mockResolvedValue(undefined);
    addEntry.mockReturnValue(Promise.resolve());
});

afterEach(() => {
    dispatchSpy.mockRestore();
    consoleSpy.mockRestore();
});

// ── Tests ─────────────────────────────────────────────────────

describe('triggerHealingWord', () => {
    it.each([
        ['disk near-miss Cure Wounds (has heal tiers, 1 action)', diskRow(spells5e, 'Cure Wounds'), {}],
        ['disk family twin Mass Healing Word (bonus action)', diskRow(spells5e, 'Mass Healing Word'), {}],
        ['case-drift name', { name: 'healing word', level: 1, heal_at_slot_level: { '1': '1d4 + MOD' } }, {}],
        ['heal_at_slot_level null', { name: 'Healing Word', level: 1, heal_at_slot_level: null }, {}],
        ['heal_at_slot_level empty', { name: 'Healing Word', level: 1, heal_at_slot_level: {} }, {}],
        ['slot key absent for cast level', { name: 'Healing Word', level: 1, heal_at_slot_level: { '1': '1d4 + MOD' } }, { slotLevel: 2 }],
        ['spell has no name', { level: 1, heal_at_slot_level: { '1': '1d4 + MOD' } }, {}],
    ])('name/expression gate rejects %s before any engine work', async (_label, spell, metaCtx) => {
        const result = await triggerHealingWord(spell, metaCtx, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(result).toBeNull();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('short-circuits downstream: null context, null target, null roll', async () => {
        getCombatContext.mockResolvedValueOnce(null);
        expect(await triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap')).toBeNull();
        expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
        expect(getTargetFromAttacker).not.toHaveBeenCalled();

        // explicit re-seed: context present, no target resolves
        getTargetFromAttacker.mockReturnValueOnce(null);
        expect(await triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap')).toBeNull();
        expect(rollExpression).not.toHaveBeenCalled();

        // explicit re-seed: target resolves, roll fails
        rollExpression.mockReturnValueOnce(null);
        expect(await triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap')).toBeNull();
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('disk canon is parity-shaped across both rulesets (level 1, bonus action, 60ft, no save)', () => {
        // disk names/shape drive the name gate and slot ladder; ladder MATH itself is
        // owned by spellDamageUtils.test.js:180 — only tier presence pinned here.
        expect(hw5e.level).toBe(1);
        expect(hw2024.level).toBe(1);
        expect(hw5e.casting_time.toLowerCase()).toContain('bonus action');
        expect(hw2024.casting_time.toLowerCase()).toContain('bonus action');
        expect(hw5e.range).toBe('60 feet');
        expect(hw2024.range).toBe('60 feet');
        expect('save' in hw5e).toBe(false);
        expect('save' in hw2024).toBe(false);
        expect('dc' in hw2024).toBe(false);
        expect(hw5e.heal_at_slot_level['1']).toBe('1d4 + MOD');
        expect(hw2024.heal_at_slot_level['1']).toBe('2d4 + MOD');
    });

    it('canonical cast: exact envelope, boundary args, store key, log, and single dispatch event', async () => {
        const cs = csFull();
        getCombatContext.mockResolvedValueOnce(cs);
        const rolls = [2, 4];
        rollExpression.mockReturnValueOnce({ total: 5, rolls, modifier: 3 });

        const playerStats = makePlayerStats();
        const result = await triggerHealingWord(hw5e, {}, playerStats, CAMPAIGN, 'testMap');

        expect(rollExpression).toHaveBeenCalledWith('1d4 + 3'); // disk lv1 tier, MOD substituted — the only math pin
        expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'Cleric');
        expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'currentHitPoints', CAMPAIGN);
        expect(getRuntimeValue).toHaveBeenCalledTimes(1);
        expect(hasHealingMaximizationForTarget).toHaveBeenCalledWith(playerStats, 'Ally', CAMPAIGN);
        expect(hasRerollHealingOnes).toHaveBeenCalledWith(playerStats);
        expect(resolveHealingBonusesWithDetails).toHaveBeenCalledWith(playerStats, { prof: 2, level: 1, slotLevel: 1, campaignName: CAMPAIGN });
        expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Ally', 5, CAMPAIGN);
        expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
        expect(result).toEqual({
            targetName: 'Ally',
            healAmount: 5,
            formula: '1d4 + 3',
            rolls,
            rawTotal: 5,
            healingRerollOriginalRolls: null,
            healingRerollDisplayRolls: rolls,
        });
        expect(result.rolls).toBe(rolls); // identity: pass-through, no copy
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'hp_change',
            targetName: 'Ally',
            delta: 5,
            currentHp: 15,
            maxHp: 30,
            isHealing: true,
            sourceName: 'Cleric',
            note: 'Healing Word',
            formula: '1d4 + 3',
            bonusDetails: undefined, // empty-bonus omission (also proves exact 11-key envelope)
            timestamp: expect.any(Number),
        });
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy.mock.calls[0][0].type).toBe('combat-summary-updated');
    });

    it('metaCtx.slotLevel overrides spell.level onto the disk upcast tier (2024 row)', async () => {
        rollExpression.mockReturnValueOnce({ total: 9, rolls: [4, 3], modifier: 3 });

        const result = await triggerHealingWord(hw2024, { slotLevel: 2 }, makePlayerStats(), CAMPAIGN, 'testMap');

        expect(rollExpression).toHaveBeenCalledWith('4d4 + 3'); // disk 2024 slot-2 tier
        expect(resolveHealingBonusesWithDetails).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ slotLevel: 2 }));
        expect(result.formula).toBe('4d4 + 3');
        expect(result.healAmount).toBe(9);
    });

    it.each([
        ['named spell ability matches entry → ability.bonus',
            { spellCastingAbility: 'Wisdom' },
            { spellAbilities: { modifier: 3, spellCastingAbility: 'Charisma' }, abilities: [{ name: 'Wisdom', bonus: 7 }] },
            '1d4 + 7'],
        ['named ability has no entry → 0, spellAbilities.modifier ignored',
            {},
            { spellAbilities: { modifier: 2, spellCastingAbility: 'Charisma' }, abilities: [{ name: 'Strength', bonus: 5 }] },
            '1d4 + 0'],
        ['no spellAbilities at all → named spell ability still resolves',
            { spellCastingAbility: 'Wisdom' },
            { spellAbilities: undefined, abilities: [{ name: 'Wisdom', bonus: 7 }] },
            '1d4 + 7'],
        ['spellAbilities without spellCastingAbility → spellAbilities.modifier',
            {},
            { spellAbilities: { modifier: 2, spellCastingAbility: undefined }, abilities: [{ name: 'Charisma', bonus: 2 }] },
            '1d4 + 2'],
    ])('casting-mod branch: %s', async (_label, spellOverrides, statsOverrides, expectedExpr) => {
        rollExpression.mockReturnValueOnce({ total: 5, rolls: [2], modifier: 0 });
        const spell = { ...hw5e, ...spellOverrides };
        const result = await triggerHealingWord(spell, {}, makePlayerStats(statsOverrides), CAMPAIGN, 'testMap');
        expect(rollExpression).toHaveBeenCalledWith(expectedExpr);
        expect(result.formula).toBe(expectedExpr);
    });

    it.each([
        ['stored full (string) beats summary 10', '30', 8, 0],
        ['stored full (number) parity', 30, 8, 0],
        ['stored empty string means full', '', 8, 0],
        ['stored 20 caps roll of 15 at missing 10', '20', 15, 10],
    ])('runtime store is canonical: %s → heal %i', async (_label, stored, rollTotal, expectedHeal) => {
        seedStore('Ally', stored);
        rollExpression.mockReturnValueOnce({ total: rollTotal, rolls: [4], modifier: 3 });

        const result = await triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap');

        expect(result.healAmount).toBe(expectedHeal);
        expect(result.rawTotal).toBe(rollTotal);
        if (expectedHeal > 0) {
            expect(applyHealingToTarget).toHaveBeenCalledWith(csFull(), 'Ally', expectedHeal, CAMPAIGN);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ delta: expectedHeal, currentHp: Number(stored) + expectedHeal }));
        } else {
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledTimes(1); // zero-heal still logs a 0-delta entry
        }
    });

    it('maxHp falls back to caster hitPoints when target absent from creatures', async () => {
        const cs = { round: 1, creatures: [] };
        getCombatContext.mockResolvedValue(cs);
        getTargetFromAttacker.mockReturnValue({ name: 'Unknown Ally' });

        // phase 1: stored 18 < caster hitPoints 25 → heal lands capped-free
        seedStore('Unknown Ally', '18');
        rollExpression.mockReturnValueOnce({ total: 5, rolls: [2], modifier: 3 });
        const caster = makePlayerStats({ hitPoints: 25 });
        const r1 = await triggerHealingWord(hw5e, {}, caster, CAMPAIGN, 'testMap');
        expect(r1.healAmount).toBe(5);
        expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Unknown Ally', 5, CAMPAIGN);

        // explicit re-seed — phase 2: stored equals fallback max → zero
        seedStore('Unknown Ally', '25');
        rollExpression.mockReturnValueOnce({ total: 8, rolls: [5], modifier: 3 });
        const r2 = await triggerHealingWord(hw5e, {}, caster, CAMPAIGN, 'testMap');
        expect(r2.healAmount).toBe(0);
        expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
    });

    it('maximized path: rollExpressionMaximized only, reroll pass bypassed', async () => {
        hasHealingMaximizationForTarget.mockReturnValueOnce(true);
        const rolls = [4, 4];
        rollExpressionMaximized.mockReturnValueOnce({ total: 7, rolls, modifier: 3, maximized: true });

        const result = await triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap');

        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyHealingRerollOnes).not.toHaveBeenCalled();
        expect(result).toEqual({
            targetName: 'Ally',
            healAmount: 7,
            formula: '1d4 + 3',
            rolls,
            rawTotal: 7,
            healingRerollOriginalRolls: null,
            healingRerollDisplayRolls: rolls,
        });
        expect(result.rolls).toBe(rolls);
        expect(applyHealingToTarget).toHaveBeenCalledWith(csFull(), 'Ally', 7, CAMPAIGN);
    });

    it('reroll-ones pass records display vs original without changing the total', async () => {
        hasRerollHealingOnes.mockReturnValueOnce(true);
        rollExpression.mockReturnValueOnce({ total: 4, rolls: [1], modifier: 3 });
        applyHealingRerollOnes.mockReturnValueOnce({ displayRolls: [3], originalRolls: [1] });

        const r1 = await triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(applyHealingRerollOnes).toHaveBeenCalledWith([1], '1d4 + 3');
        expect(r1.healAmount).toBe(4); // total from roll, reroll is display-only here
        expect(r1.healingRerollOriginalRolls).toEqual([1]);
        expect(r1.healingRerollDisplayRolls).toEqual([3]);

        // explicit re-seed — phase 2: no ones rolled
        hasRerollHealingOnes.mockReturnValueOnce(true);
        rollExpression.mockReturnValueOnce({ total: 7, rolls: [4], modifier: 3 });
        applyHealingRerollOnes.mockReturnValueOnce({ displayRolls: [4], originalRolls: null });

        const r2 = await triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(r2.healingRerollOriginalRolls).toBeNull();
        expect(r2.healingRerollDisplayRolls).toEqual([4]);
    });

    it.each([
        ['one bonus lands and latches',
            [{ name: 'Fortified Health', amount: 3 }], 5, 8, '1d4 + 0 + (3 Fortified Health)', true],
        ['multiple bonuses join in order',
            [{ name: 'Fortified Health', amount: 3 }, { name: 'Healing Spike', amount: 2 }], 5, 10, '1d4 + 0 + (3 Fortified Health + 2 Healing Spike)', true],
        ['zero actual heal never latches Fortified Health',
            [{ name: 'Fortified Health', amount: 3 }], 5, 0, '1d4 + 0 + (3 Fortified Health)', false],
    ])('healing bonuses: %s', async (_label, details, rollTotal, expectedHeal, expectedFormula, expectLatch) => {
        resolveHealingBonusesWithDetails.mockReturnValueOnce({ totalBonus: details.reduce((s, d) => s + d.amount, 0), details });
        rollExpression.mockReturnValueOnce({ total: rollTotal, rolls: [5], modifier: 0 });
        if (expectedHeal === 0) seedStore('Ally', '30');
        const playerStats = makePlayerStats({ spellAbilities: { modifier: 0, spellCastingAbility: 'Charisma' }, abilities: [{ name: 'Charisma', bonus: 0 }] });

        const result = await triggerHealingWord(hw5e, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result.healAmount).toBe(expectedHeal);
        expect(result.rawTotal).toBe(rollTotal + details[0].amount + (details[1]?.amount ?? 0));
        if (expectLatch) {
            expect(applyHealingToTarget).toHaveBeenCalledWith(csFull(), 'Ally', expectedHeal, CAMPAIGN);
            expect(markFortifiedHealthUsed).toHaveBeenCalledWith(playerStats, CAMPAIGN);
        } else {
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
        }
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            formula: expectedFormula,
            bonusDetails: details,
        }));
    });

    it('addEntry rejection is swallowed and logged with the exact prefix', async () => {
        rollExpression.mockReturnValueOnce({ total: 5, rolls: [2], modifier: 3 });
        const failure = new Error('disk error');
        addEntry.mockReturnValueOnce(Promise.reject(failure));

        await expect(triggerHealingWord(hw5e, {}, makePlayerStats(), CAMPAIGN, 'testMap')).resolves.toMatchObject({ healAmount: 5 });
        await Promise.resolve();
        await Promise.resolve(); // flush the un-awaited .catch registration
        expect(consoleSpy).toHaveBeenCalledWith('[healingWord] Error:', failure); // identical Error instance
    });
});
