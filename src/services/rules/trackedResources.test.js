// @maintained-by-ai
// Canonical lane for src/services/rules/trackedResources.js — the seed-registry
// face of the resource system. Registry shape: key -> { current, max }, seeded
// once per character load (App.jsx:175-176 -> applyServerOverride ->
// trackedResourcesToStoreEntries -> seedTrackedResources; compute invoked by
// rulesFactory.js:203). NO CLOCK here: grep proves no Date.now/setTimeout/
// setInterval/expiry arithmetic in the module — recovery is seam-declared in
// effects/restRules-constants.js (SHORT_REST_RESOURCES / LONG_REST_RESOURCES),
// tested by the restRules lanes, not this file.
//
// Lane ownership (sibling files — duplicates removed from here, cross-file
// trims reported only):
//   trackedResourcesAdditional.test.js  -> tranceOfOrder(4), adrenalineRush(5),
//     darkOnesLuck(6), gloriousDefense(3), naturalRecovery(3), arcaneWard(5),
//     mysticArcanum presence(4), healinglight(5), favoredEnemy(4),
//     moonlightStep(5), cosmicomen(5), featsOfChaos
//   trackedResourcesSubclass.test.js    -> _Star_Map(6), _Steps_of_the_Fey(6),
//     tireless(4), naturesVeil(4), stonecunning(5), stonesEndurance(4),
//     stormsThunder(4), preserveLife(5), applyServerOverride null/non-object/
//     unknown-key arm(6)
//   psionicStrikeHandler.thrustRestGate.test.js -> telekineticThrustUses seed
//   restRules-shortRest.superiorityFs010.test.js + combatSuperiorityHandlerUtils
//     .test.js -> computeSuperiorityDiceMax derivation at the rest/consume seams
// This file keeps: registry golden + two-way Venn, core seeds, feature-driven
// tables, class/ruleset gate ladders, the override merge contract, store
// projection, and the mysticArcanum ABSENCE half (absence-gate is unique here;
// presence lives in Additional).
//
// sorceryPoints cited anchors PRESERVED (incoming cite #1517:
// trackedResources.js:7/:120 — module lines, module untouched):
//   registry :7 'sorceryPoints'  -> pinned by 'ALL_TRACKED_RESOURCES' golden
//   seed    :120 maxSorceryPoints -> pinned by 'feature-driven seeds' table
//
// Kill-matrix (analytic declaration; every mutation below flips >=1 assertion):
//   drop/rename/re-add ANY registry key (incl. tranceOfOrderUses re-add,
//   CLA-364) -> golden + Venn; break casing-twin parity (secondwind/
//   actionsurge mirrors) -> fighter tests; swap ?? 0 -> 0-default rows in
//   core seed table; flip level gates (17/2, 15/7, 10/9, 6/5, 5*level) ->
//   ladder rows; falsy-check instead of != null in applyServerOverride ->
//   serverValue 0 row; >= vs > clamps / drop Math.max(1,..) -> warPriest,
//   lucky, gated-pool rows; drop class gates -> non-class rows; inline
//   classLevel row-lookup (exact-level match) -> secondWind non-matching row;
//   shallow-copy removed in applyServerOverride -> purity identity asserts;
//   store projection reading max instead of current -> full-set toEqual;
//   signature change -> arity test.
//
// Mock census: trackedResources.js imports exactly 1 of 1 exports from
// ../character/classFeatures.js (getClassFeatures) — mocked completely, 1 of 1.
// Unit under test (trackedResources.js) is NEVER mocked. No dead module mocks.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import classes2024 from '../../../public/data/2024/classes.json';
import classes5e from '../../../public/data/classes.json';

