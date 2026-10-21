// @maintained-by-ai
// FT-047 Keen Mind (2024 General Feat, public/data/2024/feats.json:1653, index
// "keen-mind"; disk bytes: 'Keen Mind' space-separated, no apostrophe) — rules-root
// regression locks for fix commit 4fbef7732 in rules.js:
//   (a) ASI reconcile at rules.js:51-65: applyAbilityScoreFeatIncreases sets each
//       ability's featIncrease to MAX(stored, sum-of-computed). Pre-fix it did
//       `featIncrease = (featIncrease||0) + amount` per buff row, double-applying
//       the ASI the Edit wizard already persisted (INT 18 stored -> sheet 19).
//   (c) Quiet Study at rules.js:184-189: a bonus_action feat benefit with NO
//       automation.casting_time (disk benefit type 'bonus_action', featBuffService
//       push2024BonusAction tags isBonusAction:true) was silently dropped by the
//       replace-only specialActions fallback; the fix appends it to bonusActions.
//
// OWNERSHIP BOUNDARIES (cite, never re-test here):
//   • featBuffService parsing of feats.json into buff rows: featBuffService lanes.
//     This lane mocks computeAllFeatBuffs — the seam under test is rules.js
//     CONSUMPTION/reconciliation, so buff rows are injected producer-shaped.
//   • abilityCalc totalScore arithmetic (base+feat+bg+misc, cap 20): abilityCalc /
//     abilityCalc2024 lanes. The pass-through computeTotals mock exists so rules.js
//     ordering is observable: totalScore pins that the reconcile runs BEFORE
//     getAbilities (a compute-then-adjust regression passes the featIncrease pins
//     but flips totalScore 18->19).
//   • getAllSaveProficiencies grant path: distinct from FT-047 (Keen Mind grants
//     skill proficiency/expertise + ASI, never a save); stubbed [] here — unlike
//     the CLA-396 lane (rules.cla396-saveProficiencies.test.js) which runs the
//     REAL collector, FT-047 has no save bytes to verify.
//   • Lore Knowledge skill-grant wiring: rules-proficiencies / #1440 lanes;
//     proficiencyUtils is stubbed [5, []] (thunks never invoked, see QUIRK 2).
//
// FIXTURE-MASKING SELF-CHECK (never pre-grant the thing under test):
//   (a) ability fixtures carry the stored featIncrease as DATA ONLY under test —
//       the buff rows come from a separate mock, so PASS requires rules.js to
//       reconcile them, not the fixture. PASS/FAIL per test declared inline.
//   (c) 'Quiet Study' is in NO featureCategories list (featureCategories.js runs
//       REAL; grep proves zero hits) — the exact-byte row can only be produced by
//       the FT-047 isBonusAction fallback branch. The input summary's bonusActions
//       is [] in test 5, so the row's presence proves the append, not the input.
//
// QUIRK SCANS (report-form evidence):
//   QUIRK 1 (golden unguarded-deref, never-executed-guard family): rules-initiative.js:8
//     `playerStats.initiative = dexAbility.bonus` derefs a bare find() with no guard;
//     this graph traverses it (rules.js getPlayerStats -> computeInitiative). Test 7
//     locks the crash boundary: TypeError, console untouched.
//   QUIRK 2 (dead guard, unobservable): rules.js:184 `!nameIn(playerStats.bonusActions,
//     name)` in the FT-047 branch is masked by resortActionArrays uniqBy('name')
//     (rules.js:46) — removing the nameIn clause yields byte-identical output, so no
//     output assertion can kill that mutant; test 6 therefore locks only the
//     NON-CLOBBER contract (stored survivor bytes), not dedupe mechanics.
//   QUIRK 3 (mocked-export dead code): this file's proficiencyUtils mock returns
//     [5, []] without invoking the backgroundToolProficiencies thunks
//     (rules-proficiencies.js:127-128), so the try/catch around the
//     getCachedBackgroundData deref (rules-proficiencies.js:76/:97) never executes
//     here; the dataLoader factory supplies the export anyway (#1440 hardening) so a
//     future thunk-invoke cannot surface as a silent-catch accident.
//   Case-gate: reconcile lowercases BOTH sides (map key :56 + lookup :63) — no split
//     gate; disk scores byte is 'Intelligence' (:1686-1688). :0-swallow census on the
//     fix bytes: `featIncrease || 0` (stored 0 yields to computed — correct, test 2)
//     and `typeof inc.amount === 'number' ? inc.amount : 1` (default-1; every producer
//     row emits a numeric amount, so no 0-swallow reachable — declared, untested).
//   NO-CLOCK: zero timers/Date.now in this file; getPlayerStats resolves synchronously
//     through the mock graph.
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

