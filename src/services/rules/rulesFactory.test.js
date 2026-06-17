import { describe, it, expect, vi, beforeEach } from 'vitest'
import rulesFactory from './rulesFactory.js'

vi.mock('./rules.js', () => ({
  default: {
    getAbilityLongName: vi.fn((s) => s),
    getAbilities: vi.fn(async () => []),
    getActions: vi.fn(() => [[], [], [], [], []]),
    getArmorClass: vi.fn(() => [10, '']),
    getAttacks: vi.fn(() => []),
    getHitPoints: vi.fn(() => 10),
    getLanguages: vi.fn(() => [2, []]),
    getMagicItems: vi.fn(() => null),
    getProficiencyChoiceCount: vi.fn(() => 0),
    getProficiencies: vi.fn(() => [5, []]),
    getSpellAbilities: vi.fn(() => ({})),
    getSpellMaxLevel: vi.fn(() => 9),
    getPlayerStats: vi.fn(async (classes, equipment, magicItems, races, spells, summary) => ({
      ...summary,
      class: summary.class || { name: 'Fighter' },
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
    getRace: vi.fn(() => ({})),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
  rules2024: {
    getRace: vi.fn(() => ({})),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
}))

vi.mock('../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(() => ({ name: 'Fighter' })),
    getDruidMaxWildShapeChallengeRating: vi.fn(() => 0),
    getDruidWildShapeUses: vi.fn(() => 0),
    getDruidBeastKnownForms: vi.fn(() => []),
    getDruidBeastFlySpeed: vi.fn(() => null),
    getRogueSneakAttack: vi.fn(() => 0),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(() => ({ name: 'Fighter' })),
    getDruidMaxWildShapeChallengeRating: vi.fn(() => 0),
    getDruidWildShapeUses: vi.fn(() => 0),
    getDruidBeastKnownForms: vi.fn(() => []),
    getDruidBeastFlySpeed: vi.fn(() => null),
    getRogueSneakAttack: vi.fn(() => 0),
  },
}))

vi.mock('./trackedResources.js', () => ({
  computeTrackedResources: vi.fn(() => ({})),
}))

vi.mock('../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => null),
}))

