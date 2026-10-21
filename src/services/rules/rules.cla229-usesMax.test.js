// @maintained-by-ai
// CLA-229 (fix d4d6b8cfe) orchestrator lane: rules.getPlayerStats collects
// automation (collectAutomationFromFeatures / buildAttackInfo) BEFORE
// rules.getAbilities assigns ability `.bonus` (rules.js:549), so
// uses_expression pools baked usesMax at the min-1 floor (1 despite WIS +3).
// The reresolveAutomationUsesMax pass at rules.js:551 re-resolves them from
// the FINAL abilities. THIS file owns only the ordering/integration proof —
// the unit behavior of reresolveAutomationUsesMax itself is owned by
// automationExpressions.test.js 'reresolveAutomationUsesMax (CLA-229)' and
// the misty_wanderer dispatch/UI legs by their lanes (no cross-file re-pin).
// Fixture rows mirror REAL disk shapes, mutually distinguishable per lane:
//   public/data/2024/classes.json  uses_expression "WIS modifier_min_1" (x6, Misty Wanderer family)
//   public/data/classes.json       uses_expression "CHA modifier"      (x4, Bardic Inspiration, UNFLOORED)
//   public/data/feats.json         uses_expression "1d6"                 (Martial Adept superiority pool)
// Cited by spellCastHandler.resourceCost.test.js:26 — keep the usesMax=3 pin.
import { describe, it, expect, vi } from 'vitest'
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

// Collect-time baked row (usesMax 1 despite the +3 WIS resolved at :549):
// exactly the shape buildAttackInfo froze pre-CLA-229 (bug-cla-229-misty-wanderer.md).
function collectBakedAutomation() {
  return {
    passives: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    specialActions: [
      {
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
      },
      {
        type: 'bardic_inspiration',
        name: 'Bardic Inspiration',
        description: 'Inspire one creature.',
        range: '60_ft',
        action: 'bonus_action',
        uses: 1,
        uses_expression: 'CHA modifier',
        usesMax: 1,
        recharge: 'long_rest',
        casting_time: '1 bonus action',
        hasAutomation: true,
      },
      {
        type: 'resource_pool',
        name: 'Martial Adept',
        description: 'Superiority dice pool.',
        resource: 'superiority_dice',
        uses: 2,
        usesMax: 2,
        uses_expression: '1d6',
        recharge_short_rest: '1d6',
        recharge_long_rest: '1d6',
        casting_time: '1 action',
        hasAutomation: true,
      },
      {
        type: 'free_spell',
        name: 'Fey Magic',
        description: 'Cast Misty Step once.',
        spell: 'Misty Step',
        uses: 1,
        recharge: 'long_rest',
        hasAutomation: true,
      },
    ],
  }
}

// automationService mock exports MUST cover every loaded importer:
// rules.js:21-28 (7 names), rules-initiative.js:1 (evaluateAutoExpression),
// rules-fightingStyles.js:4 (buildAttackInfo). Fresh rows per call so
// reresolve's in-place mutation cannot leak across tests (a shared object
// would make a removed reresolve still pass on the second run).
vi.mock('../combat/automation/automationService.js', () => ({
  collectAutomationFromFeatures: vi.fn(() => collectBakedAutomation()),
  collectSaveModifiers: vi.fn(() => []),
  collectTurnStartEffects: vi.fn(() => []),
  getConditionImmunities: vi.fn(() => []),
  getConditionalImmunities: vi.fn(() => []),
  getEvasionEffects: vi.fn(() => []),
  getAllSaveProficiencies: vi.fn(() => []),
  evaluateAutoExpression: vi.fn(() => 0),
  buildAttackInfo: vi.fn(() => null),
}))

vi.mock('./core/abilityCalc.js', () => ({
  getAbilities: vi.fn(() => [
    { name: 'Strength', bonus: 0, totalScore: 10 },
    { name: 'Dexterity', bonus: 1, totalScore: 12 },
    { name: 'Constitution', bonus: 1, totalScore: 12 },
    { name: 'Intelligence', bonus: 0, totalScore: 10 },
    { name: 'Wisdom', bonus: 2, totalScore: 14 },
    { name: 'Charisma', bonus: 4, totalScore: 18 },
  ]),
  getHitPoints: vi.fn(() => 45),
  getCarryingCapacity: vi.fn(() => 150),
}))

