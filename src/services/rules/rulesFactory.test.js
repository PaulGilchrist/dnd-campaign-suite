// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rulesFactory from './rulesFactory.js'
import rules from './rules.js'

vi.mock('./rules.js', () => ({
  default: {
    getAbilityLongName: vi.fn((s) => `Long: ${s}`),
    getAbilities: vi.fn(async () => [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 2 },
    ]),
    getActions: vi.fn(() => [[], [], [], [], []]),
    getArmorClass: vi.fn(() => [18, 'Chain mail + Dex']),
    getAttacks: vi.fn(() => [{ name: 'Longsword' }]),
    getHitPoints: vi.fn(() => 45),
    getLanguages: vi.fn(() => [3, ['Common', 'Dwarvish', 'Elvish']]),
    getMagicItems: vi.fn(() => []),
    getProficiencyChoiceCount: vi.fn(() => 2),
    getProficiencies: vi.fn(() => [5, ['Athletics', 'Perception']]),
    getSpellAbilities: vi.fn(() => ({
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
    })),
    getSpellMaxLevel: vi.fn(() => 9),
    getPlayerStats: vi.fn(async (classes, equipment, magicItems, races, spells, summary) => ({
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
    getRace: vi.fn(() => ({ name: 'Human' })),
    getImmunities: vi.fn(() => ['Poisoned']),
    getResistances: vi.fn(() => ['Fire']),
    getSenses: vi.fn(() => [{ name: 'Darkvision', value: '60 ft.' }]),
  },
  rules2024: {
    getRace: vi.fn(() => ({ name: 'High Elf' })),
    getImmunities: vi.fn(() => ['Charmed']),
    getResistances: vi.fn(() => ['Cold']),
    getSenses: vi.fn(() => [{ name: 'Darkvision', value: '60 ft.' }]),
  },
}))

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
  computeTrackedResources: vi.fn(() => ({ hitPoints: { current: 45, max: 45 } })),
}))

vi.mock('../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(
    (_playerStats, _name, _suffix) => null
  ),
}))

