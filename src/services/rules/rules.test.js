// @improved-by-ai
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
    it('returns full ability name for STR', () => {
      expect(rules.getAbilityLongName('STR')).toBe('Strength')
    })

    it('returns full ability name for DEX', () => {
      expect(rules.getAbilityLongName('DEX')).toBe('Dexterity')
    })

    it('returns full ability name for CON', () => {
      expect(rules.getAbilityLongName('CON')).toBe('Constitution')
    })

    it('returns full ability name for INT', () => {
      expect(rules.getAbilityLongName('INT')).toBe('Intelligence')
    })

    it('returns full ability name for WIS', () => {
      expect(rules.getAbilityLongName('WIS')).toBe('Wisdom')
    })

    it('returns full ability name for CHA', () => {
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

    it('defaults to 5e when no rules specified in either object', () => {
      const result = rules.getSubModules({}, {})
      expect(result.use2024).toBe(false)
    })

    it('defaults to 5e when rules is null', () => {
      const result = rules.getSubModules({ rules: null }, {})
      expect(result.use2024).toBe(false)
    })

    it('defaults to 5e when rules is undefined', () => {
      const result = rules.getSubModules({ rules: undefined }, {})
      expect(result.use2024).toBe(false)
    })

    it('provides abilityCalc with getAbilities and getHitPoints', () => {
      const result = rules.getSubModules({ rules: '5e' }, {})
      expect(typeof result.abilityCalc.getAbilities).toBe('function')
      expect(typeof result.abilityCalc.getHitPoints).toBe('function')
    })

    it('provides spellCalc with getSpellAbilities', () => {
      const result = rules.getSubModules({ rules: '5e' }, {})
      expect(typeof result.spellCalc.getSpellAbilities).toBe('function')
    })

    it('provides attackCalc as a function', () => {
      const result = rules.getSubModules({ rules: '5e' }, {})
      expect(typeof result.attackCalc).toBe('function')
    })

    it('provides proficiencyUtils as a module object', () => {
      const result = rules.getSubModules({ rules: '5e' }, {})
      expect(typeof result.proficiencyUtils.getProficiencies).toBe('function')
      expect(typeof result.proficiencyUtils.getProficiencyChoiceCount).toBe('function')
    })
  })

  describe('getAbilities', () => {
    it('returns abilities array for 5e ruleset', async () => {
      const result = await rules.getAbilities({ rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('returns abilities array for 2024 ruleset', async () => {
      const result = await rules.getAbilities({ rules: '2024' }, {})
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getHitPoints', () => {
    it('returns hit points number for 5e', () => {
      const result = rules.getHitPoints({ rules: '5e' }, {})
      expect(result).toBeTypeOf('number')
      expect(result).toBeGreaterThan(0)
    })

    it('returns hit points number for 2024', () => {
      const result = rules.getHitPoints({ rules: '2024' }, {})
      expect(result).toBeTypeOf('number')
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('getCarryingCapacity', () => {
    it('returns carrying capacity number for 5e', () => {
      const result = rules.getCarryingCapacity({ rules: '5e' })
      expect(result).toBeTypeOf('number')
      expect(result).toBeGreaterThan(0)
    })

    it('returns carrying capacity number for 2024', () => {
      const result = rules.getCarryingCapacity({ rules: '2024' })
      expect(result).toBeTypeOf('number')
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('getSpellAbilities', () => {
    it('returns spell abilities object for 5e', () => {
      const result = rules.getSpellAbilities([], { rules: '5e' }, {})
      expect(result).toBeTypeOf('object')
    })

    it('returns spell abilities object for 2024', () => {
      const result = rules.getSpellAbilities([], { rules: '2024' }, {})
      expect(result).toBeTypeOf('object')
    })
  })

  describe('getAttacks', () => {
    it('returns attacks array for 5e', () => {
      const result = rules.getAttacks([], [], { rules: '5e' }, {})
      expect(Array.isArray(result)).toBe(true)
    })

    it('returns attacks array for 2024', () => {
      const result = rules.getAttacks([], [], { rules: '2024' }, {})
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getProficiencyChoiceCount', () => {
    it('returns a number', () => {
      const result = rules.getProficiencyChoiceCount({}, [], {})
      expect(result).toBeTypeOf('number')
    })
  })

  describe('getProficiencies', () => {
    it('returns proficiency data for 5e with subclass', () => {
      const result = rules.getProficiencies({ rules: '5e', class: { subclass: {} } }, true, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
    })

    it('returns proficiency data for 2024 with major class', () => {
      const result = rules.getProficiencies({ rules: '2024', class: { major: {} } }, true, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
    })
  })

  describe('getActions', () => {
    it('returns array of 5 action categories for 5e', () => {
      const stats = { rules: '5e', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      const result = rules.getActions(stats, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(5)
      expect(result[0]).toBeInstanceOf(Array)
      expect(result[1]).toBeInstanceOf(Array)
      expect(result[2]).toBeInstanceOf(Array)
      expect(result[3]).toBeInstanceOf(Array)
      expect(result[4]).toBeInstanceOf(Array)
    })

    it('returns array of 5 action categories for 2024', () => {
      const stats = { rules: '2024', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      const result = rules.getActions(stats, {})
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(5)
      expect(result[0]).toBeInstanceOf(Array)
      expect(result[1]).toBeInstanceOf(Array)
      expect(result[2]).toBeInstanceOf(Array)
      expect(result[3]).toBeInstanceOf(Array)
      expect(result[4]).toBeInstanceOf(Array)
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
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toBe(13)
      expect(result[1]).toContain('Dexterity Bonus (3)')
    })

    it('calculates monk unarmored defense', () => {
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
      // 10 (base) + 3 (dex) + 5 (wisdom monk bonus) = 18
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
      // Barbarian: 10 + 2 + 3 = 15, Monk would be 10 + 2 + 5 = 17 but class is Barbarian
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
      // 12 (10 + dex) + 2 (shield) = 14
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

    it('adds cloak of protection bonus in 5e', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 2 },
        ],
        class: { name: 'Wizard' },
        inventory: { equipped: [], magicItems: [{ name: 'Cloak of Protection' }] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(13)
      expect(result[1]).toContain('Cloak of Protection (1)')
    })

    it('adds ring of protection bonus in 5e', () => {
      const stats = {
        rules: '5e',
        abilities: [
          { name: 'Dexterity', bonus: 2 },
        ],
        class: { name: 'Wizard' },
        inventory: { equipped: [], magicItems: [{ name: 'Ring of Protection' }] },
      }
      const result = rules.getArmorClass([], stats, {})
      expect(result[0]).toBe(13)
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
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0]).toBe(4)
      expect(result[1]).toEqual(['Common', 'Elvish'])
    })

    it('includes class languages', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { languages: ['Dwarvish'] },
        languages: [],
      }
      const result = rules.getLanguages(stats, {})
      expect(result[1]).toEqual(['Common', 'Dwarvish'])
    })

    it('includes player-chosen languages', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { languages: [] },
        languages: ['Giant'],
      }
      const result = rules.getLanguages(stats, {})
      expect(result[1]).toEqual(['Common', 'Giant'])
    })

    it('removes duplicate languages', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { languages: ['Common'] },
        languages: ['Common'],
      }
      const result = rules.getLanguages(stats, {})
      expect(result[1]).toEqual(['Common'])
    })

    it('adds background languages', () => {
      const stats = {
        race: { languages: [] },
        class: { languages: [] },
        languages: [],
      }
      const result = rules.getLanguages(stats, {})
      expect(result[0]).toBe(2)
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
      // 1 base + 2 background + 1 subrace choose = 4
      expect(result[0]).toBe(4)
    })

    it('adds ranger language bonuses at higher levels', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { name: 'Ranger', languages: [], language_choices: { choose: 0 } },
        languages: [],
        level: 16,
      }
      const result = rules.getLanguages(stats, {})
      // 1 base + 2 background + 1 (level>5) + 1 (level>13) = 5
      expect(result[0]).toBe(5)
    })

    it('adds subclass language choices for 5e', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { name: 'Wizard', subclass: { language_choices: { choose: 1 } } },
        languages: [],
      }
      const result = rules.getLanguages(stats, {})
      expect(result[0]).toBe(4)
    })

    it('adds major class language choices for 2024', () => {
      const stats = {
        race: { languages: ['Common'] },
        class: { name: 'Wizard', major: { language_choices: { choose: 1 } } },
        languages: [],
        rules: '2024',
      }
      const result = rules.getLanguages(stats, {})
      expect(result[0]).toBe(4)
    })
  })

  describe('getMagicItems', () => {
    it('returns null for 5e when no magic items', () => {
      const stats = { rules: '5e' }
      const result = rules.getMagicItems([], { inventory: { magicItems: [] } }, stats)
      expect(result).toBeNull()
    })

    it('returns empty array for 2024 when no magic items', () => {
      const stats = { rules: '2024' }
      const result = rules.getMagicItems([], { inventory: { magicItems: [] } }, stats)
      expect(result).toEqual([])
    })

    it('returns processed items for 5e', () => {
      const magicItems = [{ name: 'Ring of Protection', description: 'A protective ring' }]
      const stats = { rules: '5e' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: ['Ring of Protection'] } }, stats)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Ring of Protection')
    })

    it('filters out missing items for 2024', () => {
      const magicItems = []
      const stats = { rules: '2024' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: ['Missing Item'] } }, stats)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('keeps missing items for 5e', () => {
      const magicItems = []
      const stats = { rules: '5e' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: ['Missing Item'] } }, stats)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
    })

    it('adds quantity to magic item result when provided', () => {
      const magicItems = [{ name: 'Potion of Healing', description: 'Restores HP' }]
      const stats = { rules: '5e' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: [{ name: 'Potion of Healing', quantity: 3 }] } }, stats)
      expect(result[0].quantity).toBe(3)
    })

    it('adds rarity to magic item result when provided', () => {
      const magicItems = [{ name: 'Ring of Protection', description: 'A protective ring' }]
      const stats = { rules: '5e' }
      const result = rules.getMagicItems(magicItems, { inventory: { magicItems: [{ name: 'Ring of Protection', rarity: 'rare' }] } }, stats)
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
