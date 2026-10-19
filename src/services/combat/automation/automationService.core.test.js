// @maintained-by-ai
// ── CORE LANE: automationService local surfaces + expression-application facade ───
// Family split (automationService.*, full map):
//   • THIS FILE — four unique faces, verified against every sibling owner:
//       1. hasAutomation truth table (local, automationService.js:10 — sole owner)
//       2. facade re-export surface: exact keys + same-function identity bytes (#796)
//       3. evaluateAutoExpression console discipline (dice/clamp silent, malformed
//          warns once with text) — automationExpressions.test.js pins no console bytes
//       4. resolveNumericExpression numeric-application contract — covered NOWHERE
//          else (engine-owner file omits it entirely; roller internals are diceRoller's)
//   • automationService.buildAttackInfo.test.js — getAutomationInfo/buildAttackInfo
//     facade (#971). APPLIED REC #971: this file's old getAutomationInfo block is
//     DELETED — its null-guards ⊂ #971's guard battery (:37-53), its passive_rule
//     positive ⊂ delegation-transparency pin (:63-73, loop is type-agnostic per
//     automationService.js:148-152), its unknown-type null ⊂ guard battery (:46-48).
//   • automationService.collection.test.js — catalog categorization (#972/#957/#960).
//   • automationService.modifiers.test.js — getEvasionEffects + getAllSaveProficiencies
//     rows (imports via facade — those local entry points are cited there, not here).
//   • automationService.interactive.* — isInteractiveAutomation rows (#961).
//   • automationPassives.* — passive predicates (#965-#970).
//   • automationExpressions.test.js — expression ENGINE bytes: token table,
//     arithmetic eval, _min_ clamps, falsy passthrough (cited, not re-run here).
// Old → new: hasAutomation 2→1 folded table; getAutomationInfo 3→0 (rec #971);
// evaluateAutoExpression 6→0 engine bytes (cited to owner) + console 3→1 folded;
// resolveNumericExpression 6→5 strengthened — the 20-iteration real-random loop and
// the range-only asserts are retired for stubbed-dice exact bytes, and the _min_
// clamp case now uses prof 2 so the clamp actually BINDS (raw 2 → 3).
// Determinism: Math.random stubbed for every dice byte; zero timers, zero network.
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as service from './automationService.js'
import { hasAutomation, evaluateAutoExpression, resolveNumericExpression } from './automationService.js'
import * as expressions from './automationExpressions.js'
import * as infoBuilder from './automationInfoBuilder.js'
import * as collector from './automationCollector.js'
import * as modifiers from './automationModifiers.js'
import * as immunities from './automationImmunities.js'
import * as passives from './automationPassives.js'
import { makePlayerStats } from './automationService.test-utils.js'

// ── facade wiring: exact surface, identity bytes not wrappers (#796) ───────

const EXPECTED_SURFACE = [
  // delegation (#971 pins its envelope/transparency bytes)
  'buildAttackInfo',
  // expression helpers (engine bytes owned by automationExpressions.test.js)
  'evaluateAutoExpression', 'resolveNumericExpression', 'resolveDiceExpression',
  // collector (#972/#957/#960 import through this facade)
  'collectAutomationFromFeatures', 'processFeatureAutomation', 'collectTurnStartEffects',
  // save modifiers + evasion rows (#964 owner, imports through this facade)
  'collectSaveModifiers',
  // immunities
  'getConditionImmunities', 'getConditionalImmunities', 'playerIsImmuneToCondition', 'hasSelfRestoration',
  // passives (#965-#970)
  'getPassiveBuffs', 'collectWeaponMastery', 'resolveHealingBonuses', 'resolveHealingBonusesWithDetails',
  'markFortifiedHealthUsed', 'markFortifiedHealthUsedIfGranted', 'hasHealingMaximization',
  'hasHealingMaximizationForTarget', 'hasRerollHealingOnes', 'hasTacticalShift',
  'hasSpeedyOpportunityDisadvantage', 'hasSpeedyDifficultTerrainIgnore', 'hasIgnoreResistance',
  'hasMinDamage', 'hasTruesight', 'hasFastWrestler', 'hasGreatWeaponFighting',
  'hasTwoWeaponFighting', 'hasSomaticComponentWaiver', 'hasNaturallyStealthy',
  'hasInterception', 'hasProtection', 'hasThrownWeaponFighting', 'hasBlessedWarrior',
  'applyGreatWeaponFightingToDamage',
  // local entry points (behavior owned by THIS file or the sibling cited above)
  'hasAutomation', 'isInteractiveAutomation', 'getEvasionEffects', 'getAutomationInfo', 'getAllSaveProficiencies',
]

describe('automationService facade', () => {
  it('exposes exactly the documented surface, every sub-module export by identity (never a wrapper)', () => {
    expect(Object.keys(service).sort()).toEqual([...EXPECTED_SURFACE].sort())
    const subModules = [expressions, infoBuilder, collector, modifiers, immunities, passives]
    for (const [name, fn] of Object.entries(service)) {
      const owner = subModules.find(ns => typeof ns[name] === 'function')
      if (owner) expect(fn, `re-export drift: ${name}`).toBe(owner[name])
    }
  })
})

