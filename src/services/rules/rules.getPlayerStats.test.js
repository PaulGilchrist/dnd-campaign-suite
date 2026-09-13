// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
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
    getClass: vi.fn((_allClasses, playerSummary) => ({
      name: playerSummary.class?.name || 'Fighter',
      subclass: playerSummary.class?.subclass || null,
      languages: [],
      class_levels: [],
      expertise: playerSummary.class?.expertise || [],
    })),
    getFeatures: vi.fn(() => ({
      actions: [{ name: 'Action Surge' }],
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
    getClass: vi.fn((_allClasses, playerSummary) => ({
      name: playerSummary.class?.name || 'Fighter',
      major: playerSummary.class?.major || null,
      languages: [],
      class_levels: [],
    })),
    getFeatures: vi.fn(() => ({
      actions: [{ name: 'Action Surge' }],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
    })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn((_allRaces, playerSummary) => ({
      ...playerSummary.race,
      traits: playerSummary.race?.traits || [],
      languages: playerSummary.race?.languages || [],
    })),
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
    getRace: vi.fn((_allRaces, playerSummary) => ({
      ...playerSummary.race,
      traits: playerSummary.race?.traits || [],
      languages: playerSummary.race?.languages || [],
    })),
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
  collectAutomationFromFeatures: vi.fn(() => ({
    passives: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    specialActions: [],
  })),
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

describe('rules getPlayerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseSummary5e = {
    race: { name: 'Human', languages: ['Common'] },
    class: { name: 'Fighter', subclass: { name: 'Champion' } },
    background: 'Soldier',
    abilities: [],
    inventory: { magicItems: [], equipped: [] },
    speed: 30,
  }

  const baseSummary2024 = {
    race: { name: 'Human', traits: [], languages: ['Common'] },
    class: { name: 'Fighter', major: {} },
    background: 'Soldier',
    abilities: [],
    inventory: { magicItems: [], equipped: [] },
    speed: 30,
  }

  describe('5e ruleset', () => {
    it('returns a fully populated playerStats object', async () => {
      const summary = {
        name: 'Test Fighter',
        rules: '5e',
        level: 5,
        ...baseSummary5e,
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(result.name).toBe('Test Fighter')
      expect(result.rules).toBe('5e')
      expect(result.proficiency).toBe(3)
      expect(result.abilities).toBeDefined()
      expect(result.hitPoints).toBeTypeOf('number')
      expect(result.carryingCapacity).toBeTypeOf('number')
      expect(result.speed).toBeTypeOf('number')
      expect(result.initiative).toBeTypeOf('number')
      expect(result.armorClass).toBeTypeOf('number')
      expect(result.languagesAllowed).toBeTypeOf('number')
      expect(result.languages).toBeDefined()
      expect(result.proficienciesAllowed).toBeTypeOf('number')
      expect(result.proficiencies).toBeDefined()
      expect(result.skillProficienciesAllowed).toBeTypeOf('number')
      expect(result.skillProficiencies).toBeDefined()
      expect(result.automation).toBeDefined()
      expect(result.saveModifiers).toBeDefined()
      expect(result.allFeatures).toBeDefined()
    })

    it('sets race from allRaces data', async () => {
      const summary = {
        name: 'Test',
        rules: '5e',
        level: 1,
        ...baseSummary5e,
        race: { name: 'Elf', languages: ['Common', 'Elvish'] },
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      expect(result.race).toBeDefined()
    })

    it('sets class from allClasses data', async () => {
      const summary = {
        name: 'Test',
        rules: '5e',
        level: 1,
        ...baseSummary5e,
        race: { name: 'Human', languages: ['Common'] },
        class: { name: 'Wizard', subclass: {} },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      expect(result.class.name).toBe('Wizard')
    })

    it('sets immunities and resistances for 5e', async () => {
      const summary = {
        name: 'Test',
        rules: '5e',
        level: 1,
        ...baseSummary5e,
        race: { name: 'Human', languages: ['Common'] },
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      expect(result.immunities).toBeDefined()
      expect(result.resistances).toBeDefined()
      expect(result.senses).toBeDefined()
    })

    it('handles empty actions arrays from summary', async () => {
      const summary = {
        name: 'Test',
        rules: '5e',
        level: 1,
        ...baseSummary5e,
        race: { name: 'Human', languages: ['Common'] },
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
        inventory: { magicItems: [], equipped: [] },
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      expect(Array.isArray(result.actions)).toBe(true)
      expect(Array.isArray(result.bonusActions)).toBe(true)
      expect(Array.isArray(result.reactions)).toBe(true)
      expect(Array.isArray(result.specialActions)).toBe(true)
      expect(Array.isArray(result.characterAdvancement)).toBe(true)
    })

    it('merges feature actions into result', async () => {
      const summary = {
        name: 'Test',
        rules: '5e',
        level: 5,
        ...baseSummary5e,
        race: { name: 'Human', languages: ['Common'] },
        class: { name: 'Fighter', subclass: { name: 'Champion' } },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      const actionNames = result.actions.map((a) => a.name)
      expect(actionNames).toContain('Action Surge')
    })

    it('sets expertise from class expertise and expertSkills', async () => {
      const summary = {
        name: 'Test',
        rules: '5e',
        level: 5,
        ...baseSummary5e,
        race: { name: 'Human', languages: ['Common'] },
        class: { name: 'Rogue', subclass: { name: 'Thief' }, expertise: ['Stealth'] },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        expertSkills: ['Perception'],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      expect(result.expertise).toContain('Stealth')
      expect(result.expertise).toContain('Perception')
    })
  })

  describe('2024 ruleset', () => {
    it('returns a fully populated playerStats object for 2024', async () => {
      const summary = {
        name: 'Test Fighter 2024',
        rules: '2024',
        level: 5,
        ...baseSummary2024,
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(result.name).toBe('Test Fighter 2024')
      expect(result.rules).toBe('2024')
      expect(result.proficiency).toBe(3)
      expect(result.abilities).toBeDefined()
      expect(result.hitPoints).toBeTypeOf('number')
      expect(result.speed).toBeTypeOf('number')
      expect(result.initiative).toBeTypeOf('number')
      expect(result.armorClass).toBeTypeOf('number')
      expect(result.senses).toBeDefined()
    })

    it('sets senses for 2024', async () => {
      const summary = {
        name: 'Test',
        rules: '2024',
        level: 1,
        ...baseSummary2024,
        race: { name: 'Human', traits: [], languages: ['Common'] },
        class: { name: 'Fighter', major: {} },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      expect(result.senses).toBeDefined()
      expect(result.senses).toEqual([])
    })

    it('handles string actions in 2024', async () => {
      const summary = {
        name: 'Test',
        rules: '2024',
        level: 1,
        ...baseSummary2024,
        race: { name: 'Human', traits: [], languages: ['Common'] },
        class: { name: 'Fighter', major: {} },
        actions: ['Attack', 'Dash'],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        magicActions: [{ name: 'Cast Spell' }],
        utilizeActions: [{ name: 'Utilize' }],
        craftActions: [{ name: 'Craft' }],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      const actionNames = result.actions.map((a) => a.name)
      expect(actionNames).toContain('Attack')
      expect(actionNames).toContain('Cast Spell')
      expect(actionNames).toContain('Utilize')
      expect(actionNames).toContain('Craft')
    })

    // CLA-209 regression: the Powerful Build grapple-escape fix-up modifier must survive
    // the final saveModifiers re-collection near the end of getPlayerStats.
    it('retains Powerful Build grapple-escape save modifier after final saveModifiers collection (CLA-209)', async () => {
      const summary = {
        name: 'Goliath Test',
        rules: '2024',
        level: 5,
        ...baseSummary2024,
        race: {
          name: 'Goliath',
          traits: [{
            name: 'Powerful Build',
            automation: { type: 'conditional_advantage', target: 'ability_check', condition: 'grappled', effect: 'advantage', casting_time: 'passive' },
          }],
          languages: ['Common'],
        },
        class: { name: 'Fighter', major: {} },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(result.hasPowerfulBuild).toBe(true)
      expect(result.sizeMultiplier).toBe(2)
      const pbModifier = (result.saveModifiers || []).find(m => m.condition === 'powerful_build_grapple_escape')
      expect(pbModifier).toEqual({
        source: 'Powerful Build',
        target: 'ability_check',
        condition: 'powerful_build_grapple_escape',
        effect: 'advantage',
        abilities: ['STR'],
      })
    })

    it('does not add Powerful Build save modifier for non-Powerful-Build races', async () => {
      const summary = {
        name: 'Human Test',
        rules: '2024',
        level: 5,
        ...baseSummary2024,
        race: { name: 'Human', traits: [], languages: ['Common'] },
        class: { name: 'Fighter', major: {} },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(result.hasPowerfulBuild).toBeUndefined()
      expect((result.saveModifiers || []).some(m => m.condition === 'powerful_build_grapple_escape')).toBe(false)
    })

    it('handles string specialActions in 2024', async () => {
      const summary = {
        name: 'Test',
        rules: '2024',
        level: 1,
        ...baseSummary2024,
        race: { name: 'Human', traits: [], languages: ['Common'] },
        class: { name: 'Fighter', major: {} },
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: ['Feature A'],
        magicSpecialActions: [{ name: 'Magic Feature' }],
        utilizeSpecialActions: [{ name: 'Utilize Feature' }],
        craftSpecialActions: [{ name: 'Craft Feature' }],
      }

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      const specialNames = result.specialActions.map((a) => a.name)
      expect(specialNames).toContain('Feature A')
      expect(specialNames).toContain('Magic Feature')
      expect(specialNames).toContain('Utilize Feature')
      expect(specialNames).toContain('Craft Feature')
    })
  })
})
