// @maintained-by-ai
// Lane: automationPassives BASE — the generic passive dispatch/collection
// framework: hasPassiveEffect + delegate census, collectWeaponMastery plumbing
// (extra/replace/choice/kind aggregation, null shapes), the un-gated legs of
// getDamageResistances (passive_immunity / passive_buff / fiendish_resilience
// union, dedupe-if-authored), resilient-sphere store-read routing, GW-fight
// delegation, and getDamageReduction eligibility/resolution.
// Family map (cited, never duplicated): elementalAdept #965 owns multi-adept
// name-keyed chosen-type routing, store-byte-governs, union arms, and
// minDamage consumption here in automationPassives.elementalAdept.test.js —
// this base lane keeps only the single-passive elemental_adept happy/absence
// rows for both predicates. fortifiedHealth #966 owns resolveHealingBonuses*
// + mark latch (base never imports them). landResistance #967 owns the
// landMappings ladder; stormbornResistance #968 owns the type:'resistance'
// gate truth-tables — base pins only their mocked-zero non-interference rows
// (#937). wm008-kindgate owns kind-gate × replaceMastery precedence.
// Old -> new: 58 its -> 26 blocks. hasPassiveEffect 5->2; wrappers 2->1
// delegate table (15 rows, now covering every *Has*-style export);
// collectWeaponMastery 10->7 (mis-titled "kind mastery does not match"
// absent-row removed #910/#921 — its kind-gate legs live in wm008;
// replace-survives folded into the aggregation test; meleeOnly ranged/
// melee its into one gate table); isResistantToDamageType 4->2;
// hasIgnoreResistance 7->1 table (adept single-passive rows kept per #965
// lane header); hasMinDamage 4->1 table; getDamageResistances 8->3
// (type-router census incl. fiendish casing byte and mocked-zero ticket
// rows; dedupe-union kept exact authored order #864); resilient sphere
// 7->2 with name+key routed store mocks replacing order-dependent
// mockReturnValueOnce sequences (#908); GW apply 2->1 both legs;
// getDamageReduction 9->6 (null-shape/empty-damageTypes/case rows folded
// into the eligibility table; FT-045 and chosen-gate kept whole).
// Pure predicates: no logging, no timers, zero network, no wall-clock.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hasPassiveEffect,
  collectWeaponMastery,
  hasHealingMaximization,
  hasRerollHealingOnes,
  hasTacticalShift,
  hasSpeedyOpportunityDisadvantage,
  hasSpeedyDifficultTerrainIgnore,
  isResistantToDamageType,
  hasIgnoreResistance,
  hasMinDamage,
  getDamageResistances,
  isResilientSphereActive,
  getResilientSphereSource,
  hasGreatWeaponFighting,
  applyGreatWeaponFightingToDamage,
  getDamageReduction,
  hasTruesight,
  hasFastWrestler,
  hasTwoWeaponFighting,
  hasSomaticComponentWaiver,
  hasNaturallyStealthy,
  hasInterception,
  hasProtection,
  hasThrownWeaponFighting,
  hasBlessedWarrior,
} from './automationPassives.js'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(),
}))

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((_abilities, abilityName) => {
    const map = { strength: 3, dexterity: 2, constitution: 1, intelligence: 0, wisdom: -1, charisma: 0 }
    return map[abilityName?.toLowerCase()] ?? 0
  }),
}))

vi.mock('./automationExpressions.js', () => {
  const evaluateAutoExpression = vi.fn()
  return {
    evaluateAutoExpression,
    resolveNumericExpression: (...args) => evaluateAutoExpression(...args),
  }
})

vi.mock('../../rules/core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn(),
}))

// ── Imports for mocked modules ─────────────────────────────────────

import { parseMagicItemName } from '../../rules/core/attackCalc.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getChosenRuntimeValue } from '../../automation/common/choiceStorage.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { applyGreatWeaponFighting } from '../../rules/core/greatWeaponFighting.js'

// ── Shared fixtures / defaults ─────────────────────────────────────

const ps = (passives) => ({ automation: { passives } })

// Kind-gate store route: chosenWeapons bucket answers, everything else is
// explicitly null (#940) — the ONLY byte accumulateKindMastery consults.
const kindRoute = (chosenWeapons) => (name, key) =>
  key === '_Weapon_Kind_Mastery_chosenWeapons' ? chosenWeapons : null

