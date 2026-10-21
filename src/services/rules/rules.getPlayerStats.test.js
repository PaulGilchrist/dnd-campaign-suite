// @maintained-by-ai
// rules.getPlayerStats TRUNK-ORCHESTRATION lane: owns the call-ORDER and
// integration seams of rules.js getPlayerStats (:431-569) as observable bytes —
// NOT the segments. Segment ownership (cite, never re-run):
//   • #1441 CLA-229 collect-before-abilities + reresolveAutomationUsesMax
//     (:551) ordering: rules.cla229-usesMax.test.js (usesMax=3 pin cited by
//     spellCastHandler.resourceCost.test.js:26 — untouched there).
//   • #1442 CLA-396 saveProficiencies unconditional writer (:518) + seam-order:
//     rules.cla396-saveProficiencies.test.js.
//   • #1443 FT-047 ASI reconcile (:51-65) + Quiet Study append (:184-189):
//     rules.ft047-keenMind.test.js.
//   • #1440 CLA-181 getProficiencies2024 bonusSource=class.major wiring:
//     rules-proficiencies.implementsOfMercy.test.js (mock-factory-completeness
//     canon applied HERE: dataLoader factory supplies getCachedBackgroundData —
//     previously MISSING, its try/catch consumers rules-proficiencies.js:77/:98
//     would turn a future thunk-invoke into a silent skip).
//   • #1254-#1259 getPlayerStats sub-cluster: proficiency tiers + HP/CC
//     passthrough (basics #1255), feat buffs (#1256), fighting styles (#1257),
//     computeInitiative internals (#1258), senses→senseUtils chain + speed
//     passthrough (#1259), cloneDeep isolation + canMoveThroughCreatureSpace
//     (#1254, rules-playerStats-advanced.test.js:164). 2024 string-action
//     normalization + magic/utilize/craft concat: core/rules-actions.test.js:110-146
//     + rules.helpers.test.js:176-201. Facade delegates: rules.test.js.
//     The old CLA-209 lane in THIS file is retained+strengthened per
//     rules-playerStats-advanced.test.js:158 ownership note.
//
// ORCHESTRATION ORDER MAP (observable; each step's output byte is pinned in the
// goldens so a deleted/reordered trunk step flips a byte):
//   :432 cloneDeep → :435 runtime Fey/Shadow seeds → :438 rules type → :440
//   proficiency floor((lv-1)/4+2) → :444 cr.getClass → :446-448 fightingStyles
//   top-level→class map → :449 wildMagicSurgeTable → :450 rr.getRace → :451/:452
//   raceTraits → :453 getMagicItems (5e null / 2024 [] dispatch) → :456-459
//   2024-only senses seed + equipment passthrough → :461 initActionArrays
//   (+class.expertise merge) → :463 getActions tuple → :466 fighting styles +
//   sort → :468-474 allFeatures concat order → :477-481 2024-only feat/background
//   feature lanes → :484-490 automation collectors → :491-493 languages/
//   proficiencies/skills tuples → :497-502 placeholder filter → :512 applyFeatBuffs
//   → :518 saveProficiencies → :520-522 free-cast writers (MI→FT→ST order pinned
//   by automation.specialActions push order) → :525/:529 resort (maneuvers seam) →
//   :530 saveModifiers RE-collection → :533-541 CLA-209 push after it → :543
//   allFeatures assign → :545 abilities → :551 reresolve → :552 hitPoints →
//   :553 carryingCapacity → :554-555 speed fold → :556 initiative → :557 AC tuple
//   → :558-559 spellAbilities/attacks → :562 hunterPrey → :566 computeSenses
//   (5e-only immunities/resistances + final senses write for BOTH rulesets).
//
// QUIRK SCANS (report-only, source untouched):
//   • 🔴 rules.js:394-399 carryingCapacity=HP in BOTH branches (ledger standing;
//     defect pin owned rules-core.test.js:95-114): goldens carry the byte
//     (carryingCapacity===hitPoints: 5e 45/45, 2024 78/78) while the mocked
//     getCarryingCapacity stubs (150/999) are NEVER called by the trunk —
//     getSubModules (:23) does not even forward getCarryingCapacity.
//   • 🔴 rules.js:379-391 no-op ternaries in getAbilities/getHitPoints facades
//     (identical branches; owned rules.test.js facade lane — cited here because
//     goldens traverse the wrappers at :545/:552/:553).
//   • Golden unguarded-deref: rules-initiative.js:8-9 dexAbility.bonus throws on
//     degenerate rosters; the graph traverses :556 with the full six-ability mock
//     rows (console untouched). Reorder mutant (:556 before :545) is killed twice
//     over: abilities census byte + TypeError rejection.
//   • Never-executed guards (rules.js:456-459 twin of #1443's :184-behind-uniqBy
//     form): :457 senses=[] seed is always overwritten by :566 rr.getSenses — no
//     output assertion can distinguish its removal (undeletable-by-test; the :566
//     marker row kills :566 deletion only). FT free-cast dedupe guards
//     (freeSpellAlreadyAdded :275/:307/:346) never fire with the empty-automation
//     fixtures here; dedupe owners: cla229/#1257 lanes.
//   • :0-swallow census (trunk-declared, untested): proficiency uses summary.level
//     (level-less summary → NaN); applyAbilityScoreFeatIncreases computed||0.
//   • Case gates traced: loadFeatData receives exactly '5e'/'2024' (:254) and
//     loadBackgroundData exactly '2024' (:268) — pinned via toHaveBeenCalledWith
//     exact args in both goldens; reconcile lowercases both sides (#1443 owns).
//   • Mock-completeness audit (#1440 form, live graph importers): utils{getAbilityLongName
//     ← rules.js/rules-core}; attackCalc{parseMagicItemName ← rules-armorClass,
//     getAttacks ← rules-core}; attackCalc2024{getAttacks}; abilityCalc(2024){getAbilities,
//     getHitPoints ← rules-core}; spellCalc(2024){getSpellAbilities}; classRules{getClass
//     ← rules.js:444, getFeatures ← rules-actions, getRangerFeatures←rules-fightingStyles
//     lane consumers}; raceRules{getRace,getTraits,getImmunities,getResistances,getSenses ←
//     rules.js/rules-actions/rules-senses}; proficiencyUtils(2024){getProficiencies,
//     getProficiencyChoiceCount ← rules-proficiencies via getSubModules}; useRuntimeState
//     {getRuntimeValue ← rules-helpers/rules-armorClass/senseUtils/maneuvers/magicSpells};
//     spell-utils{getSpellMaxLevel ← rules.js/rules-core}; dataLoader{loadFeatData,
//     loadSkills,loadWildMagicSurgeTable ← rules.js; loadBackgroundData/loadFeatData ←
//     rules-fightingStyles; loadManeuvers ← maneuvers; getCachedBackgroundData ←
//     rules-proficiencies ADDED this pass}; featBuffService{computeAllFeatBuffs};
//     automationService{7 names ← rules.js + evaluateAutoExpression ← rules-initiative +
//     buildAttackInfo ← rules-fightingStyles}; elfishLineageHandler{elfishLineageSpeedBonus
//     ← speedUtils}. Audit PASS (1 gap found + fixed: getCachedBackgroundData).
//   • Collector/fixture freshness (cla229 lesson): every vi.fn returning objects
//     constructs FRESH rows per call so no cross-test in-place mutation (the
//     CLA-209 push, free-cast pushes) leaks a stale byte.
// FIXTURE-MASKING SELF-CHECK: goldens contain NO pre-baked key the trunk computes
// — saveProficiencies/hasPowerfulBuild/equipment/feyTouchedSpell absent from inputs;
// ruleset-distinguishing mock values (DEX 3 vs 4, HP 45 vs 78, module markers) mean
// a dispatch swap flips bytes. PASS declared per golden.
// NO-CLOCK: pure synchronous compute through the mock graph; zero timers/Date.now.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rules from './rules.js'

