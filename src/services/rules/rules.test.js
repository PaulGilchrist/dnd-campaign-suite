// @maintained-by-ai
// rules.js FACADE-GLUE lane — owns ONLY the glue that lives inside rules.js and
// that the real-graph lanes cannot see: module-selection ternaries, wrapper arity,
// passthrough identity through the mock graph, the two delegates whose impl math has
// NO other owner (getLanguages 5e assembly, getMagicItems processing), and the
// export-surface census. The getPlayerStats trunk is owned end-to-end by
// rules.getPlayerStats.test.js (:431-569 order map) — NEVER traversed here.
//
// INCOMING-CITE DISPOSITION (old -> new, collected via grep 'rules.test.js:' src .opencode docs):
//   rules-core.test.js:12  precedence owner (old :154-177)      -> kept, new :202-242
//   rules-core.test.js:66  'mocks all collaborators' context      -> mocks retained (see audit below)
//   rules-core.test.js:79  'stubs getSpellMaxLevel out' (old :147-152 stub-echo,
//                          queue test-maintain-bugs.md:781 delete-cite #1251) -> test DELETED;
//                          truth table + real-graph identity pin owned rules-core.test.js:65-94;
//                          spell-utils is no longer mocked at all here (citer justification now stale)
//   getPlayerStats header :52-54 (no-op ternary owner, rules.js:378-421) -> kept, new :244-342
//   rules-armorClass-2024.test.js:8-10 (3 rows owned here VERBATIM by name) -> kept :344-391
//   rules-languages.test.js:7 (5e assembly math owned here, old :510-598)   -> kept+strengthened, new :393-432
//   rules.helpers.test.js:14 (Ring of Spell Storing branch, old :631)        -> kept+extended to the
//                          full byte family at rules-magicItems.js:32, new :454-457
//   featBuffService.ritualMaster.test.js:12 ('every rules suite stubs
//                          computeAllFeatBuffs, e.g. rules.test.js:107')       -> mock KEPT, new :176-178
//
// FOLDED (covered at cited owner with VERBATIM ranges — do not re-add):
//   getActions tuple/dedup/sort/merge (old :233-291)   -> core/rules-actions.test.js:110-146 + rules.helpers.test.js
//                          (old :176-201, remapped :222-239) + rules-2024-actions.test.js:1-10
//   5e AC rows (old :295-459): unarmored Dex -> core/rules-armorClass.test.js:35; neg Dex :52;
//                          monk :60; barbarian :72; barbarian-vs-monk + overwrites quirk :72/:239-265;
//                          shield + armor base + medium cap :96/:127-157 (old :372/:386 BROKEN fixtures
//                          armor_category-not-equipment_category retired with the fold, #1250);
//                          Defense style :178-201; Cloak+Ring stack :163; Draconic :84.
//   dance-armored 2024 false-pin (old :493-507, never actually armored, #1249 rec)
//                          -> core/rules-armorClass-2024.test.js:96 'College of Dance blocked while armored'
//   2024 major-channel languages -> core/rules-languages.test.js:19+ (channel dispatch lane)
//   getProficiencies tuple (old :221-231 vacuous length pins)
//                          -> rules-proficiencies.implementsOfMercy.test.js + getPlayerStats :492-493
//   getAbilityLongName map + identity (old :132-145, was a stub-echo of the utils mock)
//                          -> core/rules-core.test.js:69 (real-graph identity; utils now UNMOCKED here)
//   vacuous type-smokes (old :179-219 isArray/toBeTypeOf shells, queue #1251 delete-cite)
//                          -> replaced by exact-args dispatch pins below.
//
// MOCK-COMPLETENESS AUDIT (#1440 form, every mocked module in the live loaded graph):
//   abilityCalc/2024{getAbilities,getHitPoints,getCarryingCapacity ← rules-core.js:4-5} — 3/3;
//   spellCalc/2024{getSpellAbilities ← rules-core.js:6-7} — 1/1; attackCalc{parseMagicItemName ←
//   rules-armorClass.js:1, getAttacks ← rules-core.js:8} — 2/2; attackCalc2024{getAttacks} — 1/1;
//   classRules/2024{getClass,getFeatures,getRangerFeatures ← default, real surface 1 export object};
//   race-rules{rules5e,rules2024 each with getRace/getTraits/getImmunities/getResistances/getSenses ←
//   rules-core.js:14-15}; proficiencyUtils/2024{getProficiencies,getProficiencyChoiceCount};
//   useRuntimeState{getRuntimeValue ← rules-helpers/rules-armorClass/senseUtils/maneuvers/magicSpells,
//   setRuntimeObject+setRuntimeValue ← elfishLineageHandler.js:1 (GAP FIXED this pass)};
//   dataLoader{loadFeatData,loadSkills,loadWildMagicSurgeTable ← rules.js:31, getCachedBackgroundData ←
//   rules-proficiencies.js:3, loadManeuvers ← maneuvers.js:2, loadBackgroundData ←
//   rules-fightingStyles.js:3 — getCachedBackgroundData/loadManeuvers GAP FIXED this pass};
//   featBuffService{computeAllFeatBuffs ← rules.js:32}; automationService{9 names ← rules.js:21-29 +
//   rules-initiative.js:1 evaluateAutoExpression + rules-fightingStyles.js:4 buildAttackInfo — 9/9};
//   elfishLineageHandler{elfishLineageSpeedBonus ← speedUtils.js:1, getElfisLineageSelection ←
//   handler surface — elfishLineageSpeedBonus GAP FIXED this pass}. UNMOCKED pure glue (zero-mock
//   rule): utils.js, shared/spell-utils.js, rules-core.js, rules-helpers.js, rules-actions.js,
//   rules-proficiencies.js, rules-armorClass.js, rules-languages.js, rules-magicItems.js,
//   rules-fightingStyles.js, rules-hunterPrey.js, rules-initiative.js, rules-senses.js,
//   core/raceTraits.js, core/maneuvers.js, core/speedUtils.js, core/magicSpells.js,
//   core/featureCategorizationUtils.js, featureCategories.js, castingTimeUtils.js,
//   automationExpressions.js, lodash.
//   Fresh objects are constructed per mock call at every object-returning seam (#1444 form) so no
//   in-place mutation can leak a byte across tests.
//
// QUIRK SCANS (this lane, report-only):
//   • No-op ternaries rules.js:380-382/:388-390/:412-414: identical branches — the branch flip is a
//     behaviorally inert byte (selection happens in getSubModules). Pinned as same-target calls below;
//     the getSubModules bundle swap is what a real dispatch change would flip (#1444 owns trunk).
//   • Arity fork rules.js:404-406: 5e silently DROPS playerSummary from getSpellAbilities — pinned
//     exactly at rules-core.js:58-62 twin.
//   • DEFECT standing rules.js:394-399 carryingCapacity=HP (and the bundle omits getCarryingCapacity
//     entirely, rules-core.js:23) — wrapper-level collaborator pin below; raw-value twin
//     core/rules-core.test.js:96-115.
//   • :0-swallow census (this lane's inputs): none reachable — all facade inputs here are arrays/objects;
//     NaN-on-level-less-summary and computed||0 censuses live at getPlayerStats trunk (#1444).
//   • Console untouched by every test below (no guard branch is entered). NO-CLOCK: pure synchronous
//     asserts, zero timers/Date.now. FIXTURE-MASKING: no surviving fixture pre-bakes a key its unit
//     computes (quantity/rarity/details absent from inputs where output must add them).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cloneDeep } from 'lodash'
import rules from './rules.js'
import * as rulesModule from './rules.js'