vi.mock('../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

import { getClassFeatures } from '../character/classFeatures.js';
import {
  ALL_TRACKED_RESOURCES,
  GATED_TRACKED_KEYS,
  computeTrackedResources,
  applyServerOverride,
  trackedResourcesToStoreEntries,
} from './trackedResources.js';

function basePlayerStats(extra = {}) {
  return {
    level: 5,
    rules: '5e',
    class: { name: 'Wizard', class_levels: [], major: {}, subclass: {} },
    abilities: [],
    feats: [],
    ...extra,
  };
}

const wizardClass = (extra = {}) => ({ name: 'Wizard', class_levels: [], major: {}, subclass: {}, ...extra });

// Table row runner: keying the assertion by row name so a failure names the row.
function expectPool(stats, key, expected, label) {
  const result = computeTrackedResources(stats);
  expect({ [label]: result[key] }).toEqual({ [label]: expected });
  return result;
}

// ── public surface ──────────────────────────────────────────────

describe('ALL_TRACKED_RESOURCES (registry golden)', () => {
  it('is the exact 60-key registry, byte-for-byte, in declaration order', () => {
    expect(ALL_TRACKED_RESOURCES).toEqual([
      'currentHitPoints',
      'hitPoints',
      'sorceryPoints', // :7 — cited anchor (#1517)
      'innateSorceryUses',
      'focusPoints',
      'kiPoints',
      'channelDivinityCharges',
      'bardicInspirationUses',
      'wildShapeUses',
      // improve ghost-keys (case-dup pass): the legacy lower-case twins
      // 'secondwindUses'/'actionsurgeUses' are RETIRED (were intentional
      // under the old seed; camelCase is the single canonical casing —
      // see trackedResources.js catalog note).
      'secondWindUses',
      'actionSurgeUses',
      'actionSurgeUsedThisRound',
      'ragePoints',
      'layOnHandsPool',
      'preserveLifePool',
      'gloriousDefenseUses',
      'superiorityDice',
      'psionicEnergy',
      'telekineticThrustUses',
      'arcaneRecoveryLevels',
      'naturalRecoverySlots',
      'arcaneWardHp',
      'arcaneWardMax',
      'warlockPactMagic',
      'sorcerousRestorationUses',
      'uncannymetabolismUses',
      'rageOfTheGodsUses',
      'warPriestUses',
      'luckyPoints',
      'divineInterventionUses',
      'wholenessofbodyUses',
      'adrenalineRushUses',
      'naturesVeilUses',
      'favoredEnemyUses',
      'stonecunningUses',
      'stonesEnduranceUses',
      'stormsThunderUses',
      'tirelessUses',
      'moonlightStepUses',
      'dreadambushUses',
      'cosmicomenUses',
      // CLA-364 BUG-A: tranceOfOrderUses is NOT here (handler-owned
      // null-as-available latch; a 0-seed killed the free first use).
      'shortRestHitDice',
      'spell_slots_level_1',
      'spell_slots_level_2',
      'spell_slots_level_3',
      'spell_slots_level_4',
      'spell_slots_level_5',
      'spell_slots_level_6',
      'spell_slots_level_7',
      'spell_slots_level_8',
      'spell_slots_level_9',
      'tamedSurgeUses',
      'featsOfChaosUses',
      'mysticArcanumLevel6',
      'mysticArcanumLevel7',
      'mysticArcanumLevel8',
      'mysticArcanumLevel9',
      'isDead',
      '_Steps_of_the_Fey_freeCastCount',
      'healinglightPool',
    ]);
  });

  it('exposes the documented API at exact arity (runtime Function.length)', () => {
    expect(computeTrackedResources.length).toBe(1);
    expect(applyServerOverride.length).toBe(2);
    expect(trackedResourcesToStoreEntries.length).toBe(1);
  });
});

// ── computeTrackedResources ─────────────────────────────────────

describe('computeTrackedResources', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seeds nothing for null playerStats; core pools mirror hitPoints, spell slots (??: missing defaults 0), level', () => {
    expect(computeTrackedResources(null)).toEqual({});

    const result = computeTrackedResources(basePlayerStats({
      level: 8,
      hitPoints: 35,
      spellAbilities: { spell_slots_level_1: 4, spell_slots_level_4: 1 },
    }));
    expect(result.hitPoints).toEqual({ current: 35, max: 35 });
    expect(result.currentHitPoints).toEqual({ current: 35, max: 35 });
    expect(result.shortRestHitDice).toEqual({ current: 8, max: 8 });
    expect({
      l1: result.spell_slots_level_1,
      l4: result.spell_slots_level_4,
      l9: result.spell_slots_level_9,
    }).toEqual({
      l1: { current: 4, max: 4 },
      l4: { current: 1, max: 1 },
      l9: { current: 0, max: 0 }, // ?? 0 for absent spellAbilities entries
    });

    // hitPoints missing -> 0 (falsy default), still present as a pool.
    expect(computeTrackedResources(basePlayerStats({ level: 1 })).hitPoints).toEqual({ current: 0, max: 0 });
  });

  it('registry Venn both directions: owned-only seeds; declared exceptions are the documented latch sets', () => {
    // Kitchen-sink fixture exercises the Warlock adders. improve
    // ghost-keys (ownership pass): class-agnostic adders NO LONGER seed
    // 0-ghosts — every STATICALLY_OWNABLE key appears only for its owner
    // (GATED_TRACKED_KEYS), so this Fiend-patron Warlock compute yields the
    // universal core lane + its owned Warlock/Fiend keys and nothing else.
    getClassFeatures.mockReturnValue({ arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 } });
    const result = computeTrackedResources(basePlayerStats({
      class: wizardClass({ name: 'Warlock', major: { name: 'Fiend' } }),
      automation: {},
      proficiency: 2,
    }));

    const computedKeys = Object.keys(result);
    const computedOnly = computedKeys.filter((k) => !ALL_TRACKED_RESOURCES.includes(k)).sort();
    const registryOnly = ALL_TRACKED_RESOURCES.filter((k) => !(k in result)).sort();

    // Computed but absent from registry (reported quirk: harmless today because
    // applyServerOverride only consults the registry for server-only keys).
    // _Star_Map_freeCastCount is no longer computed here — Stars-owned only now:
    expect(computedOnly).toEqual(['darkOnesLuckUses']);

    // Registry keys absent from this compute = every GATED key the fixture
    // does NOT own, plus the handler/exec-owned latches that are NEVER
    // seeded (restored by restRules seams). Exact seeded set for this
    // fixture: the 12 universal core keys + warlockPactMagic + the four
    // Mystic Arcanum levels (Fiend grants no arcanum-free cast here).
    const UNSEEDED_LATCHES = [
      'actionSurgeUsedThisRound',
      'dreadambushUses',
      'isDead',
      'rageOfTheGodsUses',
      'tamedSurgeUses',
    ];
    const expectRegistryOnly = ALL_TRACKED_RESOURCES.filter(
      (k) => (GATED_TRACKED_KEYS.includes(k) && k !== 'warlockPactMagic' && !k.startsWith('mysticArcanum'))
        || UNSEEDED_LATCHES.includes(k),
    ).sort();
    expect(registryOnly).toEqual(expectRegistryOnly);
    // Every gated key listed above is genuinely unowned by this fixture
    // (no accidental gate-open), and the universal core lane is fully seeded:
    expect(result).toHaveProperty('warlockPactMagic', { current: 0, max: 0 });
    expect(result.darkOnesLuckUses).toEqual({ current: 1, max: 1 });
    // CLA-364: never seeded.
    expect(result.tranceOfOrderUses).toBeUndefined();
  });

  it('gated pool keys (improve tracked-resource-ghost-keys): ABSENT for non-owners, seeded for owners', () => {
    // The three class-pool keys follow the CLA-364 tranceOfOrderUses idiom:
    // key absence is the unowned state — no `: 0` ghost rows fan into
    // non-owner buckets via the first full-store POST.
    const POOL_KEYS = ['healinglightPool', 'preserveLifePool', 'layOnHandsPool'];
    for (const stats of [
      basePlayerStats(), // Wizard
      basePlayerStats({ class: wizardClass({ name: 'Cleric', major: { name: 'War Domain' } }) }),
      basePlayerStats({ class: wizardClass({ name: 'Warlock', major: { name: 'Fiend' } }) }),
    ]) {
      const result = computeTrackedResources(stats);
      for (const key of POOL_KEYS) expect(result, key).not.toHaveProperty(key);
    }

    // Owner lanes still seed with correct current/max (byte-identical values).
    expect(computeTrackedResources(basePlayerStats({
      class: wizardClass({ name: 'Paladin' }), level: 5,
    })).layOnHandsPool).toEqual({ current: 25, max: 25 });
    expect(computeTrackedResources(basePlayerStats({
      class: wizardClass({ name: 'Warlock', major: { name: 'Celestial Patron' } }), level: 5,
    })).healinglightPool).toEqual({ current: 6, max: 6 });
    expect(computeTrackedResources(basePlayerStats({
      class: wizardClass({ name: 'Cleric', major: { name: 'Life Domain' } }), level: 8,
    })).preserveLifePool).toEqual({ current: 40, max: 40 });
    // Owner with undefined level still seeds the key (at 0) — ownership, not
    // the value, decides presence.
    expect(computeTrackedResources(basePlayerStats({
      class: wizardClass({ name: 'Paladin' }), level: undefined,
    })).layOnHandsPool).toEqual({ current: 0, max: 0 });
  });

  it('feature-driven seeds (incl. sorceryPoints :120 anchor) map 1:1 from getClassFeatures; absent features seed 0', () => {
    getClassFeatures.mockReturnValue({
      maxSorceryPoints: 5,
      maxInnateSorcery: 3,
      maxChannelDivinity: 2,
      maxWildShapeUses: 2,
      arcaneRecoveryLevels: 3,
      uncannymetabolismUses: 2,
    });
    const result = computeTrackedResources(basePlayerStats());
    expect({
      sorceryPoints: result.sorceryPoints, // :120
      innateSorceryUses: result.innateSorceryUses,
      channelDivinityCharges: result.channelDivinityCharges,
      wildShapeUses: result.wildShapeUses,
      arcaneRecoveryLevels: result.arcaneRecoveryLevels,
      uncannymetabolismUses: result.uncannymetabolismUses,
    }).toEqual({
      sorceryPoints: { current: 5, max: 5 },
      innateSorceryUses: { current: 3, max: 3 },
      channelDivinityCharges: { current: 2, max: 2 },
      wildShapeUses: { current: 2, max: 2 },
      arcaneRecoveryLevels: { current: 3, max: 3 },
      uncannymetabolismUses: { current: 2, max: 2 },
    });

    // features undefined (getClassFeatures returns undefined) -> the
    // feature-owned keys are ABSENT (owned-only pass, GATED_TRACKED_KEYS).
    getClassFeatures.mockReturnValue(undefined);
    const zeroed = computeTrackedResources(basePlayerStats());
    expect(zeroed).not.toHaveProperty('sorceryPoints');
    expect(zeroed).not.toHaveProperty('innateSorceryUses');
  });

  it('focusPoints and kiPoints mirror each other; class_levels row wins over features fallback', () => {
    getClassFeatures.mockReturnValue({ maxFocusPoints: 4 });
    let result = computeTrackedResources(basePlayerStats({
      class: wizardClass({ class_levels: [{ level: 5, focus_points: 2 }] }),
    }));
    expect(result.focusPoints).toEqual({ current: 2, max: 2 });
    expect(result.kiPoints).toEqual({ current: 2, max: 2 });

    result = computeTrackedResources(basePlayerStats({
      class: wizardClass({ class_levels: [{ level: 5 }] }),
    }));
    expect(result.focusPoints).toEqual({ current: 4, max: 4 });
    expect(result.kiPoints).toEqual({ current: 4, max: 4 });
  });

  it('fighter 5e: secondWind/actionSurge read the EXACT-level class_levels row; the lower-case twins are NEVER seeded (case-dup retired)', () => {
    const fighter = (classLevels) => basePlayerStats({
      rules: '5e', level: 7, class: wizardClass({ name: 'Fighter', class_levels: classLevels }),
    });
    const match = [{ level: 7, second_wind: 1, class_specific: { action_surges: 2 } }];
    const result = computeTrackedResources(fighter(match));
    expect({
      sw: result.secondWindUses,
      as: result.actionSurgeUses,
    }).toEqual({
      sw: { current: 1, max: 1 },
      as: { current: 2, max: 2 },
    });
    // CRITERION 1: no case-variant duplicate rides the bucket — the legacy
    // feature-name-derived twin seed is gone (case-insensitive dedupe: the
    // camelCase automation-id casing is the canonical survivor).
    expect(result).not.toHaveProperty('secondwindUses');
    expect(result).not.toHaveProperty('actionsurgeUses');
    expect(ALL_TRACKED_RESOURCES).not.toContain('secondwindUses');
    expect(ALL_TRACKED_RESOURCES).not.toContain('actionsurgeUses');

    // level-3 row must NOT satisfy a level-7 query — unowned data -> ABSENT,
    // not a 0-ghost (owned-only pass).
    const miss = computeTrackedResources(fighter([{ level: 3, second_wind: 1, class_specific: { action_surges: 2 } }]));
    expect(miss).not.toHaveProperty('secondWindUses');
    expect(miss).not.toHaveProperty('actionSurgeUses');
  });

  it('fighter 2024: actionSurge ladder 17->2, 2->1, <2 ABSENT; non-fighter ABSENT', () => {
    const f = (lvl, name = 'Fighter') => basePlayerStats({ rules: '2024', level: lvl, class: wizardClass({ name }) });
    expect(computeTrackedResources(f(17)).actionSurgeUses).toEqual({ current: 2, max: 2 });
    expect(computeTrackedResources(f(2)).actionSurgeUses).toEqual({ current: 1, max: 1 });
    expect(computeTrackedResources(f(1))).not.toHaveProperty('actionSurgeUses');
    expect(computeTrackedResources(f(17, 'Wizard'))).not.toHaveProperty('actionSurgeUses');
  });

  it('ragePoints: 5e class_specific.rage_count, 2024 rages, 2024-missing 0, non-barbarian 0', () => {
    let result = computeTrackedResources(basePlayerStats({
      rules: '5e', class: wizardClass({ name: 'Barbarian', class_levels: [{ level: 5, class_specific: { rage_count: 2 } }] }),
    }));
    expect(result.ragePoints).toEqual({ current: 2, max: 2 });
    result = computeTrackedResources(basePlayerStats({
      rules: '2024', class: wizardClass({ name: 'Barbarian', class_levels: [{ level: 5, rages: 3 }] }),
    }));
    expect(result.ragePoints).toEqual({ current: 3, max: 3 });
    result = computeTrackedResources(basePlayerStats({
      rules: '2024', class: wizardClass({ name: 'Barbarian', class_levels: [{ level: 5 }] }),
    }));
    expect(result).not.toHaveProperty('ragePoints'); // owned-only: 0-rage data rows seed no ghost
    result = computeTrackedResources(basePlayerStats({ class: wizardClass({ name: 'Cleric' }) }));
    expect(result).not.toHaveProperty('ragePoints'); // non-Barbarian ABSENT
  });

  it('superiorityDice: FS-010 single source — Battle Master 5e ladder / 2024 dice field / Superior Technique style 1 / non-fighter 0', () => {
    const bm = (rules, level, cl = {}) => basePlayerStats({
      rules, level, class: wizardClass({ name: 'Fighter', major: { name: 'Battle Master' }, class_levels: [{ level, ...cl }] }),
    });
    expect(computeTrackedResources(bm('5e', 15)).superiorityDice).toEqual({ current: 6, max: 6 });
    expect(computeTrackedResources(bm('5e', 7)).superiorityDice).toEqual({ current: 5, max: 5 });
    expect(computeTrackedResources(bm('5e', 6)).superiorityDice).toEqual({ current: 4, max: 4 });
    // fix#346 (#1318) tier-boundary arms, both sides of each DISK step
    // (5e/classes.json Battle Master lv3 'Combat Superiority': "You gain
    // another superiority die at 7th level and one more at 15th level."):
    // lv6->4 / lv7->5 and lv14->5 / lv15->6 exact. The rec's 'PHB
    // 11->5/17->6' ladder is REFUTED at disk: lv10 and lv11 BOTH sit at 5
    // (under the phantom 11/17 law lv10 would have to seed 4).
    expect(computeTrackedResources(bm('5e', 14)).superiorityDice).toEqual({ current: 5, max: 5 });
    expect(computeTrackedResources(bm('5e', 15)).superiorityDice).toEqual({ current: 6, max: 6 });
    expect(computeTrackedResources(bm('5e', 10)).superiorityDice).toEqual({ current: 5, max: 5 });
    expect(computeTrackedResources(bm('5e', 11)).superiorityDice).toEqual({ current: 5, max: 5 });
    expect(computeTrackedResources(bm('5e', 16)).superiorityDice).toEqual({ current: 6, max: 6 });
    expect(computeTrackedResources(bm('2024', 5, { superiority_dice: 5 })).superiorityDice).toEqual({ current: 5, max: 5 });
    expect(computeTrackedResources(bm('2024', 5, { superiority_dice: 0 }))).not.toHaveProperty('superiorityDice');
    // 2024 disk ladder BY-level census agrees with the 5e fallback shape:
    // superiority_dice column is 4 (lv3-6), 5 (lv7-14), 6 (lv15-20).
    const f2024 = classes2024.find((c) => c.name === 'Fighter');
    const sd = (lv) => f2024.class_levels.find((cl) => cl.level === lv).superiority_dice;
    expect([sd(3), sd(6), sd(7), sd(14), sd(15), sd(20)]).toEqual([4, 4, 5, 5, 6, 6]);
    // 5e disk carries NO superiority_dice field (fallback :79-81 is the law,
    // and it matches the lv3 prose quote above — fix#346 DISCHARGED-STALE).
    const f5e = classes5e.find((c) => c.name === 'Fighter');
    expect(f5e.class_levels.every((cl) => !('superiority_dice' in cl))).toBe(true);
    const bm5e = f5e.subclasses.find((s) => s.name === 'Battle Master')
      .class_levels.find((cl) => cl.level === 3).features.find((f) => f.name === 'Combat Superiority');
    expect(bm5e.description).toContain('You have four superiority dice, which are d8s');
    expect(bm5e.description).toContain('You gain another superiority die at 7th level and one more at 15th level.');
    expect(bm5e.description).not.toMatch(/at 11th level and one more at 17th level/);
    // 2024 BM with no class_levels row -> classLevel undefined -> ABSENT (no crash)
    expect(computeTrackedResources(basePlayerStats({
      rules: '2024', class: wizardClass({ name: 'Fighter', major: { name: 'Battle Master' } }),
    }))).not.toHaveProperty('superiorityDice');
    // non-Battle-Master fighter WITH the Superior Technique style -> exactly 1
    expect(computeTrackedResources(basePlayerStats({
      class: wizardClass({ name: 'Fighter', major: { name: 'Champion' }, fightingStyles: ['Superior Technique'] }),
    })).superiorityDice).toEqual({ current: 1, max: 1 });
    expect(computeTrackedResources(basePlayerStats({
      class: wizardClass({ name: 'Wizard', major: { name: 'Champion' } }),
    }))).not.toHaveProperty('superiorityDice');
  });

  it('warlockPactMagic: 5e class_specific.pact_slots, 2024 pact_slot_levels, missing row 0, non-warlock 0', () => {
    let result = computeTrackedResources(basePlayerStats({
      rules: '5e', class: wizardClass({ name: 'Warlock', class_levels: [{ level: 5, class_specific: { pact_slots: 2 } }] }),
    }));
    expect(result.warlockPactMagic).toEqual({ current: 2, max: 2 });
    result = computeTrackedResources(basePlayerStats({
      rules: '2024', class: wizardClass({ name: 'Warlock', class_levels: [{ level: 5, pact_slot_levels: 3 }] }),
    }));
    expect(result.warlockPactMagic).toEqual({ current: 3, max: 3 });
    result = computeTrackedResources(basePlayerStats({
      rules: '2024', class: wizardClass({ name: 'Warlock', class_levels: [{ level: 5 }] }),
    }));
    expect(result.warlockPactMagic).toEqual({ current: 0, max: 0 }); // owner data-hole keeps the row
    result = computeTrackedResources(basePlayerStats());
    expect(result).not.toHaveProperty('warlockPactMagic'); // non-warlock ABSENT
  });

  it('mysticArcanum keys appear ONLY when BOTH warlock AND features.arcanumLevels (absence half; presence owned by Additional)', () => {
    // Warlock but features null -> no keys.
    getClassFeatures.mockReturnValue(null);
    let result = computeTrackedResources(basePlayerStats({ class: wizardClass({ name: 'Warlock' }) }));
    expect(['mysticArcanumLevel6', 'mysticArcanumLevel7', 'mysticArcanumLevel8', 'mysticArcanumLevel9'].filter((k) => k in result)).toEqual([]);

    // arcanumLevels present but non-warlock -> no keys.
    getClassFeatures.mockReturnValue({ arcanumLevels: { level6: 1 } });
    result = computeTrackedResources(basePlayerStats());
    expect(['mysticArcanumLevel6', 'mysticArcanumLevel7', 'mysticArcanumLevel8', 'mysticArcanumLevel9'].filter((k) => k in result)).toEqual([]);
  });

  it('class/ability-gated pools: bardic (CHA), layOnHands (5x level), divineIntervention (cleric >=10), wholeness (monk >=6), warPriest (default-1 quirk)', () => {
    const rows = [
      ['bard CHA 3', basePlayerStats({ class: wizardClass({ name: 'Bard' }), abilities: [{ name: 'Charisma', bonus: 3 }] }), 'bardicInspirationUses', { current: 3, max: 3 }],
      ['bard no CHA entry', basePlayerStats({ class: wizardClass({ name: 'Bard' }) }), 'bardicInspirationUses', { current: 0, max: 0 }],
      // GATED (owned-only pass): the key itself is Bard-owned — non-bards get
      // no row at all (was a `: 0` ghost).
      ['bard gate: non-bard with CHA -> ABSENT', basePlayerStats({ abilities: [{ name: 'Charisma', bonus: 3 }] }), 'bardicInspirationUses', undefined],
      ['paladin lvl 5 = 25', basePlayerStats({ class: wizardClass({ name: 'Paladin' }), level: 5 }), 'layOnHandsPool', { current: 25, max: 25 }],
      ['paladin level undefined = 0', basePlayerStats({ class: wizardClass({ name: 'Paladin' }), level: undefined }), 'layOnHandsPool', { current: 0, max: 0 }],
      // Gated (improve tracked-resource-ghost-keys, CLA-364 idiom): the key is
      // ABSENT for non-paladins — no `layOnHandsPool: 0` ghost row.
      ['paladin gate: non-paladin lvl 5 -> key ABSENT', basePlayerStats({ class: wizardClass({ name: 'Sorcerer' }) }), 'layOnHandsPool', undefined],
      ['cleric lvl 10 boundary = 1', basePlayerStats({ class: wizardClass({ name: 'Cleric' }), level: 10 }), 'divineInterventionUses', { current: 1, max: 1 }],
      ['cleric lvl 9 -> ABSENT (feature grant is lv10)', basePlayerStats({ class: wizardClass({ name: 'Cleric' }), level: 9 }), 'divineInterventionUses', undefined],
      ['cleric gate: wizard lvl 15 -> ABSENT', basePlayerStats({ level: 15 }), 'divineInterventionUses', undefined],
      ['monk lvl 6 boundary = 1', basePlayerStats({ class: wizardClass({ name: 'Monk' }), level: 6 }), 'wholenessofbodyUses', { current: 1, max: 1 }],
      ['monk lvl 5 -> ABSENT (feature grant is lv6)', basePlayerStats({ class: wizardClass({ name: 'Monk' }), level: 5 }), 'wholenessofbodyUses', undefined],
      ['warPriest WIS 3', basePlayerStats({ class: wizardClass({ name: 'Cleric' }), abilities: [{ name: 'Wisdom', bonus: 3 }] }), 'warPriestUses', { current: 3, max: 3 }],
      ['warPriest WIS -2 clamps to 1', basePlayerStats({ class: wizardClass({ name: 'Cleric' }), abilities: [{ name: 'Wisdom', bonus: -2 }] }), 'warPriestUses', { current: 1, max: 1 }],
      ['warPriest cleric no WIS entry -> 1', basePlayerStats({ class: wizardClass({ name: 'Cleric' }) }), 'warPriestUses', { current: 1, max: 1 }],
      // GATED (fix#336S value gate widened to a KEY gate by the owned-only
      // pass): warPriestUses is a cleric pool — non-clerics carry no row.
      ['warPriest gate: wizard, no WIS -> ABSENT', basePlayerStats(), 'warPriestUses', undefined],
    ];
    for (const [label, stats, key, expected] of rows) expectPool(stats, key, expected, label);
  });

  it('luckyPoints: proficiency-gated, case-insensitive feat match, null-safe inputs', () => {
    const rows = [
      ['Lucky feat prof 3', { feats: ['Lucky'], proficiency: 3 }, { current: 3, max: 3 }],
      ['lowercase lucky prof 4', { feats: ['lucky'], proficiency: 4 }, { current: 4, max: 4 }],
      ['other feat -> ABSENT (owned-only)', { feats: ['Alert'] }, undefined],
      ['Lucky, proficiency undefined', { feats: ['Lucky'], proficiency: undefined }, { current: 0, max: 0 }],
      ['feats null -> ABSENT', { feats: null }, undefined],
      ['feats undefined -> ABSENT', { feats: undefined }, undefined],
      ['null/undefined entries inside feats -> ABSENT', { feats: [null, 'Alert', undefined] }, undefined],
    ];
    for (const [label, extra, expected] of rows) expectPool(basePlayerStats(extra), 'luckyPoints', expected, label);
  });

  it('automation/energy gates: sorcerousRestoration passive, psionicEnergy required_major match/mismatch/missing', () => {
    const psiClass = (major, subclass, classLevels) => wizardClass({ name: 'Fighter', major: major || {}, subclass: subclass || {}, class_levels: classLevels || [] });
    const rows = [
      ['resource_restoration passive', basePlayerStats({ automation: { passives: [{ type: 'resource_restoration' }] } }), 'sorcerousRestorationUses', { current: 1, max: 1 }],
      ['other passive -> ABSENT', basePlayerStats({ automation: { passives: [{ type: 'other_type' }] } }), 'sorcerousRestorationUses', undefined],
      ['no automation object -> ABSENT', basePlayerStats(), 'sorcerousRestorationUses', undefined],
    ];
    for (const [label, stats, key, expected] of rows) expectPool(stats, key, expected, label);

    const energyRow = (major, subclass, energy) => basePlayerStats({
      class: psiClass(major, subclass, [{ level: 5, energy }]),
    });
    const psi = (stats) => computeTrackedResources(stats).psionicEnergy;
    expect(psi(energyRow({ name: 'Psi Warrior' }, {}, { required_major: 'Psi Warrior', energy_die_num: 3 }))).toEqual({ current: 3, max: 3 });
    expect(psi(energyRow({}, { name: 'Psi Warrior' }, { required_major: 'Psi Warrior', energy_die_num: 2 }))).toEqual({ current: 2, max: 2 });
    expect(psi(energyRow({ name: 'Champion' }, {}, { required_major: 'Psi Warrior', energy_die_num: 3 }))).toBeUndefined();
    expect(psi(basePlayerStats({ class: psiClass({ name: 'Psi Warrior' }) }))).toBeUndefined();
    expect(psi(energyRow({ name: 'Psi Warrior' }, {}, { required_major: 'Psi Warrior' }))).toBeUndefined();
  });
});

