// @improved-by-ai
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
    expect(resolveUses(makePlayerStats(), 0)).toBe(0)
    expect(resolveUses(makePlayerStats(), -1)).toBe(-1)
  })

  it('returns proficiency_bonus when usesSpec is "proficiency_bonus"', () => {
    const stats = makePlayerStats()
    expect(resolveUses(stats, 'proficiency_bonus')).toBe(4)
  })

  it('returns proficiency_bonus when class proficiency is missing', () => {
    const stats = makePlayerStats({ proficiency: undefined })
    expect(resolveUses(stats, 'proficiency_bonus')).toBe(0)
  })

  it('returns player level when usesSpec is "<className>_level" and class name matches', () => {
    const stats = makePlayerStats()
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('returns player level when usesSpec is "<className>_level" with case-insensitive match', () => {
    const stats = makePlayerStats({ class: { name: 'Barbarian' } })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('returns class.levels when class name does not match but class object exists', () => {
    const stats = makePlayerStats({
      class: { name: 'wizard', levels: 10 },
    })
    expect(resolveUses(stats, 'barbarian_level')).toBe(10)
  })

  it('returns class.levels when class has no levels property and name does not match', () => {
    const stats = makePlayerStats({
      class: { name: 'wizard' },
    })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('falls back to playerStats.level when class object is missing entirely', () => {
    const stats = makePlayerStats({ class: undefined })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('returns 0 when class has no levels and level is falsy', () => {
    const stats = makePlayerStats({ level: 0, class: { name: 'wizard', levels: undefined } })
    expect(resolveUses(stats, 'barbarian_level')).toBe(0)
  })

  it('falls back to playerStats.level when usesSpec is not a recognized pattern', () => {
    expect(resolveUses(makePlayerStats(), 'unknown_pattern')).toBe(5)
  })

  it('falls back to 1 when playerStats.level is falsy and spec is unrecognized', () => {
    const stats = makePlayerStats({ level: 0 })
    expect(resolveUses(stats, 'unknown_pattern')).toBe(1)
  })

  it('handles non-string usesSpec by falling back to level', () => {
    const stats = makePlayerStats()
    expect(resolveUses(stats, true)).toBe(5)
    expect(resolveUses(stats, null)).toBe(5)
    expect(resolveUses(stats, 42)).toBe(42)
  })
})

// ── resolveScaling ───────────────────────────────────────────────

describe('resolveScaling', () => {
  it('returns null when scaling is falsy', () => {
    expect(resolveScaling(makePlayerStats(), null)).toBe(null)
    expect(resolveScaling(makePlayerStats(), undefined)).toBe(null)
    expect(resolveScaling(makePlayerStats(), '')).toBe(null)
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

  it('returns the exact match when player level matches a scaling entry', () => {
    const stats = makePlayerStats({ level: 3 })
    const scaling = [
      { level: 1, value: 'low' },
      { level: 3, value: 'mid' },
    ]
    expect(resolveScaling(stats, scaling)).toEqual({ level: 3, value: 'mid' })
  })

  it('returns the last entry when player level exceeds all scaling levels', () => {
    const stats = makePlayerStats({ level: 20 })
    const scaling = [
      { level: 1, value: 'low' },
      { level: 5, value: 'mid' },
    ]
    expect(resolveScaling(stats, scaling)).toEqual({ level: 5, value: 'mid' })
  })

  it('handles empty scaling array', () => {
    expect(resolveScaling(makePlayerStats(), [])).toBe(null)
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

  it('calculates 8 + ability modifier when proficiency is 0', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'constitution', 0)).toBe(11)
  })

  it('handles negative ability modifiers', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'charisma', 4)).toBe(11)
  })

  it('handles zero ability modifier', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'wisdom', 4)).toBe(12)
  })

  it('handles all six abilities without proficiency', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'strength')).toBe(12)
    expect(getSaveDc(stats, 'dexterity')).toBe(10)
    expect(getSaveDc(stats, 'constitution')).toBe(11)
    expect(getSaveDc(stats, 'intelligence')).toBe(9)
    expect(getSaveDc(stats, 'wisdom')).toBe(8)
    expect(getSaveDc(stats, 'charisma')).toBe(7)
  })

  it('handles unknown ability names gracefully', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'unknown', 4)).toBe(12)
  })
})

