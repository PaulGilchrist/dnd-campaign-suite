import { describe, it, expect } from 'vitest'
import {
  evaluateAutoExpression,
  resolveUses,
  resolveScaling,
  getSaveDc,
  resolveHealingPoolExpression,
  resolveDiceExpression,
  getSuperiorityDieSize,
  getPsionicEnergyDieSize,
  reresolveAutomationUsesMax,
} from './automationExpressions.js'

// ── Helpers ──────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    proficiency: 4,
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4 },
      { name: 'Dexterity', bonus: 2 },
      { name: 'Constitution', bonus: 3 },
      { name: 'Intelligence', bonus: 1 },
      { name: 'Wisdom', bonus: 0 },
      { name: 'Charisma', bonus: -1 },
    ],
    class: {
      name: 'barbarian',
      class_levels: [
        { rage_damage: 2, bardic_die: 6 },
        { rage_damage: 2, bardic_die: 6 },
        { rage_damage: 2, bardic_die: 6 },
        { rage_damage: 2, bardic_die: 6 },
        { rage_damage: 2, bardic_die: 6 },
      ],
    },
    ...overrides,
  }
}

// ── resolveUses ──────────────────────────────────────────────────

describe('resolveUses', () => {
  it('returns the number directly when usesSpec is a number', () => {
    expect(resolveUses(makePlayerStats(), 3)).toBe(3)
  })

  it('returns 0 when usesSpec is "proficiency_bonus" and proficiency is undefined', () => {
    const stats = makePlayerStats({ proficiency: undefined })
    expect(resolveUses(stats, 'proficiency_bonus')).toBe(0)
  })

  it('returns proficiency_bonus when usesSpec is "proficiency_bonus"', () => {
    const stats = makePlayerStats()
    expect(resolveUses(stats, 'proficiency_bonus')).toBe(4)
  })

  it('returns player level when usesSpec matches class name with _level suffix', () => {
    const stats = makePlayerStats()
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('performs case-insensitive class name matching', () => {
    const stats = makePlayerStats({ class: { name: 'Barbarian' } })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('returns class.levels when class name does not match', () => {
    const stats = makePlayerStats({
      class: { name: 'wizard', levels: 10 },
    })
    expect(resolveUses(stats, 'barbarian_level')).toBe(10)
  })

  it('falls back to player level when class exists but has no levels property', () => {
    const stats = makePlayerStats({ class: { name: 'wizard' } })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('falls back to playerStats.level when class object is missing entirely', () => {
    const stats = makePlayerStats({ class: undefined })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('falls back to player level when usesSpec is an unrecognized string pattern', () => {
    expect(resolveUses(makePlayerStats(), 'unknown_pattern')).toBe(5)
  })

  it('falls back to 1 when playerStats.level is falsy and usesSpec is unrecognized', () => {
    const stats = makePlayerStats({ level: 0 })
    expect(resolveUses(stats, 'unknown_pattern')).toBe(1)
  })
})

// ── resolveScaling ───────────────────────────────────────────────

describe('resolveScaling', () => {
  it('returns null when scaling is falsy', () => {
    expect(resolveScaling(makePlayerStats(), null)).toBe(null)
    expect(resolveScaling(makePlayerStats(), undefined)).toBe(null)
    expect(resolveScaling(makePlayerStats(), '')).toBe(null)
  })

  it('returns null when scaling is not an array', () => {
    expect(resolveScaling(makePlayerStats(), {})).toBe(null)
    expect(resolveScaling(makePlayerStats(), [])).toBe(null)
  })

  it('returns the entry with the highest level <= player level', () => {
    const stats = makePlayerStats({ level: 5 })
    const scaling = [
      { level: 1, value: 'low' },
      { level: 3, value: 'mid' },
      { level: 7, value: 'high' },
    ]
    expect(resolveScaling(stats, scaling)).toEqual({ level: 3, value: 'mid' })
  })

  it('returns null when player level is below all scaling levels', () => {
    const stats = makePlayerStats({ level: 1 })
    const scaling = [
      { level: 3, value: 'mid' },
      { level: 7, value: 'high' },
    ]
    expect(resolveScaling(stats, scaling)).toBe(null)
  })

  it('returns the last entry when player level exceeds all scaling levels', () => {
    const stats = makePlayerStats({ level: 20 })
    const scaling = [
      { level: 1, value: 'low' },
      { level: 5, value: 'mid' },
    ]
    expect(resolveScaling(stats, scaling)).toEqual({ level: 5, value: 'mid' })
  })

  it('handles unsorted scaling entries', () => {
    const stats = makePlayerStats({ level: 5 })
    const scaling = [
      { level: 7, value: 'high' },
      { level: 1, value: 'low' },
      { level: 3, value: 'mid' },
    ]
    expect(resolveScaling(stats, scaling)).toEqual({ level: 3, value: 'mid' })
  })

  it('skips entries with missing level property', () => {
    const stats = makePlayerStats({ level: 5 })
    const scaling = [
      { value: 'no-level' },
      { level: 3, value: 'mid' },
    ]
    expect(resolveScaling(stats, scaling)).toEqual({ level: 3, value: 'mid' })
  })

  // CLA-208: classes.json stores scaling as object maps, e.g. Land's Aid {"10":"3d6","14":"4d6"}
  it('resolves object-map scaling to the highest level <= player level', () => {
    expect(resolveScaling(makePlayerStats({ level: 20 }), { '10': '3d6', '14': '4d6' }))
      .toEqual({ level: 14, damage: '4d6' })
    expect(resolveScaling(makePlayerStats({ level: 12 }), { '10': '3d6', '14': '4d6' }))
      .toEqual({ level: 10, damage: '3d6' })
  })

  it('returns null for object-map scaling when player level is below all thresholds', () => {
    expect(resolveScaling(makePlayerStats({ level: 3 }), { '10': '3d6', '14': '4d6' })).toBe(null)
  })

  it('returns null for an empty object map', () => {
    expect(resolveScaling(makePlayerStats({ level: 20 }), {})).toBe(null)
  })

  it('sorts unordered object-map keys before resolving', () => {
    expect(resolveScaling(makePlayerStats({ level: 20 }), { '14': '4d6', '10': '3d6' }))
      .toEqual({ level: 14, damage: '4d6' })
  })
})

// ── getSaveDc ────────────────────────────────────────────────────

describe('getSaveDc', () => {
  it('calculates 8 + ability modifier + proficiency when proficiency is provided', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'strength', 4)).toBe(16)
  })

  it('calculates 8 + ability modifier when proficiency is omitted', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'dexterity')).toBe(10)
  })

  it('handles negative ability modifiers', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'charisma', 4)).toBe(11)
  })

  it('handles unknown ability names gracefully', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'unknown', 4)).toBe(12)
  })

  it('returns 8 when abilities array is missing and proficiency is 0', () => {
    const stats = makePlayerStats({ abilities: undefined })
    expect(getSaveDc(stats, 'strength', 0)).toBe(8)
  })
})