// ── applyServerOverride ─────────────────────────────────────────

describe('applyServerOverride', () => {
  it('merge contract: server overrides current only; null preserved, 0 applied; unknown keys ignored; server-only registry keys added as {current:max}; inputs never mutated', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
      sorceryPoints: { current: 5, max: 5 },
      arcaneWardHp: { current: 8, max: 8 },
      darkOnesLuckUses: { current: 4, max: 4 }, // computed-only key: registry gate must NOT block its override
    };
    const snapshot = JSON.parse(JSON.stringify(computed));
    const result = applyServerOverride(computed, {
      hitPoints: 12,        // override current, keep max
      sorceryPoints: 0,     // falsy-but-valid 0 applies (pool-0 vs absent)
      arcaneWardHp: null,   // null = server has no value -> computed preserved
      kiPoints: 3,          // registry key absent from computed -> added {3,3}
      unknownKey: 99,       // not in ALL_TRACKED_RESOURCES -> ignored
    });

    expect(result).toEqual({
      hitPoints: { current: 12, max: 20 },
      sorceryPoints: { current: 0, max: 5 },
      arcaneWardHp: { current: 8, max: 8 },
      darkOnesLuckUses: { current: 4, max: 4 },
      kiPoints: { current: 3, max: 3 },
    });
    // Purity: fresh top-level object, fresh object for each mutated entry,
    // untouched entries shared by reference (shallow merge), input unchanged.
    expect(result).not.toBe(computed);
    expect(result.hitPoints).not.toBe(computed.hitPoints);
    expect(result.arcaneWardHp).toBe(computed.arcaneWardHp);
    expect(computed).toEqual(snapshot);
    expect(result.unknownKey).toBeUndefined();
  });
});

// ── trackedResourcesToStoreEntries ─────────────────────────────

describe('trackedResourcesToStoreEntries', () => {
  it('projects every current value (0 observable, max never leaks) into flat store entries', () => {
    const tracked = {
      hitPoints: { current: 20, max: 35 },
      sorceryPoints: { current: 0, max: 5 },
      kiPoints: { current: 3, max: 3 },
    };
    expect(trackedResourcesToStoreEntries(tracked)).toEqual({ hitPoints: 20, sorceryPoints: 0, kiPoints: 3 });
  });
});