// WIS +3 / CHA -1 fixture (mirrors the live lv15 Fey Wanderer FeyRanger).
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

// getCachedBackgroundData is called (rules-proficiencies.js:77/:99) inside a
// try/catch — omitting it here would silently no-op via that catch (#1440
// lesson: every mock factory must export what the loaded graph imports).
vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(async () => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
  getCachedBackgroundData: vi.fn(() => null),
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadManeuvers: vi.fn(async () => []),
}))

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
}))

vi.mock('../automation/handlers/class-other/elfishLineageHandler.js', () => ({
  getElfisLineageSelection: vi.fn(() => null),
  elfishLineageSpeedBonus: vi.fn(() => 0),
  handle: vi.fn(),
}))

const feyRanger2024 = {
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

const bard5e = {
  ...feyRanger2024,
  name: 'TestBard',
  rules: '5e',
  level: 8,
  class: { name: 'Bard', subclass: { name: 'College of Valor' } },
  major: undefined,
  background: 'Entertainer',
}

const args = (playerSummary) => ({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary })

describe('rules.getPlayerStats — uses_expression pools re-resolve after final abilities (CLA-229)', () => {
  it('2024: full automation.specialActions set byte-exact after re-resolve (cannot-regress vs collect-time bake)', async () => {
    const result = await rules.getPlayerStats(args(feyRanger2024))

    // Ordering proof: tokens resolve from the :549 output only. Pre-fix
    // (no reresolve, or reresolve before :549, or abilities still []) the
    // WIS row keeps usesMax 1 — the exact pre-fix byte — and this fails.
    expect(result.abilities.find(a => a.name === 'Wisdom').bonus).toBe(3)
    expect(result.automation.specialActions).toStrictEqual([
      {
        type: 'free_spell',
        name: 'Misty Wanderer',
        description: 'Cast Misty Step without spell slot.',
        spell: 'Misty Step',
        uses: 3,
        uses_expression: 'WIS modifier_min_1',
        usesMax: 3,
        recharge: 'long_rest',
        casting_time: 'passive',
        hasAutomation: true,
      },
      {
        // UNFLOORED disk expression with CHA -1: today's guard accepts any
        // finite number, so the ceiling resolves NEGATIVE (quirk pinned as
        // drift-detector; prose min-1 clamp lives nowhere in this lane).
        type: 'bardic_inspiration',
        name: 'Bardic Inspiration',
        description: 'Inspire one creature.',
        range: '60_ft',
        action: 'bonus_action',
        uses: -1,
        uses_expression: 'CHA modifier',
        usesMax: -1,
        recharge: 'long_rest',
        casting_time: '1 bonus action',
        hasAutomation: true,
      },
      {
        // Dice-string expression: evaluateAutoExpression returns the string
        // '1d6', the number-guard skips it, the collect-time sentinel bytes
        // survive untouched (string/NaN family of #1411/#1410).
        type: 'resource_pool',
        name: 'Martial Adept',
        description: 'Superiority dice pool.',
        resource: 'superiority_dice',
        uses: 2,
        usesMax: 2,
        uses_expression: '1d6',
        recharge_short_rest: '1d6',
        recharge_long_rest: '1d6',
        casting_time: '1 action',
        hasAutomation: true,
      },
      {
        // No uses_expression: re-resolve never fabricates a usesMax key.
        type: 'free_spell',
        name: 'Fey Magic',
        description: 'Cast Misty Step once.',
        spell: 'Misty Step',
        uses: 1,
        recharge: 'long_rest',
        hasAutomation: true,
      },
    ])
  })

  it('5e dispatch: same post-abilities position re-resolves the unfloored CHA pool to the live modifier', async () => {
    const result = await rules.getPlayerStats(args(bard5e))

    // reresolveAutomationUsesMax sits outside the is2024 dispatch — the
    // 5e lane resolves through the 5e abilityCalc fixture (WIS +2 / CHA +4),
    // distinguishable from the 2024 lane's +3 / -1 bytes above.
    expect(result.abilities.find(a => a.name === 'Wisdom').bonus).toBe(2)
    expect(result.automation.specialActions.map(a => [a.name, a.usesMax, a.uses])).toStrictEqual([
      ['Misty Wanderer', 2, 2],
      ['Bardic Inspiration', 4, 4],
      ['Martial Adept', 2, 2],
      ['Fey Magic', undefined, 1],
    ])
  })
})