describe('rulesFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRules', () => {
    it('returns 5e rules by default', () => {
      const result = rulesFactory.getRules({})
      expect(result.rules).toBeDefined()
      expect(result.raceRules).toBeDefined()
    })

    it('returns 5e rules when rules is 5e', () => {
      const result = rulesFactory.getRules({ rules: '5e' })
      expect(result.raceRules).toBeDefined()
    })

    it('returns 2024 rules when rules is 2024', () => {
      const result = rulesFactory.getRules({ rules: '2024' })
      expect(result.raceRules).toBeDefined()
    })
  })

  describe('getRulesType', () => {
    it('returns 5e by default', () => {
      expect(rulesFactory.getRulesType({})).toBe('5e')
    })

    it('returns the rules type from summary', () => {
      expect(rulesFactory.getRulesType({ rules: '2024' })).toBe('2024')
    })
  })

  describe('delegation wrappers', () => {
    it('getAbilityLongName delegates to rules', () => {
      expect(typeof rulesFactory.getAbilityLongName).toBe('function')
    })

    it('getAbilities delegates to rules', async () => {
      const result = await rulesFactory.getAbilities({}, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('getActions delegates to rules', () => {
      const result = rulesFactory.getActions({ rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('getArmorClass delegates to rules', () => {
      const result = rulesFactory.getArmorClass([], { rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('getAttacks delegates to rules', () => {
      const result = rulesFactory.getAttacks([], [], { rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('getHitPoints delegates to rules', () => {
      const result = rulesFactory.getHitPoints({ rules: '5e' }, {})
      expect(typeof result).toBe('number')
    })

    it('getLanguages delegates to rules', () => {
      const result = rulesFactory.getLanguages({ rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('getMagicItems delegates to rules', () => {
      const result = rulesFactory.getMagicItems([], {}, { rules: '5e' })
      expect(result).toBeNull()
    })

    it('getProficiencyChoiceCount delegates to rules', () => {
      const result = rulesFactory.getProficiencyChoiceCount({}, [], {})
      expect(typeof result).toBe('number')
    })

    it('getProficiencies delegates to rules', () => {
      const result = rulesFactory.getProficiencies({ rules: '5e' }, true, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('getSpellAbilities delegates to rules', () => {
      const result = rulesFactory.getSpellAbilities([], { rules: '5e' }, {})
      expect(result).toBeDefined()
    })

    it('getSpellMaxLevel delegates to rules', () => {
      const result = rulesFactory.getSpellMaxLevel({})
      expect(typeof result).toBe('number')
    })
  })

  describe('class rules delegation', () => {
    it('getDruidMaxWildShapeChallengeRating', () => {
      const result = rulesFactory.getDruidMaxWildShapeChallengeRating({}, { rules: '5e' })
      expect(typeof result).toBe('number')
    })

    it('getDruidWildShapeUses', () => {
      const result = rulesFactory.getDruidWildShapeUses({}, { rules: '5e' })
      expect(typeof result).toBe('number')
    })

    it('getDruidBeastKnownForms', () => {
      const result = rulesFactory.getDruidBeastKnownForms({}, { rules: '5e' })
      expect(Array.isArray(result)).toBe(true)
    })

    it('getDruidBeastFlySpeed', () => {
      const result = rulesFactory.getDruidBeastFlySpeed({}, { rules: '5e' })
      expect(result).toBeNull()
    })

    it('getRogueSneakAttack', () => {
      const result = rulesFactory.getRogueSneakAttack({}, { rules: '5e' })
      expect(typeof result).toBe('number')
    })
  })

  describe('race rules delegation', () => {
    it('getImmunities', () => {
      const result = rulesFactory.getImmunities({ rules: '5e' })
      expect(Array.isArray(result)).toBe(true)
    })

    it('getResistances', () => {
      const result = rulesFactory.getResistances({ rules: '5e' })
      expect(Array.isArray(result)).toBe(true)
    })

    it('getSenses returns senses array', () => {
      const result = rulesFactory.getSenses({}, { rules: '5e' })
      expect(Array.isArray(result)).toBe(true)
    })

    it('getSenses adds truesight from passive_buff', () => {
      const stats = {
        automation: {
          passives: [{ type: 'passive_buff', effect: 'truesight', range: '120 ft.' }],
        },
      }
      const result = rulesFactory.getSenses(stats, { rules: '5e' })
      const truesight = result.find((s) => s.name === 'Truesight')
      expect(truesight).toBeDefined()
      expect(truesight.value).toBe('120 ft.')
    })

    it('getSenses adds blindsight from passive_buff', () => {
      const stats = {
        automation: {
          passives: [{ type: 'passive_buff', effect: 'blindsight', range: '30 ft.' }],
        },
      }
      const result = rulesFactory.getSenses(stats, { rules: '5e' })
      const blindsight = result.find((s) => s.name === 'Blindsight')
      expect(blindsight).toBeDefined()
      expect(blindsight.value).toBe('30 ft.')
    })
  })

  describe('getPlayerStats', () => {
    it('returns player stats with tracked resources', async () => {
      const result = await rulesFactory.getPlayerStats([], [], [], [], {}, { rules: '5e' })
      expect(result).toBeDefined()
      expect(result._trackedResources).toBeDefined()
    })

    it('adds auto resistances from passives', async () => {
      const result = await rulesFactory.getPlayerStats([], [], [], [], {}, {
        rules: '5e',
        resistances: [],
        automation: {
          passives: [{ type: 'resistance', damageTypes: ['Fire', 'Cold'] }],
        },
      })
      expect(result.resistances).toContain('Fire')
      expect(result.resistances).toContain('Cold')
    })

    it('adds passive immunity resistances', async () => {
      const result = await rulesFactory.getPlayerStats([], [], [], [], {}, {
        rules: '5e',
        resistances: [],
        automation: {
          passives: [{ type: 'passive_immunity', damageResistance: ['Psychic'] }],
        },
      })
      expect(result.resistances).toContain('Psychic')
    })

    it('does not add land resistance when class type does not match mapping', async () => {
      const result = await rulesFactory.getPlayerStats([], [], [], [], {}, {
        rules: '5e',
        resistances: [],
        class: { major: { type: 'fire' } },
        automation: {
          passives: [{ type: 'land_resistance', landMappings: { nature: 'Lightning' } }],
        },
      })
      expect(result.resistances).not.toContain('Lightning')
    })
  })
})