vi.mock('./core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name, magicBonus: 0 })),
  getAttacks: vi.fn(() => [{ marker: 'attackCalc-5e' }]),
}))

vi.mock('./core/abilityCalc.js', () => ({
  getAbilities: vi.fn(() => [{ marker: 'abilities-5e' }]),
  getHitPoints: vi.fn(() => 45),
  getCarryingCapacity: vi.fn(() => 150),
}))

vi.mock('./core/abilityCalc2024.js', () => ({
  getAbilities: vi.fn(() => [{ marker: 'abilities-2024' }]),
  getHitPoints: vi.fn(() => 78),
  getCarryingCapacity: vi.fn(() => 999),
}))

vi.mock('./core/spellCalc.js', () => ({
  getSpellAbilities: vi.fn(() => ({ lane: 'spellCalc-5e' })),
}))

vi.mock('./core/spellCalc2024.js', () => ({
  getSpellAbilities: vi.fn(() => ({ lane: 'spellCalc-2024' })),
}))

vi.mock('./core/attackCalc2024.js', () => ({
  getAttacks: vi.fn(() => [{ marker: 'attackCalc-2024' }]),
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
    getRangerFeatures: vi.fn(() => ({ extraAttacks: 0 })),
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
  getProficiencyChoiceCount: vi.fn(() => 7),
}))

