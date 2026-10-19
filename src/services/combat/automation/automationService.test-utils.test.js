// @maintained-by-ai
// Fixture lane for makePlayerStats / makeFeature — the ONLY canonical owners of these two
// builders' contracts live here (automationService.test-utils.js:31-51). Both builders are
// pure literal spreads with zero derived/computed values, so per #923 no separate defaults
// byte-pin: every default byte is pinned exactly once by the un-overridden legs of the
// exact-shape toEqual below (#943 exact-shape absent-key honesty), and override-wins legs
// use falsifiable distinct values (#842: Grog≠TestCharacter, 4≠2, bonus 10≠5, len 1≠6).
//
// Importers (13 lanes):
//   makePlayerStats → core, collection, types, coverage, modifiers, buildAttackInfo,
//     sacredWeapon, combatSuperiorityMovement, combatSuperiorityGrantAttack
//   makeFeature     → collection, types, coverage, modifiers, buildAttackInfo, interactive,
//     twinkling, useMagicDevice, mistyWanderer
// #980 no-crossover: the vi.mock factories in the same module (parseMagicItemName,
// getAbilityModifier) are owned by ./automationService.test-utils.mocks.test.js —
// not re-pinned here.
//
// Deleted faces (#923 canon — language/vitest semantics, not helper behavior):
// - "returns defaults" / "correct ability bonuses"  → un-overridden legs of test 1 below;
//   the forEach bonus-map re-serialized the same literals already in the toEqual
// - "handles empty overrides"                         → {...{}} ≡ {...undefined} spread semantics;
//   all default bytes already pinned by test 1
// - toHaveProperty('name'/'automation')             → shape introspection; envelope is pinned
//   by exact bytes in tests 3-4
// - per-call identity f1/f2 passthrough             → vitest semantics (test-utils.js:49-51);
//   the one real claim, no-clone-by-reference, is pinned once via toBe in tests 1 and 3
//
// Old→new map: defaults×2 + primitive-merge + abilities-array → test 1; nested-class
// (strengthened: old minted both class keys, hiding shallow replace) → test 2; custom-name
// + no-clone passthrough + null/undefined automation → tests 3-4.

import { describe, it, expect } from 'vitest'

import { makePlayerStats, makeFeature } from './automationService.test-utils.js'

describe('makePlayerStats (test-utils.js:31-47)', () => {
  it('override-wins on primitives and abilities; un-overridden legs byte-exact incl. class default', () => {
    const abilities = [{ name: 'Strength', bonus: 10 }]
    const ps = makePlayerStats({ name: 'Grog', proficiency: 4, abilities })

    expect(ps).toEqual({
      name: 'Grog',
      proficiency: 4,
      level: 3,
      class: { name: 'Barbarian', levels: 3 },
      abilities: [{ name: 'Strength', bonus: 10 }],
    })
    // abilities is replaced by reference, never cloned/normalized — consumers that mutate
    // the array they passed in must see it in the fixture.
    expect(ps.abilities).toBe(abilities)
  })

  it('replaces nested objects wholesale — shallow spread, NO deep merge', () => {
    // The trap 13 importer lanes must not fall into: a partial class override replaces the
    // whole default, so class.levels (default 3) disappears rather than being merged in.
    const ps = makePlayerStats({ class: { name: 'Wizard' } })

    expect(ps.class).toEqual({ name: 'Wizard' })
  })
})

describe('makeFeature (test-utils.js:49-51)', () => {
  it("stamps default name 'Test Feature' and passes automation through by reference", () => {
    const automation = { type: 'passive_rule' }
    const feature = makeFeature(automation)

    expect(feature).toEqual({ name: 'Test Feature', automation })
    expect(feature.automation).toBe(automation)
  })

  it('second argument overrides the default name; nullish automation passes through unstamped', () => {
    expect(makeFeature(null, 'Flame Blade')).toEqual({ name: 'Flame Blade', automation: null })
    expect(makeFeature(undefined, 'Flame Blade').automation).toBeUndefined()
  })
})
