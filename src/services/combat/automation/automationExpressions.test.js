// @maintained-by-ai
import { describe, it, expect, vi, afterEach } from 'vitest'
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
  STRING_SENTINEL_EXPRESSIONS,
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
  it('returns a numeric spec unchanged', () => {
    expect(resolveUses(makePlayerStats(), 3)).toBe(3)
  })

  it('resolves "proficiency_bonus" to proficiency, 0 when missing', () => {
    expect(resolveUses(makePlayerStats(), 'proficiency_bonus')).toBe(4)
    expect(resolveUses(makePlayerStats({ proficiency: undefined }), 'proficiency_bonus')).toBe(0)
  })

  it('returns player level when "<class>_level" matches the class name (case-insensitive)', () => {
    expect(resolveUses(makePlayerStats(), 'barbarian_level')).toBe(5)
    expect(resolveUses(makePlayerStats({ class: { name: 'Barbarian' } }), 'barbarian_level')).toBe(5)
  })

  it('falls back to class.levels then player level when the class name does not match', () => {
    expect(resolveUses(makePlayerStats({ class: { name: 'wizard', levels: 10 } }), 'barbarian_level')).toBe(10)
    expect(resolveUses(makePlayerStats({ class: { name: 'wizard' } }), 'barbarian_level')).toBe(5)
    expect(resolveUses(makePlayerStats({ class: undefined }), 'barbarian_level')).toBe(5)
  })

  it('falls back to player level for unrecognized patterns', () => {
    expect(resolveUses(makePlayerStats(), 'unknown_pattern')).toBe(5)
  })

  it('falls back to 1 when level is falsy and the pattern is unrecognized', () => {
    expect(resolveUses(makePlayerStats({ level: 0 }), 'unknown_pattern')).toBe(1)
  })
})

// ── resolveScaling ───────────────────────────────────────────────

describe('resolveScaling', () => {
  it('returns null for missing, non-array, or empty scalings', () => {
    for (const scaling of [null, undefined, '', [], {}]) {
      expect(resolveScaling(makePlayerStats(), scaling)).toBe(null)
    }
  })

  it('picks the highest array entry <= player level; null below all entries', () => {
    const scaling = [
      { level: 1, value: 'low' },
      { level: 3, value: 'mid' },
      { level: 7, value: 'high' },
    ]
    expect(resolveScaling(makePlayerStats({ level: 5 }), scaling)).toEqual({ level: 3, value: 'mid' })
    expect(resolveScaling(makePlayerStats({ level: 20 }), scaling)).toEqual({ level: 7, value: 'high' })
    expect(resolveScaling(makePlayerStats({ level: 1 }), [{ level: 3, value: 'mid' }])).toBe(null)
  })

  it('skips entries without a level and honours array order for unsorted input', () => {
    const scaling = [
      { level: 7, value: 'high' },
      { value: 'no-level' },
      { level: 1, value: 'low' },
      { level: 3, value: 'mid' },
    ]
    // Arrays are NOT re-sorted: the LAST qualifying entry wins (3), never 7.
    expect(resolveScaling(makePlayerStats({ level: 5 }), scaling)).toEqual({ level: 3, value: 'mid' })
  })

  // CLA-208: classes.json stores scaling as object maps, e.g. Land's Aid {"10":"3d6","14":"4d6"}
  it('resolves object-map scaling to {level, damage} at the highest threshold <= level', () => {
    expect(resolveScaling(makePlayerStats({ level: 20 }), { '10': '3d6', '14': '4d6' }))
      .toEqual({ level: 14, damage: '4d6' })
    expect(resolveScaling(makePlayerStats({ level: 12 }), { '10': '3d6', '14': '4d6' }))
      .toEqual({ level: 10, damage: '3d6' })
  })

  it('sorts unordered object-map keys before resolving and returns null below all thresholds', () => {
    expect(resolveScaling(makePlayerStats({ level: 20 }), { '14': '4d6', '10': '3d6' }))
      .toEqual({ level: 14, damage: '4d6' })
    expect(resolveScaling(makePlayerStats({ level: 3 }), { '10': '3d6', '14': '4d6' })).toBe(null)
  })
})

// ── getSaveDc ────────────────────────────────────────────────────