// Pass-through totals so the featIncrease value rules.js reconciles BEFORE
// getAbilities is observable in totalScore/bonus. Only fields the downstream
// real graph consumes are emitted (name via callers, bonus for initiative/AC).
const computeTotals = (playerStats) => playerStats.abilities.map((ability) => {
  const totalScore = Math.min(
    (ability.baseScore || 0) + (ability.featIncrease || 0) + (ability.backgroundIncrease || 0) + (ability.miscIncrease || 0),
    20
  )
  return { ...ability, totalScore, bonus: Math.floor((totalScore - 10) / 2) }
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

// Complete consumed-export set: rules.js (loadFeatData/loadSkills/
// loadWildMagicSurgeTable), rules-fightingStyles.js (loadBackgroundData/
// loadFeatData), rules-proficiencies.js (getCachedBackgroundData — QUIRK 3),
// core/maneuvers.js (loadManeuvers).
vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(async () => []),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
  getCachedBackgroundData: vi.fn(() => null),
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadManeuvers: vi.fn(async () => []),
}))

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => featBuffs),
}))

// Consumed-export set: rules.js seven collectors + rules-fightingStyles.js
// buildAttackInfo + rules-initiative.js evaluateAutoExpression.
vi.mock('../combat/automation/automationService.js', () => ({
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
  elfishLineageSpeedBonus: vi.fn(() => 0),
  handle: vi.fn(),
}))

// Ticket character: test-campaign DivinationWizard lv20 2024 (INT base 16 +
// background 1; Keen Mind ASI +1). featIncrease is the wizard-persisted value.
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

// Producer-shaped rows (featBuffService parse for feats.json Keen Mind).
const keenMindAsi = (featName) => ({ name: 'Intelligence', amount: 1, isChoice: false, featName })

const getPlayerStats = (summary) => rules.getPlayerStats({
  allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary: summary,
})

const ability = (result, name) => result.abilities.find(a => a.name === name)