beforeEach(() => {
  vi.clearAllMocks()
  parseMagicItemName.mockImplementation((name) => ({
    baseName: String(name).replace(/^\+\d+\s+/, ''),
    magicBonus: 0,
  }))
  getRuntimeValue.mockReturnValue(null)
  getChosenRuntimeValue.mockReturnValue(null)
  evaluateAutoExpression.mockReturnValue(0)
})

// ── hasPassiveEffect ──────────────────────────────────────────────

describe('hasPassiveEffect', () => {
  it('matches type AND effect together, among many passives', () => {
    const multi = {
      automation: {
        passives: [
          { type: 'passive_buff', effect: 'blindsight' },
          { type: 'passive_rule', effect: 'superior_dice' },
          { type: 'passive_immunity', effect: 'fire' },
        ],
      },
    }
    expect(hasPassiveEffect(multi, 'passive_rule', 'superior_dice')).toBe(true)
    // Right effect on the wrong type (and vice-versa) never matches.
    expect(hasPassiveEffect(multi, 'passive_buff', 'superior_dice')).toBe(false)
    expect(hasPassiveEffect(multi, 'passive_rule', 'blindsight')).toBe(false)
  })

  it('returns false when stats, automation, or passives are absent or empty', () => {
    expect(hasPassiveEffect(null, 'passive_rule', 'superior_dice')).toBe(false)
    expect(hasPassiveEffect({}, 'passive_rule', 'superior_dice')).toBe(false)
    expect(hasPassiveEffect({ automation: { passives: null } }, 'passive_rule', 'superior_dice')).toBe(false)
    expect(hasPassiveEffect({ automation: { passives: [] } }, 'passive_rule', 'superior_dice')).toBe(false)
  })
})

// ── type+effect delegate census (every thin wrapper export) ───────

describe('has*-style delegate wrappers', () => {
  const DELEGATES = [
    { fn: hasHealingMaximization, effect: 'maximize_healing_dice' },
    { fn: hasRerollHealingOnes, effect: 'reroll_healing_ones' },
    { fn: hasTacticalShift, effect: 'tactical_shift_no_oa' },
    { fn: hasSpeedyOpportunityDisadvantage, effect: 'opportunity_attacks_disadvantage' },
    { fn: hasSpeedyDifficultTerrainIgnore, effect: 'ignore_difficult_terrain_on_dash' },
    { fn: hasGreatWeaponFighting, effect: 'great_weapon_fighting' },
    { fn: hasTwoWeaponFighting, effect: 'two_weapon_fighting' },
    { fn: hasNaturallyStealthy, effect: 'naturally_stealthy' },
    { fn: hasInterception, effect: 'interception' },
    { fn: hasProtection, effect: 'protection' },
    { fn: hasThrownWeaponFighting, effect: 'thrown_weapon_fighting' },
    { fn: hasBlessedWarrior, effect: 'blessed_warrior' },
    { fn: hasTruesight, type: 'passive_buff', effect: 'truesight' },
    { fn: hasFastWrestler, type: 'passive_buff', effect: 'fast_wrestler' },
    { fn: hasSomaticComponentWaiver, type: 'passive_buff', effect: 'somatic_component_waiver' },
  ]

  it.each(DELEGATES.map(({ fn, type = 'passive_rule', effect }) => ({
    label: `${fn.name} <-> ${type}/${effect}`,
    fn,
    armed: ps([{ type, effect }]),
    effect,
    type,
  })))('$label is true armed, false without its exact passive', ({ fn, armed, type, effect }) => {
    expect(fn(armed)).toBe(true)
    expect(fn(ps([{ type, effect: 'other_effect' }]))).toBe(false)
    // Armed flag on the wrong type must not qualify either.
    const wrongType = type === 'passive_rule' ? 'passive_buff' : 'passive_rule'
    expect(fn(ps([{ type: wrongType, effect }]))).toBe(false)
  })
})

// ── collectWeaponMastery ──────────────────────────────────────────