describe('getSaveDc', () => {
  it('computes 8 + ability modifier + proficiency, incl. negative modifiers', () => {
    const stats = makePlayerStats()
    expect(getSaveDc(stats, 'strength', 4)).toBe(16)
    expect(getSaveDc(stats, 'charisma', 4)).toBe(11)
  })

  it('defaults proficiency to 0 when omitted', () => {
    expect(getSaveDc(makePlayerStats(), 'dexterity')).toBe(10)
  })

  it('treats unknown abilities and missing abilities arrays as modifier 0', () => {
    expect(getSaveDc(makePlayerStats(), 'unknown', 4)).toBe(12)
    expect(getSaveDc(makePlayerStats({ abilities: undefined }), 'strength', 0)).toBe(8)
  })
})

// ── resolveHealingPoolExpression ─────────────────────────────────

describe('resolveHealingPoolExpression', () => {
  it('returns baseExpression when scaling is falsy (undefined base passes through)', () => {
    expect(resolveHealingPoolExpression('2d6', null)).toBe('2d6')
    expect(resolveHealingPoolExpression(undefined, null)).toBe(undefined)
  })

  it('applies the highest matching level, incl. between entries and beyond all entries', () => {
    const scaling = { 3: '3d6', 5: '4d6' }
    expect(resolveHealingPoolExpression('2d6', scaling, makePlayerStats({ level: 5 }))).toBe('4d6')
    expect(resolveHealingPoolExpression('2d6', scaling, makePlayerStats({ level: 4 }))).toBe('3d6')
    expect(resolveHealingPoolExpression('2d6', scaling, makePlayerStats({ level: 10 }))).toBe('4d6')
  })

  it('keeps baseExpression when the level is below all entries', () => {
    expect(resolveHealingPoolExpression('2d6', { 3: '3d6', 5: '4d6' }, makePlayerStats({ level: 1 }))).toBe('2d6')
  })

  it('ignores non-numeric scaling keys', () => {
    const scaling = { invalid: 'bad', 3: '3d6', 5: '4d6' }
    expect(resolveHealingPoolExpression('2d6', scaling, makePlayerStats({ level: 5 }))).toBe('4d6')
  })
})

// ── getSuperiorityDieSize ────────────────────────────────────────

describe('getSuperiorityDieSize', () => {
  it('returns d12/d10/d8 by level tier, defaulting to d8 for missing stats', () => {
    expect(getSuperiorityDieSize({ level: 18 })).toBe(12)
    expect(getSuperiorityDieSize({ level: 10 })).toBe(10)
    expect(getSuperiorityDieSize({ level: 5 })).toBe(8)
    expect(getSuperiorityDieSize({})).toBe(8)
    expect(getSuperiorityDieSize(null)).toBe(8)
  })

  // FS-010: style dice beats the level table for non-Battle Masters.
  it('caps at d6 for a Superior Technique fighter who is not a Battle Master', () => {
    const stats = {
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Superior Technique'] },
    }
    expect(getSuperiorityDieSize(stats)).toBe(6)
  })

  it('keeps the level table for Battle Masters who also list the style (major or subclass)', () => {
    const major = { level: 18, class: { name: 'Fighter', major: { name: 'Battle Master' }, fightingStyles: ['Superior Technique'] } }
    const subclass = { level: 18, class: { name: 'Fighter', subclass: { name: 'Battle Master' } } }
    expect(getSuperiorityDieSize(major)).toBe(12)
    expect(getSuperiorityDieSize(subclass)).toBe(12)
  })
})

// ── getPsionicEnergyDieSize ──────────────────────────────────────

describe('getPsionicEnergyDieSize', () => {
  it('prefers energy_die_type from the class_levels entry matching player level', () => {
    const stats = {
      level: 5,
      class: { class_levels: [{ level: 5, energy: { energy_die_type: 10 } }] },
    }
    expect(getPsionicEnergyDieSize(stats)).toBe(10)
    // An entry at a different level does not count — falls through to the tier table (d6 at 5).
    const stale = {
      level: 5,
      class: { class_levels: [{ level: 4, energy: { energy_die_type: 8 } }] },
    }
    expect(getPsionicEnergyDieSize(stale)).toBe(6)
  })

  it('falls back to d6 when the matching entry has energy but no energy_die_type', () => {
    const stats = { level: 5, class: { class_levels: [{ level: 5, energy: {} }] } }
    expect(getPsionicEnergyDieSize(stats)).toBe(6)
  })

  it('uses the level tier table when no class energy entry applies', () => {
    expect(getPsionicEnergyDieSize({ level: 17 })).toBe(12)
    expect(getPsionicEnergyDieSize({ level: 13 })).toBe(10)
    expect(getPsionicEnergyDieSize({ level: 9 })).toBe(8)
    expect(getPsionicEnergyDieSize({ level: 3 })).toBe(6)
    expect(getPsionicEnergyDieSize({})).toBe(6)
  })

  it('throws on null playerStats — unguarded class access (surfaces via resolveDiceExpression)', () => {
    expect(() => getPsionicEnergyDieSize(null)).toThrow(TypeError)
  })
})

