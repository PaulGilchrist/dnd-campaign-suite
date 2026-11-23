// @maintained-by-ai
// rulesFactory getPlayerStats FIGHTING-STYLE SURVIVAL lane (regression for
// bug-rulesfactory-wipes-fightingstyles-mapping): rulesFactory.js:103 REPLACES
// playerStats.class with a fresh cr.getClass(allClasses, playerSummary) merge
// AFTER the trunk builds stats — so the ONLY shape that survives to consumers
// (CharClassFeatures display, automationExpressions Superior Technique die,
// race-rules Blind Fighting gates, trackedResources) is the canonical
// file-carried class.fightingStyles. The former top-level fightingStyles→class
// lift inside rules.getPlayerStats was a guaranteed no-op (wiped two lines
// later) and is DELETED per the repo no-legacy policy — T2 pins it stays dead.
// Unlike rulesFactory.test.js (mocked class lane, selector/resistance owner),
// THIS lane runs the REAL classRules.js:28 + classRules2024.js:85 getClass
// against a minimal class table so the merge-carry is pinned against the
// actual lodash-merge / Object.assign behavior. Race lane, trunk, tracked
// resources and runtime stores are inert mocks — cited, not re-run.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rulesFactory from './rulesFactory.js'

// Trunk stand-in mirrors rules.getPlayerStats bytes the factory consumes:
// clone of the summary + automation bundle. Fresh object per call.
vi.mock('./rules.js', () => ({
  default: {
    getPlayerStats: vi.fn(async ({ playerSummary: summary }) => ({
      ...summary,
      class: { ...(summary.class || {}) },
      race: {},
      immunities: [],
      resistances: [],
      automation: summary.automation || { passives: [] },
      level: summary.level || 1,
    })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(() => ({ marker: 'race-5e' })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
  rules2024: {
    getRace: vi.fn(() => ({ marker: 'race-2024' })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
}))

vi.mock('./trackedResources.js', () => ({
  computeTrackedResources: vi.fn(() => []),
}))

vi.mock('../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => null),
}))

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}))

// Minimal class table rows exercising each lane's real getClass: 5e merges the
// file's class over the table row; 2024 Object.assigns it and resolves major +
// proficiencies from table strings.
const TABLE_5E = [{
  name: 'Fighter',
  hit_point_die: '1d10',
  saving_throws: ['STR', 'DEX'],
  subclasses: [{ name: 'Battle Master' }],
}]
const TABLE_2024 = [{
  name: 'Fighter',
  hit_point_die: '1d10',
  weapon_proficiencies: 'Simple and Martial weapons',
  armor_training: 'All Armor',
  saving_throw_proficiencies: ['STR', 'DEX'],
  class_levels: [{ level: 1 }],
  majors: [{ name: 'Champion', features: [] }],
}]

const callFactory = (playerSummary, allClasses) =>
  rulesFactory.getPlayerStats({
    allClasses, allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {},
    playerSummary,
  })

describe('rulesFactory.getPlayerStats fighting-style survival', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('T1 5e lane: file-carried class.fightingStyles survives the :103 class re-assignment', async () => {
    const summary = {
      name: 'Style_Hero',
      campaignName: 'test-campaign',
      rules: '5e',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' }, fightingStyles: ['Superior Technique'] },
    }

    const result = await callFactory(summary, TABLE_5E)

    // The regression: the wiped-merge face left class WITHOUT the key while
    // the top-level clone still carried it (sheet rendered "Fighting Styles:
    // N/A", every class.fightingStyles consumer silently no-oped).
    expect(result.class.fightingStyles).toEqual(['Superior Technique'])
    // table-row neighbors of the merge are intact (subclass resolution,
    // saving-throw name conversion) — the carry did not clobber getClass work
    expect(result.class.subclass).toEqual({ name: 'Battle Master' })
    expect(result.class.saving_throws).toEqual(['Strength', 'Dexterity'])
  })

  it('T1b 2024 lane: file-carried class.fightingStyles survives the :103 class re-assignment', async () => {
    const summary = {
      name: 'Style_Hero_24',
      campaignName: 'test-campaign',
      rules: '2024',
      level: 5,
      class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Great Weapon Fighting'] },
    }

    const result = await callFactory(summary, TABLE_2024)

    expect(result.class.fightingStyles).toEqual(['Great Weapon Fighting'])
    // real 2024 getClass work survives alongside the carry
    expect(result.class.major).toEqual({ name: 'Champion', features: [] })
    expect(result.class.class_levels).toEqual([{ level: 1 }])
    expect(result.class.proficiencies).toContain('Martial Weapons')
  })

  it('T2 no-legacy pin: a top-level fightingStyles array is NEVER lifted onto class (both rulesets)', async () => {
    const lift = {
      name: 'Legacy_Hero',
      campaignName: 'test-campaign',
      rules: '5e',
      level: 5,
      class: { name: 'Fighter', subclass: { name: 'Champion' } },
      fightingStyles: ['Defense'],
    }

    const result5e = await callFactory(lift, TABLE_5E)
    expect(result5e.class.fightingStyles).toBeUndefined()
    // the byte survives only as the inert clone carried by the trunk — no
    // consumer may read it back into class
    expect(result5e.fightingStyles).toEqual(['Defense'])

    const result24 = await callFactory({ ...lift, rules: '2024' }, TABLE_2024)
    expect(result24.class.fightingStyles).toBeUndefined()
  })
})