describe('collectWeaponMastery', () => {
  it('returns the weapon baseMastery and the exact envelope for a kind-mastery weapon', () => {
    getRuntimeValue.mockImplementation(kindRoute(['Longsword']))
    const playerStats = {
      name: 'TestChar',
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ type: 'weapon_kind_mastery' }] },
    }
    const result = collectWeaponMastery('+1 Longsword', playerStats)
    expect(parseMagicItemName).toHaveBeenCalledWith('+1 Longsword')
    expect(result).toEqual({
      baseMastery: 'push',
      extraMasteries: [],
      replaceMasteryOptions: null,
      choiceMasteries: null,
      featureName: null,
    })
  })

  it('accumulates extraMastery entries in authored order, deduped first-wins', () => {
    getRuntimeValue.mockImplementation(kindRoute(['Longsword']))
    // Lowercase 'push'/'topple' are NOT the capitalised CHOICE_MASTERY_NAMES,
    // so they land in plain extraMasteries — case-sensitive bucket routing.
    const playerStats = {
      name: 'TestChar',
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: {
        passives: [
          { type: 'weapon_kind_mastery' },
          { extraMastery: ['topple', 'push'] },
          { extraMastery: ['push'] },
        ],
      },
    }
    expect(collectWeaponMastery('Longsword', playerStats)).toEqual({
      baseMastery: 'push',
      extraMasteries: ['topple', 'push'],
      replaceMasteryOptions: null,
      choiceMasteries: null,
      featureName: null,
    })
  })

  it('routes capitalised choice masteries to the chooser options with the granting feature (Battering Roots)', () => {
    getRuntimeValue.mockImplementation(kindRoute(['Greataxe']))
    const playerStats = {
      name: 'TestChar',
      equipment: [{ name: 'Greataxe', mastery: 'vex' }],
      automation: {
        passives: [
          { type: 'weapon_kind_mastery' },
          { name: 'Battering Roots', type: 'passive_buff', effect: 'extra_reach', extraMastery: ['Push', 'Topple'] },
        ],
      },
    }
    const result = collectWeaponMastery('Greataxe', playerStats)
    expect(result.baseMastery).toBe('vex')
    expect(result.choiceMasteries).toEqual(['Push', 'Topple'])
    expect(result.replaceMasteryOptions).toEqual(['Push', 'Topple'])
    expect(result.featureName).toBe('Battering Roots')
    expect(result.extraMasteries).toEqual([])
  })

  it('aggregates extra, replace, and weapon_mastery_choice arms in one passives array', () => {
    getChosenRuntimeValue.mockImplementation((_ps, passiveName, field) =>
      passiveName === 'mc' && field === 'chosenMastery' ? 'topple' : null)
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: {
        passives: [
          { extraMastery: ['shove'] },
          { replaceMastery: ['trip'] },
          { type: 'weapon_mastery_choice', name: 'mc', masteryProperties: ['topple', 'shove'] },
        ],
      },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBe('push') // replaceMastery does not clear a usable base
    expect(result.extraMasteries).toEqual(['shove', 'topple']) // authored order: extra arm, then choice arm
    expect(result.replaceMasteryOptions).toEqual(['trip'])
  })

  it('offers no replaceMastery options when the weapon has no usable base mastery', () => {
    // resolveMasteryOptions: Tactical Master only qualifies on a weapon that
    // already carries a mastery; a mastery-less weapon falls through null.
    const result = collectWeaponMastery('Longsword', {
      equipment: [{ name: 'Longsword' }],
      automation: { passives: [{ replaceMastery: ['topple', 'shove'] }] },
    })
    expect(result).toEqual({
      baseMastery: null,
      extraMasteries: [],
      replaceMasteryOptions: null,
      choiceMasteries: null,
      featureName: null,
    })
  })

  it.each([
    { label: 'Ranged weapon gated out', weapon: { name: 'Longbow', mastery: 'range', weapon_range: 'Ranged' } },
    { label: 'weapon_range absent gated out', weapon: { name: 'Dagger', mastery: 'push' } },
    { label: 'Melee weapon passes', weapon: { name: 'Shortsword', mastery: 'push', weapon_range: 'Melee' }, expected: 'push' },
  ])('meleeOnly kind mastery: $label', ({ weapon, expected = null }) => {
    getRuntimeValue.mockImplementation(kindRoute([weapon.name])) // chosen bucket contains it — only range may veto
    const result = collectWeaponMastery(weapon.name, {
      name: 'TestChar',
      equipment: [weapon],
      automation: { passives: [{ type: 'weapon_kind_mastery', meleeOnly: true }] },
    })
    expect(result.baseMastery).toBe(expected)
  })

  it('returns null baseMastery across null passives, equipment, automation, or unknown weapons', () => {
    const kindps = (extra) => ({
      name: 'TestChar',
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ type: 'weapon_kind_mastery' }] },
      ...extra,
    })
    // Store answers null by default => chosen bucket never matches => gate nulls base.
    expect(collectWeaponMastery('Longsword', kindps({ automation: { passives: null } })).baseMastery).toBeNull()
    expect(collectWeaponMastery('Longsword', kindps({ equipment: null })).baseMastery).toBeNull()
    expect(collectWeaponMastery('Longsword', { automation: null }).baseMastery).toBeNull()
    expect(collectWeaponMastery('Unknown Weapon', kindps({ equipment: [] })).baseMastery).toBeNull()
  })
})