vi.mock('../character/proficiencyUtils2024.js', () => ({
  getProficiencies: vi.fn(() => [5, []]),
  getProficiencyChoiceCount: vi.fn(() => 8),
}))

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeObject: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(async () => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadManeuvers: vi.fn(async () => []),
  getCachedBackgroundData: vi.fn(() => null),
}))

vi.mock('../character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(() => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
}))

vi.mock('../combat/automation/automationService.js', () => ({
  collectAutomationFromFeatures: vi.fn(() => ({ passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] })),
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
  elfishLineageSpeedBonus: vi.fn(() => null),
  getElfisLineageSelection: vi.fn(() => null),
}))

describe('rules.js facade glue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSubModules ruleset precedence (owner cited by core/rules-core.test.js:12)', () => {
    it('exposes exactly seven keys and wires the 5e bundle by default', async () => {
      const m = rules.getSubModules({}, {})
      const abilityCalc5e = await import('./core/abilityCalc.js')
      const classRules5e = await import('../character/classRules.js')
      const { rules5e } = await import('../character/race-rules/index.js')

      expect(Object.keys(m).sort()).toEqual(['abilityCalc', 'attackCalc', 'classRules', 'proficiencyUtils', 'raceRules', 'spellCalc', 'use2024'])
      expect(m.use2024).toBe(false)
      expect(m.abilityCalc.getAbilities).toBe(abilityCalc5e.getAbilities)
      expect(m.abilityCalc.getHitPoints).toBe(abilityCalc5e.getHitPoints)
      // Defect shape (rules-core.js:23): the bundle omits getCarryingCapacity entirely,
      // which is what makes the facade getCarryingCapacity defect below survivable.
      expect(m.abilityCalc.getCarryingCapacity).toBeUndefined()
      expect(m.classRules).toBe(classRules5e.default)
      expect(m.raceRules).toBe(rules5e)
    })

    it('selects 2024 only on the exact byte "2024", playerStats.rules first, falsy falls through to playerSummary', async () => {
      const abilityCalc2024 = await import('./core/abilityCalc2024.js')
      const classRules2024 = await import('../character/classRules2024.js')
      const { rules2024 } = await import('../character/race-rules/index.js')

      // 2024 via playerSummary alone, and via playerStats alone.
      expect(rules.getSubModules({}, { rules: '2024' }).use2024).toBe(true)
      const viaStats = rules.getSubModules({ rules: '2024' }, { rules: '5e' })
      expect(viaStats.use2024).toBe(true)
      expect(viaStats.abilityCalc.getHitPoints).toBe(abilityCalc2024.getHitPoints)
      expect(viaStats.classRules).toBe(classRules2024.default)
      expect(viaStats.raceRules).toBe(rules2024)

      // Precedence: playerStats wins both directions; falsy stats fall through.
      expect(rules.getSubModules({ rules: '5e' }, { rules: '2024' }).use2024).toBe(false)
      expect(rules.getSubModules({ rules: '' }, { rules: '2024' }).use2024).toBe(true)
      expect(rules.getSubModules({ rules: null }, { rules: null }).use2024).toBe(false)
      expect(rules.getSubModules({ rules: undefined }, {}).use2024).toBe(false)
      // Case/byte gate (#1435-45 canon): ' 2024' and '2024 ' are NOT the 2024 byte.
      expect(rules.getSubModules({ rules: '2024 ' }, {}).use2024).toBe(false)
      expect(rules.getSubModules({ rules: '2024x' }, {}).use2024).toBe(false)
    })
  })

  describe('wrapper dispatch — rules.js:378-421 no-op ternaries (owner per rules.getPlayerStats.test.js header :52-54)', () => {
    it('getAbilities routes BOTH ternary branches through the selected abilityCalc with playerStats only', async () => {
      const { getAbilities: getAbilities5e } = await import('./core/abilityCalc.js')
      const { getAbilities: getAbilities2024 } = await import('./core/abilityCalc2024.js')
      const stats = { rules: '5e' }

      expect(await rules.getAbilities(stats, { rules: '5e' })).toEqual([{ marker: 'abilities-5e' }])
      expect(getAbilities5e).toHaveBeenCalledTimes(1)
      expect(getAbilities5e.mock.calls).toEqual([[stats]])
      expect(getAbilities2024).not.toHaveBeenCalled()

      const stats2024 = { rules: '2024' }
      expect(await rules.getAbilities(stats2024, { rules: '2024' })).toEqual([{ marker: 'abilities-2024' }])
      expect(getAbilities2024).toHaveBeenCalledTimes(1)
      expect(getAbilities2024.mock.calls).toEqual([[stats2024]])
      expect(getAbilities5e).toHaveBeenCalledTimes(1)
    })

    it('getHitPoints forwards playerStats only and returns the selected module value verbatim', async () => {
      const abilityCalc5e = await import('./core/abilityCalc.js')
      const abilityCalc2024 = await import('./core/abilityCalc2024.js')
      const stats = { rules: '5e' }

      expect(rules.getHitPoints(stats, { rules: '5e' })).toBe(45)
      expect(abilityCalc5e.getHitPoints).toHaveBeenCalledTimes(1)
      expect(abilityCalc5e.getHitPoints.mock.calls).toEqual([[stats]])
      expect(abilityCalc2024.getHitPoints).not.toHaveBeenCalled()

      const stats2024 = { rules: '2024' }
      expect(rules.getHitPoints(stats2024, {})).toBe(78)
      expect(abilityCalc2024.getHitPoints).toHaveBeenCalledTimes(1)
      expect(abilityCalc2024.getHitPoints.mock.calls).toEqual([[stats2024]])
    })

    it('DEFECT pin: getCarryingCapacity invokes abilityCalc.getHitPoints and NEVER getCarryingCapacity, both branches (rules.js:394-399, #1444 standing)', async () => {
      const abilityCalc5e = await import('./core/abilityCalc.js')
      const abilityCalc2024 = await import('./core/abilityCalc2024.js')

      // RAW would be a STR-based capacity; today the wrapper returns HP (twin value pin:
      // core/rules-core.test.js:96-115). Flip these collaborator pins together with it.
      expect(rules.getCarryingCapacity({ rules: '5e' })).toBe(45)
      expect(rules.getCarryingCapacity({ rules: '2024' })).toBe(78)
      expect(abilityCalc5e.getHitPoints).toHaveBeenCalledTimes(1)
      expect(abilityCalc5e.getHitPoints.mock.calls).toEqual([[{ rules: '5e' }]])
      expect(abilityCalc2024.getHitPoints).toHaveBeenCalledTimes(1)
      expect(abilityCalc2024.getHitPoints.mock.calls).toEqual([[{ rules: '2024' }]])
      expect(abilityCalc5e.getCarryingCapacity).not.toHaveBeenCalled()
      expect(abilityCalc2024.getCarryingCapacity).not.toHaveBeenCalled()
    })

    it('getSpellAbilities arity fork: 2024 forwards playerSummary, 5e drops it (rules.js:404-406)', async () => {
      const spellCalc5e = await import('./core/spellCalc.js')
      const spellCalc2024 = await import('./core/spellCalc2024.js')
      const spells = [{ name: 'Fireball' }]
      const stats = { rules: '5e' }
      const summary = { rules: '5e', name: 'ArityProbe' }

      expect(rules.getSpellAbilities(spells, stats, summary)).toEqual({ lane: 'spellCalc-5e' })
      expect(spellCalc5e.getSpellAbilities.mock.calls).toEqual([[spells, stats]])
      expect(spellCalc2024.getSpellAbilities).not.toHaveBeenCalled()

      const stats2024 = { rules: '2024' }
      const summary2024 = { rules: '2024', name: 'ArityProbe' }
      expect(rules.getSpellAbilities(spells, stats2024, summary2024)).toEqual({ lane: 'spellCalc-2024' })
      expect(spellCalc2024.getSpellAbilities.mock.calls).toEqual([[spells, stats2024, summary2024]])
    })

    it('getAttacks calls the selected attackCalc function directly with (equipment, spells, stats)', async () => {
      const attackCalc5e = await import('./core/attackCalc.js')
      const attackCalc2024 = await import('./core/attackCalc2024.js')
      const equipment = [{ name: 'Longsword' }]
      const spells = [{ name: 'Firebolt' }]
      const stats = { rules: '5e' }

      expect(rules.getAttacks(equipment, spells, stats, { rules: '5e' })).toEqual([{ marker: 'attackCalc-5e' }])
      expect(attackCalc5e.getAttacks).toHaveBeenCalledTimes(1)
      expect(attackCalc5e.getAttacks.mock.calls).toEqual([[equipment, spells, stats]])
      expect(attackCalc2024.getAttacks).not.toHaveBeenCalled()

      const stats2024 = { rules: '2024' }
      expect(rules.getAttacks(equipment, spells, stats2024, { rules: '2024' })).toEqual([{ marker: 'attackCalc-2024' }])
      expect(attackCalc2024.getAttacks.mock.calls).toEqual([[equipment, spells, stats2024]])
    })

    it('getProficiencyChoiceCount forwards (playerStats, skills) — never playerSummary — to the ruleset-selected proficiencyUtils', async () => {
      const pu5e = await import('../character/proficiencyUtils.js')
      const pu2024 = await import('../character/proficiencyUtils2024.js')
      const stats = { rules: '5e' }
      const skills = [{ name: 'Acrobatics' }]

      expect(rules.getProficiencyChoiceCount(stats, skills, { rules: '5e' })).toBe(7)
      expect(pu5e.getProficiencyChoiceCount.mock.calls).toEqual([[stats, skills]])
      expect(pu2024.getProficiencyChoiceCount).not.toHaveBeenCalled()

      const stats2024 = { rules: '2024' }
      expect(rules.getProficiencyChoiceCount(stats2024, skills, { rules: '2024' })).toBe(8)
      expect(pu2024.getProficiencyChoiceCount.mock.calls).toEqual([[stats2024, skills]])
    })
  })

  describe('rules.getArmorClass — 2024 dispatch rows (owned HERE, cited verbatim by core/rules-armorClass-2024.test.js:8-10)', () => {
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
      const [ac, formula] = rules.getArmorClass([], stats, {})
      expect(ac).toBe(17)
      expect(formula).toContain('Charisma Bonus (4)')
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
      const [ac, formula] = rules.getArmorClass([], stats, {})
      expect(ac).toBe(15)
      expect(formula).toContain('Constitution Bonus (2)')
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
      const [ac, formula] = rules.getArmorClass([], stats, {})
      expect(ac).toBe(12)
      expect(formula).not.toContain('Fighting Style Defense')
    })
  })

  describe('rules.getLanguages — 5e assembly math (owned HERE, cited by core/rules-languages.test.js:7)', () => {
    it('counts race + background(+2) + race.choices + subclass.choices, dedupes and sorts the list; allowed counts pre-dedupe race length', () => {
      // Base: 2 race + 2 background constant.
      expect(rules.getLanguages({ race: { languages: ['Common', 'Elvish'] }, class: { languages: [] }, languages: [] }, {}))
        .toEqual([4, ['Common', 'Elvish']])
      // Class + player-chosen channels merged, sorted Set.
      expect(rules.getLanguages({ race: { languages: ['Common'] }, class: { languages: ['Dwarvish'] }, languages: ['Giant'] }, {}))
        .toEqual([3, ['Common', 'Dwarvish', 'Giant']])
      // Full dedupe across all three channels; allowed does NOT shrink with dedupe (quirk byte).
      expect(rules.getLanguages({ race: { languages: ['Common'] }, class: { languages: ['Common'] }, languages: ['Common'] }, {}))
        .toEqual([3, ['Common']])
      // Race choice channel adds to allowed only; subrace appends list + choose.
      expect(rules.getLanguages({ race: { languages: ['Common'], language_choices: { choose: 2 } }, class: { languages: [] }, languages: [] }, {}))
        .toEqual([5, ['Common']])
      expect(rules.getLanguages({ race: { languages: ['Common'], subrace: { languages: ['Elvish'], language_options: { choose: 1 } } }, class: { languages: [] }, languages: [] }, {}))
        .toEqual([4, ['Common', 'Elvish']])
      // 5e subclass channel (2024 major channel owned by core/rules-languages.test.js:19+).
      expect(rules.getLanguages({ race: { languages: ['Common'] }, class: { name: 'Wizard', subclass: { language_choices: { choose: 1 } } }, languages: [] }, {}))
        .toEqual([4, ['Common']])
      // Background constant is a flat +2 even with zero known languages.
      expect(rules.getLanguages({ race: { languages: [] }, class: { languages: [] }, languages: [] }, {}))
        .toEqual([2, []])
    })

    it.each([
      { level: 1, allowed: 3 },
      { level: 5, allowed: 3 },
      { level: 6, allowed: 4 },
      { level: 13, allowed: 4 },
      { level: 14, allowed: 5 },
    ])('ranger bonus is strictly level > 5 and > 13 (lv $level -> allowed $allowed)', ({ level, allowed }) => {
      const stats = {
        race: { languages: ['Common'] },
        class: { name: 'Ranger', languages: [], language_choices: { choose: 0 } },
        languages: [],
        level,
      }
      expect(rules.getLanguages(stats, {})[0]).toBe(allowed)
    })
  })

  describe('rules.getMagicItems — sole processing lane (guards owned by rules.helpers.test.js:340-353 / rules-error-handling.test.js:8; trunk dispatch :453 owned by getPlayerStats)', () => {
    it('empty inventory or falsy catalog short-circuits: 5e null, 2024 []', () => {
      expect(rules.getMagicItems([], { inventory: { magicItems: [] } }, { rules: '5e' })).toBeNull()
      expect(rules.getMagicItems([], { inventory: { magicItems: [] } }, { rules: '2024' })).toEqual([])
      // Falsy catalog takes the same :13 shortcut — the lookup/filter branches are NOT reached.
      expect(rules.getMagicItems(undefined, { inventory: { magicItems: [{ name: 'Ring of Protection' }] } }, { rules: '5e' })).toBeNull()
      expect(rules.getMagicItems(undefined, { inventory: { magicItems: [{ name: 'Ring of Protection' }] } }, { rules: '2024' })).toEqual([])
    })

    it('catalog hit copies the catalog row and attaches inventory quantity/rarity; string rows gain neither key', () => {
      const ring = { name: 'Ring of Protection', description: 'def' }
      const summary = { inventory: { magicItems: [{ name: 'Ring of Protection', quantity: 3, rarity: 'rare' }] } }
      const before = cloneDeep(summary)
      expect(rules.getMagicItems([ring], summary, { rules: '5e' })).toEqual([{ ...ring, quantity: 3, rarity: 'rare' }])
      expect(summary).toEqual(before)

      // String inventory row: verbatim catalog copy, NO fabricated quantity/rarity keys.
      expect(rules.getMagicItems([ring], { inventory: { magicItems: ['Ring of Protection'] } }, { rules: '2024' })).toEqual([{ ...ring }])
    })

    it.each(['Ring of Spell Storing', 'Spell Ring', 'Spell Scroll'])('%s: details keeps catalog text, description becomes the stored spell byte (rules-magicItems.js:32-33)', (name) => {
      const catalog = [{ name, description: 'catalog text' }]
      const result = rules.getMagicItems(catalog, { inventory: { magicItems: [{ name, spell: 'fireball' }] } }, { rules: '5e' })
      expect(result).toEqual([{ name, description: 'fireball', details: 'catalog text' }])
    })

    it('missing catalog item: 2024 filters the null (real :48 filter), 5e keeps the inventory row spread verbatim', () => {
      const ring = { name: 'Ring of Protection', description: 'def' }
      const ghost = { name: 'Ghost Item' }
      const summary = { inventory: { magicItems: [{ name: 'Ring of Protection' }, ghost] } }

      expect(rules.getMagicItems([ring], summary, { rules: '2024' })).toEqual([ring])
      expect(rules.getMagicItems([ring], summary, { rules: '5e' })).toEqual([ring, ghost])
    })
  })

  describe('export surface', () => {
    it('named exports are a DEAD re-export table (zero app consumers — rec drop) and default carries exactly the 15-key facade', () => {
      // Live consumers of rules.js are default-import only (rulesFactory.getPlayerStats,
      // CharSpellSlots.getSpellMaxLevel). Every named re-export below has zero importers
      // app-wide — census pinned so an accidental ADD/REMOVE forces a re-audit.
      expect(Object.keys(rulesModule).sort()).toEqual([
        'default', 'getActions', 'getArmorClass', 'getLanguages', 'getMagicItems',
        'getProficiencies', 'getRulesType', 'getSubModules', 'is2024', 'mergeAutomationSpecialActions',
      ])

      expect(Object.keys(rules).sort()).toEqual([
        'getAbilities', 'getAbilityLongName', 'getActions', 'getArmorClass', 'getAttacks',
        'getCarryingCapacity', 'getHitPoints', 'getLanguages', 'getMagicItems', 'getPlayerStats',
        'getProficiencies', 'getProficiencyChoiceCount', 'getSpellAbilities', 'getSpellMaxLevel',
        'getSubModules',
      ])
      Object.values(rules).forEach((fn) => expect(typeof fn).toBe('function'))
    })
  })
})