const { runtimeStore } = vi.hoisted(() => ({ runtimeStore: new Map() }))

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
  // Marker row distinguishes the 5e attackCalc module in the golden census.
  getAttacks: vi.fn(() => [{ name: 'Longsword' }]),
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
  // Dead stub: getSubModules never forwards getCarryingCapacity (🔴 rules.js:394-399).
  getCarryingCapacity: vi.fn(() => 150),
}))

vi.mock('./core/abilityCalc2024.js', () => ({
  // Mutually-distinguishable from the 5e twin (DEX +4, HP 78): any ruleset
  // dispatch swap at :442/:545/:552/:557 flips golden bytes.
  getAbilities: vi.fn(() => [
    { name: 'Strength', bonus: 1, totalScore: 12 },
    { name: 'Dexterity', bonus: 4, totalScore: 18 },
    { name: 'Constitution', bonus: 3, totalScore: 16 },
    { name: 'Intelligence', bonus: 0, totalScore: 10 },
    { name: 'Wisdom', bonus: 2, totalScore: 14 },
    { name: 'Charisma', bonus: 0, totalScore: 10 },
  ]),
  getHitPoints: vi.fn(() => 78),
  getCarryingCapacity: vi.fn(() => 999),
}))

vi.mock('./core/spellCalc.js', () => ({
  getSpellAbilities: vi.fn(() => ({})),
}))