// ── isResistantToDamageType ───────────────────────────────────────

describe('isResistantToDamageType', () => {
  it('matches passive_immunity damageResistance case-insensitively', () => {
    const playerStats = ps([{ type: 'passive_immunity', damageResistance: ['Fire', 'COLD'] }])
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(true)
    expect(isResistantToDamageType(playerStats, 'cOLD')).toBe(true)
    expect(isResistantToDamageType(playerStats, 'lightning')).toBe(false)
  })

  it('returns false for missing or unusable resistance shapes', () => {
    expect(isResistantToDamageType({ automation: null }, 'fire')).toBe(false)
    expect(isResistantToDamageType(ps([]), 'fire')).toBe(false)
    expect(isResistantToDamageType(ps([{ type: 'passive_immunity' }]), 'fire')).toBe(false)
    expect(isResistantToDamageType(ps([{ type: 'passive_immunity', damageResistance: 'fire' }]), 'fire')).toBe(false)
  })
})

// ── hasIgnoreResistance ───────────────────────────────────────────

describe('hasIgnoreResistance', () => {
  // Single-passive framework rows. Multi-adept name routing, store-byte-
  // governs, and union arms live in automationPassives.elementalAdept.test.js (#965).
  const ROWS = [
    { label: 'passive_rule arm with empty damageTypes covers all types', passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: [] }], damageType: 'fire', expected: true },
    { label: 'passive_rule arm without damageTypes covers all types', passives: [{ type: 'passive_rule', effect: 'ignore_resistance' }], damageType: 'any', expected: true },
    { label: 'passive_rule arm matches case-insensitively', passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['Fire', 'Cold'] }], damageType: 'COLD', expected: true },
    { label: 'passive_rule arm misses non-listed type', passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['fire', 'cold'] }], damageType: 'lightning', expected: false },
    { label: 'elemental_adept chosen type matches case-insensitively', passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }], damageType: 'fire', chosen: 'Fire', expected: true },
    { label: 'elemental_adept with non-matching chosen type', passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }], damageType: 'fire', chosen: 'cold', expected: false },
    { label: 'elemental_adept with no chosen value', passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }], damageType: 'fire', expected: false },
    { label: 'foreign passive arms never qualify', passives: [{ type: 'passive_buff', effect: 'test' }], damageType: 'fire', expected: false },
  ]

  it.each(ROWS)('$label', ({ passives, damageType, chosen = null, expected }) => {
    getChosenRuntimeValue.mockReturnValue(chosen)
    expect(hasIgnoreResistance(ps(passives), damageType)).toBe(expected)
  })

  it('returns false when automation is null', () => {
    expect(hasIgnoreResistance({ automation: null }, 'fire')).toBe(false)
  })
})

// ── hasMinDamage ──────────────────────────────────────────────────

