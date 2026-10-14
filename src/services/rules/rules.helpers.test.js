import { describe, it, expect, vi, beforeEach } from 'vitest'
import rules from './rules.js'

vi.mock('../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((short) => ({
      STR: 'Strength',
      DEX: 'Dexterity',
      CON: 'Constitution',
      INT: 'Intelligence',
      WIS: 'Wisdom',
      CHA: 'Charisma',
    }[short] || short.toUpperCase())),
  },
}))

vi.mock('./core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name, magicBonus: 0 })),
  getAttacks: vi.fn(() => []),
}))

vi.mock('./core/abilityCalc.js', () => ({
  getAbilities: vi.fn(() => [
    { name: 'Strength', bonus: 2, totalScore: 14 },
    { name: 'Dexterity', bonus: 3, totalScore: 16 },
    { name: 'Constitution', bonus: 2, totalScore: 14 },
    { name: 'Intelligence', bonus: 1, totalScore: 12 },
    { name: 'Wisdom', bonus: 0, totalScore: 10 },
    { name: 'Charisma', bonus: 0, totalScore: 10 },
  ]),
  getHitPoints: vi.fn(() => 45),
  getCarryingCapacity: vi.fn(() => 150),
}))

vi.mock('./core/abilityCalc2024.js', () => ({
  getAbilities: vi.fn(() => [
    { name: 'Strength', bonus: 2, totalScore: 14 },
    { name: 'Dexterity', bonus: 3, totalScore: 16 },
    { name: 'Constitution', bonus: 2, totalScore: 14 },
    { name: 'Intelligence', bonus: 1, totalScore: 12 },
    { name: 'Wisdom', bonus: 0, totalScore: 10 },
    { name: 'Charisma', bonus: 0, totalScore: 10 },
  ]),
  getHitPoints: vi.fn(() => 45),
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
    getClass: vi.fn(() => ({ name: 'Fighter', languages: [] })),
    getFeatures: vi.fn(() => ({
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
    })),
    getRangerFeatures: vi.fn(() => ({ extraAttacks: 0 })),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(() => ({ name: 'Fighter', languages: [] })),
    getFeatures: vi.fn(() => ({
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
    })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(() => ({})),
    getTraits: vi.fn(() => ({
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
    })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
  rules2024: {
    getRace: vi.fn(() => ({})),
    getTraits: vi.fn(() => ({
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
    })),
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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../shared/spell-utils.js', () => ({
  getSpellMaxLevel: vi.fn(() => 9),
}))

vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(async () => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadManeuvers: vi.fn(async () => []),
}))

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({
    abilityScoreIncreases: [],
    proficiencies: [],
    features: [],
  })),
}))

vi.mock('../../combat/automation/automationService.js', () => ({
  collectAutomationFromFeatures: vi.fn(() => ({ passives: [], actions: [], specialActions: [] })),
  collectSaveModifiers: vi.fn(() => []),
  collectTurnStartEffects: vi.fn(() => []),
  getConditionImmunities: vi.fn(() => []),
  getConditionalImmunities: vi.fn(() => []),
  getEvasionEffects: vi.fn(() => []),
  getAllSaveProficiencies: vi.fn(() => []),
  evaluateAutoExpression: vi.fn(() => 0),
  buildAttackInfo: vi.fn(() => null),
}))

vi.mock('../automation/handlers/class-other/elfishLineageHandler.js', () => ({
  getElfisLineageSelection: vi.fn(() => null),
  handle: vi.fn(),
}))