describe('rulesFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRules', () => {
    it('returns correct modules for each ruleset', () => {
      const result5e = rulesFactory.getRules({ rules: '5e' })
      const result2024 = rulesFactory.getRules({ rules: '2024' })
      const resultDefault = rulesFactory.getRules({})

      expect(result5e.rules).toBeDefined()
      expect(result5e.raceRules).toBeDefined()
      expect(result2024.raceRules).toBeDefined()
      expect(resultDefault.raceRules).toBeDefined()
    })

    it('selects different race rules for each ruleset', async () => {
      const { rules5e, rules2024 } = await import(
        '../character/race-rules/index.js'
      )
      vi.clearAllMocks()
      const result5e = rulesFactory.getRules({ rules: '5e' })
      const result2024 = rulesFactory.getRules({ rules: '2024' })
      expect(result5e.raceRules).toBe(rules5e)
      expect(result2024.raceRules).toBe(rules2024)
    })
  })

  describe('getRulesType', () => {
    it('returns 5e by default or the specified rules type', () => {
      expect(rulesFactory.getRulesType({})).toBe('5e')
      expect(rulesFactory.getRulesType({ rules: '2024' })).toBe('2024')
    })
  })

  describe('direct rules calls', () => {
    it('rules.getAbilityLongName returns long name', () => {
      expect(rules.getAbilityLongName('str')).toBe('Long: str')
    })

    it('rules.getAbilities returns abilities array', async () => {
      const result = await rules.getAbilities({}, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0].name).toBe('Strength')
    })

    it('rules.getActions returns nested arrays', () => {
      const result = rules.getActions({ rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(5)
    })

    it('rules.getArmorClass returns [ac, contributions]', () => {
      const result = rules.getArmorClass([], { rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toBe(18)
      expect(result[1]).toBe('Chain mail + Dex')
    })

    it('rules.getAttacks returns attack objects', () => {
      const result = rules.getAttacks([], [], { rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].name).toBe('Longsword')
    })

    it('rules.getHitPoints returns a number', () => {
      expect(rules.getHitPoints({ rules: '5e' }, {})).toBe(45)
    })

    it('rules.getLanguages returns [count, languages]', () => {
      const result = rules.getLanguages({ rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toBe(3)
      expect(result[1]).toEqual(['Common', 'Dwarvish', 'Elvish'])
    })

    it('rules.getMagicItems returns items', () => {
      const result = rules.getMagicItems([], {}, { rules: '5e' })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('rules.getProficiencyChoiceCount returns count', () => {
      expect(rules.getProficiencyChoiceCount({}, [], {})).toBe(2)
    })

    it('rules.getProficiencies returns [count, proficiencies]', () => {
      const result = rules.getProficiencies({ rules: '5e' }, true, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toBe(5)
      expect(result[1]).toContain('Athletics')
    })

    it('rules.getSpellAbilities returns spell ability object', () => {
      const result = rules.getSpellAbilities([], { rules: '5e' }, {})
      expect(result).toBeDefined()
      expect(result.spell_slots_level_1).toBe(4)
    })

    it('rules.getSpellMaxLevel returns max level', () => {
      expect(rules.getSpellMaxLevel({})).toBe(9)
    })

    it('raceRules.getImmunities returns immunities', async () => {
      const { rules5e, rules2024 } = await import(
        '../character/race-rules/index.js'
      )
      expect(rules5e.getImmunities({ rules: '5e' })).toContain('Poisoned')
      expect(rules2024.getImmunities({ rules: '2024' })).toContain('Charmed')
    })

    it('raceRules.getResistances returns resistances', async () => {
      const { rules5e, rules2024 } = await import(
        '../character/race-rules/index.js'
      )
      expect(rules5e.getResistances({ rules: '5e' })).toContain('Fire')
      expect(rules2024.getResistances({ rules: '2024' })).toContain('Cold')
    })
  })

  describe('class rules delegation - 5e vs 2024', () => {
    it('delegates druid and rogue class methods to the correct ruleset', () => {
      expect(rulesFactory.getDruidMaxWildShapeChallengeRating({}, { rules: '5e' })).toBe(1)
      expect(rulesFactory.getDruidMaxWildShapeChallengeRating({}, { rules: '2024' })).toBe(2)

      expect(rulesFactory.getDruidWildShapeUses({}, { rules: '5e' })).toBe(2)
      expect(rulesFactory.getDruidWildShapeUses({}, { rules: '2024' })).toBe(3)

      expect(rulesFactory.getDruidBeastKnownForms({}, { rules: '5e' })[0].name).toBe('Raccoon')
      expect(rulesFactory.getDruidBeastKnownForms({}, { rules: '2024' })[0].name).toBe('Bear')

      expect(rulesFactory.getDruidBeastFlySpeed({}, { rules: '5e' })).toBe(true)
      expect(rulesFactory.getDruidBeastFlySpeed({}, { rules: '2024' })).toBe(false)

      expect(rulesFactory.getRogueSneakAttack({}, { rules: '5e' })).toBe(3)
      expect(rulesFactory.getRogueSneakAttack({}, { rules: '2024' })).toBe(5)
    })
  })

  describe('race rules delegation - 5e vs 2024', () => {
    it('uses raceRules for immunities and resistances', async () => {
      const { rules5e, rules2024 } = await import(
        '../character/race-rules/index.js'
      )
      expect(rules5e.getImmunities({ rules: '5e' })).toContain('Poisoned')
      expect(rules2024.getImmunities({ rules: '2024' })).toContain('Charmed')
      expect(rules5e.getResistances({ rules: '5e' })).toContain('Fire')
      expect(rules2024.getResistances({ rules: '2024' })).toContain('Cold')
    })

    it('returns base senses from race rules', () => {
      const result = rulesFactory.getSenses(
        { automation: { passives: [] } },
        { rules: '5e' }
      )
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].name).toBe('Darkvision')
      expect(result[0].value).toBe('60 ft.')
    })

    it('adds truesight and blindsight from passive_buff when not already present', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'passive_buff', effect: 'truesight', range: '120 ft.' },
            { type: 'passive_buff', effect: 'blindsight' },
          ],
        },
      }
      const result = rulesFactory.getSenses(stats, { rules: '5e' })
      const truesight = result.find((s) => s.name === 'Truesight')
      const blindsight = result.find((s) => s.name === 'Blindsight')
      expect(truesight).toBeDefined()
      expect(truesight.value).toBe('120 ft.')
      expect(blindsight).toBeDefined()
      expect(blindsight.value).toBe('10 ft.')
    })

    it('does not add truesight or blindsight when already present in base senses', async () => {
      const { rules5e } = await import('../character/race-rules/index.js')
      const originalGetSenses = rules5e.getSenses
      rules5e.getSenses = vi.fn(() => [{ name: 'Truesight', value: '30 ft.' }, { name: 'Blindsight', value: '10 ft.' }])

      const stats = {
        automation: {
          passives: [
            { type: 'passive_buff', effect: 'truesight', range: '120 ft.' },
            { type: 'passive_buff', effect: 'blindsight', range: '60 ft.' },
          ],
        },
      }
      const result = rulesFactory.getSenses(stats, { rules: '5e' })
      const truesightEntries = result.filter((s) => s.name === 'Truesight')
      const blindsightEntries = result.filter((s) => s.name === 'Blindsight')
      expect(truesightEntries.length).toBe(1)
      expect(truesightEntries[0].value).toBe('30 ft.')
      expect(blindsightEntries.length).toBe(1)
      expect(blindsightEntries[0].value).toBe('10 ft.')

      rules5e.getSenses = originalGetSenses
    })
  })

  describe('getPlayerStats', () => {
    it('returns player stats with tracked resources', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        { rules: '5e' }
      )
      expect(result).toBeDefined()
      expect(result._trackedResources).toBeDefined()
      expect(result._trackedResources.hitPoints).toBeDefined()
    })

    it('adds auto resistances from resistance passives and passive_immunity', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        {
          rules: '5e',
          resistances: [],
          automation: {
            passives: [
              { type: 'resistance', damageTypes: ['Fire', 'Cold'] },
              { type: 'passive_immunity', damageResistance: ['Psychic'] },
            ],
          },
        }
      )
      expect(result.resistances).toContain('Fire')
      expect(result.resistances).toContain('Cold')
      expect(result.resistances).toContain('Psychic')
    })

    it('deduplicates auto resistances with existing ones', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        {
          rules: '5e',
          resistances: ['Fire'],
          automation: {
            passives: [{ type: 'resistance', damageTypes: ['Fire', 'Lightning'] }],
          },
        }
      )
      const fireCount = result.resistances.filter((r) => r === 'Fire').length
      expect(fireCount).toBe(1)
      expect(result.resistances).toContain('Lightning')
    })

    it('adds land resistance when class type matches mapping', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        {
          rules: '5e',
          resistances: [],
          class: { major: { type: 'nature' } },
          automation: {
            passives: [{ type: 'land_resistance', landMappings: { nature: 'Lightning' } }],
          },
        }
      )
      expect(result.resistances).toContain('Lightning')
    })

    it('does not add land resistance when class type does not match mapping', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        {
          rules: '5e',
          resistances: [],
          class: { major: { type: 'fire' } },
          automation: {
            passives: [{ type: 'land_resistance', landMappings: { nature: 'Lightning' } }],
          },
        }
      )
      expect(result.resistances).not.toContain('Lightning')
    })

    it('prioritizes major.type over subclass.type for land resistance', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        {
          rules: '5e',
          resistances: [],
          class: { major: { type: 'nature' }, subclass: { type: 'fire' } },
          automation: {
            passives: [
              { type: 'land_resistance', landMappings: { nature: 'Lightning', fire: 'Fire' } },
            ],
          },
        }
      )
      expect(result.resistances).toContain('Lightning')
    })

    it('trims whitespace from class type for land resistance matching', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        {
          rules: '5e',
          resistances: [],
          class: { major: { type: '  nature  ' } },
          automation: {
            passives: [{ type: 'land_resistance', landMappings: { nature: 'Lightning' } }],
          },
        }
      )
      expect(result.resistances).toContain('Lightning')
    })

    it('respects runtime choice resistances for 2024', async () => {
      const { getChosenRuntimeValue } = await import(
        '../automation/common/choiceStorage.js'
      )
      vi.mocked(getChosenRuntimeValue).mockImplementation(
        (_playerStats, name) => {
          if (name === 'Elemental Affinity') return 'Radiant'
          if (name === 'Fiendish Resilience') return 'Fire'
          if (name === 'Boon Of Energy Resistance') return ['Necrotic', 'Poison']
          return null
        }
      )
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        { rules: '2024', resistances: [] }
      )
      expect(result.resistances).toContain('Radiant')
      expect(result.resistances).toContain('Fire')
      expect(result.resistances).toContain('Necrotic')
      expect(result.resistances).toContain('Poison')
    })

    it('does not add Boon Of Energy Resistance when array is empty', async () => {
      const { getChosenRuntimeValue } = await import(
        '../automation/common/choiceStorage.js'
      )
      vi.mocked(getChosenRuntimeValue).mockImplementation(
        (_playerStats, name) => {
          if (name === 'Boon Of Energy Resistance') return []
          return null
        }
      )
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        { rules: '2024', resistances: [] }
      )
      expect(result.resistances).toEqual(['Cold'])
    })

    it('combines multiple resistance sources from passives and race rules', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        {
          rules: '5e',
          resistances: [],
          automation: {
            passives: [
              { type: 'resistance', damageTypes: ['Fire'] },
              { type: 'passive_immunity', damageResistance: ['Psychic'] },
            ],
          },
        }
      )
      expect(result.resistances).toContain('Fire')
      expect(result.resistances).toContain('Psychic')
    })

    it('sets class and race from appropriate ruleset modules', async () => {
      const result = await rulesFactory.getPlayerStats(
        [],
        [],
        [],
        [],
        {},
        { rules: '5e', resistances: [] }
      )
      expect(result.class).toBeDefined()
      expect(result.race).toBeDefined()
      expect(result.immunities).toBeDefined()
      expect(result.resistances).toBeDefined()
    })

    it('throws when passives is not an array', async () => {
      await expect(
        rulesFactory.getPlayerStats(
          [],
          [],
          [],
          [],
          {},
          {
            rules: '5e',
            resistances: [],
            automation: { passives: 'not-an-array' },
          }
        )
      ).rejects.toThrow('Expected passives to be an array')
    })

    it('throws when damageTypes is not an array in resistance passive', async () => {
      await expect(
        rulesFactory.getPlayerStats(
          [],
          [],
          [],
          [],
          {},
          {
            rules: '5e',
            resistances: [],
            automation: {
              passives: [{ type: 'resistance', damageTypes: 'not-an-array' }],
            },
          }
        )
      ).rejects.toThrow('Expected damageTypes to be an array')
    })

    it('throws when landMappings is null in land_resistance passive', async () => {
      await expect(
        rulesFactory.getPlayerStats(
          [],
          [],
          [],
          [],
          {},
          {
            rules: '5e',
            resistances: [],
            class: { major: { type: 'nature' } },
            automation: {
              passives: [{ type: 'land_resistance', landMappings: null }],
            },
          }
        )
      ).rejects.toThrow('Expected landMappings to be an object')
    })
  })
})