describe('hasMinDamage', () => {
  // Only the elemental_adept leg supplies minDamage; consumption semantics
  // per #965 lane (multi-passive, foreign-effect at scale live there).
  const adept = (extra = {}) => ({ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', ...extra })
  const ROWS = [
    { label: 'armed adept with matching chosen type', passives: [adept({ minDamage: true })], chosen: 'fire', expected: true },
    { label: 'minDamage unset', passives: [adept()], chosen: 'fire', expected: false },
    { label: 'minDamage explicitly false', passives: [adept({ minDamage: false })], chosen: 'fire', expected: false },
    { label: 'chosen type does not match', passives: [adept({ minDamage: true })], chosen: 'cold', expected: false },
    { label: 'no chosen value stored', passives: [adept({ minDamage: true })], expected: false },
    { label: 'foreign damage_type_choice effect even with minDamage', passives: [{ type: 'damage_type_choice', effect: 'elemental_affinity', name: 'ea', minDamage: true }], chosen: 'fire', expected: false },
    { label: 'no passives at all', passives: [], expected: false },
  ]

  it.each(ROWS)('$label', ({ passives, chosen = null, expected }) => {
    getChosenRuntimeValue.mockReturnValue(chosen)
    expect(hasMinDamage(ps(passives), 'fire')).toBe(expected)
  })
})

// ── getDamageResistances ──────────────────────────────────────────

describe('getDamageResistances', () => {
  // Type-router census over the un-gated legs. Stormborn/Full-of-Stars gate
  // truth-tables live in automationPassives.stormbornResistance.test.js (#968);
  // landMappings ladder in automationPassives.landResistance.test.js (#967).
  it.each([
    { label: 'passive_immunity contributes damageResistance', passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }], expected: ['fire', 'cold'] },
    { label: 'passive_buff contributes resistances', passives: [{ type: 'passive_buff', resistances: ['necrotic', 'psychic'] }], expected: ['necrotic', 'psychic'] },
    { label: 'fiendish_resilience emits the chosen store byte verbatim (casing preserved)', passives: [{ type: 'damage_type_choice', effect: 'fiendish_resilience', name: 'Fiendish Resilience' }], chosen: 'Fire', expected: ['Fire'] },
    { label: 'fiendish_resilience without chosen type contributes nothing', passives: [{ type: 'damage_type_choice', effect: 'fiendish_resilience', name: 'Fiendish Resilience' }], expected: [] },
    { label: 'passive_immunity without damageResistance array contributes nothing', passives: [{ type: 'passive_immunity' }], expected: [] },
    { label: 'passive_buff without resistances array contributes nothing', passives: [{ type: 'passive_buff', effect: 'test' }], expected: [] },
    { label: 'unknown type contributes nothing', passives: [{ type: 'mystery', damageResistance: ['fire'] }], expected: [] },
    { label: 'Stormborn gate closed (store byte unset) emits nothing (#937 mocked-zero)', passives: [{ type: 'resistance', name: 'Stormborn', damageTypes: ['Cold', 'Lightning', 'Thunder'] }], expected: [] },
    { label: 'land_resistance with no land-type byte maps to nothing (#937 mocked-zero)', passives: [{ type: 'land_resistance', landMappings: { arid: 'Fire' } }], expected: [] },
  ])('$label', ({ passives, chosen = null, expected }) => {
    getChosenRuntimeValue.mockReturnValue(chosen)
    expect(getDamageResistances(ps(passives))).toEqual(expected)
  })

  it('unions all contributing legs in authored passives order, deduped first-wins, never re-sorted', () => {
    getChosenRuntimeValue.mockReturnValue('acid')
    const playerStats = ps([
      { type: 'passive_immunity', damageResistance: ['fire', 'cold'] },
      { type: 'passive_buff', name: 'Aura of Warding', resistances: ['necrotic', 'fire'] },
      { type: 'damage_type_choice', effect: 'fiendish_resilience', name: 'Fiendish Resilience' },
      { type: 'passive_immunity', damageResistance: ['fire', 'lightning'] },
    ])
    expect(getDamageResistances(playerStats)).toEqual(['fire', 'cold', 'necrotic', 'acid', 'lightning'])
  })

  it('returns [] when automation or passives are absent or empty', () => {
    expect(getDamageResistances({ automation: null })).toEqual([])
    expect(getDamageResistances({})).toEqual([])
    expect(getDamageResistances(ps([]))).toEqual([])
    expect(getDamageResistances({ automation: { passives: null } })).toEqual([])
  })
})

// ── resilient sphere (store-read routing at framework level) ──────