vi.mock('./core/spellCalc2024.js', () => ({
  getSpellAbilities: vi.fn(() => ({ spellcastingAbility: 'WIS' })),
}))

vi.mock('./core/attackCalc2024.js', () => ({
  getAttacks: vi.fn(() => [{ name: 'Quarterstaff' }]),
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
      name: playerSummary.class?.name || 'Monk',
      major: playerSummary.class?.major || null,
      languages: [],
      class_levels: [],
    })),
    getFeatures: vi.fn(() => ({
      actions: [{ name: 'Extra Attack' }],
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
    // Distinguishable markers: immunities/resistances ownership transferred to
    // THIS file by rules-playerStats-senses-speed.test.js:6; a getImmunities/
    // getResistances swap at rules-senses.js:21-22 flips golden bytes.
    getImmunities: vi.fn(() => ['Lightning']),
    getResistances: vi.fn(() => ['Cold']),
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
    getImmunities: vi.fn(() => ['Fire']),
    getResistances: vi.fn(() => ['Poison']),
    // Marker proves the FINAL :566 write overrides the :457 [] seed AND pins
    // the rules2024 module (vs rules5e) in the dispatch census.
    getSenses: vi.fn(() => [{ name: 'Darkvision', value: '120 ft.' }]),
  },
}))

vi.mock('../character/proficiencyUtils.js', () => ({
  // Arg-sensitive markers: skill vs non-skill lane swap at rules.js:492/:493
  // flips golden bytes; internals owned by proficiencyUtils lanes (#1440).
  getProficiencies: vi.fn((_playerStats, skill) => (skill ? [2, ['Athletics']] : [4, ['Bagpipes']])),
  getProficiencyChoiceCount: vi.fn(() => 0),
}))

vi.mock('../character/proficiencyUtils2024.js', () => ({
  getProficiencies: vi.fn((_playerStats, skill) => (skill ? [3, ['Medicine']] : [5, ['Herbalism Kit']])),
  getProficiencyChoiceCount: vi.fn(() => 0),
}))

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((_name, key) => runtimeStore.get(key)),
}))

vi.mock('../shared/spell-utils.js', () => ({
  getSpellMaxLevel: vi.fn(() => 9),
}))

// COMPLETE export set for every live-graph importer (see header audit);
// getCachedBackgroundData ADDED this pass (#1440 mock-completeness form —
// consumed at rules-proficiencies.js:77/:98 inside try/catch).
vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(async () => ({ abilityScoreIncreases: [], proficiencies: [], features: [] })),
  loadSkills: vi.fn(async () => []),
  loadBackgroundData: vi.fn(() => null),
  getCachedBackgroundData: vi.fn(() => null),
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

// Fresh automation object per call (cla229 lesson): the CLA-209 push and the
// free-cast writers mutate automation.specialActions in-place; a shared literal
// would leak rows across tests and fake-kill reorder mutants.
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

// Fresh top-level summary per call (#1441/43 fresh-object discipline).
const makeSummary = (overrides = {}) => ({
  name: 'Trunk Fighter',
  rules: '5e',
  level: 5,
  race: { name: 'Human', languages: ['Common'] },
  class: { name: 'Fighter', subclass: { name: 'Champion' } },
  background: 'Soldier',
  abilities: [],
  inventory: { magicItems: [], equipped: [] },
  speed: 30,
  feats: [],
  ...overrides,
})