// ── resolveHealingPoolExpression ─────────────────────────────────

describe('resolveHealingPoolExpression', () => {
  it('returns baseExpression when scaling is falsy', () => {
    expect(resolveHealingPoolExpression('2d6', null)).toBe('2d6')
  })

  it('returns baseExpression when player level is below all scaling levels', () => {
    const stats = makePlayerStats({ level: 1 })
    const scaling = { 3: '3d6', 5: '4d6' }
    expect(resolveHealingPoolExpression('2d6', scaling, stats)).toBe('2d6')
  })

  it('returns the expression for the highest matching level', () => {
    const stats = makePlayerStats({ level: 5 })
    const scaling = { 3: '3d6', 5: '4d6' }
    expect(resolveHealingPoolExpression('2d6', scaling, stats)).toBe('4d6')
  })

  it('returns the expression for the matching level when level is between entries', () => {
    const stats = makePlayerStats({ level: 4 })
    const scaling = { 3: '3d6', 5: '4d6' }
    expect(resolveHealingPoolExpression('2d6', scaling, stats)).toBe('3d6')
  })

  it('returns the last matching expression when level exceeds all entries', () => {
    const stats = makePlayerStats({ level: 10 })
    const scaling = { 3: '3d6', 5: '4d6' }
    expect(resolveHealingPoolExpression('2d6', scaling, stats)).toBe('4d6')
  })

  it('handles non-numeric keys by filtering them out', () => {
    const stats = makePlayerStats({ level: 5 })
    const scaling = { invalid: 'bad', 3: '3d6', 5: '4d6' }
    expect(resolveHealingPoolExpression('2d6', scaling, stats)).toBe('4d6')
  })

  it('returns undefined when baseExpression is undefined and scaling is falsy', () => {
    expect(resolveHealingPoolExpression(undefined, null)).toBe(undefined)
  })
})