describe('resilient sphere lookup', () => {
  const TARGET = 'TestCharacter'

  // Name+key routed store (#908): each read answers its own key, so the
  // two-read order inside the source is never an assertion dependency.
  function sphereStores({ buffs = null, effects = null } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === TARGET && key === 'activeBuffs') return buffs
      if (name === 'campaign' && key === 'targetEffects') return effects
      return null
    })
  }

  it('isResilientSphereActive finds the sphere in activeBuffs or targetEffects for this target only', () => {
    sphereStores({ buffs: [{ effect: 'resilient_sphere', sourceCharacter: 'Ally' }] })
    expect(isResilientSphereActive(TARGET, 'test-campaign')).toBe(true)

    sphereStores({ buffs: null, effects: [{ target: TARGET, effect: 'resilient_sphere', source: 'Caster' }] })
    expect(isResilientSphereActive(TARGET, 'test-campaign')).toBe(true)

    sphereStores({ buffs: null, effects: [{ target: 'OtherCreature', effect: 'resilient_sphere', source: 'Caster' }] })
    expect(isResilientSphereActive(TARGET, 'test-campaign')).toBe(false)

    sphereStores({ buffs: [{ effect: 'other_buff' }], effects: [] })
    expect(isResilientSphereActive(TARGET, 'test-campaign')).toBe(false)

    sphereStores({}) // both stores null
    expect(isResilientSphereActive(TARGET, 'test-campaign')).toBe(false)
  })

  it('getResilientSphereSource prefers buff.sourceCharacter, falls back to targetEffect.source, else null', () => {
    sphereStores({ buffs: [{ effect: 'resilient_sphere', sourceCharacter: 'Ally' }] })
    expect(getResilientSphereSource(TARGET, 'test-campaign')).toBe('Ally')

    sphereStores({ buffs: [{ effect: 'resilient_sphere' }], effects: [{ target: TARGET, effect: 'resilient_sphere', source: 'Caster' }] })
    expect(getResilientSphereSource(TARGET, 'test-campaign')).toBe('Caster')

    sphereStores({ buffs: [{ effect: 'resilient_sphere' }] }) // active but no source anywhere
    expect(getResilientSphereSource(TARGET, 'test-campaign')).toBeNull()

    sphereStores({ buffs: null, effects: [{ target: 'OtherCreature', effect: 'resilient_sphere', source: 'Caster' }] })
    expect(getResilientSphereSource(TARGET, 'test-campaign')).toBeNull()
  })
})

// ── applyGreatWeaponFightingToDamage ──────────────────────────────

describe('applyGreatWeaponFightingToDamage', () => {
  it('delegates roll filtering to the rules module only when great_weapon_fighting is armed', () => {
    applyGreatWeaponFighting.mockImplementation((rolls) => rolls.filter(r => r > 1))
    const armed = ps([{ type: 'passive_rule', effect: 'great_weapon_fighting' }])
    const rolls = [1, 3, 1, 5, 2]
    expect(applyGreatWeaponFightingToDamage(rolls, armed)).toEqual([3, 5, 2])
    expect(applyGreatWeaponFighting).toHaveBeenCalledWith(rolls)

    const unarmed = rolls
    // Unarmed, the rolls pass through byte-for-byte — even the 1s the
    // rules module would have filtered.
    expect(applyGreatWeaponFightingToDamage(unarmed, ps([]))).toEqual([1, 3, 1, 5, 2])
    expect(applyGreatWeaponFighting).toHaveBeenCalledTimes(1) // never re-invoked unarmed
  })
})

// ── getDamageReduction ────────────────────────────────────────────