// ── resolveDiceExpression ────────────────────────────────────────

describe('resolveDiceExpression', () => {
  it.each([
    // [expression, expected, why] — base stats: prof 4, level 5, STR +4, CHA -1,
    // barbarian rage_damage 2, bardic_die 6
    ['proficiency_bonus', '4', 'plain proficiency'],
    ['proficiency_bonus_d4', '4d4', 'must beat short proficiency_bonus (else "4_d4")'],
    ['rage_damage_d6', '2d6', 'must beat short rage_damage (else "2_d6")'],
    ['rage_damage', '2', 'numeric rage bonus'],
    ['bardic_inspiration_die', '6', 'bardic die token'],
    ['1bardic_inspiration_die', '16', 'string concat quirk — "1" + "6"'],
    ['superiority_die', '8', 'superiority die size'],
    ['psionic_energy_die', '6', 'psionic energy die size'],
    ['martial_arts_die', '4', 'default when class_levels has none'],
    ['favored_enemy', '0', 'default when class_levels has none'],
    ['ally_hit_die', '4', 'companion hit die'],
    ['spellSlotLevel', '2', 'camelCase slot token (slotLevel arg = 2)'],
    ['level', '5', 'generic level'],
    ['1STR modifier', '14', 'positive modifier appends'],
    ['1CHA modifier', '1-1', 'negative modifier concat quirk'],
  ])('resolves %s → %s (%s)', (expression, expected) => {
    expect(resolveDiceExpression(expression, makePlayerStats(), 2)).toBe(expected)
  })

  it('substitutes every class-level token spelling with the player level', () => {
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

  it('resolves spell_slot_level from the slotLevel argument, defaulting to 1', () => {
    const stats = makePlayerStats()
    expect(resolveDiceExpression('spell_slot_level', stats)).toBe('1')
    expect(resolveDiceExpression('spell_slot_level', stats, 3)).toBe('3')
  })

  it('resolves spellcasting_ability_modifier via spellAbilities, defaulting to intelligence', () => {
    expect(resolveDiceExpression('spellcasting_ability_modifier', makePlayerStats(), 1)).toBe('1')
    const wis = makePlayerStats({ spellAbilities: { spellcasting_ability: 'charisma' } })
    expect(resolveDiceExpression('spellcasting_ability_modifier', wis, 1)).toBe('-1')
  })

  it('reads martial_arts_die / favored_enemy from the level-matching class_levels entry', () => {
    const monk = makePlayerStats({ class: { name: 'monk', class_levels: [{ level: 5, martial_arts_die: 6 }] } })
    expect(resolveDiceExpression('martial_arts_die', monk, 1)).toBe('6')
    const ranger = makePlayerStats({ class: { name: 'ranger', class_levels: [{ level: 5, favored_enemy: 2 }] } })
    expect(resolveDiceExpression('favored_enemy', ranger, 1)).toBe('2')
  })

  it('clamps proficiency_bonus_d4 to a minimum of 1d4 when proficiency is 0 or negative', () => {
    expect(resolveDiceExpression('proficiency_bonus_d4', makePlayerStats({ proficiency: 0 }), 1)).toBe('1d4')
    expect(resolveDiceExpression('proficiency_bonus_d4', makePlayerStats({ proficiency: -1 }), 1)).toBe('1d4')
  })

  it('applies all replacements in one expression, leaving dice notation intact', () => {
    expect(resolveDiceExpression('1d6+proficiency_bonus+STR modifier', makePlayerStats(), 1)).toBe('1d6+4+4')
  })

  it('maps ally_hit_die across every level bracket', () => {
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 1 }), 1)).toBe('4')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 5 }), 1)).toBe('4')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 9 }), 1)).toBe('6')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 13 }), 1)).toBe('8')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 17 }), 1)).toBe('10')
    expect(resolveDiceExpression('ally_hit_die', makePlayerStats({ level: 20 }), 1)).toBe('12')
  })

  it('returns falsy expressions unchanged', () => {
    expect(resolveDiceExpression(null, makePlayerStats(), 1)).toBe(null)
    expect(resolveDiceExpression('', makePlayerStats(), 1)).toBe('')
  })

  it('throws on null playerStats (unguarded getPsionicEnergyDieSize)', () => {
    expect(() => resolveDiceExpression('proficiency_bonus', null, 1)).toThrow(TypeError)
  })
})

