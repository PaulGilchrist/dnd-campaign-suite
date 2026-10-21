// @maintained-by-ai
// rulesFactory BASE lane: dual-ruleset SELECTOR MATRIX owner + full factory export
// surface drift-pin. rulesFactory = selector ('5e'/'2024' per playerSummary.rules)
// routing raceRules/classRules + getPlayerStats hub (repo AGENTS.md canon).
// Cited, not duplicated: rulesFactory.naturesWard.test.js owns rulesFactory.js:148-176
// compute-merge bytes — runtime _circleOfTheLandType governance/flip, runtime-beats-class
// precedence, campaign-scoped triple lookup args, poisoned conditionImmunity leg, and the
// :158-161 class-null guard (deliberately UNPINNED there per lying-mock policy: real
// classRules.getClass :31-33 and classRules2024.getClass fall back to { class_levels: [] },
// never null — honored here too). automationPassives.stormbornResistance.test.js owns the
// COMBAT-lane copies of the Stormborn/Full-of-Stars gates; the COMPUTE-time gates at
// rulesFactory.js:121-133 have no other owner — pinned here (T7). applyDamage lanes own
// the post-render consumption of the CLA-110 stamp; the stamp WRITE is pinned here (T11).
// rules.test.js / rules.getPlayerStats.test.js own rules.js trunk internals — mocked at
// the :97 seam (sole trunk call; getPlayerStats is the ONLY rules.js export the factory
// imports, verified line-by-line against rulesFactory.js:1).
// EXPORT LIVE/DEAD MAP (caller evidence, src grep): getPlayerStats LIVE (App.jsx:346,
// CharSheet.jsx:319); getRules LIVE (charSummaryCalc.js:73 + internal router :46-:99);
// getRulesType/getDruidMaxWildShapeChallengeRating/getDruidWildShapeUses/
// getDruidBeastKnownForms/getDruidBeastFlySpeed/getRogueSneakAttack/getSenses DORMANT
// (zero production callers outside this file — compact drift-pin below; removal is a
// source-side decision, reported only).
// Selector byte gates (T1): routing is `rulesType === '2024'` strict-equality after
// `|| '5e'` default — '2024 ' (trailing space), '2024x', numeric 2024 SILENTLY route to
// the 5e lane (no trim on the rules field; honesty: this is divergence-tolerant by design
// of ||, pinned not fixed). Fallback default ruleset is 5e.
// Mock audit vs live-graph imports rulesFactory.js:1-8: rules.js=getPlayerStats only;
// race-rules index=getRace/getImmunities/getResistances/getSenses (all four touched at
// :72/:104-:106); classRules+classRules2024=getClass+5 delegators (:45-:68,:103);
// trackedResources=computeTrackedResources(:203); choiceStorage=getChosenRuntimeValue
// (:179,:189,:198); useRuntimeState=getRuntimeValue(:122,:128,:162). Real
// getRuntimeValue(characterKey, propertyName) is 2-arity — the factory's 3rd campaignName
// arg is ignored in production (quirk reported; call census pins the bytes as sent).
// Quirk scan: golden unguarded-deref none at factory level (trunk mock always supplies
// class; real getClass:28-30 would TypeError on missing class — classRules lane owns).
// :103 asymmetry pinned (T4): getClass receives the RAW playerSummary while :104-:106
// receive the BUILT playerStats; :105-:106 lane-overwrite masks summary-borne
// immunities/resistances bytes before merges (T8). :0-swallow census zero; never-executed
// guards: :158-161 declared above (unpinned) + mergeDefenseList :15-18 unreachable
// through honest mocks (:106 replaces the target list with an rr-lane array first);
// chokepoint inline-dup: truesight/blindsight merge duplicated in rules-senses.js:14-17/
// core/senseUtils.js — factory wrapper :70-93 is dormant copy, drift-pinned here.
// NO-CLOCK: zero timers, zero Date.now, no localStorage, no clock stamps. Input purity:
// fresh summary objects per call (T4 pins summary byte-unchanged after compute).
// Old -> new: 36 -> 11 (deleted 13 mock-self-tests calling mocked rules.* directly and 2
// mock-self-tests calling mocked raceRules.* directly; consolidated 4 land rows + 2
// dedupe/combine rows + 3 throw rows into tables; strengthened every toContain/
// toBeDefined shell to exact sets).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import _ from 'lodash'
import rulesFactory from './rulesFactory.js'
import rules from './rules.js'
import { rules5e, rules2024 } from '../character/race-rules/index.js'
import classRules from '../character/classRules.js'
import classRules2024 from '../character/classRules2024.js'
import { computeTrackedResources } from './trackedResources.js'
import { getChosenRuntimeValue } from '../automation/common/choiceStorage.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

