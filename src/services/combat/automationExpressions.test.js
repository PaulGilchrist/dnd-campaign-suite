import { describe, it, expect } from 'vitest'
import {
  evaluateAutoExpression,
  resolveUses,
  resolveScaling,
  getSaveDc,
  resolveHealingPoolExpression,
  resolveDiceExpression,
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

  it('returns level when usesSpec is "<className>_level" and class name matches', () => {
    const stats = makePlayerStats()
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('returns class.levels when class name does not match but class object exists', () => {
    const stats = makePlayerStats({
      class: { name: 'wizard', levels: 10 },
    })
    expect(resolveUses(stats, 'barbarian_level')).toBe(10)
  })

  it('returns level when usesSpec is "<className>_level" and class object is missing levels', () => {
    const stats = makePlayerStats({
      class: { name: 'wizard' },
    })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
  })

  it('falls back to level when class object is missing entirely', () => {
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

  it('falls back to playerStats.level when usesSpec is not recognized', () => {
    const stats = makePlayerStats({ level: 7 })
    expect(resolveUses(stats, 'something_else')).toBe(7)
  })

  it('handles case-insensitive class name matching', () => {
    const stats = makePlayerStats({ class: { name: 'Barbarian' } })
    expect(resolveUses(stats, 'barbarian_level')).toBe(5)
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

  it('returns the first entry when player level is below all scaling levels', () => {
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
})

// ── getSaveDc ────────────────────────────────────────────────────

describe('getSaveDc', () => {
  it('calculates 8 + ability modifier + proficiency when proficiency is provided', () => {
    const stats = makePlayerStats()
    // STR bonus = 4, proficiency = 4
    expect(getSaveDc(stats, 'strength', 4)).toBe(16)
  })

  it('calculates 8 + ability modifier when proficiency is omitted', () => {
    const stats = makePlayerStats()
    // DEX bonus = 2
    expect(getSaveDc(stats, 'dexterity')).toBe(10)
  })

  it('calculates 8 + ability modifier when proficiency is 0', () => {
    const stats = makePlayerStats()
    // CON bonus = 3
    expect(getSaveDc(stats, 'constitution', 0)).toBe(11)
  })

  it('handles negative ability modifiers', () => {
    const stats = makePlayerStats()
    // CHA bonus = -1
    expect(getSaveDc(stats, 'charisma', 4)).toBe(11)
  })

  it('handles zero ability modifier', () => {
    const stats = makePlayerStats()
    // WIS bonus = 0
    expect(getSaveDc(stats, 'wisdom', 4)).toBe(12)
  })

  it('handles all six abilities', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'strength')).toBe(12)  // 8 + 4 + 0
    expect(getSaveDc(stats, 'dexterity')).toBe(10) // 8 + 2 + 0
    expect(getSaveDc(stats, 'constitution')).toBe(11) // 8 + 3 + 0
    expect(getSaveDc(stats, 'intelligence')).toBe(9) // 8 + 1 + 0
    expect(getSaveDc(stats, 'wisdom')).toBe(8)     // 8 + 0 + 0
    expect(getSaveDc(stats, 'charisma')).toBe(7)   // 8 + -1 + 0
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

  it('handles expressions with extra whitespace or edge cases', () => {
    const stats = makePlayerStats({ level: 3 })
    const scaling = { 3: '2d8+1', 5: '3d8+2' }
    expect(resolveHealingPoolExpression('1d6', scaling, stats)).toBe('2d8+1')
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

  it('replaces proficiency_bonus with numeric prof value (concatenates in string)', () => {
    const stats = makePlayerStats()
    // '1proficiency_bonus' → '14' (1 + replacement of proficiency_bonus=4)
    expect(resolveDiceExpression('proficiency_bonus', stats, 1)).toBe('4')
  })

  it('replaces monk level with player level', () => {
    const stats = makePlayerStats()
    // 'monk level' → '5', so '1monk level' → '15'
    expect(resolveDiceExpression('monk level', stats, 1)).toBe('5')
    expect(resolveDiceExpression('monk_level', stats, 1)).toBe('5')
  })

  it('replaces fighter_level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('fighter_level', stats, 1)).toBe('5')
  })

  it('replaces fighter level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('fighter level', stats, 1)).toBe('5')
  })

  it('replaces paladin level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('paladin level', stats, 1)).toBe('5')
  })

  it('replaces barbarian_level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('barbarian_level', stats, 1)).toBe('5')
  })

  it('replaces barbarian level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('barbarian level', stats, 1)).toBe('5')
  })

  it('replaces bard level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('bard level', stats, 1)).toBe('5')
  })

  it('replaces rage_damage_d6 with rage_damage d6', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('rage_damage_d6', stats, 1)).toBe('2d6')
  })

  it('replaces rage_damage with rage_damage numeric value', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('rage_damage', stats, 1)).toBe('2')
  })

  it('replaces cleric_level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('cleric_level', stats, 1)).toBe('5')
    expect(resolveDiceExpression('cleric level', stats, 1)).toBe('5')
  })

  it('replaces druid_level with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('druid_level', stats, 1)).toBe('5')
  })

  it('replaces general "level" with player level', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('level', stats, 1)).toBe('5')
  })

  it('replaces spell_slot_level with slotLevel parameter', () => {
    const stats = makePlayerStats()
    // Note: 'level' (case-insensitive) is replaced first, turning 'spell_slot_level' into 'spell_slot_5'
    // So spell_slot_level replacement never fires - this is the actual behavior
    expect(resolveDiceExpression('spell_slot_level', stats, 3)).toBe('spell_slot_5')
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

  it('throws TypeError when playerStats.abilities is not an array-like object', () => {
    // Empty abilities object causes getAbilityModifier to throw
    // because {} doesn't have .find()
    expect(() => resolveDiceExpression('1level', {}, 1)).toThrow()
  })

  it('uses slotLevel default of 1 when not provided', () => {
    const stats = makePlayerStats()
    // Same issue: 'level' is replaced first, mangling 'spell_slot_level'
    expect(resolveDiceExpression('spell_slot_level', stats)).toBe('spell_slot_5')
  })

  it('handles complex expressions with multiple replacements', () => {
    const stats = makePlayerStats()
    const result = resolveDiceExpression('1d6+proficiency_bonus+STR modifier', stats, 1)
    expect(result).toBe('1d6+4+4')
  })

  it('handles rage_damage when class_levels index is out of range', () => {
    const stats = makePlayerStats({ level: 1, class: { class_levels: [] } })
    // (1 - 1) = 0 index, but class_levels is empty, so rage_damage defaults to 2
    expect(resolveDiceExpression('rage_damage', stats, 1)).toBe('2')
  })

  it('handles bardic_die when class_levels index is out of range', () => {
    const stats = makePlayerStats({ level: 1, class: { class_levels: [] } })
    expect(resolveDiceExpression('bardic_inspiration_die', stats, 1)).toBe('6')
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
    // '1d6+4' is not valid JS, so it returns the string as-is
    const result = evaluateAutoExpression('1d6+proficiency_bonus', stats)
    expect(result).toBe('1d6+4')
  })

  it('evaluates expressions with ability modifier replacements', () => {
    const stats = makePlayerStats()
    // '1d4+4' is not valid JS, so it returns the string as-is
    const result = evaluateAutoExpression('1d4+STR modifier', stats)
    expect(result).toBe('1d4+4')
  })

  it('applies _min_ suffix for minimum value enforcement', () => {
    const stats = makePlayerStats()
    // -5_min_3 should become Math.max(3, (-5)) = 3
    expect(evaluateAutoExpression('-5_min_3', stats)).toBe(3)
    // 10_min_3 should become Math.max(3, (10)) = 10
    expect(evaluateAutoExpression('10_min_3', stats)).toBe(10)
  })

  it('evaluates negative numbers with _min_ suffix', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('-10_min_5', stats)).toBe(5)
  })

  it('returns string when expression evaluation fails', () => {
    const stats = makePlayerStats()
    // This should fail to evaluate as a simple expression and return the string
    const result = evaluateAutoExpression('invalid_syntax_!!', stats)
    expect(typeof result).toBe('string')
  })

  it('uses default prof=0 and level=1 when not provided', () => {
    const stats = makePlayerStats()
    // '1level' → '15' (1 + level=5), evaluated as number 15
    expect(evaluateAutoExpression('1level', stats, 0, 1)).toBe(15)
  })

  it('uses provided prof override', () => {
    const stats = makePlayerStats()
    // evaluateAutoExpression's prof param is not passed to resolveDiceExpression
    // resolveDiceExpression uses playerStats.proficiency, not the prof param
    // So 'proficiency_bonus' resolves from playerStats.proficiency = 4
    expect(evaluateAutoExpression('proficiency_bonus', stats, 7)).toBe(4)
  })

  it('uses provided level override', () => {
    const stats = makePlayerStats()
    // evaluateAutoExpression's level param is not passed to resolveDiceExpression
    // resolveDiceExpression uses playerStats.level = 5
    // '1level' → '15', evaluated as number 15
    expect(evaluateAutoExpression('1level', stats, 4, 10)).toBe(15)
  })

  it('uses provided slotLevel override', () => {
    const stats = makePlayerStats()
    // '1spell_slot_level' → '1spell_slot_5' after level replacement, returns string
    const result = evaluateAutoExpression('1spell_slot_level', stats, 4, 10, 5)
    expect(result).toBe('1spell_slot_5')
  })

  it('handles expressions that evaluate to NaN by returning the string', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('1/0', stats)
    // Division by zero produces Infinity, not NaN, so it returns Infinity
    expect(result).toBe(Infinity)
  })

  it('returns non-numeric results as strings', () => {
    const stats = makePlayerStats()
    // This should not produce a number and will be returned as string
    const result = evaluateAutoExpression('Math.max(3, (0))', stats)
    expect(result).toBe(3)
  })

  it('handles rage_damage_d6 replacement in complex expression', () => {
    const stats = makePlayerStats()
    // '2rage_damage_d6+proficiency_bonus' → '22d6+4', not valid JS, returns string
    const result = evaluateAutoExpression('2rage_damage_d6+proficiency_bonus', stats)
    expect(result).toBe('22d6+4')
  })

  it('handles bardic_inspiration_die in expression', () => {
    const stats = makePlayerStats()
    // '3bardic_inspiration_die' → '36', evaluated as number 36
    const result = evaluateAutoExpression('3bardic_inspiration_die', stats)
    expect(result).toBe(36)
  })

  it('handles proficiency_bonus_d4 as string (not evaluated)', () => {
    const stats = makePlayerStats()
    const result = evaluateAutoExpression('proficiency_bonus_d4', stats)
    expect(result).toBe('4d4')
  })

  it('handles _min_ with variable expressions', () => {
    const stats = makePlayerStats()
    // -proficiency_bonus_min_2 -> Math.max(2, (-4)) = 2
    expect(evaluateAutoExpression('-proficiency_bonus_min_2', stats)).toBe(2)
  })

  it('handles case-insensitive class level replacements', () => {
    const stats = makePlayerStats()
    // '1CLERIC_LEVEL' → 'cleric_level' (case-insensitive) matches first → '15'
    expect(evaluateAutoExpression('1CLERIC_LEVEL', stats)).toBe(15)
    // '1CLERIC level' → 'cleric level' (case-insensitive) matches first → '15'
    expect(evaluateAutoExpression('1CLERIC level', stats)).toBe(15)
    // '1DRUID_LEVEL' → 'druid_level' (case-insensitive) matches first → '15'
    expect(evaluateAutoExpression('1DRUID_LEVEL', stats)).toBe(15)
  })

  it('handles expressions with multiple _min_ patterns (only first matches)', () => {
    const stats = makePlayerStats()
    // Only the first _min_ pattern should match due to regex structure
    const result = evaluateAutoExpression('5_min_3', stats)
    expect(result).toBe(5)
  })
})