const getStats = (playerSummary) => rules.getPlayerStats({
  allClasses: [],
  allEquipment: [],
  allMagicItems: [],
  allRaces: [],
  allSpells: [],
  playerSummary,
})

describe('rules.getPlayerStats trunk orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtimeStore.clear()
  })

  // T1 — golden census, 5e direction. Exact full output: every trunk writer
  // (:432-:566) contributes a pinned byte; deleting/reordering any step flips
  // at least one key. Owns immunities/resistances at rules-root (transferred
  // by rules-playerStats-senses-speed.test.js:6, formerly :290 toBeDefined).
  // fightingStyles: ['Defense'] exercises the top-level→class.fightingStyles
  // map at :446-448 (sole owner — every other lane injects class.fightingStyles
  // directly via the classRules mock; Defense itself adds NO AC without armor,
  // rules-armorClass.js:21 — so AC stays 10+DEX).
  it('5e golden: every trunk step contributes exact bytes in fixed order', async () => {
    const result = await getStats(makeSummary({ fightingStyles: ['Defense'] }))

    expect(result).toStrictEqual({
      name: 'Trunk Fighter',
      rules: '5e',
      level: 5,
      background: 'Soldier',
      feats: [],
      fightingStyles: ['Defense'],
      proficiency: 3,
      class: {
        name: 'Fighter',
        subclass: { name: 'Champion' },
        languages: [],
        class_levels: [],
        expertise: [],
        fightingStyles: ['Defense'],
      },
      wildMagicSurgeTable: [],
      race: { name: 'Human', languages: ['Common'], traits: [] },
      inventory: { magicItems: null, equipped: [] },
      actions: [{ name: 'Action Surge' }],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      expertise: [],
      automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
      saveModifiers: [],
      evasionEffects: [],
      automationConditionImmunities: [],
      automationConditionalImmunities: [],
      turnStartEffects: [],
      languagesAllowed: 3,
      languages: ['Common'],
      proficienciesAllowed: 4,
      proficiencies: ['Bagpipes'],
      skillProficienciesAllowed: 2,
      skillProficiencies: ['Athletics'],
      saveProficiencies: [],
      allFeatures: [{ name: 'Action Surge' }],
      abilities: [
        { name: 'Strength', bonus: 2, totalScore: 14 },
        { name: 'Dexterity', bonus: 3, totalScore: 16 },
        { name: 'Constitution', bonus: 2, totalScore: 14 },
        { name: 'Intelligence', bonus: 1, totalScore: 12 },
        { name: 'Wisdom', bonus: 0, totalScore: 10 },
        { name: 'Charisma', bonus: 0, totalScore: 10 },
      ],
      hitPoints: 45,
      // 🔴 rules.js:394-399 carryingCapacity=HP (defect pin: rules-core.test.js:95-114)
      carryingCapacity: 45,
      speed: 30,
      initiative: 3,
      // computeInitiative boolean flags (:31-:43) — trunk bytes, internals #1258.
      initiativeAdvantage: false,
      noSurprise: false,
      unseenAttackerAdvantageNegate: false,
      armorClass: 13,
      armorClassFormula: 'Unarmored AC (10) + Dexterity Bonus (3)',
      spellAbilities: {},
      attacks: [{ name: 'Longsword' }],
      immunities: ['Lightning'],
      resistances: ['Cold'],
      senses: [],
    })
    // Case-gate byte-map: the 5e direction must request '5e' feat data exactly.
    const { loadFeatData } = await import('../ui/dataLoader.js')
    expect(loadFeatData).toHaveBeenCalledWith('5e')
  })

  // T2 — golden census, 2024 direction (distinct fixture per #1348/#1442 form:
  // level 9 → PB 4, DEX +4, marker modules). Kills every 2024-only trunk step:
  // :456-459 equipment passthrough (5e golden lacks the key), :453 magicItems
  // [] (vs 5e null), :477-481 addBackgroundFeatures traversal (null data →
  // allFeatures unchanged), bonusSource=class.major eager deref :119-126,
  // :566 final senses override of the :457 seed, and the 5e-only ABSENCE of
  // immunities/resistances keys.
  it('2024 golden: ruleset-specific writers and module dispatch exact bytes', async () => {
    const result = await getStats(makeSummary({
      rules: '2024',
      level: 9,
      class: { name: 'Monk', major: { name: 'Warrior of Mercy' } },
    }))

    expect(result).toStrictEqual({
      name: 'Trunk Fighter',
      rules: '2024',
      level: 9,
      background: 'Soldier',
      feats: [],
      proficiency: 4,
      class: {
        name: 'Monk',
        major: { name: 'Warrior of Mercy' },
        languages: [],
        class_levels: [],
      },
      wildMagicSurgeTable: [],
      race: { name: 'Human', traits: [], languages: ['Common'] },
      inventory: { magicItems: [], equipped: [] },
      equipment: [],
      senses: [{ name: 'Darkvision', value: '120 ft.' }],
      actions: [{ name: 'Extra Attack' }],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      characterAdvancement: [],
      expertise: [],
      automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
      saveModifiers: [],
      evasionEffects: [],
      automationConditionImmunities: [],
      automationConditionalImmunities: [],
      turnStartEffects: [],
      languagesAllowed: 3,
      languages: ['Common'],
      proficienciesAllowed: 5,
      proficiencies: ['Herbalism Kit'],
      skillProficienciesAllowed: 3,
      skillProficiencies: ['Medicine'],
      saveProficiencies: [],
      allFeatures: [{ name: 'Extra Attack' }],
      abilities: [
        { name: 'Strength', bonus: 1, totalScore: 12 },
        { name: 'Dexterity', bonus: 4, totalScore: 18 },
        { name: 'Constitution', bonus: 3, totalScore: 16 },
        { name: 'Intelligence', bonus: 0, totalScore: 10 },
        { name: 'Wisdom', bonus: 2, totalScore: 14 },
        { name: 'Charisma', bonus: 0, totalScore: 10 },
      ],
      hitPoints: 78,
      // 🔴 rules.js:394-399 carryingCapacity=HP, 2024 branch same defect.
      carryingCapacity: 78,
      speed: 30,
      initiative: 4,
      initiativeAdvantage: false,
      noSurprise: false,
      unseenAttackerAdvantageNegate: false,
      armorClass: 16,
      // Ordering canary: AC (:557) consumes the :545 abilities — Monk WIS +2
      // (rules-armorClass.js:13-17) is absent if abilities aren't computed yet.
      armorClassFormula: 'Monk Wisdom Bonus (2) + Unarmored AC (10) + Dexterity Bonus (4)',
      spellAbilities: { spellcastingAbility: 'WIS' },
      attacks: [{ name: 'Quarterstaff' }],
    })
    const { loadFeatData, loadBackgroundData } = await import('../ui/dataLoader.js')
    expect(loadFeatData).toHaveBeenCalledWith('2024')
    expect(loadBackgroundData).toHaveBeenCalledWith('2024')
  })

  // T3 — CLA-209 (owned here, cited by rules-playerStats-advanced.test.js:158):
  // the Powerful Build grapple-escape modifier pushed at :533-541 must SURVIVE
  // the final saveModifiers re-collection at :530. Exact one-element census:
  // moving the push above :530 yields [] (collector mock), duplicating it yields
  // length 2, deleting :451 applyPowerfulBuild loses hasPowerfulBuild.
  it('CLA-209: Powerful Build grapple-escape modifier survives the final saveModifiers re-collection', async () => {
    const result = await getStats(makeSummary({
      name: 'Goliath Test',
      rules: '2024',
      level: 5,
      class: { name: 'Fighter', major: {} },
      race: {
        name: 'Goliath',
        traits: [{
          name: 'Powerful Build',
          automation: { type: 'conditional_advantage', target: 'ability_check', condition: 'grappled', effect: 'advantage', casting_time: 'passive' },
        }],
        languages: ['Common'],
      },
    }))

    expect(result.hasPowerfulBuild).toBe(true)
    expect(result.sizeMultiplier).toBe(2)
    expect(result.saveModifiers).toStrictEqual([{
      source: 'Powerful Build',
      target: 'ability_check',
      condition: 'powerful_build_grapple_escape',
      effect: 'advantage',
      abilities: ['STR'],
    }])
  })

  // T4 — free-cast writer seam :520-522 (sole owner: no lane pins the trunk
  // invocation of addMagicInitiateFreeCasts/addFeyTouchedFreeCast/
  // addShadowTouchedFreeCasts; ft035/#1257/#1443 own feature-collection
  // internals). Fey/Shadow seeds must flow from the runtime store at :435 to
  // the writers, so the whole chain is pinned: runtime → seed keys → exact
  // specialActions rows (resort order) → automation.specialActions push order
  // MI→FT→ST. Deleting :435 drops FT+ST rows; deleting :520/:521/:522 drops
  // exactly one row each; reordering flips the automation census.
  it('free-cast seam: runtime seeds flow to MI→FT→ST writers in pinned push order', async () => {
    runtimeStore.set('feyTouchedSpell', 'Faerie Fire')
    runtimeStore.set('shadowTouchedSpell', 'Blur')

    const result = await getStats(makeSummary({
      magicInitiateInstances: [{ class: 'Cleric', level1Spell: 'Toll the Dead' }],
    }))

    expect([result.feyTouchedSpell, result.shadowTouchedSpell]).toEqual(['Faerie Fire', 'Blur'])
    expect(result.specialActions.map((a) => a.name)).toEqual(['Fey Magic', 'Level 1 Spell [Instance 1]', 'Shadow Magic'])
    expect(result.specialActions).toStrictEqual([
      {
        name: 'Fey Magic',
        description: 'Fey Touched: Cast Faerie Fire once for free. Recharges on long rest.',
        type: 'free_spell',
        automation: { type: 'free_spell', spell: 'Faerie Fire', name: 'Fey Magic', uses: 1, recharge: 'long_rest' },
      },
      {
        name: 'Level 1 Spell [Instance 1]',
        description: 'Magic Initiate (Cleric): Cast Toll the Dead once for free. Recharges on long rest.',
        type: 'free_spell',
        automation: { type: 'free_spell', spell: 'Toll the Dead', name: 'Level 1 Spell [Instance 1]', uses: 1, recharge: 'long_rest' },
      },
      {
        name: 'Shadow Magic',
        description: 'Shadow Touched: Cast Blur or Invisibility once each for free. Recharges on long rest.',
        type: 'free_spell',
        automation: { type: 'free_spell', spell: ['Blur', 'Invisibility'], name: 'Shadow Magic', uses: 1, recharge: 'long_rest', perSpellTracking: true },
      },
    ])
    expect(result.automation.specialActions).toStrictEqual([
      { type: 'free_spell', spell: 'Toll the Dead', name: 'Level 1 Spell [Instance 1]', uses: 1, recharge: 'long_rest' },
      { type: 'free_spell', spell: 'Faerie Fire', name: 'Fey Magic', uses: 1, recharge: 'long_rest' },
      { type: 'free_spell', spell: ['Blur', 'Invisibility'], name: 'Shadow Magic', uses: 1, recharge: 'long_rest', perSpellTracking: true },
    ])
  })

  // T5 — expertise assembly seam: class.expertise merges at initActionArrays
  // (:117-119, :461) BEFORE expertSkills pushes at applyProficiencyFeatBuffs
  // (:83-89, :512). Exact ordered census kills both deletions AND the :461/
  // :512 swap. expertSkills merge semantics owned by rules-playerStats-
  // featBuffs.test.js:214 + rules-playerStats-fightingStyles-feats.test.js:338
  // (they feed expertise via summary, not class.expertise — no cross-pin).
  it('expertise seam: class.expertise (:461) lands before expertSkills (:512)', async () => {
    const result = await getStats(makeSummary({
      class: { name: 'Rogue', subclass: { name: 'Thief' }, expertise: ['Stealth'] },
      expertSkills: ['Perception'],
    }))

    expect(result.expertise).toStrictEqual(['Stealth', 'Perception'])
    expect(result.proficiencies).toStrictEqual(['Bagpipes'])
  })
})
