// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest'
import { applyMaxHpPassives, getCarryingCapacity } from './carryingCapacity.js'

// Unit canon for carryingCapacity.js itself. abilityCalc2024.test.js pins the
// getHitPoints seam; abilityCalc.test.js pins the re-export rows cited below.
// The real evaluateAutoExpression runs here (no mock): 'level'-style tokens
// resolve deterministically and pure-arithmetic expressions never hit the dice.

function statsWithPassives(passives, extra = {}) {
  return { automation: { passives }, ...extra }
}

describe('applyMaxHpPassives', () => {
  it('folds amount from max_hp_increase and fortified_health, singly and stacked (FT-012)', () => {
    // fortified_health (2024 Epic Boon) carries amount under its own key and
    // ignores its alsoSelfHealing metadata here.
    expect(applyMaxHpPassives(statsWithPassives([
      { type: 'passive_rule', effect: 'fortified_health', name: 'Fortified Health', amount: 40, alsoSelfHealing: { extraHealingExpression: 'CON modifier', oncePerTurn: true } },
    ]), 143)).toBe(183)

    expect(applyMaxHpPassives(statsWithPassives([
      { type: 'passive_rule', effect: 'max_hp_increase', name: 'Toughness', amount: 20 },
    ]), 100)).toBe(120)

    expect(applyMaxHpPassives(statsWithPassives([
      { type: 'passive_rule', effect: 'fortified_health', amount: 40 },
      { type: 'passive_rule', effect: 'max_hp_increase', amount: 20 },
    ]), 100)).toBe(160)
  })

  it('falls back to bonusExpression via the real evaluator when amount is absent; amount wins when both present', () => {
    const level = { level: 8 }
    expect(applyMaxHpPassives(statsWithPassives([
      { type: 'passive_rule', effect: 'max_hp_increase', name: 'Expr', bonusExpression: 'level' },
    ], level), 100)).toBe(108)

    expect(applyMaxHpPassives(statsWithPassives([
      { type: 'passive_rule', effect: 'fortified_health', name: 'Fortified Health', bonusExpression: 'level / 2' },
    ], level), 100)).toBe(104)

    // static amount takes precedence over bonusExpression
    expect(applyMaxHpPassives(statsWithPassives([
      { type: 'passive_rule', effect: 'max_hp_increase', amount: 3, bonusExpression: 'level' },
    ], level), 100)).toBe(103)
  })

  it('ignores wrong-type passives, unrelated effects, unresolvable expressions, and missing automation', () => {
    expect(applyMaxHpPassives(statsWithPassives([
      { type: 'passive_buff', effect: 'fortified_health', amount: 40 },
      { type: 'passive_buff', effect: 'max_hp_increase', amount: 10 },
      { type: 'passive_rule', effect: 'other_effect', amount: 100 },
      // dice notation is returned unresolved by evaluateAutoExpression — never rolled, never added
      { type: 'passive_rule', effect: 'max_hp_increase', bonusExpression: '1d4+1' },
    ]), 100)).toBe(100)

    expect(applyMaxHpPassives({}, 100)).toBe(100)
  })

  it('tolerates a nullish playerStats apex with silent passthrough of hitPoints (#204-class apex guard)', () => {
    // Posture: tolerant-quiet, mirroring the hasPassiveEffect exemplar (automationPassives.js:19)
    // and greatWeaponFightingApplies (greatWeaponFighting.js:42, fix#204): absent apex folds
    // to the SAME neutral as absent automation ({}, 100 -> 100 above) — never a log, never a throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(applyMaxHpPassives(undefined, 100)).toBe(100)
    expect(applyMaxHpPassives(null, 55)).toBe(55)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('getCarryingCapacity', () => {
  // Default-STR, x2 and x1.5 rows are pinned verbatim at abilityCalc.test.js:295-304.
  // This owns the direct-module formula falsifiers across the full STR span.
  it('is STR totalScore x 15 x sizeMultiplier', () => {
    const capacity = (strScore, sizeMultiplier) =>
      getCarryingCapacity({ abilities: [{ name: 'Strength', totalScore: strScore }], sizeMultiplier })

    expect(capacity(1)).toBe(15) // low-end falsifier
    expect(capacity(8)).toBe(120)
    expect(capacity(20)).toBe(300)
    expect(capacity(30)).toBe(450) // high-end falsifier
    expect(capacity(10, 0.5)).toBe(75) // Tiny halves; x1/x1.5/x2 live in the twin
    expect(capacity(10, 3)).toBe(450)
  })
})
