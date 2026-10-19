// @maintained-by-ai
// Lane: conditionUtils direct-helper canon (pure helpers, zero mocks).
// Every consumer test (EffectAdder, CharConditions, SavePromptModal*,
// conditionSaveService*) vi.mock's this module, so the REAL behavior of
// these exports is verified ONLY here.
//
// exports            | consumers (non-test)                                    | here
// -------------------|---------------------------------------------------------|---------------------------
// CONDITIONS       | EffectAdder, createEffectAdderHandlers, HealingPoolModal | golden pin (test 1)
// CONDITION_SAVE_DC| (reserved rule constant)                                | golden pin (test 1)
// CONDITION_SAVE_MAP| internal via getDefaultAbility                         | golden pin (test 1)
// ABILITY_LABELS   | internal via getAbilityLabel                           | golden pin (test 1)
// getDefaultAbility| EffectAdder                                             | it.each guard table
// getAbilityLabel  | CreatureCard, CharConditions, createRollConditionSaveHandler | it.each branch table
// getAbilitySaveBonus| conditionSaveService, SavePromptModal, savePromptHandlers,
//                    | concentrationPromptRoll, CharConditions               | it.each ladder table
//
// old -> new: CONDITIONS x2 + DC + SAVE_MAP x3 + LABELS -> test 1 golden;
// getDefaultAbility x3 -> one it.each; getAbilityLabel x3 -> one it.each;
// getAbilitySaveBonus x10 -> one it.each (guards + save ?? bonus ?? 0 ladder).

import { describe, it, expect } from 'vitest'
import {
  CONDITIONS,
  CONDITION_SAVE_DC,
  CONDITION_SAVE_MAP,
  ABILITY_LABELS,
  getDefaultAbility,
  getAbilityLabel,
  getAbilitySaveBonus,
} from './conditionUtils.js'

describe('conditionUtils data registry', () => {
  it('pins the rule-constant tables exactly once (drift fails loudly)', () => {
    // Hand-derived from 5e conditions once; any key, label, save-ability,
    // or DC drift breaks here — consumers all mock this module in tests.
    expect(CONDITIONS).toEqual([
      { key: 'blinded', label: 'Blinded' },
      { key: 'charmed', label: 'Charmed' },
      { key: 'cursed', label: 'Cursed' },
      { key: 'deafened', label: 'Deafened' },
      { key: 'frightened', label: 'Frightened' },
      { key: 'grappled', label: 'Grappled' },
      { key: 'incapacitated', label: 'Incapacitated' },
      { key: 'paralyzed', label: 'Paralyzed' },
      { key: 'petrified', label: 'Petrified' },
      { key: 'poisoned', label: 'Poisoned' },
      { key: 'prone', label: 'Prone' },
      { key: 'restrained', label: 'Restrained' },
      { key: 'slow', label: 'Slow' },
      { key: 'stunned', label: 'Stunned' },
      { key: 'unconscious', label: 'Unconscious' },
    ])
    expect(CONDITION_SAVE_MAP).toEqual({
      blinded: null,
      charmed: 'wis',
      cursed: 'con',
      deafened: null,
      frightened: 'wis',
      grappled: 'str',
      incapacitated: null,
      paralyzed: 'con',
      petrified: null,
      poisoned: 'con',
      prone: null,
      restrained: 'str',
      slow: 'wis',
      stunned: 'con',
      unconscious: null,
    })
    expect(CONDITION_SAVE_DC).toBe(10)
    expect(ABILITY_LABELS).toEqual({
      str: 'Strength',
      dex: 'Dexterity',
      con: 'Constitution',
      int: 'Intelligence',
      wis: 'Wisdom',
      cha: 'Charisma',
    })
  })
})

describe('getDefaultAbility', () => {
  it.each([
    ['charmed', 'wis'],       // map hit
    ['grappled', 'str'],      // map hit, different value class
    ['blinded', null],        // null map value stays null
    ['invisible', null],      // unknown key coerced to null
    ['', null],               // empty string (blank UI select) → null
    [undefined, null],        // absent arg → null, never undefined
  ])('getDefaultAbility(%s) → %s', (key, expected) => {
    expect(getDefaultAbility(key)).toBe(expected)
  })
})

describe('getAbilityLabel', () => {
  it.each([
    ['wis', 'Wisdom'],       // known lowercase abbreviation
    ['meh', 'meh'],          // unknown truthy → passthrough
    ['WIS', 'WIS'],          // case-sensitive keys → passthrough
    ['', 'None'],            // empty string → None
    [null, 'None'],          // null → None
  ])('getAbilityLabel(%s) → %s', (abbr, expected) => {
    expect(getAbilityLabel(abbr)).toBe(expected)
  })
})

describe('getAbilitySaveBonus', () => {
  const str = (bonus, save) => ({ name: 'Strength', bonus, save })

  it.each([
    // guards: missing character / abilities / abbreviation → 0
    [null, 'str', 0],
    [{}, 'str', 0],
    [{ abilities: [str(3, 5)] }, '', 0],
    // save ?? bonus ?? 0 ladder (distinct truths survive)
    [{ abilities: [str(3, 5)] }, 'str', 5],      // save wins over bonus
    [{ abilities: [str(3, 0)] }, 'str', 0],      // save 0 does NOT fall back to bonus
    [{ abilities: [str(3, undefined)] }, 'str', 3], // absent save → bonus fallback
    [{ abilities: [str(-1, -2)] }, 'str', -2],   // negative save preserved
    [{ abilities: [str(3, 5)] }, 'dex', 0],      // ability not in list → 0
    // abbreviation normalization at the abilityLookup boundary
    [{ abilities: [str(3, 5)] }, 'STR', 5],
  ])('getAbilitySaveBonus(abilities for %j, %s) → %i', (character, abbr, expected) => {
    expect(getAbilitySaveBonus(character, abbr)).toBe(expected)
  })
})
