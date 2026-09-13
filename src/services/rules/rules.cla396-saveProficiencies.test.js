// CLA-396 regression: playerStats.saveProficiencies must be computed for ALL
// characters, not only those with >=1 feat. Zero-feat characters were silently
// losing every feature-based save grant (e.g. Gloom Stalker Iron Mind WIS).
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
  getHitPoints: vi.fn(() => 45),
  getCarryingCapacity: vi.fn(() => 150),
}))

vi.mock('./core/abilityCalc2024.js', () => ({
  getAbilities: vi.fn(() => ([
    { name: 'Strength', bonus: -1, totalScore: 8 },
    { name: 'Dexterity', bonus: 0, totalScore: 10 },
    { name: 'Constitution', bonus: 0, totalScore: 10 },
    { name: 'Intelligence', bonus: 0, totalScore: 10 },
    { name: 'Wisdom', bonus: 2, totalScore: 15 },
    { name: 'Charisma', bonus: 0, totalScore: 10 },
  ])),
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

const ironMindFeature = {
  name: 'Iron Mind',
  description: 'You gain proficiency in Wisdom saving throws.',
  type: 'passive',
  level: 7,
  automation: { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'], casting_time: 'passive' },
}

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
      name: playerSummary.class?.name || 'Ranger',
      major: playerSummary.class?.major || null,
      saving_throw_proficiencies: ['Strength', 'Dexterity'],
      languages: [],
      class_levels: [],
    })),
    getFeatures: vi.fn(() => ({
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [{ ...ironMindFeature }],
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

const resilientFeature = {
  name: 'Resilient (CON)',
  description: 'You gain proficiency in Constitution saving throws.',
  type: 'passive',
  automation: { type: 'save_proficiency', saveType: 'Constitution', casting_time: 'passive' },
}

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({
    abilityScoreIncreases: [],
    proficiencies: [],
    features: [],
  })),
}))

vi.mock('../combat/automation/automationService.js', async () => {
  const actual = await vi.importActual('../combat/automation/automationService.js')
  return {
    ...actual,
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
  }
})

vi.mock('../automation/handlers/class-other/elfishLineageHandler.js', () => ({
  getElfisLineageSelection: vi.fn(() => null),
  handle: vi.fn(),
}))

describe('CLA-396 saveProficiencies not feat-gated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseSummary = {
    name: 'Zero Feat Gloom Stalker',
    rules: '2024',
    level: 7,
    race: { name: 'Human', traits: [], languages: ['Common'] },
    class: { name: 'Ranger', major: { name: 'Gloom Stalker' } },
    background: 'Soldier',
    abilities: [],
    inventory: { magicItems: [], equipped: [] },
    speed: 30,
    actions: [],
    bonusActions: [],
    reactions: [],
    specialActions: [],
  }

  it('computes saveProficiencies for a zero-feat character (Iron Mind WIS)', async () => {
    const summary = { ...baseSummary, feats: [] }

    const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

    expect(result.saveProficiencies).toContain('Wisdom')
  })

  it('keeps feat-based and subclass save grants together for a feat-holding character', async () => {
    const { computeAllFeatBuffs } = await import('../character/featBuffService.js')
    computeAllFeatBuffs.mockImplementation(() => ({
      abilityScoreIncreases: [],
      proficiencies: [],
      features: [{ ...resilientFeature, featName: 'Resilient' }],
    }))
    const summary = { ...baseSummary, feats: ['Resilient'] }

    const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary })

    expect(result.saveProficiencies).toContain('Wisdom')
    expect(result.saveProficiencies).toContain('Constitution')
  })
})