// ── getSuperiorityDieSize ────────────────────────────────────────

describe('getSuperiorityDieSize', () => {
  it('returns 12 for level 18+', () => {
    expect(getSuperiorityDieSize({ level: 18 })).toBe(12)
  })

  it('returns 10 for level 10-17', () => {
    expect(getSuperiorityDieSize({ level: 10 })).toBe(10)
  })

  it('returns 8 for level below 10', () => {
    expect(getSuperiorityDieSize({ level: 5 })).toBe(8)
  })

  it('returns 8 when level is missing', () => {
    expect(getSuperiorityDieSize({})).toBe(8)
  })

  it('returns 8 when playerStats is null', () => {
    expect(getSuperiorityDieSize(null)).toBe(8)
  })
})

// ── getPsionicEnergyDieSize ──────────────────────────────────────

describe('getPsionicEnergyDieSize', () => {
  it('returns energy_die_type from class_levels when available', () => {
    const stats = {
      level: 5,
      class: {
        class_levels: [{ level: 5, energy: { energy_die_type: 10 } }],
      },
    }
    expect(getPsionicEnergyDieSize(stats)).toBe(10)
  })

  it('returns fallback die size when class_levels has energy but no energy_die_type', () => {
    const stats = {
      level: 5,
      class: {
        class_levels: [{ level: 5, energy: {} }],
      },
    }
    expect(getPsionicEnergyDieSize(stats)).toBe(6)
  })

  it('returns 12 for level 17+', () => {
    expect(getPsionicEnergyDieSize({ level: 17 })).toBe(12)
  })

  it('returns 10 for level 13-16', () => {
    expect(getPsionicEnergyDieSize({ level: 13 })).toBe(10)
  })

  it('returns 8 for level 9-12', () => {
    expect(getPsionicEnergyDieSize({ level: 9 })).toBe(8)
  })

  it('returns 6 for level below 9', () => {
    expect(getPsionicEnergyDieSize({ level: 3 })).toBe(6)
  })

  it('returns 6 when level is missing or class has no class_levels', () => {
    expect(getPsionicEnergyDieSize({})).toBe(6)
  })

  it('throws when playerStats is null due to unguarded class access', () => {
    expect(() => getPsionicEnergyDieSize(null)).toThrow(TypeError)
  })
})

// ── resolveDiceExpression ────────────────────────────────────────