// ── evaluateAutoExpression ───────────────────────────────────────
// Lane invariant: token substitution + arithmetic evaluation happen HERE;
// dice notation is returned as a STRING for diceRoller to evaluate later.

describe('evaluateAutoExpression', () => {
  it('returns falsy expressions unchanged', () => {
    expect(evaluateAutoExpression(null, makePlayerStats())).toBe(null)
    expect(evaluateAutoExpression('', makePlayerStats())).toBe('')
  })

  it('evaluates pure arithmetic to a number, auto-prefixing floor/ceil/round', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('2+3', stats)).toBe(5)
    expect(evaluateAutoExpression('5-5', stats)).toBe(0)
    expect(evaluateAutoExpression('floor(3.7)', stats)).toBe(3)
    expect(evaluateAutoExpression('ceil(3.2)', stats)).toBe(4)
    expect(evaluateAutoExpression('round(3.5)', stats)).toBe(4)
  })

  it('substitutes tokens but keeps dice notation as strings for diceRoller', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('1d6', stats)).toBe('1d6')
    expect(evaluateAutoExpression('2d8+3', stats)).toBe('2d8+3')
    expect(evaluateAutoExpression('1d6+proficiency_bonus', stats)).toBe('1d6+4')
    expect(evaluateAutoExpression('1d4+STR modifier', stats)).toBe('1d4+4')
  })

  it('clamps with _min_ across plain, token, and parenthesised expressions', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('-5_min_3', stats)).toBe(3)
    expect(evaluateAutoExpression('10_min_3', stats)).toBe(10)
    expect(evaluateAutoExpression('-proficiency_bonus_min_2', stats)).toBe(2)
    expect(evaluateAutoExpression('(-proficiency_bonus - 2)_min_5', stats)).toBe(5)
    // Regex quirk: the minimum must be digits-only, so this stays verbatim.
    expect(evaluateAutoExpression('5_min_-3', stats)).toBe('5_min_-3')
  })

  it('returns Infinity for 1/0 but the original string when the result is NaN', () => {
    const stats = makePlayerStats()
    expect(evaluateAutoExpression('1/0', stats)).toBe(Infinity)
    expect(evaluateAutoExpression('0/0', stats)).toBe('0/0')
  })

  it('fully evaluates token arithmetic with no dice present', () => {
    expect(evaluateAutoExpression('ally_hit_die + proficiency_bonus', makePlayerStats({ level: 5 }), 1)).toBe(8)
  })
})

// ── STRING_SENTINEL_EXPRESSIONS — data-driven string markers ─────
// "class_level_scaling" (2024 classes.json maxKinds/maxRages/uses_expression)
// is resolved by component-level logic, not the expression engine. It must
// pass through verbatim WITHOUT the string-fallback console.warn (app-load
// noise), while genuinely malformed expressions still warn.

describe('evaluateAutoExpression string sentinels', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(STRING_SENTINEL_EXPRESSIONS)('returns sentinel %s verbatim without warning', (sentinel) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(evaluateAutoExpression(sentinel, makePlayerStats())).toBe(sentinel)
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not token-substitute or coerce the sentinel (no numeric conversion, no throw)', () => {
    // Level 5 stats would otherwise let \blevel\b-style tokens corrupt a match;
    // the exact-string guard short-circuits before resolveDiceExpression.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = evaluateAutoExpression('class_level_scaling', makePlayerStats({ level: 5 }))
    expect(result).toBe('class_level_scaling')
    expect(typeof result).toBe('string')
    expect(warn).not.toHaveBeenCalled()
  })

  it('still warns exactly once for a genuinely unparseable non-sentinel expression', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(evaluateAutoExpression('@@invalid@@', makePlayerStats())).toBe('@@invalid@@')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]).toContain('@@invalid@@')
  })

  it('reresolveAutomationUsesMax leaves sentinel uses_expression entries untouched and silent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stats = {
      level: 5,
      proficiency: 3,
      abilities: [{ name: 'Wisdom', bonus: 3 }],
      automation: {
        specialActions: [{
          type: 'resource_pool',
          name: 'Channel Divinity',
          uses: 2,
          usesMax: 2,
          uses_expression: 'class_level_scaling',
        }],
      },
    }
    reresolveAutomationUsesMax(stats)
    expect(stats.automation.specialActions[0].usesMax).toBe(2)
    expect(stats.automation.specialActions[0].uses).toBe(2)
    expect(warn).not.toHaveBeenCalled()
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