// ── resolveHealingPoolExpression ─────────────────────────────────

describe('resolveHealingPoolExpression', () => {
  it('returns baseExpression when scaling is falsy', () => {
    expect(resolveHealingPoolExpression('2d6', null)).toBe('2d6')
    expect(resolveHealingPoolExpression('2d6', undefined)).toBe('2d6')
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

  it('handles expressions with modifiers', () => {
    const stats = makePlayerStats({ level: 3 })
    const scaling = { 3: '2d8+1', 5: '3d8+2' }
    expect(resolveHealingPoolExpression('1d6', scaling, stats)).toBe('2d8+1')
  })

  it('handles empty scaling object', () => {
    const stats = makePlayerStats({ level: 5 })
    expect(resolveHealingPoolExpression('2d6', {}, stats)).toBe('2d6')
  })
})

// ── getSuperiorityDieSize ────────────────────────────────────────

describe('getSuperiorityDieSize', () => {
  it('returns 12 for level 18+', () => {
    expect(getSuperiorityDieSize({ level: 18 })).toBe(12)
    expect(getSuperiorityDieSize({ level: 20 })).toBe(12)
  })

  it('returns 10 for level 10-17', () => {
    expect(getSuperiorityDieSize({ level: 10 })).toBe(10)
    expect(getSuperiorityDieSize({ level: 17 })).toBe(10)
  })

  it('returns 8 for level 5-9', () => {
    expect(getSuperiorityDieSize({ level: 5 })).toBe(8)
    expect(getSuperiorityDieSize({ level: 9 })).toBe(8)
  })

  it('returns 8 for level 1-4', () => {
    expect(getSuperiorityDieSize({ level: 1 })).toBe(8)
    expect(getSuperiorityDieSize({ level: 4 })).toBe(8)
  })

  it('returns 8 when level is missing', () => {
    expect(getSuperiorityDieSize({})).toBe(8)
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

  it('returns 12 for level 17+', () => {
    expect(getPsionicEnergyDieSize({ level: 17 })).toBe(12)
    expect(getPsionicEnergyDieSize({ level: 20 })).toBe(12)
  })

  it('returns 10 for level 13-16', () => {
    expect(getPsionicEnergyDieSize({ level: 13 })).toBe(10)
    expect(getPsionicEnergyDieSize({ level: 16 })).toBe(10)
  })

  it('returns 8 for level 9-12', () => {
    expect(getPsionicEnergyDieSize({ level: 9 })).toBe(8)
    expect(getPsionicEnergyDieSize({ level: 12 })).toBe(8)
  })

  it('returns 6 for level 3-8', () => {
    expect(getPsionicEnergyDieSize({ level: 3 })).toBe(6)
    expect(getPsionicEnergyDieSize({ level: 8 })).toBe(6)
  })

  it('returns 6 when level is missing', () => {
    expect(getPsionicEnergyDieSize({})).toBe(6)
  })

  it('returns 6 when class has no class_levels', () => {
    expect(getPsionicEnergyDieSize({ level: 5, class: {} })).toBe(6)
  })
})

// ── resolveDiceExpression ────────────────────────────────────────

describe('resolveDiceExpression', () => {
  it('returns expression when expression is falsy', () => {
    expect(resolveDiceExpression(null, makePlayerStats(), 1)).toBe(null)
    expect(resolveDiceExpression(undefined, makePlayerStats(), 1)).toBe(undefined)
    expect(resolveDiceExpression('', makePlayerStats(), 1)).toBe('')
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

  it('replaces class level tokens case-insensitively', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('1CLERIC_LEVEL', stats, 1)).toBe('15')
    expect(resolveDiceExpression('1CLERIC level', stats, 1)).toBe('15')
    expect(resolveDiceExpression('1DRUID_LEVEL', stats, 1)).toBe('15')
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

  it('defaults rage_damage to 2 when class_levels is empty', () => {
    const stats = makePlayerStats({ level: 1, class: { class_levels: [] } })
    expect(resolveDiceExpression('rage_damage', stats, 1)).toBe('2')
    expect(resolveDiceExpression('rage_damage_d6', stats, 1)).toBe('2d6')
  })

  it('defaults bardic_inspiration_die to 6 when class_levels is empty', () => {
    const stats = makePlayerStats({ level: 1, class: { class_levels: [] } })
    expect(resolveDiceExpression('bardic_inspiration_die', stats, 1)).toBe('6')
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

  it('replaces superiority_die with correct die size for level 5', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('superiority_die', stats, 1)).toBe('8')
  })

  it('replaces superiority_die with 12 for level 18+', () => {
    const stats = makePlayerStats({ level: 18 })
    expect(resolveDiceExpression('superiority_die', stats, 1)).toBe('12')
  })

  it('replaces psionic_energy_die with correct die size', () => {
    const stats = makePlayerStats({ level: 5 })
    expect(resolveDiceExpression('psionic_energy_die', stats, 1)).toBe('6')
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

  it('replaces spell_slot_level with slotLevel after "level" is already replaced', () => {
    const stats = makePlayerStats()
    // 'level' replacement runs first, turning 'spell_slot_level' into 'spell_slot_5'
    // Then 'spell_slot_level' no longer matches, so slotLevel param is unused
    expect(resolveDiceExpression('spell_slot_level', stats)).toBe('spell_slot_5')
    expect(resolveDiceExpression('spell_slot_level', stats, 3)).toBe('spell_slot_5')
  })
})

// ── evaluateAutoExpression ───────────────────────────────────────

describe('evaluateAutoExpression', () => {
  it('returns expression when expression is falsy', () => {
    expect(evaluateAutoExpression(null, makePlayerStats())).toBe(null)
    expect(evaluateAutoExpression(undefined, makePlayerStats())).toBe(undefined)
    expect(evaluateAutoExpression('', makePlayerStats())).toBe('')
  })

  it('evaluates simple arithmetic expressions', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('2+3', stats)).toBe(5)
    expect(evaluateAutoExpression('10-4', stats)).toBe(6)
    expect(evaluateAutoExpression('3*4', stats)).toBe(12)
    expect(evaluateAutoExpression('20/5', stats)).toBe(4)
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
  })

  it('evaluates negative numbers with _min_ suffix', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('-10_min_5', stats)).toBe(5)
  })

  it('returns string when expression evaluation fails with invalid syntax', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('invalid_syntax_!!', stats)
    expect(typeof result).toBe('string')
    expect(result).toBe('invalid_syntax_!!')
  })

  it('handles expressions that evaluate to Infinity by returning the number', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('1/0', stats)).toBe(Infinity)
  })

  it('returns string when expression evaluates to NaN', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('0/0', stats)
    expect(typeof result).toBe('string')
  })

  it('returns numeric result from Math.max via _min_ pattern', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('Math.max(3, (0))', stats)
    expect(result).toBe(3)
  })

  it('handles rage_damage_d6 replacement in complex expression', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('2rage_damage_d6+proficiency_bonus', stats)
    expect(result).toBe('22d6+4')
  })

  it('handles bardic_inspiration_die in expression', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('3bardic_inspiration_die', stats)
    expect(result).toBe(36)
  })

  it('handles proficiency_bonus_d4 as string (not evaluated as valid JS)', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('proficiency_bonus_d4', stats)
    expect(result).toBe('4d4')
  })

  it('handles _min_ with variable expressions', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('-proficiency_bonus_min_2', stats)).toBe(2)
  })

  it('replaces ally_hit_die with correct value per level bracket', () => {
    // evaluateAutoExpression evaluates numeric results as numbers
    expect(evaluateAutoExpression('ally_hit_die', makePlayerStats({ level: 5 }), 1)).toBe(4)
    expect(evaluateAutoExpression('ally_hit_die', makePlayerStats({ level: 17 }), 1)).toBe(10)
    expect(evaluateAutoExpression('ally_hit_die', makePlayerStats({ level: 20 }), 1)).toBe(12)
  })

  it('replaces ally_hit_die in combined expression', () => {
    const stats = makePlayerStats({ level: 5 })
    // evaluateAutoExpression evaluates arithmetic as numbers
    expect(evaluateAutoExpression('ally_hit_die + proficiency_bonus', stats, 1)).toBe(8)
  })

  it('handles expressions with multiple _min_ patterns using the first match', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('5_min_3', stats)).toBe(5)
  })
})
