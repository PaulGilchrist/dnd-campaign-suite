// CLA-229 regression: getPlayerStats collects automation (collectAutomationFromFeatures)
// BEFORE rules.getAbilities computes ability bonuses, so `uses_expression`
// free-cast pools baked usesMax at the min-1 floor (1 despite WIS +3).
// The reresolveAutomationUsesMax pass after abilities re-resolves them —
// fixture here mirrors FeyRanger (lv15 Fey Wanderer, WIS 16/+3).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rules from './rules.js'

vi.mock('../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((short) => ({
      STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
      INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
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

// WIS 16 → bonus +3 (the CLA-229 fixture).
vi.mock('./core/abilityCalc2024.js', () => ({
  getAbilities: vi.fn(() => [
    { name: 'Strength', bonus: -1, totalScore: 8 },
    { name: 'Dexterity', bonus: -1, totalScore: 8 },
    { name: 'Constitution', bonus: -1, totalScore: 8 },
    { name: 'Intelligence', bonus: 0, totalScore: 11 },
    { name: 'Wisdom', bonus: 3, totalScore: 16 },
    { name: 'Charisma', bonus: -1, totalScore: 9 },
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
      expertise: [],
    })),
    getFeatures: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
    getRangerFeatures: vi.fn(() => ({ extraAttacks: 0 })),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn((_allClasses, playerSummary) => ({
      name: playerSummary.class?.name || 'Ranger',
      major: playerSummary.class?.major || null,
      languages: [],
      class_levels: [],
    })),
    getFeatures: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn((_allRaces, playerSummary) => ({ ...playerSummary.race, traits: [], languages: [] })),
    getTraits: vi.fn(() => ({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
  rules2024: {
    getRace: vi.fn((_allRaces, playerSummary) => ({ ...playerSummary.race, traits: [], languages: [] })),
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
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadManeuvers: vi.fn(async () => []),
}))

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
}))

// Simulate the COLLECT-time bake: buildAttackInfo ran while abilities had no
// .bonus, so the pool was frozen at max(1, 0) = 1.
vi.mock('../combat/automation/automationService.js', () => ({
  collectAutomationFromFeatures: vi.fn(() => ({
    passives: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    specialActions: [{
      type: 'free_spell',
      name: 'Misty Wanderer',
      description: 'Cast Misty Step without spell slot.',
      spell: 'Misty Step',
      uses: 1,
      uses_expression: 'WIS modifier_min_1',
      usesMax: 1,
      recharge: 'long_rest',
      casting_time: 'passive',
      hasAutomation: true,
    }],
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

describe('rules getPlayerStats — uses_expression pools re-resolve after abilities (CLA-229)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const feyRangerSummary = {
    name: 'FeyRanger',
    rules: '2024',
    level: 15,
    race: { name: 'Human', traits: [], languages: ['Common'] },
    class: { name: 'Ranger', subclass: { name: 'Fey Wanderer' }, major: { name: 'Fey Wanderer' } },
    background: 'Faction Agent',
    abilities: [],
    inventory: { magicItems: [], equipped: [] },
    speed: 30,
    actions: [],
    bonusActions: [],
    reactions: [],
    specialActions: [],
    characterAdvancement: [],
  }

  it('automation free_spell usesMax reflects the WIS modifier, not the collect-time floor of 1', async () => {
    const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: feyRangerSummary })

    expect(result.abilities.find(a => a.name === 'Wisdom').bonus).toBe(3)
    const pool = result.automation.specialActions.find(a => a.type === 'free_spell' && a.name === 'Misty Wanderer')
    expect(pool).toBeDefined()
    expect(pool.usesMax).toBe(3)
    expect(pool.uses).toBe(3)
  })

  it('leaves non-expression use entries untouched', async () => {
    const { collectAutomationFromFeatures } = await import('../combat/automation/automationService.js')
    collectAutomationFromFeatures.mockImplementationOnce(() => ({
      passives: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [{ type: 'free_spell', name: 'Fey Magic', spell: 'Misty Step', uses: 1, recharge: 'long_rest', hasAutomation: true }],
    }))

    const result = await rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: feyRangerSummary })

    const pool = result.automation.specialActions.find(a => a.name === 'Fey Magic')
    expect(pool.uses).toBe(1)
    expect(pool.usesMax).toBeUndefined()
  })
})
