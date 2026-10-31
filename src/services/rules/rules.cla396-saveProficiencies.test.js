// @maintained-by-ai
// CLA-396 regression (rules-root lane): playerStats.saveProficiencies MUST be
// written unconditionally at rules.js:518 from allFeatures. Pre-fix (commit
// a045ae523^), the writer sat inside the `if (featFeatures.length > 0)` block,
// so zero-feat characters silently lost every feature-based save grant
// (e.g. Gloom Stalker Iron Mind WIS). Manifest row CLA-396: expectedBehavior =
// "saveProficiencies computed unconditionally from allFeatures ... feats:[]."
//
// OWNERSHIP BOUNDARIES (cite, never re-run):
//   • getAllSaveProficiencies transform bytes (null→all-six quirk, auto_reroll
//     all-saves, primary→fallback chain, normalization, Set dedup/order) are
//     owned by automationService.modifiers.test.js (#973 lane, file:17-18).
//     NOTE: that header's claim that THIS file mocks getAllSaveProficiencies is
//     STALE — this lane deliberately runs the REAL getAllSaveProficiencies via
//     the automationService partial-mock spread below; only the six collector
//     siblings are stubbed. If it were stubbed here, CLA-396 would be untestable.
//   • proficiencyUtils merge internals: proficiencyUtils lanes (utility owners).
//   • skill-grant wiring at rules-root: rules-proficiencies.implementsOfMercy.test.js
//     (#1440 lane; its mock-factory-completeness lesson applied here: the
//     dataLoader factory now supplies getCachedBackgroundData, consumed by
//     rules-proficiencies.js:77/:98 inside try/catch — previously a missing
//     export masked as a silent catch path).
//   • PB save-bonus tiers: abilityCalc2024 lanes (this fixture's ability mocks
//     are pass-through rows, not save math).
//
// FIXTURE-MASKING SELF-CHECK: class mock grants only STR/DEX saving throws;
// the saves under test (Wisdom via Iron Mind, Constitution via Resilient) are
// NEVER pre-granted — the strict pins below cannot be satisfied by a fixture
// that shadows the grant. saveProficiencies is deliberately ABSENT from the
// input summary (cloneDeep copy) so the pin proves the writer, not the input.
//
// QUIRK SCAN (reported, not fixed — source is read-only in this lane):
//   • rules-initiative.js:8-9 unguarded deref: `abilities.find(DEX).bonus`
//     throws TypeError if getAbilities returns []. The 5e abilityCalc mock
//     therefore returns FULL six-ability rows here (the old [] stub made any
//     5e-root lane un-runnable). Golden unguarded-deref, console untouched.
//   • getAllSaveProficiencies returns ONLY feature-derived grants: mocked class
//     saving_throw_proficiencies ['Strength','Dexterity'] never bleed into the
//     output — pinned by exact arrays in every test.
//   • normalization ('STR'→'Strength') + fallback chain: modifiers lane owns;
//     ironMind's fallbackTypes stay unused here because primary WIS is free —
//     exact ['Wisdom'] proves no fallback spill.
// NO-CLOCK: pure static aggregation, zero timers, zero network, deterministic.
import { describe, it, expect, vi } from 'vitest'
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

// 5e lane must traverse computeInitiative (rules-initiative.js:8-9 unguarded
// DEX deref) — provide the full six-ability roster, values distinguishable.
vi.mock('./core/abilityCalc.js', () => ({
  getAbilities: vi.fn(() => [
    { name: 'Strength', bonus: 2, totalScore: 14 },
    { name: 'Dexterity', bonus: 1, totalScore: 12 },
    { name: 'Constitution', bonus: 2, totalScore: 14 },
    { name: 'Intelligence', bonus: 0, totalScore: 10 },
    { name: 'Wisdom', bonus: 0, totalScore: 10 },
    { name: 'Charisma', bonus: 0, totalScore: 10 },
  ]),
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
      // Class saves under the mock are STR/DEX ONLY — Wisdom/Constitution
      // (the grants under test) are never pre-selected (anti-masking).
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

// Complete export set for every real module in this lane's chain that imports
// dataLoader: rules.js (loadFeatData/loadSkills/loadWildMagicSurgeTable),
// rules-fightingStyles.js (loadBackgroundData/loadFeatData), maneuvers.js
// (loadManeuvers), rules-proficiencies.js (getCachedBackgroundData — was
// MISSING here; its try/catch consumers rules-proficiencies.js:77/:98 turned
// the absent export into a silent skip. #1440 mock-completeness form).
vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(async () => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
  getCachedBackgroundData: vi.fn(() => null),
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

// Partial mock: collectSaveModifiers/evasion/immunity collectors stubbed,
// getAllSaveProficiencies left REAL via the spread — CLA-396 lives in it.
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
  elfishLineageSpeedBonus: vi.fn(() => 0),
  handle: vi.fn(),
}))

// Fresh top-level object per call so getPlayerStats (cloneDeep of summary) has
// no cross-test mutation surface (#1441 collector-fixture lesson).
const makeSummary = (overrides = {}) => ({
  name: 'CLA-396 character',
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
  feats: [],
  ...overrides,
})

const getStats = (summary) => rules.getPlayerStats({
  allClasses: [],
  allEquipment: [],
  allMagicItems: [],
  allRaces: [],
  allSpells: [],
  playerSummary: summary,
})

describe('CLA-396 saveProficiencies not feat-gated', () => {
  it('zero-feat 2024 character keeps the Iron Mind WIS grant — exact bytes', async () => {
    const result = await getStats(makeSummary({ feats: [] }))

    // The pre-fix discriminator: writer skipped when featFeatures.length === 0,
    // so saveProficiencies was undefined for this character. ['Wisdom'] exact +
    // fallbackTypes not spilled + class STR/DEX not bled.
    expect(result.saveProficiencies).toStrictEqual(['Wisdom'])
  })

  it('feat-holding character merges feat + subclass grants after applyFeatBuffs — exact order', async () => {
    const mod = await import('../character/featBuffService.js')
    mod.computeAllFeatBuffs.mockImplementationOnce(() => ({
      abilityScoreIncreases: [],
      proficiencies: [],
      features: [{ ...resilientFeature, featName: 'Resilient' }],
    }))

    const result = await getStats(makeSummary({ feats: ['Resilient'] }))

    // Order seam (#1441 form): subclass specialActions enter allFeatures at
    // getActions; feat features push later via addFeatFeatures; the single
    // writer runs AFTER applyFeatBuffs (rules.js:512→518). Set insertion order
    // pins all three — hoisting the writer above applyFeatBuffs yields
    // ['Wisdom'] and fails here, while zero-feat rows pin the removed gate.
    expect(result.saveProficiencies).toStrictEqual(['Wisdom', 'Constitution'])
  })

  it('zero-grant 5e character yields an empty array on the unconditional writer', async () => {
    const result = await getStats(makeSummary({
      rules: '5e',
      class: { name: 'Fighter', subclass: { name: 'Champion' } },
      feats: [],
    }))

    // Control row: writer executes with no save_proficiency features in play —
    // key present as [] (not undefined, not the null→all-six default).
    expect(result.saveProficiencies).toStrictEqual([])
  })
})