// Sole rules.js export the factory consumes (:1, :97). Fresh object per call so
// mergeDefenseList mutation never bleeds across tests.
vi.mock('./rules.js', () => ({
  default: {
    getPlayerStats: vi.fn(async ({ playerSummary: summary }) => ({
      ...summary,
      class: summary.class || { name: 'Fighter', class_levels: [] },
      race: {},
      immunities: [],
      resistances: summary.resistances || [],
      automation: summary.automation || { passives: [] },
      level: 1,
    })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(() => ({ marker: 'human-5e' })),
    getImmunities: vi.fn(() => ['5e-lane-immunity']),
    getResistances: vi.fn(() => ['5e-lane-resistance']),
    getSenses: vi.fn(() => [{ name: 'Darkvision', value: '60 ft.' }]),
  },
  rules2024: {
    getRace: vi.fn(() => ({ marker: 'high-elf-2024' })),
    getImmunities: vi.fn(() => ['2024-lane-immunity']),
    getResistances: vi.fn(() => ['2024-lane-resistance']),
    getSenses: vi.fn(() => [{ name: 'Darkvision', value: '60 ft.' }]),
  },
}))

// getClass mirrors the REAL never-null contract (classRules.js:31-33,
// classRules2024.js:82-85 fall back to { class_levels: [] }).
vi.mock('../character/classRules.js', () => ({
  default: {
    getClass: vi.fn((_allClasses, playerStats) => ({
      name: 'Fighter',
      class_levels: [],
      ...(playerStats?.class || {}),
    })),
    getDruidMaxWildShapeChallengeRating: vi.fn(() => 1),
    getDruidWildShapeUses: vi.fn(() => 2),
    getDruidBeastKnownForms: vi.fn(() => [{ name: 'Raccoon' }]),
    getDruidBeastFlySpeed: vi.fn(() => true),
    getRogueSneakAttack: vi.fn(() => 3),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn((_allClasses, playerStats) => ({
      name: 'Fighter',
      class_levels: [],
      ...(playerStats?.class || {}),
    })),
    getDruidMaxWildShapeChallengeRating: vi.fn(() => 2),
    getDruidWildShapeUses: vi.fn(() => 3),
    getDruidBeastKnownForms: vi.fn(() => [{ name: 'Bear' }]),
    getDruidBeastFlySpeed: vi.fn(() => false),
    getRogueSneakAttack: vi.fn(() => 5),
  },
}))

vi.mock('./trackedResources.js', () => ({
  computeTrackedResources: vi.fn(() => ({ marker: 'tracked-sentinel' })),
}))

// Chosen-value store keyed on the EXACT (name, suffix) producer bytes so a
// wrong suffix ('chosenType' vs 'chosenTypes') misses instead of passing.
const chosenStore = new Map()
vi.mock('../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn((_playerStats, name, suffix) =>
    chosenStore.get(`${name}:${suffix}`) ?? null
  ),
}))

// Runtime store mock keyed on the triple as SENT (factory :122/:128/:162 pass
// campaignName 3rd; production getRuntimeValue is 2-arity and drops it — quirk
// reported in header, census pins bytes as sent).
const runtimeStore = new Map()
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeStore.get(`${name}:${key}`) ?? null),
}))

const callFactory = (playerSummary) =>
  rulesFactory.getPlayerStats({
    allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {},
    playerSummary,
  })