describe('resolveDiceExpression', () => {
  it('returns expression when expression is falsy', () => {
    expect(resolveDiceExpression(null, makePlayerStats(), 1)).toBe(null)
  })

  it('throws when playerStats is null due to unguarded class access in getPsionicEnergyDieSize', () => {
    expect(() => resolveDiceExpression('proficiency_bonus', null, 1)).toThrow(TypeError)
  })

  it('replaces bardic_inspiration_die with bardic_die value', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('1bardic_inspiration_die', stats, 1)).toBe('16')
  })

  it('replaces proficiency_bonus_d4 with max(1, prof)d4', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('proficiency_bonus_d4', stats, 1)).toBe('4d4')
  })

  it('replaces proficiency_bonus with numeric prof value', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('proficiency_bonus', stats, 1)).toBe('4')
  })

  it('replaces proficiency_bonus with 0 when proficiency is missing', () => {
    const stats = makePlayerStats({ proficiency: undefined })
    expect(resolveDiceExpression('proficiency_bonus', stats, 1)).toBe('0')
  })

  it('replaces class level tokens with player level', () => {
    const stats = makePlayerStats()
    const tokens = [
      'monk level', 'monk_level', 'fighter_level', 'fighter level',
      'paladin level', 'barbarian_level', 'barbarian level', 'bard level',
      'cleric_level', 'cleric level', 'druid_level', 'rogue_level',
      'warlock_level', 'warlock level',
    ]
    for (const token of tokens) {
      expect(resolveDiceExpression(token, stats, 1)).toBe('5')
    }
  })

  it('replaces general "level" with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('level', stats, 1)).toBe('5')
  })

  it('replaces rage_damage with rage_damage numeric value', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('rage_damage', stats, 1)).toBe('2')
  })

  it('replaces rage_damage_d6 with rage_damage d6', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('rage_damage_d6', stats, 1)).toBe('2d6')
  })

  it('replaces ability modifiers correctly for all six abilities', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('1STR modifier', stats, 1)).toBe('14')
    expect(resolveDiceExpression('1DEX modifier', stats, 1)).toBe('12')
    expect(resolveDiceExpression('1CON modifier', stats, 1)).toBe('13')
    expect(resolveDiceExpression('1INT modifier', stats, 1)).toBe('11')
    expect(resolveDiceExpression('1WIS modifier', stats, 1)).toBe('10')
    expect(resolveDiceExpression('1CHA modifier', stats, 1)).toBe('1-1')
  })

  it('replaces superiority_die with correct die size for level 18+', () => {
    const stats = makePlayerStats({ level: 18 })
    expect(resolveDiceExpression('superiority_die', stats, 1)).toBe('12')
  })

  it('replaces psionic_energy_die with correct die size', () => {
    const stats = makePlayerStats({ level: 5 })
    expect(resolveDiceExpression('psionic_energy_die', stats, 1)).toBe('6')
  })

  it('replaces martial_arts_die when available', () => {
    const stats = makePlayerStats({
      class: {
        name: 'monk',
        class_levels: [{ level: 5, martial_arts_die: 6 }],
      },
    })
    expect(resolveDiceExpression('martial_arts_die', stats, 1)).toBe('6')
  })

  it('replaces martial_arts_die with default when not available', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('martial_arts_die', stats, 1)).toBe('4')
  })

  it('replaces favored_enemy when available', () => {
    const stats = makePlayerStats({
      class: {
        name: 'ranger',
        class_levels: [{ level: 5, favored_enemy: 2 }],
      },
    })
    expect(resolveDiceExpression('favored_enemy', stats, 1)).toBe('2')
  })

  it('replaces favored_enemy with 0 when not available', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('favored_enemy', stats, 1)).toBe('0')
  })

  it('replaces ally_hit_die with correct die size per level bracket', () => {
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 1 }), 1)).toBe('4')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 5 }), 1)).toBe('4')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 9 }), 1)).toBe('6')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 13 }), 1)).toBe('8')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 17 }), 1)).toBe('10')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 20 }), 1)).toBe('12')
  })

  it('handles complex expressions with multiple replacements', () => {
    const stats = makePlayerStats()
    const result = resolveDiceExpression('1d6+proficiency_bonus+STR modifier', stats, 1)
    expect(result).toBe('1d6+4+4')
  })

  it('replaces spell_slot_level with slotLevel correctly', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('spell_slot_level', stats)).toBe('1')
    expect(resolveDiceExpression('spell_slot_level', stats, 3)).toBe('3')
  })
})

// ── evaluateAutoExpression ───────────────────────────────────────