describe('getDamageReduction', () => {
  const reduction = (auto) => ({ automation: { passives: [auto] } })

  it.each([
    { label: 'flat reduction on matching type', auto: { type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 }, damageType: 'fire', expected: 2 },
    { label: 'reaction-flagged entries are skipped', auto: { type: 'damage_reduction', reaction: true, damageTypes: ['fire'], reduction: 5 }, damageType: 'fire', expected: null },
    { label: 'zero reduction is skipped', auto: { type: 'damage_reduction', damageTypes: ['fire'], reduction: 0 }, damageType: 'fire', expected: null },
    { label: 'negative reduction is skipped', auto: { type: 'damage_reduction', damageTypes: ['fire'], reduction: -3 }, damageType: 'fire', expected: null },
    { label: 'non-matching damage type is skipped', auto: { type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }, damageType: 'cold', expected: null },
    { label: 'empty damageTypes covers all types', auto: { type: 'damage_reduction', damageTypes: [], reduction: 3 }, damageType: 'fire', expected: 3 },
    { label: 'absent damageTypes covers all types', auto: { type: 'damage_reduction', reduction: 4 }, damageType: 'fire', expected: 4 },
    { label: 'null damageTypes defaults to all types', auto: { type: 'damage_reduction', damageTypes: null, reduction: 2 }, damageType: 'any-type', expected: 2 },
    { label: 'damage types match case-insensitively', auto: { type: 'damage_reduction', damageTypes: ['Fire'], reduction: 5 }, damageType: 'fire', expected: 5 },
    { label: 'foreign automation type never reduces', auto: { type: 'passive_buff', damageTypes: ['fire'], reduction: 9 }, damageType: 'fire', expected: null },
  ])('$label', ({ auto, damageType, expected }) => {
    expect(getDamageReduction(reduction(auto), damageType, false)).toBe(expected)
  })

  it('sums reductions across passives, reactions, and specialActions', () => {
    const playerStats = {
      automation: {
        passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 }],
        reactions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 3 }],
        specialActions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 1 }],
      },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(6)
  })

  it('returns null when playerStats is null, automation is empty, or nothing qualifies', () => {
    expect(getDamageReduction(null, 'fire', false)).toBeNull()
    expect(getDamageReduction({ automation: {} }, 'fire', false)).toBeNull()
    expect(getDamageReduction(reduction({ type: 'passive_buff', effect: 'test' }), 'fire', false)).toBeNull()
  })

  it('resolves entry reductions: numeric first, string expression second, both entries summed', () => {
    evaluateAutoExpression.mockImplementation((expr) => {
      if (expr === '3 + 4') return 7
      if (expr === '1 + 2') return 3
      return 0
    })
    expect(getDamageReduction(reduction({ type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '3 + 4' }), 'fire', false)).toBe(7)
    // A numeric reduction wins outright; the expression is never consulted.
    expect(getDamageReduction(reduction({ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5, reductionExpression: '100' }), 'fire', false)).toBe(5)
    // Separate entries resolve and sum independently.
    const separate = { automation: { passives: [
      { type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 },
      { type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '1 + 2' },
    ] } }
    expect(getDamageReduction(separate, 'fire', false)).toBe(8)
    expect(getDamageReduction(reduction({ type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '' }), 'fire', false)).toBeNull()
    expect(getDamageReduction(reduction({ type: 'damage_reduction', damageTypes: ['fire'] }), 'fire', false)).toBeNull()
  })

  it('enforces the wearing_heavy_armor condition in both directions', () => {
    const withCondition = reduction({ type: 'damage_reduction', damageTypes: [], reduction: 5, condition: 'wearing_heavy_armor' })
    expect(getDamageReduction(withCondition, 'fire', true)).toBe(5)
    expect(getDamageReduction(withCondition, 'fire', false)).toBeNull()
  })

  it('FT-045: Heavy Armor Master reaction row reduces B/P/S by PB only while wearing heavy armor', () => {
    evaluateAutoExpression.mockImplementation((expr) => (expr === 'proficiency_bonus' ? 5 : 0))
    const ham = { automation: { reactions: [{
      type: 'damage_reduction', name: 'Heavy Armor Master',
      reductionExpression: 'proficiency_bonus',
      damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
      condition: 'wearing_heavy_armor', reaction: false,
    }] } }
    expect(getDamageReduction(ham, 'Slashing', true)).toBe(5)
    expect(getDamageReduction(ham, 'Bludgeoning', true)).toBe(5)
    expect(getDamageReduction(ham, 'Piercing', true)).toBe(5)
    expect(getDamageReduction(ham, 'Slashing', false)).toBeNull()
    expect(getDamageReduction(ham, 'Fire', true)).toBeNull()
  })

  it('gates damage_taken_of_chosen_resistance_type on chosen byte match and used-flag', () => {
    const gatedStats = {
      name: 'TestChar',
      campaignName: 'test-campaign',
      automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5, trigger: 'damage_taken_of_chosen_resistance_type' }] },
    }
    const gateRoute = (chosen, used) => (name, key) => {
      if (name !== 'TestChar') return null
      if (key === 'resistanceChosenDamageType') return chosen
      if (key === 'resistanceUsedThisTurn') return used
      return null
    }

    getRuntimeValue.mockImplementation(gateRoute('fire', false))
    expect(getDamageReduction(gatedStats, 'fire', false)).toBe(5)

    getRuntimeValue.mockImplementation(gateRoute('cold', false)) // chosen mismatch
    expect(getDamageReduction(gatedStats, 'fire', false)).toBeNull()

    getRuntimeValue.mockImplementation(gateRoute('fire', true)) // already spent this turn
    expect(getDamageReduction(gatedStats, 'fire', false)).toBeNull()
  })
})