describe('rules helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getActions 2024-specific', () => {
    it('handles 2024 string bonusActions', () => {
      const stats = {
        rules: '2024',
        actions: [],
        bonusActions: ['Haste'],
        reactions: [],
        specialActions: [],
      }
      const result = rules.getActions(stats, {})
      // String bonusActions are NOT mapped to objects in the 2024 code path
      // They remain as strings, so .name is undefined
      expect(result[1].length).toBe(1)
    })

    it('handles 2024 string reactions', () => {
      const stats = {
        rules: '2024',
        actions: [],
        bonusActions: [],
        reactions: ['Reaction Attack'],
        specialActions: [],
      }
      const result = rules.getActions(stats, {})
      // String reactions are NOT mapped to objects in the 2024 code path
      expect(result[2].length).toBe(1)
    })

    it('deduplicates across feature and trait actions in 2024', async () => {
      const { default: classRules } = await import('../character/classRules2024.js')
      vi.mocked(classRules.getFeatures).mockReturnValue({
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      })
      const stats = {
        rules: '2024',
        actions: ['Attack'],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }
      const result = rules.getActions(stats, {})
      const actionNames = result[0].map((a) => a.name)
      expect(actionNames.filter((n) => n === 'Attack').length).toBe(1)
    })
  })

  describe('getActions 5e-specific', () => {
    it('throws when actions is not an array (5e)', () => {
      const stats = {
        rules: '5e',
        actions: 'not an array',
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }
      expect(() => rules.getActions(stats, {})).toThrow('Missing array: actions')
    })

    it('throws when bonusActions is not an array (5e)', () => {
      const stats = {
        rules: '5e',
        actions: [],
        bonusActions: 'not an array',
        reactions: [],
        specialActions: [],
      }
      expect(() => rules.getActions(stats, {})).toThrow('Missing array: bonusActions')
    })

    it('throws when reactions is not an array (5e)', () => {
      const stats = {
        rules: '5e',
        actions: [],
        bonusActions: [],
        reactions: 'not an array',
        specialActions: [],
      }
      expect(() => rules.getActions(stats, {})).toThrow('Missing array: reactions')
    })

    it('throws when specialActions is not an array (5e)', () => {
      const stats = {
        rules: '5e',
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: 'not an array',
      }
      expect(() => rules.getActions(stats, {})).toThrow('Missing array: specialActions')
    })
  })

  describe('getProficiencies 5e-specific', () => {
    it('throws when class.subclass is not an object (5e)', () => {
      const stats = {
        rules: '5e',
        class: { subclass: null },
      }
      expect(() => rules.getProficiencies(stats, true, {})).toThrow('Missing object: class.subclass')
    })
  })

  describe('getProficiencies 2024-specific', () => {
    it('throws when class.major is not an object (2024)', () => {
      const stats = {
        rules: '2024',
        class: { major: null },
      }
      expect(() => rules.getProficiencies(stats, true, {})).toThrow('Missing object: class.major')
    })
  })

  describe('getLanguages', () => {
    it('throws when race.languages is not an array', () => {
      const stats = {
        race: { languages: 'not an array' },
        class: { languages: [] },
      }
      expect(() => rules.getLanguages(stats, {})).toThrow('Missing array: race.languages')
    })

    it('throws when class.languages is not an array', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { languages: 'not an array' },
      }
      expect(() => rules.getLanguages(stats, {})).toThrow('Missing array: class.languages')
    })

    it('throws when subrace.languages is not an array', () => {
      const stats = {
        race: {
          languages: ['Common'],
          subrace: { languages: 'not an array', language_options: { choose: 1 } },
        },
        class: { languages: [] },
      }
      expect(() => rules.getLanguages(stats, {})).toThrow('Missing array: subrace.languages')
    })

    it('handles ranger language bonuses at levels 6-13 and 14+', () => {
      const stats6 = {
        race: { languages: ['Common'] },
        class: { name: 'Ranger', languages: [], language_choices: { choose: 0 } },
        languages: [],
        level: 6,
      }
      expect(rules.getLanguages(stats6, {})[0]).toBe(4)

      const stats14 = {
        race: { languages: ['Common'] },
        class: { name: 'Ranger', languages: [], language_choices: { choose: 0 } },
        languages: [],
        level: 14,
      }
      expect(rules.getLanguages(stats14, {})[0]).toBe(5)
    })
  })

  describe('getMagicItems', () => {
    it('throws when inventory.magicItems is not an array', () => {
      const stats = { rules: '5e' }
      expect(() => rules.getMagicItems([], { inventory: { magicItems: 'not an array' } }, stats)).toThrow(
        'Missing array: inventory.magicItems'
      )
    })

    it('Spell Scroll items get description from inventory item', () => {
      const magicItems = [{ name: 'Spell Scroll', description: 'A scroll with a spell' }]
      const stats = { rules: '5e' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: [{ name: 'Spell Scroll', spell: 'magic missile' }] } }, stats)
      expect(result[0].description).toBe('magic missile')
    })
  })
})
