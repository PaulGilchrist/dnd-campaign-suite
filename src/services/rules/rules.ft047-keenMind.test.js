// @improved-by-ai
// FT-047 regression locks:
// (a) feat ASI double-count — rules.js must reconcile stored featIncrease
//     idempotently (max of stored vs computed), never accumulate on top of
//     the ASI the Edit wizard already persisted.
// (c) bonus_action feat benefits without automation.casting_time (e.g.
//     Keen Mind "Quiet Study") must surface as Bonus Actions rows instead
//     of being silently dropped by the replace-only fallback.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rules from './rules.js'

const { featBuffs } = vi.hoisted(() => ({
  featBuffs: {
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  },
}))

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

const computeTotals = (playerStats) => playerStats.abilities.map((ability) => {
  const totalScore = Math.min(
    (ability.baseScore || 0) + (ability.featIncrease || 0) + (ability.backgroundIncrease || 0) + (ability.miscIncrease || 0),
    20
  )
  return { ...ability, totalScore, bonus: Math.floor((totalScore - 10) / 2), proficient: false, save: Math.floor((totalScore - 10) / 2), skills: [] }
})

vi.mock('./core/abilityCalc.js', () => ({
  getAbilities: vi.fn((playerStats) => computeTotals(playerStats)),
  getHitPoints: vi.fn(() => 45),
  getCarryingCapacity: vi.fn(() => 150),
}))

vi.mock('./core/abilityCalc2024.js', () => ({
  getAbilities: vi.fn((playerStats) => computeTotals(playerStats)),
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
      name: playerSummary.class?.name || 'Wizard',
      subclass: playerSummary.class?.subclass || null,
      languages: [],
      class_levels: [],
      expertise: playerSummary.class?.expertise || [],
    })),
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
    getClass: vi.fn((_allClasses, playerSummary) => ({
      name: playerSummary.class?.name || 'Wizard',
      major: playerSummary.class?.major || null,
      languages: [],
      class_levels: [],
    })),
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
  loadFeatData: vi.fn(async () => []),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadManeuvers: vi.fn(async () => []),
}))

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => featBuffs),
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

const keenMindSummary = (featIncrease) => ({
  name: 'DivinationWizard',
  rules: '2024',
  level: 20,
  race: { name: 'Human', traits: [], languages: ['Common'] },
  class: { name: 'Wizard', major: { name: 'Divination' }, subclass: { name: 'Divination' } },
  background: 'Sage',
  abilities: [
    { name: 'Strength', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Dexterity', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Constitution', baseScore: 10, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
    { name: 'Intelligence', baseScore: 16, featIncrease, backgroundIncrease: 1, miscIncrease: 0 },
    { name: 'Wisdom', baseScore: 10, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
    { name: 'Charisma', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
  ],
  inventory: { magicItems: [], equipped: [] },
  speed: 30,
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
})

describe('FT-047 Keen Mind — rules.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featBuffs.abilityScoreIncreases = []
    featBuffs.proficiencies = []
    featBuffs.resistances = []
    featBuffs.features = []
  })

  describe('(a) feat ASI idempotency', () => {
    it('does not double-apply a feat ASI the wizard already persisted (INT stays 18, not 19)', async () => {
      featBuffs.abilityScoreIncreases = [{ name: 'Intelligence', amount: 1, isChoice: false, featName: 'Keen Mind' }]
      const summary = keenMindSummary(1)

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      const int = result.abilities.find(a => a.name === 'Intelligence')

      expect(int.featIncrease).toBe(1)
      expect(int.totalScore).toBe(18)
      expect(int.bonus).toBe(4)
    })

    it('still applies a computed feat ASI once when the stored JSON has not persisted it', async () => {
      featBuffs.abilityScoreIncreases = [{ name: 'Intelligence', amount: 1, isChoice: false, featName: 'Keen Mind' }]
      const summary = keenMindSummary(0)

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      const int = result.abilities.find(a => a.name === 'Intelligence')

      expect(int.featIncrease).toBe(1)
      expect(int.totalScore).toBe(18)
    })

    it('repeated getPlayerStats calls on the same persisted JSON never grow featIncrease', async () => {
      featBuffs.abilityScoreIncreases = [{ name: 'Intelligence', amount: 1, isChoice: false, featName: 'Keen Mind' }]
      const summary = keenMindSummary(1)

      const first = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      const second = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(first.abilities.find(a => a.name === 'Intelligence').featIncrease).toBe(1)
      expect(second.abilities.find(a => a.name === 'Intelligence').featIncrease).toBe(1)
      expect(second.abilities.find(a => a.name === 'Intelligence').totalScore).toBe(18)
    })

    it('preserves stored featIncreases that no current feat computes (orphaned legacy data untouched)', async () => {
      featBuffs.abilityScoreIncreases = []
      const summary = keenMindSummary(0)
      summary.abilities[1].featIncrease = 2

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(result.abilities[1].featIncrease).toBe(2)
    })

    it('skips choice (any) increases so featAbilityChoices-persisted ASIs are not doubled', async () => {
      featBuffs.abilityScoreIncreases = [{ name: 'any', amount: 1, isChoice: true, featName: 'Medium Armor Master' }]
      const summary = keenMindSummary(0)
      summary.abilities[1].featIncrease = 1

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(result.abilities[1].featIncrease).toBe(1)
      expect(result.abilities[1].totalScore).toBe(9)
    })
  })

  describe('(c) Quiet Study bonus-action row', () => {
    const quietStudy = {
      name: 'Quiet Study',
      description: 'You can take the Study action as a Bonus Action.',
      type: 'bonus_action',
      isBonusAction: true,
      featName: 'Keen Mind',
    }

    it('surfaces a bonus_action feat feature without casting_time in bonusActions', async () => {
      featBuffs.features = [quietStudy]
      const summary = keenMindSummary(1)

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })
      const row = result.bonusActions.find(b => b.name === 'Quiet Study')

      expect(row).toBeDefined()
      expect(row.source).toBe('feat')
      expect(row.description).toContain('Study action')
    })

    it('does not duplicate the Quiet Study row across repeated loads', async () => {
      featBuffs.features = [quietStudy]
      const summary = keenMindSummary(1)
      summary.bonusActions = [{ name: 'Quiet Study', description: 'existing', type: 'bonus_action' }]

      const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

      expect(result.bonusActions.filter(b => b.name === 'Quiet Study').length).toBe(1)
    })
  })
})