describe('evaluateAutoExpression', () => {
  it('returns expression when expression is falsy', () => {
    expect(evaluateAutoExpression(null, makePlayerStats())).toBe(null)
  })

  it('evaluates simple arithmetic expressions', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('2+3', stats)).toBe(5)
  })

  it('evaluates expressions with variable replacements', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('1d6+proficiency_bonus', stats)
    expect(result).toBe('1d6+4')
  })

  it('evaluates expressions with ability modifier replacements', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('1d4+STR modifier', stats)
    expect(result).toBe('1d4+4')
  })

  it('applies _min_ suffix for minimum value enforcement', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('-5_min_3', stats)).toBe(3)
    expect(evaluateAutoExpression('10_min_3', stats)).toBe(10)
    expect(evaluateAutoExpression('-proficiency_bonus_min_2', stats)).toBe(2)
  })

  it('evaluates to 0 when expression results in zero', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('5-5', stats)).toBe(0)
  })

  it('evaluates expressions with floor/ceil/round auto-prefix', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('floor(3.7)', stats)).toBe(3)
    expect(evaluateAutoExpression('ceil(3.2)', stats)).toBe(4)
    expect(evaluateAutoExpression('round(3.5)', stats)).toBe(4)
  })

  it('returns string for expressions with dice notation that cannot be evaluated', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('1d6', stats)).toBe('1d6')
    expect(evaluateAutoExpression('2d8+3', stats)).toBe('2d8+3')
  })

  it('returns string for expressions with invalid JavaScript identifiers', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('abc', stats)).toBe('abc')
  })

  it('returns Infinity for division by zero since it is a valid number', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('1/0', stats)).toBe(Infinity)
  })

  it('returns original string for 0/0 since result is NaN', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('0/0', stats)).toBe('0/0')
  })

  it('replaces ally_hit_die in combined expression', () => {
    const stats = makePlayerStats({ level: 5 })
    expect(evaluateAutoExpression('ally_hit_die + proficiency_bonus', stats, 1)).toBe(8)
  })

  it('handles _min_ with complex expressions', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('(-proficiency_bonus - 2)_min_5', stats)).toBe(5)
  })

  it('returns string when _min_ has negative minimum since regex requires digits only', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('5_min_-3', stats)).toBe('5_min_-3')
  })
})

// ── CLA-229: reresolveAutomationUsesMax ─────────────────────────
// Automation with uses_expression is collected by getPlayerStats BEFORE
// rules.getAbilities computes ability .bonus, so WIS-based pools baked at
// the min-1 floor (usesMax 1 despite WIS +3). This pass re-resolves the
// expressions once abilities exist — fixes the whole free-cast family.

describe('reresolveAutomationUsesMax (CLA-229)', () => {
  const wisPool = () => ({
    type: 'free_spell',
    name: 'Misty Wanderer',
    spell: 'Misty Step',
    uses: 1,
    uses_expression: 'WIS modifier_min_1',
    usesMax: 1,
    recharge: 'long_rest',
  })

  it('re-resolves usesMax/uses to the WIS modifier once abilities exist', () => {
    const stats = {
      level: 15,
      proficiency: 5,
      abilities: [{ name: 'Wisdom', bonus: 3 }],
      automation: { specialActions: [wisPool()] },
    }
    reresolveAutomationUsesMax(stats)
    expect(stats.automation.specialActions[0].usesMax).toBe(3)
    expect(stats.automation.specialActions[0].uses).toBe(3)
  })

  it('keeps the min-1 floor when the modifier is negative', () => {
    const stats = {
      level: 15,
      proficiency: 5,
      abilities: [{ name: 'Wisdom', bonus: -2 }],
      automation: { specialActions: [wisPool()] },
    }
    reresolveAutomationUsesMax(stats)
    expect(stats.automation.specialActions[0].usesMax).toBe(1)
  })

  it('re-resolves every uses_expression category (Steps of the Fey family)', () => {
    const stats = {
      level: 17,
      proficiency: 6,
      abilities: [{ name: 'Charisma', bonus: 4 }, { name: 'Wisdom', bonus: 3 }],
      automation: {
        bonusActions: [{ type: 'steps_of_the_fey', name: 'Steps of the Fey', uses: 1, uses_expression: 'CHA modifier_min_1', usesMax: 1 }],
        actions: [{ type: 'free_spell', name: 'Other', uses: 1, uses_expression: 'WIS modifier_min_1', usesMax: 1 }],
      },
    }
    reresolveAutomationUsesMax(stats)
    expect(stats.automation.bonusActions[0].usesMax).toBe(4)
    expect(stats.automation.actions[0].usesMax).toBe(3)
  })

  it('leaves entries without uses_expression untouched', () => {
    const stats = {
      level: 5,
      abilities: [{ name: 'Wisdom', bonus: 3 }],
      automation: { specialActions: [{ type: 'free_spell', name: 'Fey Magic', uses: 1, recharge: 'long_rest' }] },
    }
    reresolveAutomationUsesMax(stats)
    expect(stats.automation.specialActions[0].uses).toBe(1)
    expect(stats.automation.specialActions[0].usesMax).toBeUndefined()
  })

  it('is null-safe on missing automation', () => {
    expect(() => reresolveAutomationUsesMax({})).not.toThrow()
    expect(() => reresolveAutomationUsesMax(null)).not.toThrow()
  })
})
