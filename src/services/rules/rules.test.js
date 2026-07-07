// @cleaned-by-ai
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
    getClass: vi.fn(() => ({ name: 'Fighter', languages: [] })),
    getFeatures: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
    getRangerFeatures: vi.fn(() => ({ extraAttacks: 0 })),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(() => ({ name: 'Fighter', languages: [] })),
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

vi.mock('../automation/handlers/class-other/elfishLineageHandler.js', () => ({
  getElfisLineageSelection: vi.fn(() => null),
  handle: vi.fn(),
}))

describe('rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAbilityLongName', () => {
    it('returns full ability name for all standard abbreviations', () => {
      expect(rules.getAbilityLongName('STR')).toBe('Strength')
      expect(rules.getAbilityLongName('DEX')).toBe('Dexterity')
      expect(rules.getAbilityLongName('CON')).toBe('Constitution')
      expect(rules.getAbilityLongName('INT')).toBe('Intelligence')
      expect(rules.getAbilityLongName('WIS')).toBe('Wisdom')
      expect(rules.getAbilityLongName('CHA')).toBe('Charisma')
    })

    it('uppercase-cases unknown ability abbreviations', () => {
      expect(rules.getAbilityLongName('XYZ')).toBe('XYZ')
    })
  })

  describe('getSpellMaxLevel', () => {
    it('returns maximum spell level from spell-utils', () => {
      const result = rules.getSpellMaxLevel({})
      expect(result).toBe(9)
    })
  })

  describe('getSubModules', () => {
    it('returns 2024 modules when ruleset is 2024 via playerStats', () => {
      const result = rules.getSubModules({ rules: '2024' }, {})
      expect(result.use2024).toBe(true)
      expect(result.classRules).toBeDefined()
      expect(result.raceRules).toBeDefined()
    })

    it('returns 2024 modules when ruleset is 2024 via playerSummary', () => {
      const result = rules.getSubModules({}, { rules: '2024' })
      expect(result.use2024).toBe(true)
    })

    it('prefers playerStats.rules over playerSummary.rules', () => {
      const result = rules.getSubModules({ rules: '5e' }, { rules: '2024' })
      expect(result.use2024).toBe(false)
    })

    it('defaults to 5e when no rules specified', () => {
      expect(rules.getSubModules({}, {}).use2024).toBe(false)
      expect(rules.getSubModules({ rules: null }, {}).use2024).toBe(false)
      expect(rules.getSubModules({ rules: undefined }, {}).use2024).toBe(false)
    })
  })

  describe('getAbilities', () => {
    it('returns abilities array for both rulesets', async () => {
      expect(Array.isArray(await rules.getAbilities({ rules: '5e' }, {}))).toBe(true)
      expect(Array.isArray(await rules.getAbilities({ rules: '2024' }, {}))).toBe(true)
    })
  })

  describe('getHitPoints', () => {
    it('returns hit points number for both rulesets', () => {
      expect(rules.getHitPoints({ rules: '5e' }, {})).toBeTypeOf('number')
      expect(rules.getHitPoints({ rules: '2024' }, {})).toBeTypeOf('number')
    })
  })

  describe('getCarryingCapacity', () => {
    it('returns carrying capacity number for both rulesets', () => {
      expect(rules.getCarryingCapacity({ rules: '5e' })).toBeTypeOf('number')
      expect(rules.getCarryingCapacity({ rules: '2024' })).toBeTypeOf('number')
    })
  })

  describe('getSpellAbilities', () => {
    it('returns spell abilities object for both rulesets', () => {
      expect(rules.getSpellAbilities([], { rules: '5e' }, {})).toBeTypeOf('object')
      expect(rules.getSpellAbilities([], { rules: '2024' }, {})).toBeTypeOf('object')
    })
  })

  describe('getAttacks', () => {
    it('returns attacks array for both rulesets', () => {
      expect(Array.isArray(rules.getAttacks([], [], { rules: '5e' }, {}))).toBe(true)
      expect(Array.isArray(rules.getAttacks([], [], { rules: '2024' }, {}))).toBe(true)
    })
  })

  describe('getProficiencyChoiceCount', () => {
    it('returns a number', () => {
      const result = rules.getProficiencyChoiceCount({}, [], {})
      expect(result).toBeTypeOf('number')
    })
  })

  describe('getProficiencies', () => {
    it('returns proficiency data for both rulesets', () => {
      const result5e = rules.getProficiencies({ rules: '5e', class: { subclass: {} } }, true, {})
      expect(Array.isArray(result5e)).toBe(true)
      expect(result5e.length).toBe(2)

      const result2024 = rules.getProficiencies({ rules: '2024', class: { major: {} } }, true, {})
      expect(Array.isArray(result2024)).toBe(true)
      expect(result2024.length).toBe(2)
    })
  })

  describe('getActions', () => {
    it('returns array of 5 action categories for both rulesets', () => {
      const stats5e = { rules: '5e', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      const stats2024 = { rules: '2024', actions: [], bonusActions: [], reactions: [], specialActions: [] }

      const result5e = rules.getActions(stats5e, {})
      const result2024 = rules.getActions(stats2024, {})

      expect(result5e.length).toBe(5)
      expect(result2024.length).toBe(5)
      expect(result5e[0]).toBeInstanceOf(Array)
      expect(result2024[0]).toBeInstanceOf(Array)
    })

    it('deduplicates actions with same name across sources', () => {
      const stats = {
        rules: '5e',
        actions: [{ name: 'Attack' }, { name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }
      const result = rules.getActions(stats, {})
      const actionNames = result[0].map((a) => a.name)
      expect(actionNames.filter((n) => n === 'Attack').length).toBe(1)
    })

    it('returns actions sorted alphabetically by name', () => {
      const stats = {
        rules: '5e',
        actions: [{ name: 'ZAction' }, { name: 'AAction' }, { name: 'MAction' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }
      const result = rules.getActions(stats, {})
      const names = result[0].map((a) => a.name)
      expect(names).toEqual(['AAction', 'MAction', 'ZAction'])
    })

    it('merges feature actions into the result', async () => {
      const { default: classRules } = await import('../character/classRules.js')
      const mockFeatures = { actions: [{ name: 'Feature Attack' }], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] }
      vi.mocked(classRules.getFeatures).mockReturnValue(mockFeatures)
      const stats = { rules: '5e', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      const result = rules.getActions(stats, {})
      const names = result[0].map((a) => a.name)
      expect(names).toContain('Feature Attack')
    })

    it('merges race trait actions into the result', async () => {
      const { rules5e } = await import('../character/race-rules/index.js')
      const mockTraits = { actions: [{ name: 'Race Trait' }], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] }
      vi.mocked(rules5e.getTraits).mockReturnValue(mockTraits)
      const stats = { rules: '5e', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      const result = rules.getActions(stats, {})
      const names = result[0].map((a) => a.name)
      expect(names).toContain('Race Trait')
    })
  })

  describe('getArmorClass', () => {
    it('calculates unarmored AC with dexterity bonus', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Constitution', bonus: 2 },
          { name: 'Dexterity', bonus: 3 },
          { name: 'Wisdom', bonus: 1 },
          { name: 'Charisma', bonus: 0 },
        ],
        class: { name: 'Wizard' },
        inventory: { equipped: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(13)
      expect(result[1]).toContain('Dexterity Bonus (3)')
    })

    it('calculates monk unarmored defense with wisdom', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Constitution', bonus: 2 },
          { name: 'Dexterity', bonus: 3 },
          { name: 'Wisdom', bonus: 5 },
        ],
        class: { name: 'Monk' },
        inventory: { equipped: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(18)
      expect(result[1]).toContain('Monk Wisdom Bonus (5)')
    })

    it('calculates barbarian unarmored defense with constitution', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Constitution', bonus: 4 },
          { name: 'Dexterity', bonus: 2 },
        ],
        class: { name: 'Barbarian' },
        inventory: { equipped: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(16)
      expect(result[1]).toContain('Constitution Bonus (4)')
    })

    it('prefers barbarian AC over monk AC when both would qualify', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Constitution', bonus: 3 },
          { name: 'Dexterity', bonus: 2 },
          { name: 'Wisdom', bonus: 5 },
        ],
        class: { name: 'Barbarian' },
        inventory: { equipped: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(15)
    })

    it('adds shield bonus when equipped', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 2 },
        ],
        class: { name: 'Wizard' },
        inventory: { equipped: ['Shield'] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(14)
      expect(result[1]).toContain('Shield (2)')
    })

    it('applies armor class from equipped armor', () => {
      const armor = { name: 'Chain Mail', armor_category: 'Armor', armor_class: { base: 16, dex_bonus: false } }
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 3 },
        ],
        class: { name: 'Fighter' },
        inventory: { equipped: ['Chain Mail'] },
      }
      const result = rules.getArmorClass([armor], stats, {})
      expect(result[0]).toBe(13)
    })

    it('caps dexterity bonus on medium armor', () => {
      const armor = { name: 'Scale Mail', armor_category: 'Armor', armor_class: { base: 14, dex_bonus: true, max_bonus: 2 } }
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 5 },
        ],
        class: { name: 'Fighter' },
        inventory: { equipped: ['Scale Mail'] },
      }
      const result = rules.getArmorClass([armor], stats, {})
      expect(result[0]).toBe(15)
    })

    it('adds defense fighting style bonus for 5e when wearing armor', () => {
      const equipment = [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } }
      ];
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 2 },
        ],
        class: { name: 'Fighter', fightingStyles: ['Defense'] },
        inventory: { equipped: ['Leather Armor'] },
      }
      const result = rules.getArmorClass(equipment, stats, {})
      expect(result[0]).toBe(14)
      expect(result[1]).toContain('Fighting Style Defense (1)')
    })

    it('does not apply defense fighting style for 2024', () => {
      const stats = {
        rules: '2024',
        abilities: [
          { name: 'Dexterity', bonus: 2 },
        ],
        class: { name: 'Fighter', fightingStyles: ['Defense'] },
        inventory: { equipped: [] },
        automation: { passives: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(12)
      expect(result[1]).not.toContain('Fighting Style Defense')
    })

    it('adds cloak and ring of protection bonus in 5e', () => {
      const stats5e = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 2 },
        ],
        class: { name: 'Wizard' },
        inventory: { equipped: [], magicItems: [{ name: 'Cloak of Protection' }, { name: 'Ring of Protection' }] },
      }
      const result = rules.getArmorClass([], stats5e, {})
      expect(result[0]).toBe(14)
      expect(result[1]).toContain('Cloak of Protection (1)')
      expect(result[1]).toContain('Ring of Protection (1)')
    })

    it('calculates draconic sorcerer unarmored defense in 5e', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Charisma', bonus: 2 },
        ],
        class: { name: 'Sorcerer', subclass: { name: 'Draconic' } },
        inventory: { equipped: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(16)
    })

    it('calculates college of dance unarmored defense in 2024', () => {
      const stats = {
        rules: '2024',
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Charisma', bonus: 4 },
        ],
        class: { name: 'Bard', subclass: { name: 'College of Dance' } },
        inventory: { equipped: [] },
        automation: { passives: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(17)
      expect(result[1]).toContain('Charisma Bonus (4)')
    })

    it('calculates barbarian unarmored defense in 2024', () => {
      const stats = {
        rules: '2024',
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Constitution', bonus: 2 },
        ],
        class: { name: 'Barbarian' },
        inventory: { equipped: [] },
        automation: { passives: [] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(15)
      expect(result[1]).toContain('Constitution Bonus (2)')
    })

    it('does not apply college of dance when wearing armor in 2024', () => {
      const armor = { name: 'Leather Armor', armor_category: 'Armor', armor_class: { base: 11, dex_bonus: true } }
      const stats = {
        rules: '2024',
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Charisma', bonus: 4 },
        ],
        class: { name: 'Bard', subclass: { name: 'College of Dance' } },
        inventory: { equipped: ['Leather Armor'] },
        automation: { passives: [] },
      }
      const result = rules.getArmorClass([armor], stats, {})
      expect(result[0]).toBe(17)
    })
  })

  describe('getLanguages', () => {
    it('returns language count and sorted list', () => {
      const stats = {
        race: { languages: ['Common', 'Elvish'] },
        class: { languages: [] },
        languages: [],
      }
      const result = rules.getLanguages(stats, {})
      expect(result.length).toBe(2)
      expect(result[0]).toBe(4)
      expect(result[1]).toEqual(['Common', 'Elvish'])
    })

    it('includes class languages, player-chosen languages, and removes duplicates', () => {
      const stats1 = {
        race: { languages: ['Common'] },
        class: { languages: ['Dwarvish'] },
        languages: [],
      }
      expect(rules.getLanguages(stats1, {})[1]).toEqual(['Common', 'Dwarvish'])

      const stats2 = {
        race: { languages: ['Common'] },
        class: { languages: [] },
        languages: ['Giant'],
      }
      expect(rules.getLanguages(stats2, {})[1]).toEqual(['Common', 'Giant'])

      const stats3 = {
        race: { languages: ['Common'] },
        class: { languages: ['Common'] },
        languages: ['Common'],
      }
      expect(rules.getLanguages(stats3, {})[1]).toEqual(['Common'])
    })

    it('adds background languages', () => {
      const stats = {
        race: { languages: [] },
        class: { languages: [] },
        languages: [],
      }
      expect(rules.getLanguages(stats, {})[0]).toBe(2)
    })

    it('adds subrace languages', () => {
      const stats = {
        race: {
          languages: ['Common'],
          subrace: {
            languages: ['Elvish'],
            language_options: { choose: 1 },
          },
        },
        class: { languages: [] },
        languages: [],
      }
      const result = rules.getLanguages(stats, {})
      expect(result[1]).toEqual(['Common', 'Elvish'])
      expect(result[0]).toBe(4)
    })

    it('adds ranger language bonuses at higher levels', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { name: 'Ranger', languages: [], language_choices: { choose: 0 } },
        languages: [],
        level: 16,
      }
      expect(rules.getLanguages(stats, {})[0]).toBe(5)
    })

    it('adds subclass language choices for 5e and major class for 2024', () => {
      const stats5e = {
        race: { languages: ['Common'] },
        class: { name: 'Wizard', subclass: { language_choices: { choose: 1 } } },
        languages: [],
      }
      expect(rules.getLanguages(stats5e, {})[0]).toBe(4)

      const stats2024 = {
        race: { languages: ['Common'] },
        class: { name: 'Wizard', major: { language_choices: { choose: 1 } } },
        languages: [],
        rules: '2024',
      }
      expect(rules.getLanguages(stats2024, {})[0]).toBe(4)
    })
  })

  describe('getMagicItems', () => {
    it('returns null for 5e and empty array for 2024 when no magic items', () => {
      const stats = { rules: '5e' }
      expect(rules.getMagicItems([], { inventory: { magicItems: [] } }, stats)).toBeNull()

      const stats2024 = { rules: '2024' }
      expect(rules.getMagicItems([], { inventory: { magicItems: [] } }, stats2024)).toEqual([])
    })

    it('returns processed items for 5e and filters missing items for 2024', () => {
      const magicItems = [{ name: 'Ring of Protection', description: 'A protective ring' }]
      const stats5e = { rules: '5e' }
      const result5e = rules.getMagicItems(magicItems, { inventory: { magicItems: ['Ring of Protection'] } }, stats5e)
      expect(result5e.length).toBe(1)
      expect(result5e[0].name).toBe('Ring of Protection')

      const stats2024 = { rules: '2024' }
      const result2024 = rules.getMagicItems([], { inventory: { magicItems: ['Missing Item'] } }, stats2024)
      expect(result2024.length).toBe(0)

      const result5eMissing = rules.getMagicItems([], { inventory: { magicItems: ['Missing Item'] } }, stats5e)
      expect(result5eMissing.length).toBe(1)
    })

    it('adds quantity and rarity to magic item result', () => {
      const magicItems = [{ name: 'Potion of Healing', description: 'Restores HP' }]
      const stats = { rules: '5e' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: [{ name: 'Potion of Healing', quantity: 3, rarity: 'rare' }] } }, stats)
      expect(result[0].quantity).toBe(3)
      expect(result[0].rarity).toBe('rare')
    })

    it('handles ring of spell storing items', () => {
      const magicItems = [{ name: 'Ring of Spell Storing', description: 'Stores spells' }]
      const stats = { rules: '5e' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: [{ name: 'Ring of Spell Storing', spell: 'fireball' }] } }, stats)
      expect(result[0].details).toBe('Stores spells')
      expect(result[0].description).toBe('fireball')
    })
  })
})