// ── hasAutomation (local, automationService.js:10) ─────────────────────────

describe('hasAutomation', () => {
  it('is true for every truthy automation shape and false for every absent one', () => {
    const declared = [
      { name: 'X', automation: { type: 'passive_rule' } },
      { name: 'X', automation: {} },
      // multi-half features declare arrays — a truthy container declares automation
      { name: 'X', automation: [] },
    ]
    for (const feature of declared) {
      expect(hasAutomation(feature), `should be true: ${JSON.stringify(feature)}`).toBe(true)
    }
    const absent = [
      { name: 'X' },
      { name: 'X', automation: null },
      { name: 'X', automation: undefined },
      null,
      undefined,
      0,
      false,
      '',
    ]
    for (const feature of absent) {
      expect(hasAutomation(feature), `should be false: ${JSON.stringify(feature)}`).toBe(false)
    }
  })
})

// ── evaluateAutoExpression console discipline ────────────────────────────────
// Engine bytes (tokens/arithmetic/_min_) are owned by automationExpressions.test.js;
// the LOGGING contract for its string-fallback path is pinned only here.

describe('evaluateAutoExpression console discipline', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps dice and clamped-dice string fallbacks silent; malformed input warns once with its text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Dice is a documented outcome for diceRoller — exact bytes, zero noise.
    expect(evaluateAutoExpression('1d8 + 3', makePlayerStats())).toBe('1d8 + 3')
    expect(evaluateAutoExpression('3d6', makePlayerStats())).toBe('3d6')
    // Clamped dice rolls AFTER the clamp — exact bytes, zero noise.
    expect(evaluateAutoExpression('proficiency_bonus_d4_min_3', makePlayerStats({ proficiency: 3 }))).toBe('Math.max(3, (3d4))')
    expect(warn).not.toHaveBeenCalled()
    // Genuinely malformed: passthrough string + exactly one warning naming it.
    expect(evaluateAutoExpression('@@invalid@@', makePlayerStats())).toBe('@@invalid@@')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]).toContain('@@invalid@@')
  })
})

// ── resolveNumericExpression — numeric application (temp HP, healing, reductions) ─
// Owner: no other file covers this export. Math.random stubbed for exact bytes
// (rollDie = floor(random*sides)+1 — diceRoller internals owned by diceRoller tests).

describe('resolveNumericExpression', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns null for absent expressions and evaluates pure arithmetic without touching the dice roller', () => {
    const roll = vi.spyOn(Math, 'random').mockImplementation(() => { throw new TypeError('dice roller must not run') })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(resolveNumericExpression(null, makePlayerStats())).toBeNull()
    expect(resolveNumericExpression(undefined, makePlayerStats())).toBeNull()
    expect(resolveNumericExpression('', makePlayerStats())).toBeNull()
    expect(resolveNumericExpression('proficiency_bonus + 1', makePlayerStats({ proficiency: 3 }))).toBe(4)
    expect(roll).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('rolls dice and dice+modifier formulas to exact stubbed totals', () => {
    const roll = vi.spyOn(Math, 'random')
    roll.mockReturnValue(0)
    expect(resolveNumericExpression('2d6', makePlayerStats())).toBe(2) // 1 + 1
    roll.mockReturnValue(0.999999)
    expect(resolveNumericExpression('2d6', makePlayerStats())).toBe(12) // 6 + 6
    expect(resolveNumericExpression('1d10 + CON modifier', makePlayerStats())).toBe(13) // 10 + CON 3
  })

  it('resolves maximize to the die-face sum without rolling', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new TypeError('maximize must not roll') })
    expect(resolveNumericExpression('4d6', makePlayerStats(), undefined, { maximize: true })).toBe(24)
  })

  it('clamps dice AFTER the roll — floor binds on a low roll, high rolls untouched', () => {
    const roll = vi.spyOn(Math, 'random')
    // prof 2 → "Math.max(3, (2d4))": raw 1+1=2 must be clamped UP to 3
    // (prof 3 would bind at its own minimum and prove nothing).
    roll.mockReturnValue(0)
    expect(resolveNumericExpression('proficiency_bonus_d4_min_3', makePlayerStats({ proficiency: 2 }))).toBe(3)
    roll.mockReturnValue(0.999999)
    expect(resolveNumericExpression('proficiency_bonus_d4_min_3', makePlayerStats({ proficiency: 2 }))).toBe(8) // 4+4, above the floor
  })

  it('returns null and logs console.error once for genuinely unresolvable expressions', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {}) // engine string-fallback warn
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(resolveNumericExpression('@@bogus@@', makePlayerStats())).toBeNull()
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]).toContain('@@bogus@@')
  })
})