describe('FT-047 Keen Mind — rules.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featBuffs.abilityScoreIncreases = []
    featBuffs.proficiencies = []
    featBuffs.resistances = []
    featBuffs.features = []
  })

  describe('(a) feat ASI reconcile: featIncrease = max(stored, computed)', () => {
    // Pre-fix accumulate (stored 1 + computed 1) produced 2/19 — FAILS pre-fix.
    it('reconciles stored + computed ASI without accumulating (INT stays 18, not 19)', async () => {
      featBuffs.abilityScoreIncreases = [keenMindAsi('Keen Mind')]
      const summary = keenMindSummary(1)

      const result = await getPlayerStats(summary)
      const int = ability(result, 'Intelligence')

      expect(int.featIncrease).toBe(1)
      expect(int.totalScore).toBe(18)
      expect(int.bonus).toBe(4)
      // input purity: getPlayerStats cloneDeeps — the stored JSON is untouched
      expect(summary.abilities[3].featIncrease).toBe(1)
    })

    // Passes pre-fix BY DESIGN (control); kills ignore-computed/"trust stored only"
    // mutations: pre-persistence JSON (featIncrease 0) must still receive +1 once.
    it('applies a computed ASI exactly once when stored JSON predates persistence', async () => {
      featBuffs.abilityScoreIncreases = [keenMindAsi('Keen Mind')]
      const summary = keenMindSummary(0)

      const int = ability(await getPlayerStats(summary), 'Intelligence')

      expect(int.featIncrease).toBe(1)
      expect(int.totalScore).toBe(18)
    })

    // Kills overwrite-with-computed mutation (computed 0 would zero stored 2).
    it('preserves an orphan stored featIncrease no current feat computes', async () => {
      featBuffs.abilityScoreIncreases = []
      const summary = keenMindSummary(0)
      summary.abilities[1].featIncrease = 2

      const result = await getPlayerStats(summary)

      expect(result.abilities.map(a => a.featIncrease)).toStrictEqual([0, 2, 0, 0, 0, 0])
    })

    // Kills last-wins/first-wins accumulator mutations: two computed +1 rows on the
    // same ability sum to 2, then max against stored 1 -> 2 (INT 19).
    it('sums multiple computed ASIs on one ability before reconciling with stored', async () => {
      featBuffs.abilityScoreIncreases = [keenMindAsi('Keen Mind'), keenMindAsi('Observant')]
      const summary = keenMindSummary(1)

      const int = ability(await getPlayerStats(summary), 'Intelligence')

      expect(int.featIncrease).toBe(2)
      expect(int.totalScore).toBe(19)
      expect(int.bonus).toBe(4)
    })
  })

  describe('(c) Quiet Study bonus_action benefit (no automation.casting_time)', () => {
    const quietStudy = {
      name: 'Quiet Study',
      description: 'You can take the Study action as a Bonus Action.',
      type: 'bonus_action',
      automation: undefined,
      isBonusAction: true,
      featName: 'Keen Mind',
    }

    // Pre-fix: row silently dropped — FAILS pre-fix (bonusActions []). Also proves
    // it lands in bonusActions, NOT the old replace-only specialActions lane.
    it('appends the exact informational Bonus Actions row, nothing in specialActions', async () => {
      featBuffs.features = [quietStudy]

      const result = await getPlayerStats(keenMindSummary(1))

      expect(result.bonusActions).toStrictEqual([{
        name: 'Quiet Study',
        description: 'You can take the Study action as a Bonus Action.',
        type: 'bonus_action',
        source: 'feat',
        automation: undefined,
        featName: 'Keen Mind',
      }])
      expect(result.specialActions).toStrictEqual([])
    })

    // Non-clobber contract: a wizard-persisted Quiet Study row survives with its
    // OWN bytes (the FT-047 append is guarded by nameIn and must not replace the
    // stored row with the feat-derived description).
    it('does not clobber a stored Quiet Study row when the feat re-derives it', async () => {
      featBuffs.features = [quietStudy]
      const storedRow = { name: 'Quiet Study', description: 'You can take the Study action as a Bonus Action.', type: 'bonus_action' }
      const summary = keenMindSummary(1)
      summary.bonusActions = [storedRow]

      const result = await getPlayerStats(summary)

      expect(result.bonusActions).toStrictEqual([storedRow])
    })
  })

  describe('quirk locks', () => {
    // QUIRK 1 golden: rules-initiative.js:8 unguarded dexAbility.bonus deref —
    // crash boundary stays console-untouched (no silent fallback was added).
    it('rejects with untouched-console TypeError when abilities lack Dexterity', async () => {
      const errorSpy = vi.spyOn(console, 'error')
      const warnSpy = vi.spyOn(console, 'warn')
      const summary = keenMindSummary(1)
      summary.abilities = summary.abilities.filter(a => a.name !== 'Dexterity')

      await expect(getPlayerStats(summary)).rejects.toThrow(TypeError)
      expect(errorSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()

      errorSpy.mockRestore()
      warnSpy.mockRestore()
    })
  })
})