const summary = (over = {}) => ({
  name: 'Test_Hero',
  campaignName: 'test-campaign',
  rules: '5e',
  resistances: [],
  ...over,
})

// Real Nature's Ward land-type bytes (public/data/2024/classes.json, mirrored by
// rulesFactory.naturesWard.test.js); only used here for the synthetic ladder.
const LAND_MAPPINGS = { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' }

describe('rulesFactory', () => {
  beforeEach(() => {
    runtimeStore.clear()
    chosenStore.clear()
    vi.clearAllMocks()
  })

  it('T1 selector matrix: every rules-form routes to the exact lane modules, and the export surface is the pinned nine', () => {
    // Byte-gate rows: strict === '2024' after || '5e'. Trailing-space/'x'/numeric
    // forms SILENTLY route 5e (pinned honestly, not fixed).
    const rows = [
      ['5e', rules5e, classRules],
      ['2024', rules2024, classRules2024],
      ['2024 ', rules5e, classRules],
      ['2024x', rules5e, classRules],
      [2024, rules5e, classRules],
      ['', rules5e, classRules],
      [null, rules5e, classRules],
      [undefined, rules5e, classRules],
    ]
    for (const [form, raceLane, classLane] of rows) {
      const result = rulesFactory.getRules({ rules: form })
      expect([form, result.rules, result.raceRules, result.classRules]).toEqual([form, rules, raceLane, classLane])
      expect(Object.keys(result)).toEqual(['rules', 'raceRules', 'classRules'])
    }
    // missing-field row === undefined row, via || default
    expect(rulesFactory.getRules({}).raceRules).toBe(rules5e)
    // Export surface drift-pin: nine keys, exact set. Drop an export -> red here.
    expect(Object.keys(rulesFactory)).toEqual([
      'getRules', 'getRulesType',
      'getDruidMaxWildShapeChallengeRating', 'getDruidWildShapeUses',
      'getDruidBeastKnownForms', 'getDruidBeastFlySpeed', 'getRogueSneakAttack',
      'getSenses', 'getPlayerStats',
    ])
  })

  it('T2 getRulesType returns the raw byte or the 5e default — no trim, no coercion (dormant export drift-pin)', () => {
    expect(rulesFactory.getRulesType({})).toBe('5e')
    expect(rulesFactory.getRulesType({ rules: '' })).toBe('5e')
    expect(rulesFactory.getRulesType({ rules: null })).toBe('5e')
    expect(rulesFactory.getRulesType({ rules: undefined })).toBe('5e')
    expect(rulesFactory.getRulesType({ rules: '5e' })).toBe('5e')
    expect(rulesFactory.getRulesType({ rules: '2024' })).toBe('2024')
    expect(rulesFactory.getRulesType({ rules: '2024 ' })).toBe('2024 ')
    expect(rulesFactory.getRulesType({ rules: 2024 })).toBe(2024)
  })

  it('T3 dormant delegator wrappers call the lane impl once with the stats arg only, never the opposite lane', () => {
    const stats = { marker: 'stats-passthrough' }
    const rows = [
      ['getDruidMaxWildShapeChallengeRating', 1, 2],
      ['getDruidWildShapeUses', 2, 3],
      ['getRogueSneakAttack', 3, 5],
      ['getDruidBeastFlySpeed', true, false],
    ]
    for (const [method, byte5e, byte2024] of rows) {
      vi.clearAllMocks()
      expect(rulesFactory[method](stats, { rules: '5e' })).toBe(byte5e)
      expect(classRules[method]).toHaveBeenCalledTimes(1)
      expect(classRules[method].mock.calls[0]).toEqual([stats])
      expect(classRules2024[method]).not.toHaveBeenCalled()

      vi.clearAllMocks()
      expect(rulesFactory[method](stats, { rules: '2024' })).toBe(byte2024)
      expect(classRules2024[method]).toHaveBeenCalledTimes(1)
      expect(classRules2024[method].mock.calls[0]).toEqual([stats])
      expect(classRules[method]).not.toHaveBeenCalled()
    }
    // forms that byte-gate to 5e still resolve 5e bytes through the delegators
    expect(rulesFactory.getDruidMaxWildShapeChallengeRating(stats, { rules: '2024 ' })).toBe(1)
    expect(classRules2024.getDruidMaxWildShapeChallengeRating).not.toHaveBeenCalled()

    // getDruidBeastKnownForms: array lane byte (known forms have no 2024 numeric face)
    vi.clearAllMocks()
    expect(rulesFactory.getDruidBeastKnownForms(stats, { rules: '5e' })).toEqual([{ name: 'Raccoon' }])
    expect(rulesFactory.getDruidBeastKnownForms(stats, { rules: '2024' })).toEqual([{ name: 'Bear' }])
    expect(classRules.getDruidBeastKnownForms).toHaveBeenCalledTimes(1)
    expect(classRules2024.getDruidBeastKnownForms).toHaveBeenCalledTimes(1)
  })

  it('T4 getPlayerStats seam: trunk called once with the exact six inputs; class/race/immunities/senses lanes re-read from the resolved module; tracked resources stamped by identity; summary untouched', async () => {
    const allClasses = [{ name: 'Fighter' }]
    const allRaces = [{ name: 'Human' }]
    const allEquipment = []
    const allMagicItems = []
    const allSpells = {}
    const input = summary()
    const puritySnapshot = _.cloneDeep(input)

    const result = await rulesFactory.getPlayerStats({ allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary: input })

    // trunk seam: exactly one call, exact arg bytes
    expect(rules.getPlayerStats).toHaveBeenCalledTimes(1)
    const [trunkArgs] = rules.getPlayerStats.mock.calls[0]
    expect(Object.keys(trunkArgs).sort()).toEqual(['allClasses', 'allEquipment', 'allMagicItems', 'allRaces', 'allSpells', 'playerSummary'])
    expect(trunkArgs.allClasses).toBe(allClasses)
    expect(trunkArgs.allEquipment).toBe(allEquipment)
    expect(trunkArgs.allMagicItems).toBe(allMagicItems)
    expect(trunkArgs.allRaces).toBe(allRaces)
    expect(trunkArgs.allSpells).toBe(allSpells)
    expect(trunkArgs.playerSummary).toBe(input)

    // 5e lane re-read (:103-:106). Asymmetry quirk pinned faithfully: :103 hands
    // getClass the RAW playerSummary (not the built stats), :104-:106 hand the
    // race lane the BUILT stats.
    const built = await rules.getPlayerStats.mock.results[0].value
    expect(result).toBe(built) // factory mutates and returns the trunk object
    expect(classRules.getClass).toHaveBeenCalledTimes(1)
    expect(classRules.getClass.mock.calls[0][0]).toBe(allClasses)
    expect(classRules.getClass.mock.calls[0][1]).toBe(input)
    expect(classRules2024.getClass).not.toHaveBeenCalled()
    expect(result.class).toEqual({ name: 'Fighter', class_levels: [] })
    expect(rules5e.getRace).toHaveBeenCalledTimes(1)
    expect(rules5e.getRace.mock.calls[0][0]).toBe(allRaces)
    expect(rules5e.getRace.mock.calls[0][1]).toBe(built)
    expect(result.race).toEqual({ marker: 'human-5e' })
    expect(result.immunities).toEqual(['5e-lane-immunity'])
    expect(result.resistances).toEqual(['5e-lane-resistance'])
    expect(rules2024.getImmunities).not.toHaveBeenCalled()
    expect(rules2024.getResistances).not.toHaveBeenCalled()

    // _trackedResources stamped by identity from the trackedResources seam (:203)
    expect(computeTrackedResources).toHaveBeenCalledTimes(1)
    expect(computeTrackedResources.mock.calls[0][0]).toBe(result)
    expect(result._trackedResources).toEqual(computeTrackedResources())

    // no fabricated keys: CLA-110 stamp absent when no chosen value (T11 pins presence)
    expect(Object.prototype.hasOwnProperty.call(result, '_elementalAffinityResistedType')).toBe(false)

    // input purity: the summary bytes survive compute untouched
    expect(input).toEqual(puritySnapshot)
  })

  it('T5 2024 master route: getPlayerStats pulls every collaborator from the 2024 lane', async () => {
    const result = await callFactory(summary({ rules: '2024' }))
    expect(classRules2024.getClass).toHaveBeenCalledTimes(1)
    expect(classRules.getClass).not.toHaveBeenCalled()
    expect(rules2024.getRace).toHaveBeenCalledTimes(1)
    expect(rules5e.getRace).not.toHaveBeenCalled()
    expect(result.race).toEqual({ marker: 'high-elf-2024' })
    expect(result.immunities).toEqual(['2024-lane-immunity'])
    expect(result.resistances).toEqual(['2024-lane-resistance'])
  })

  it('T6 getSenses: lanes routed by selector, truesight/blindsight appended with exact bytes, deduped, defaults honest', () => {
    // 2024 routing proof: rr.getSenses is the 2024 module's, called with [playerStats]
    const stats2024 = { automation: { passives: [] } }
    expect(rulesFactory.getSenses(stats2024, { rules: '2024' })).toEqual([{ name: 'Darkvision', value: '60 ft.' }])
    expect(rules2024.getSenses.mock.calls).toEqual([[stats2024]])
    expect(rules5e.getSenses).not.toHaveBeenCalled()

    // append rows: parsed range, default 60 ft. (missing range), default 10 ft.
    // (non-numeric range), full exact arrays including base senses
    const parsed = rulesFactory.getSenses(
      { automation: { passives: [{ type: 'passive_buff', effect: 'truesight', range: '120 ft.' }] } },
      { rules: '5e' }
    )
    expect(parsed).toEqual([
      { name: 'Darkvision', value: '60 ft.' },
      { name: 'Truesight', value: '120 ft.' },
    ])
    const defaults = rulesFactory.getSenses(
      { automation: { passives: [{ type: 'passive_buff', effect: 'truesight' }, { type: 'passive_buff', effect: 'blindsight', range: 'immediate' }] } },
      { rules: '5e' }
    )
    expect(defaults).toEqual([
      { name: 'Darkvision', value: '60 ft.' },
      { name: 'Truesight', value: '60 ft.' },
      { name: 'Blindsight', value: '10 ft.' },
    ])
    // foreign type/effect bytes contribute nothing
    const foreign = rulesFactory.getSenses(
      { automation: { passives: [{ type: 'passive_buff', effect: 'darkvision', range: '300 ft.' }, { type: 'resistance', effect: 'truesight' }] } },
      { rules: '5e' }
    )
    expect(foreign).toEqual([{ name: 'Darkvision', value: '60 ft.' }])

    // dedupe: base senses already carry the entry -> original byte wins, no push
    rules5e.getSenses.mockReturnValueOnce([
      { name: 'Truesight', value: '30 ft.' },
      { name: 'Blindsight', value: '5 ft.' },
    ])
    const deduped = rulesFactory.getSenses(
      { automation: { passives: [{ type: 'passive_buff', effect: 'truesight', range: '120 ft.' }, { type: 'passive_buff', effect: 'blindsight', range: '60 ft.' }] } },
      { rules: '5e' }
    )
    expect(deduped).toEqual([
      { name: 'Truesight', value: '30 ft.' },
      { name: 'Blindsight', value: '5 ft.' },
    ])

    // :75-:78 passives shape guard — console/throw pair, byte-exact
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => rulesFactory.getSenses({ automation: {} }, { rules: '5e' })).toThrow('Expected passives to be an array')
    expect(spy.mock.calls).toEqual([['rulesFactory.getSenses: expected passives array']])
    spy.mockRestore()
  })

  it('T7 compute-time Stormborn / Full of Stars gates (:121-:133): closed gate emits nothing, open gate merges the exact damageTypes, lookup keys byte-exact', async () => {
    const STORM = { type: 'resistance', name: 'Stormborn', damageTypes: ['Cold', 'Lightning', 'Thunder'] }
    const STARS = { type: 'resistance', name: 'Full of Stars', damageTypes: ['Radiant'] }

    // gate closed (store empty -> null)
    const closed = await callFactory(summary({ automation: { passives: [STORM, STARS] } }))
    expect(closed.resistances).toEqual(['5e-lane-resistance'])
    expect(getRuntimeValue.mock.calls).toEqual([
      ['Test_Hero', 'wrathOfTheSeaActive', 'test-campaign'],
      ['Test_Hero', 'activeBuffs', 'test-campaign'],
    ])

    // Stormborn gate open only
    runtimeStore.set('Test_Hero:wrathOfTheSeaActive', true)
    const stormOpen = await callFactory(summary({ automation: { passives: [STORM, STARS] } }))
    expect(stormOpen.resistances).toEqual(['5e-lane-resistance', 'Cold', 'Lightning', 'Thunder'])

    // Full of Stars gate open only (Starry Form byte name-match)
    runtimeStore.clear()
    runtimeStore.set('Test_Hero:activeBuffs', [{ name: 'Starry Form' }])
    const starsOpen = await callFactory(summary({ automation: { passives: [STORM, STARS] } }))
    expect(starsOpen.resistances).toEqual(['5e-lane-resistance', 'Radiant'])

    // activeBuffs without the Starry Form byte stays closed
    runtimeStore.clear()
    runtimeStore.set('Test_Hero:activeBuffs', [{ name: 'Haste' }])
    const wrongBuff = await callFactory(summary({ automation: { passives: [STARS] } }))
    expect(wrongBuff.resistances).toEqual(['5e-lane-resistance'])

    // un-gated resistance passive ignores both gates
    const ungated = await callFactory(summary({ automation: { passives: [{ type: 'resistance', name: 'Other', damageTypes: ['Acid'] }] } }))
    expect(ungated.resistances).toEqual(['5e-lane-resistance', 'Acid'])
  })

  it('T8 resistance merges: resistance + passive_immunity legs append in source order, deduped against existing bytes', async () => {
    const result = await callFactory(summary({
      resistances: ['Fire'],
      automation: {
        passives: [
          { type: 'resistance', damageTypes: ['Fire', 'Cold'] },
          { type: 'passive_immunity', damageResistance: ['Psychic', 'Fire'] },
          { type: 'passive_immunity' },
        ],
      },
    }))
    // :106 OVERWRITES the trunk-built resistances with the rr lane array (the
    // summary's own ['Fire'] byte is masked — pinned honestly), then auto leg
    // (:137) and passive_immunity leg (:145) append; Set-dedupe keeps FIRST
    // occurrence; the passive_immunity passive without a damageResistance array
    // is filtered shape-silent at :142
    expect(result.resistances).toEqual(['5e-lane-resistance', 'Fire', 'Cold', 'Psychic'])
  })

  it('T9 land class-type ladder: match appends, mismatch contributes nothing, major beats subclass, case+whitespace normalized (runtime byte owned by naturesWard lane)', async () => {
    const land = (majorType, subclassType) => ({
      resistances: [],
      class: {
        ...(majorType ? { major: { type: majorType } } : {}),
        ...(subclassType ? { subclass: { type: subclassType } } : {}),
      },
      automation: { passives: [{ type: 'land_resistance', landMappings: LAND_MAPPINGS }] },
    })

    const matched = await callFactory(summary(land('arid')))
    expect(matched.resistances).toEqual(['5e-lane-resistance', 'Fire'])

    const mismatched = await callFactory(summary(land('shadow')))
    expect(mismatched.resistances).toEqual(['5e-lane-resistance'])

    const majorWins = await callFactory(summary(land('temperate', 'arid')))
    expect(majorWins.resistances).toEqual(['5e-lane-resistance', 'Lightning'])

    const subclassFallback = await callFactory(summary(land(null, 'polar')))
    expect(subclassFallback.resistances).toEqual(['5e-lane-resistance', 'Cold'])

    const normalized = await callFactory(summary(land('  TEMPERATE  ')))
    expect(normalized.resistances).toEqual(['5e-lane-resistance', 'Lightning'])

    const noTypes = await callFactory(summary(land(null, null)))
    expect(noTypes.resistances).toEqual(['5e-lane-resistance'])
  })

  it('T10 shape guards fire console.error + throw byte pairs, in source order', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(callFactory(summary({ automation: { passives: 'not-an-array' } })))
        .rejects.toThrow('Expected passives to be an array')
      expect(spy.mock.calls).toEqual([['rulesFactory.getPlayerStats: expected passives array']])

      spy.mockClear()
      await expect(callFactory(summary({ automation: { passives: [{ type: 'resistance', damageTypes: 'not-an-array' }] } })))
        .rejects.toThrow('Expected damageTypes to be an array')
      expect(spy.mock.calls).toEqual([['rulesFactory.getPlayerStats: expected damageTypes array']])

      spy.mockClear()
      await expect(callFactory(summary({ automation: { passives: [{ type: 'land_resistance', landMappings: null }] } })))
        .rejects.toThrow('Expected landMappings to be an object')
      expect(spy.mock.calls).toEqual([['rulesFactory.getPlayerStats: expected landMappings object']])

      spy.mockClear()
      // landMappings present but scalar -> typeof guard, same pair
      await expect(callFactory(summary({ automation: { passives: [{ type: 'land_resistance', landMappings: 'arid' }] } })))
        .rejects.toThrow('Expected landMappings to be an object')
      expect(spy.mock.calls).toEqual([['rulesFactory.getPlayerStats: expected landMappings object']])
    } finally {
      spy.mockRestore()
    }
    // :158-:161 'Expected class to be an object' guard: deliberately UNPINNED —
    // real getClass never returns null (mirrored by the mock); pinning would
    // require a lying collaborator (naturesWard lane policy, honored here).
    // mergeDefenseList :15-:18 non-array guard likewise UNREACHABLE through an
    // honest seam: :105-:106 overwrite immunities/resistances with the rr lane
    // arrays before any merge — pinning it would require the rr mock to lie.
  })

  it('T11 chosen-runtime consumer keys are the producer bytes; merges exact; CLA-110 stamp written; empty array contributes nothing', async () => {
    chosenStore.set('Elemental Affinity:chosenType', 'Radiant')
    chosenStore.set('Fiendish Resilience:chosenType', 'Fire')
    chosenStore.set('Energy Resistances:chosenTypes', ['Necrotic', 'Poison'])

    const result = await callFactory(summary({ rules: '2024', resistances: [] }))
    // consumer asks the three producer keys, each once, exact (name, suffix) bytes
    expect(getChosenRuntimeValue.mock.calls.map(([, name, suffix]) => [name, suffix])).toEqual([
      ['Elemental Affinity', 'chosenType'],
      ['Fiendish Resilience', 'chosenType'],
      ['Energy Resistances', 'chosenTypes'],
    ])
    expect(result.resistances).toEqual(['2024-lane-resistance', 'Radiant', 'Fire', 'Necrotic', 'Poison'])
    // CLA-110 provenance stamp (:185) — the damage lane REPLACE slot
    expect(result._elementalAffinityResistedType).toBe('Radiant')

    // wrong-suffix lookup misses: 'chosenType' for Energy Resistances is NOT consulted
    chosenStore.clear()
    chosenStore.set('Energy Resistances:chosenType', ['Necrotic'])
    const wrongSuffix = await callFactory(summary({ rules: '2024', resistances: [] }))
    expect(wrongSuffix.resistances).toEqual(['2024-lane-resistance'])
    expect(Object.prototype.hasOwnProperty.call(wrongSuffix, '_elementalAffinityResistedType')).toBe(false)

    // empty chosen array -> no merge, no stamp (:199)
    chosenStore.clear()
    chosenStore.set('Energy Resistances:chosenTypes', [])
    const empty = await callFactory(summary({ rules: '2024', resistances: [] }))
    expect(empty.resistances).toEqual(['2024-lane-resistance'])
  })
})
