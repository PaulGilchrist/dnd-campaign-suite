import { describe, it, expect, vi, beforeEach } from 'vitest'
import rules from './rules.js'

vi.mock('../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((short) => short.toUpperCase()),
  },
}))

vi.mock('./core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name, magicBonus: 0 })),
  getAttacks: vi.fn(() => []),
}))

vi.mock('./core/abilityCalc.js', () => ({
  getAbilities: vi.fn(() => []),
  getHitPoints: vi.fn(() => 10),
  getCarryingCapacity: vi.fn(() => 150),
}))

vi.mock('./core/abilityCalc2024.js', () => ({
  getAbilities: vi.fn(() => []),
  getHitPoints: vi.fn(() => 10),
  getCarryingCapacity: vi.fn(() => 150),
}))

vi.mock('./core/spellCalc.js', () => ({
  getSpellAbilities: vi.fn(() => ({})),
}))

vi.mock('./core/spellCalc2024.js', () => ({
  getSpellAbilities: vi.fn(() => ({})),
}))

vi.mock('./core/attackCalc2024.js', () => ({
  getAttacks: vi.fn(() => []),
}))

vi.mock('../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(() => ({ name: 'Fighter' })),
    getFeatures: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
    getRangerFeatures: vi.fn(() => ({ extraAttacks: 0 })),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(() => ({ name: 'Fighter' })),
    getFeatures: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(() => ({})),
    getTraits: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
  rules2024: {
    getRace: vi.fn(() => ({})),
    getTraits: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
}))

vi.mock('../character/proficiencyUtils.js', () => ({
  getProficiencies: vi.fn(() => [5, []]),
  getProficiencyChoiceCount: vi.fn(() => 0),
}))

vi.mock('../character/proficiencyUtils2024.js', () => ({
  getProficiencies: vi.fn(() => [5, []]),
  getProficiencyChoiceCount: vi.fn(() => 0),
}))

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../shared/spell-utils.js', () => ({
  getSpellMaxLevel: vi.fn(() => 9),
}))

vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(async () => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
}))

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
}))

vi.mock('../../combat/automation/automationService.js', () => ({
  collectAutomationFromFeatures: vi.fn(() => ({ passives: [], actions: [], specialActions: [] })),
  collectSaveModifiers: vi.fn(() => ({})),
  collectTurnStartEffects: vi.fn(() => []),
  getConditionImmunities: vi.fn(() => []),
  getConditionalImmunities: vi.fn(() => []),
  getEvasionEffects: vi.fn(() => []),
  getAllSaveProficiencies: vi.fn(() => []),
  evaluateAutoExpression: vi.fn(() => 0),
  buildAttackInfo: vi.fn(() => null),
}))

vi.mock('../../automation/handlers/class-other/elfishLineageHandler.js', () => ({
  getElfisLineageSelection: vi.fn(() => null),
}))

describe('rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAbilityLongName', () => {
    it('returns the long ability name via utils', () => {
      const result = rules.getAbilityLongName('STR')
      expect(result).toBe('STR')
    })
  })

  describe('getSpellMaxLevel', () => {
    it('delegates to getSpellMaxLevel', () => {
      const result = rules.getSpellMaxLevel({})
      expect(typeof result).toBe('number')
    })
  })

  describe('getSubModules', () => {
    it('returns 5e modules for 5e ruleset', () => {
      const stats = { rules: '5e' }
      const result = rules.getSubModules(stats, {})
      expect(result.use2024).toBe(false)
      expect(result.classRules).toBeDefined()
      expect(result.raceRules).toBeDefined()
    })

    it('returns 2024 modules for 2024 ruleset', () => {
      const stats = { rules: '2024' }
      const result = rules.getSubModules(stats, {})
      expect(result.use2024).toBe(true)
    })

    it('defaults to 5e when no rules specified', () => {
      const result = rules.getSubModules({}, {})
      expect(result.use2024).toBe(false)
    })
  })

  describe('getAbilities', () => {
    it('calls 5e abilities for 5e ruleset', async () => {
      const result = await rules.getAbilities({ rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('calls 2024 abilities for 2024 ruleset', async () => {
      const result = await rules.getAbilities({ rules: '2024' }, {})
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getHitPoints', () => {
    it('returns hit points for 5e', () => {
      const result = rules.getHitPoints({ rules: '5e' }, {})
      expect(typeof result).toBe('number')
    })

    it('returns hit points for 2024', () => {
      const result = rules.getHitPoints({ rules: '2024' }, {})
      expect(typeof result).toBe('number')
    })
  })

  describe('getCarryingCapacity', () => {
    it('returns carrying capacity for 5e', () => {
      const result = rules.getCarryingCapacity({ rules: '5e' })
      expect(typeof result).toBe('number')
    })

    it('returns carrying capacity for 2024', () => {
      const result = rules.getCarryingCapacity({ rules: '2024' })
      expect(typeof result).toBe('number')
    })
  })

  describe('getSpellAbilities', () => {
    it('delegates to the correct ruleset', () => {
      const result = rules.getSpellAbilities([], { rules: '5e' }, {})
      expect(result).toBeDefined()
    })
  })

  describe('getAttacks', () => {
    it('delegates to the correct ruleset', () => {
      const result = rules.getAttacks([], [], { rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getProficiencyChoiceCount', () => {
    it('returns proficiency choice count', () => {
      const result = rules.getProficiencyChoiceCount({}, [], {})
      expect(typeof result).toBe('number')
    })
  })

  describe('getProficiencies', () => {
    it('returns proficiency arrays for 5e', () => {
      const result = rules.getProficiencies({ rules: '5e', class: { subclass: {} } }, true, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('returns proficiency arrays for 2024', () => {
      const result = rules.getProficiencies({ rules: '2024', class: { major: {} } }, true, {})
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getActions', () => {
    it('returns actions arrays for 5e', () => {
      const stats = { rules: '5e', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      const result = rules.getActions(stats, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(5)
    })

    it('returns actions arrays for 2024', () => {
      const stats = { rules: '2024', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      const result = rules.getActions(stats, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(5)
    })
  })

  describe('getArmorClass', () => {
    it('returns armor class and formula', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Constitution', bonus: 2 },
          { name: 'Dexterity', bonus: 3 },
          { name: 'Wisdom', bonus: 1 },
          { name: 'Charisma', bonus: 0 },
        ],
        class: { name: 'Monk' },
        inventory: { equipped: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toBeGreaterThan(0)
    })
  })

  describe('getLanguages', () => {
    it('returns languages array and count', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: {},
        languages: [],
      }
      const result = rules.getLanguages(stats, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toBeGreaterThan(0)
    })
  })

  describe('getMagicItems', () => {
    it('returns null when no magic items for 5e', () => {
      const stats = { rules: '5e' }
      const result = rules.getMagicItems([], {}, stats)
      expect(result).toBeNull()
    })

    it('returns empty array when no magic items for 2024', () => {
      const stats = { rules: '2024' }
      const result = rules.getMagicItems([], {}, stats)
      expect(result).toEqual([])
    })
  })
})
