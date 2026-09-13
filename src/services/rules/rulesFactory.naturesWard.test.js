// @improved-by-ai
// CLA-237 regression: Nature's Ward land resistance must resolve from the
// runtime _circleOfTheLandType key (not just classData.major/subclass type),
// so every getPlayerStats caller — including App computedCharacters feeding
// applyDamageToTarget — receives the land damage-type resistance.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rulesFactory from './rulesFactory.js'

vi.mock('./rules.js', () => ({
  default: {
    getAbilityLongName: vi.fn((s) => `Long: ${s}`),
    getAbilities: vi.fn(async () => []),
    getActions: vi.fn(() => [[], [], [], [], []]),
    getArmorClass: vi.fn(() => [9, '']),
    getAttacks: vi.fn(() => []),
    getHitPoints: vi.fn(() => 143),
    getLanguages: vi.fn(() => [1, ['Common']]),
    getMagicItems: vi.fn(() => []),
    getProficiencyChoiceCount: vi.fn(() => 0),
    getProficiencies: vi.fn(() => [0, []]),
    getSpellAbilities: vi.fn(() => ({ spell_slots_level_1: 0 })),
    getSpellMaxLevel: vi.fn(() => 0),
    getPlayerStats: vi.fn(async ({ playerSummary: summary }) => ({
      ...summary,
      class: summary.class || { name: 'Druid', class_levels: [] },
      race: {},
      immunities: [],
      resistances: summary.resistances || [],
      automation: summary.automation || { passives: [] },
      level: 20,
    })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(() => ({ name: 'Human' })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
  rules2024: {
    getRace: vi.fn(() => ({ name: 'Human' })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
}))

vi.mock('../character/classRules.js', () => ({
  default: {
    getClass: vi.fn((_allClasses, playerStats) => ({ ...(playerStats?.class || {}) })),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn((_allClasses, playerStats) => ({ ...(playerStats?.class || {}) })),
  },
}))

vi.mock('./trackedResources.js', () => ({
  computeTrackedResources: vi.fn(() => ({})),
}))

vi.mock('../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => null),
}))

const runtimeStore = new Map()
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeStore.get(`${name}:${key}`)),
}))

const NATURES_WARD_PASSIVE = {
  type: 'land_resistance',
  conditionImmunity: 'poisoned',
  landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
  casting_time: 'passive',
}

const druidSummary = () => ({
  name: 'Wild_Sage_Druid',
  campaignName: 'test-campaign',
  rules: '2024',
  resistances: [],
  class: { name: 'Druid', major: { name: 'Circle of the Land' }, subclass: { name: 'Circle of the Land' } },
  automation: { passives: [NATURES_WARD_PASSIVE] },
})

describe('rulesFactory Nature\u2019s Ward land resistance (CLA-237)', () => {
  beforeEach(() => {
    runtimeStore.clear()
    vi.clearAllMocks()
  })

  it('resolves lightning resistance from runtime _circleOfTheLandType when class JSON has no type', async () => {
    runtimeStore.set('Wild_Sage_Druid:_circleOfTheLandType', 'Temperate')
    const result = await rulesFactory.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {}, playerSummary: druidSummary() })
    expect(result.resistances).toContain('Lightning')
    expect(result.resistances).not.toContain('Fire')
  })

  it('flips resistance when runtime land type switches (Temperate \u2192 Arid)', async () => {
    runtimeStore.set('Wild_Sage_Druid:_circleOfTheLandType', 'Temperate')
    const temperate = await rulesFactory.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {}, playerSummary: druidSummary() })
    expect(temperate.resistances).toEqual(['Lightning'])

    runtimeStore.set('Wild_Sage_Druid:_circleOfTheLandType', 'Arid')
    const arid = await rulesFactory.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {}, playerSummary: druidSummary() })
    expect(arid.resistances).toEqual(['Fire'])
    expect(arid.resistances).not.toContain('Lightning')
  })

  it('falls back to class major/subclass type when no runtime land type is set', async () => {
    const summary = druidSummary()
    summary.class.major.type = 'temperate'
    const result = await rulesFactory.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {}, playerSummary: summary })
    expect(result.resistances).toContain('Lightning')
  })

  it('adds no land resistance when neither runtime key nor class type is set', async () => {
    const result = await rulesFactory.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {}, playerSummary: druidSummary() })
    expect(result.resistances).not.toContain('Lightning')
    expect(result.resistances).not.toContain('Fire')
  })

  it('still grants poisoned condition immunity independent of land type', async () => {
    const result = await rulesFactory.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {}, playerSummary: druidSummary() })
    expect(result.immunities).toContain('poisoned')
  })
})
