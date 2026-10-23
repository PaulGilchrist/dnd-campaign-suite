// @maintained-by-ai
// SUBCLASS/ANCESTRY-KEYED seed lane for src/services/rules/trackedResources.js.
// LIVE ALLOCATION cite #1532, verbatim:
//   '_Star_Map, _Steps_of_the_Fey, tireless, naturesVeil, stonecunning,
//    stonesEndurance, stormsThunder, preserveLife, applyServerOverride extra
//    arms | :316,:231-234,:292-293,:285-286,:324-333,:268-270,:411-426 |
//    subclass sibling (skipped, no overlap)'
// THIS FILE is that subclass sibling. Base lane #1531 ('trackedResourcesSubclass
// (9 lanes)') owns the registry golden, global two-way Venn, merge contract and
// Function.length arity pins — NOT repeated here; re-arm seams are owned by the
// restRules lanes. Module gates here match the 2024 disk majors; base lane
// :17-20 owns this lane's key tuple — old->new consolidation map (44 its -> 9):
//   _Star_Map 6->1 (table), _Steps_of_the_Fey 6->1, tireless+naturesVeil 8->1
//   (same adder :283-294, gate-separation rows), stonecunning 5->\
//   stonesEndurance 4->\ stormsThunder 4->/ ancestral-traits 1 shared table,
//   preserveLife 5->1, applyServerOverride-extra 6->1 (full-set toEqual covers
//   every arm), plus disk-census 0->1, subclass-absent golden 0->1.
// PRESERVED-CITED-BY: naturesVeilHandler.test.js:9 cites 'tracked-resource max
//   DEFINITION (trackedResourcesSubclass.test.js)' — preserved: tireless/naturesVeil
//   max formula is pinned here (disk lv10/lv14 rows).
//
// Adder allocation, module bytes re-verified live against current module
// (none of the #1532 cites stale):
//   _Star_Map_freeCastCount      :316   isDruid + 'Circle of the Stars' + lv>=3
//     disk 2024/classes.json Druid majors 'Circle of the Stars' lv3 feature
//     'Star Map' automation.uses_expression 'WIS modifier_min_1' -> max(WIS,1)
//   _Steps_of_the_Fey_freeCast   :231-234 isWarlock + 'Archfey Patron' + bonusActions
//     type 'steps_of_the_fey' disk 2024 warlock feature lv3 uses_expression
//     'CHA modifier_min_1'. DRIFT pinned: NO lv gate in code — the stamped
//     automation is the grant proxy (disk lv3).
//   tirelessUses                 :292-293 Ranger lv>=10 max(WIS,1), 2024-only
//     (fix#134) — disk 2024 Ranger lv10 'Tireless' automation.resourceKey
//     'tirelessUses'; 5e disk has no row -> 0
//   naturesVeilUses             :285-286 Ranger lv>=14 max(WIS,1), 2024-only
//     (fix#134) — disk lv14 'Nature's Veil' automation.resourceKey
//     'naturesVeilUses'; 5e disk has no row -> 0
//   stonecunningUses            :324-333 race trait 'Stonecunning' + automation,
//     uses=proficiency ('proficiency_bonus' disk, Dwarf trait both rulesets)
//   stonesEnduranceUses         :328-329 SUBRACE trait "Stone's Endurance" —
//     disk owner is GOLIATH subrace 'Stone Giant' (old 'Hill Dwarf' title was
//     behavior-misleading: 2024 disk Dwarf subraces carry ZERO traits).
//   stormsThunderUses           :331-332 subrace trait "Storm's Thunder" —
//     disk Goliath subrace 'Storm Giant'.
//   preserveLifePool            :268-270 isCleric + 'Life Domain' 5*level —
//     disk poolExpression '5 * cleric_level' (both rulesets). No lv gate here;
//     lv-undefined -> 0 row pins (|| 0).
//
// GATE-LEAK AUDIT of the 8 owned adders: ALL gated (class/race/trait/
//   automation). Zero non-owner-class seed leaks found (contrast #1532's
//   favoredEnemy/warPriest ungated findings, owned+reported there).
//   Non-owner fixtures here assert 0 (isDruid/isWarlock/isCleric gate rows).
// VENN GAPS (reported, not invented away): _Star_Map_freeCastCount is computed
//   but NOT in ALL_TRACKED_RESOURCES (#1531/#1532 confirmed) — executable
//   channel census below pins it; the extra-arm override therefore CANNOT
//   re-add it once absent (row in the override table). Registry-only side of
//   the subclass channel is base-lane owned (:213-219), not repeated.
// RULESET GATE (fix#134 #1533, was drift): tireless/naturesVeil gates are
//   2024-version-gated — the seeds fire only when is2024, matching the disk
//   census (5e disk Ranger has NO Tireless/Nature's Veil rows; 2024 Ranger
//   lv10/lv14 grant them). 5e subclass names ('Moon', 'The Archfey', 'Life')
//   still never match the 2024-major-name gates (separate drift, reported).
// NO CLOCK: grep proves 0 Date.now/setTimeout/setInterval in the module; all
//   owned keys re-arm at rest seams owned by restRules-constants.js
//   LONG_REST_RESOURCES (:186 :222 :223 :225 :243) and restRules-longRest.js
//   :744-745 (Goliath traits) — tested by the restRules lanes, not here.
// CAMPAIGN LOCKDOWN: no campaign strings in this file (grep-proof).
// MOCK CENSUS: 0 module mocks. Sole external collaborator getClassFeatures
//   (trackedResources.js import 1 of 1) runs REAL — a pure in-memory class
//   rules dispatch; this lane's keys never read its output, so mocking would
//   be over-mocking. Unit under test never mocked. No dead-module mocks.
//
// Kill-matrix (analytic declaration; every mutation flips >=1 row):
//   drop isDruid gate -> wizard-'Stars' row; drop lv>=3/>=10/>=14 gates ->
//   lv2/lv9/lv13 separation rows; drop major-arm or subclass-arm of
//   matchesPatron -> 50% of name rows; drop isWarlock gate -> wizard-Archfey
//   row; drop bonusActions gate -> Archfey-no-automation row; drop isCleric
//   gate -> Druid-'Life Domain' row; Math.max(...,1) floor removed -> WIS/CHA
//   0/-1/no-entry rows; || 0 on proficiency -> prof-undefined rows; swap
//   fromSubrace flag -> trait-placement row; drop t.automation truthiness ->
//   automation:false row; exact-name match loosened -> lowercase/apostrophe
//   near-miss rows; 5*level formula -> preserveLife lv5/lv8 values;
//   truthiness instead of != null in extra arm -> naturesVeilUses:0 row dies
//   and sorceryPoints:null row adds; registry guard removed -> totallyUnknownKey
//   row; shallow copy removed -> identity asserts.

import { describe, it, expect, vi } from 'vitest';

import classes2024 from '../../../public/data/2024/classes.json';
import classes5e from '../../../public/data/classes.json';
import races2024 from '../../../public/data/2024/races.json';

import { computeTrackedResources, applyServerOverride, ALL_TRACKED_RESOURCES } from './trackedResources.js';

// ── disk row extractors (existence-census-first; drift throws, never fabricate) ──

const major2024 = (className, majorName) => {
  const hit = (classes2024.find((c) => c.name === className)?.majors || [])
    .find((m) => m.name === majorName);
  if (!hit) throw new Error(`disk drift: 2024 ${className} major '${majorName}' missing from classes.json`);
  return hit;
};
const rangerFeat2024 = (level, featName) => {
  const cl = (classes2024.find((c) => c.name === 'Ranger').class_levels || []).find((x) => x.level === level);
  const feat = (cl?.features || []).find((f) => f.name === featName);
  if (!feat) throw new Error(`disk drift: 2024 Ranger lv${level} '${featName}' missing`);
  return feat;
};
const traitOf = (raceName, traitName, subraceName) => {
  const race = races2024.find((r) => r.name === raceName);
  const list = subraceName
    ? (race?.subraces || []).find((s) => s.name === subraceName)?.traits || []
    : race?.traits || [];
  const hit = list.find((t) => t.name === traitName);
  if (!hit) throw new Error(`disk drift: ${raceName}${subraceName ? '/' + subraceName : ''} trait '${traitName}' missing from 2024 races.json`);
  return hit;
};

// Disk literals — extracted, never retyped (#1362).
const STARS = major2024('Druid', 'Circle of the Stars');
const MOON = major2024('Druid', 'Circle of the Moon');
const ARCHFEY = major2024('Warlock', 'Archfey Patron');
const CELESTIAL = major2024('Warlock', 'Celestial Patron');
const LIFE = major2024('Cleric', 'Life Domain');
const WAR = major2024('Cleric', 'War Domain');
const tirelessDisk = rangerFeat2024(10, 'Tireless');
const veilDisk = rangerFeat2024(14, "Nature's Veil");
const stonecunningDisk = traitOf('Dwarf', 'Stonecunning');
const goliathSub = (subName) => {
  const sub = (races2024.find((r) => r.name === 'Goliath')?.subraces || []).find((s) => s.name === subName);
  if (!sub) throw new Error(`disk drift: Goliath subrace '${subName}' missing from 2024 races.json`);
  return sub;
};
const stonesEnduranceDisk = traitOf('Goliath', "Stone's Endurance", 'Stone Giant');
const stormsThunderDisk = traitOf('Goliath', "Storm's Thunder", 'Storm Giant');

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

const cls = (name, majorName, extra = {}) => ({
  name,
  class_levels: [],
  major: majorName ? { name: majorName } : {},
  subclass: {},
  ...extra,
});
const diskAbilities = (name, bonus) => [{ name, bonus }];
const stepsAutomation = { bonusActions: [{ type: ARCHFEY.features.find((f) => /steps/i.test(f.name)).automation.type }] };

// Row runner (canonical form, siblings #1531/#1532): failure names the row.
function expectPools(stats, keys, expected, label) {
  const result = computeTrackedResources(stats);
  const actual = {};
  const want = {};
  for (const key of keys) {
    actual[key] = result[key];
    want[key] = 'current' in expected ? expected : expected[key];
  }
  expect({ [label]: actual }).toEqual({ [label]: want });
  return result;
}

const OWNED_KEYS = [
  '_Star_Map_freeCastCount', '_Steps_of_the_Fey_freeCastCount',
  'tirelessUses', 'naturesVeilUses', 'stonecunningUses',
  'stonesEnduranceUses', 'stormsThunderUses', 'preserveLifePool',
];

// ── disk census: formula sources + name-space drift, byte-exact ──

describe('disk census (both rulesets, existence-first)', () => {
  it('every gate name + seed formula traced to disk bytes; 5e name-space drift quantified', () => {
    // 2024 grant structure: uses/level/formula per disk row.
    const starMap = STARS.features.find((f) => f.name === 'Star Map');
    expect([starMap.level, starMap.automation.type, starMap.automation.uses_expression])
      .toEqual([3, 'free_spell', 'WIS modifier_min_1']); // -> :316 max(WIS,1), lv>=3
    const steps = ARCHFEY.features.find((f) => f.name === 'Steps of the Fey');
    expect([steps.level, steps.automation.type, steps.automation.uses_expression])
      .toEqual([3, 'steps_of_the_fey', 'CHA modifier_min_1']); // -> :232-233
    const preserve = LIFE.features.find((f) => /preserve life/i.test(f.name));
    expect([preserve.automation.poolExpression, preserve.automation.resourceKey])
      .toEqual(['5 * cleric_level', 'preserveLifePool']); // -> :269-270
    expect([tirelessDisk.level, tirelessDisk.automation.resourceKey, tirelessDisk.description.includes('minimum once')])
      .toEqual([10, 'tirelessUses', true]); // -> :292
    expect([veilDisk.level, veilDisk.automation.resourceKey])
      .toEqual([14, 'naturesVeilUses']); // -> :285
    expect([stonecunningDisk.automation.type, stonecunningDisk.automation.uses])
      .toEqual(['stonecunning', 'proficiency_bonus']); // -> :325
    expect([stonesEnduranceDisk.automation.type, stonesEnduranceDisk.automation.uses, stormsThunderDisk.automation.type, stormsThunderDisk.automation.uses])
      .toEqual(['stones_endurance', 'proficiency_bonus', 'storms_thunder', 'proficiency_bonus']); // -> :328,:331

    // Disk-owner census: giant traits live on GOLIATH subraces, not Hill Dwarf
    // (old suite titles said Hill Dwarf — never retyped here).
    const dwarf = races2024.find((r) => r.name === 'Dwarf');
    expect((dwarf.subraces || []).every((s) => !(s.traits || []).some((t) => /endurance|thunder/i.test(t.name)))).toBe(true);

    // 5e name-space drift (reported): module literals are 2024-major names;
    // 5e disk subclass names never match, and 5e disk Ranger lacks the
    // Tireless/Nature's Veil rows the lv-gates key on.
    const namesIn = (cls5Name) => classes5e.find((c) => c.name === cls5Name).subclasses.map((s) => s.name);
    expect(namesIn('Druid')).toEqual(['Land', 'Moon']);
    expect(namesIn('Warlock')).toEqual(['Fiend', 'The Archfey', 'The Great Old One']);
    expect(namesIn('Cleric')).toEqual(['Life', 'Knowledge', 'Light', 'Nature', 'Tempest', 'Trickery', 'War']);
    const r5lv = classes5e.find((c) => c.name === 'Ranger').class_levels;
    expect(r5lv.find((cl) => cl.level === 10).features.map((f) => f.name)).toEqual(['Hide in Plain Sight', 'Natural Explorer']);
    expect(r5lv.find((cl) => cl.level === 14).features.map((f) => f.name)).toEqual(['Favored Enemy', 'Vanish']);
  });
});

// ── subclass-absent golden + executable channel census ──

describe('subclass channel golden + census', () => {
  it('subclass-absent rows seed every owned key at {0,0}, console untouched, pools fresh; _Star_Map_freeCastCount stays computed-not-registered (gap pinned)', () => {
    const err = vi.spyOn(console, 'error');
    for (const className of ['Druid', 'Ranger', 'Cleric']) {
      // kitchen-sink-absent form: no major/subclass/class_levels keys at all
      const result = computeTrackedResources(basePlayerStats({ class: { name: className } }));
      for (const key of OWNED_KEYS) {
        expect({ [`${className}:${key}`]: result[key] }).toEqual({ [`${className}:${key}`]: { current: 0, max: 0 } });
      }
      // deterministic + fresh object pool per compute (shared-reference mutants)
      const again = computeTrackedResources(basePlayerStats({ class: { name: className } }));
      expect(again).toEqual(result);
      const pools = Object.values(result);
      expect(new Set(pools).size).toBe(pools.length);
    }
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();

    // Executable subclass-channel Venn (direction: produced vs registry):
    // all 8 owned keys seed on every compute; 7 of 8 registered — the gap is
    // exactly _Star_Map_freeCastCount (#1531/#1532 confirmed — computed-not-
    // in-registry). Consequence: the extra override arm (:419) cannot re-add
    // it once absent — pinned in the override table below.
    const venn = computeTrackedResources(basePlayerStats({ class: { name: 'Druid' } }));
    expect(OWNED_KEYS.filter((k) => k in venn)).toEqual(OWNED_KEYS);
    expect(OWNED_KEYS.filter((k) => !ALL_TRACKED_RESOURCES.includes(k)))
      .toEqual(['_Star_Map_freeCastCount']);
    // Registered half, exact: the other seven of the owned eight.
    expect(OWNED_KEYS.filter((k) => ALL_TRACKED_RESOURCES.includes(k)))
      .toEqual(['_Steps_of_the_Fey_freeCastCount', 'tirelessUses', 'naturesVeilUses',
        'stonecunningUses', 'stonesEnduranceUses', 'stormsThunderUses', 'preserveLifePool']);
  });
});

// ── subclass-gated seed tables ──

describe('subclass-gated seeds', () => {
  it('_Star_Map_freeCastCount :316 — Stars lv>=3 gate, max(WIS,1), isDruid gate', () => {
    const druid = (majorName, level, abilities = [], viaSubclass = false) => basePlayerStats({
      rules: '2024',
      level,
      class: cls('Druid', viaSubclass ? undefined : majorName, viaSubclass ? { subclass: { name: majorName } } : {}),
      abilities,
    });
    const rows = [
      ['major Stars lv5 WIS+3', druid(STARS.name, 5, diskAbilities('Wisdom', 3)), { current: 3, max: 3 }],
      ['subclass Stars lv3 boundary WIS+2', druid(STARS.name, 3, diskAbilities('Wisdom', 2), true), { current: 2, max: 2 }],
      ['Stars lv2 -> 0 (below disk lv3 grant)', druid(STARS.name, 2, diskAbilities('Wisdom', 5)), { current: 0, max: 0 }],
      ['Moon lv5 WIS+5 -> 0', druid(MOON.name, 5, diskAbilities('Wisdom', 5)), { current: 0, max: 0 }],
      ['GATE: wizard major Stars -> 0 (isDruid gate)', basePlayerStats({ rules: '2024', level: 5, class: cls('Wizard', STARS.name), abilities: diskAbilities('Wisdom', 5) }), { current: 0, max: 0 }],
      ['WIS entry without bonus -> floor 1', druid(STARS.name, 5, [{ name: 'Wisdom' }]), { current: 1, max: 1 }],
      ['WIS -1 -> floor 1', druid(STARS.name, 5, diskAbilities('Wisdom', -1)), { current: 1, max: 1 }],
      ['no abilities at all -> floor 1', druid(STARS.name, 5), { current: 1, max: 1 }],
    ];
    for (const [label, stats, expected] of rows) expectPools(stats, ['_Star_Map_freeCastCount'], expected, label);
  });

  it('_Steps_of_the_Fey_freeCastCount :231-234 — warlock+Archfey+automation triple gate, max(CHA,1); automation is the lv proxy (no lv gate)', () => {
    const war = (majorName, level, automation, abilities = [], viaSubclass = false) => basePlayerStats({
      rules: '2024',
      level,
      class: cls('Warlock', viaSubclass ? undefined : majorName, viaSubclass ? { subclass: { name: majorName } } : {}),
      automation,
      abilities,
    });
    const rows = [
      ['major Archfey lv5 CHA+3', war(ARCHFEY.name, 5, stepsAutomation, diskAbilities('Charisma', 3)), { current: 3, max: 3 }],
      ['subclass Archfey lv2 + automation -> still seeds (no lv gate; automation proxy)', war(ARCHFEY.name, 2, stepsAutomation, diskAbilities('Charisma', 2), true), { current: 2, max: 2 }],
      ['Archfey, no bonusActions -> 0', war(ARCHFEY.name, 5, undefined), { current: 0, max: 0 }],
      ['Archfey, other bonusAction type -> 0', war(ARCHFEY.name, 5, { bonusActions: [{ type: 'misty_step' }] }, diskAbilities('Charisma', 5)), { current: 0, max: 0 }],
      ['Celestial Patron + steps automation -> 0 (patron gate)', war(CELESTIAL.name, 5, stepsAutomation, diskAbilities('Charisma', 5)), { current: 0, max: 0 }],
      ['GATE: wizard Archfey + automation -> 0 (isWarlock gate)', basePlayerStats({ rules: '2024', level: 5, class: cls('Wizard', ARCHFEY.name), automation: stepsAutomation, abilities: diskAbilities('Charisma', 5) }), { current: 0, max: 0 }],
      ['CHA 0 -> floor 1', war(ARCHFEY.name, 5, stepsAutomation, diskAbilities('Charisma', 0)), { current: 1, max: 1 }],
      ['CHA entry without bonus -> floor 1', war(ARCHFEY.name, 5, stepsAutomation, [{ name: 'Charisma' }]), { current: 1, max: 1 }],
      ['5e near-miss disk name The Archfey -> 0 (gates are 2024 names; drift reported)', basePlayerStats({ rules: '5e', level: 5, class: cls('Warlock', 'The Archfey'), automation: stepsAutomation, abilities: diskAbilities('Charisma', 5) }), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPools(stats, ['_Steps_of_the_Fey_freeCastCount'], expected, label);
  });

  it('Ranger ladder :285-293 — tireless lv>=10 / naturesVeil lv>=14, gate-separated, max(WIS,1), class-gated, RULESET-GATED 2024-only (fix#134 #1533)', () => {
    const ranger = (level, abilities, rules = '2024') => basePlayerStats({ rules, level, class: cls('Ranger', undefined), abilities });
    const both = ['tirelessUses', 'naturesVeilUses'];
    const rows = [
      ['lv10 tireless live, veil still 0 (gate separation)', ranger(10, diskAbilities('Wisdom', 3)), { tirelessUses: { current: 3, max: 3 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['lv9 tireless boundary miss -> 0', ranger(9, diskAbilities('Wisdom', 3)), { tirelessUses: { current: 0, max: 0 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['lv13 veil miss, tireless live', ranger(13, diskAbilities('Wisdom', 5)), { tirelessUses: { current: 5, max: 5 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['lv14 both live WIS+4', ranger(14, diskAbilities('Wisdom', 4)), { tirelessUses: { current: 4, max: 4 }, naturesVeilUses: { current: 4, max: 4 } }],
      ['lv12 WIS 0 -> floor 1', ranger(12, diskAbilities('Wisdom', 0)), { tirelessUses: { current: 1, max: 1 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['lv10 WIS -2 -> floor 1', ranger(10, diskAbilities('Wisdom', -2)), { tirelessUses: { current: 1, max: 1 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['lv10 no Wisdom entry -> floor 1', ranger(10, []), { tirelessUses: { current: 1, max: 1 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['GATE: druid lv15 WIS+5 -> both 0', basePlayerStats({ rules: '2024', level: 15, class: cls('Druid', MOON.name), abilities: diskAbilities('Wisdom', 5) }), { tirelessUses: { current: 0, max: 0 }, naturesVeilUses: { current: 0, max: 0 } }],
      // fix#134 (#1533): disk census — 5e Ranger lv10 rows are 'Hide in
      // Plain Sight'/'Natural Explorer', lv14 rows 'Favored Enemy'/'Vanish'
      // (census test above, bytes). No Tireless/Veil rows in the 5e disk at
      // ANY level -> the seed must be 0. Pre-fix capture: lv15 WIS+2
      // seeded {2,2} (drift row, flipped here).
      ['RULESET-GATED: 5e ranger lv15 -> both 0 (was drift {2,2}; 5e disk has no rows)', ranger(15, diskAbilities('Wisdom', 2), '5e'), { tirelessUses: { current: 0, max: 0 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['RULESET-GATED: 5e ranger lv10 -> tireless 0 (5e disk lv10 has no Tireless)', ranger(10, diskAbilities('Wisdom', 5), '5e'), { tirelessUses: { current: 0, max: 0 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['RULESET-GATED: 5e ranger lv17 -> both 0 (no capstone seed for absent rows)', ranger(17, diskAbilities('Wisdom', 5), '5e'), { tirelessUses: { current: 0, max: 0 }, naturesVeilUses: { current: 0, max: 0 } }],
      ['INVERSE: 2024 lv20 both live WIS+3 (gate stays live for the edition WITH rows)', ranger(20, diskAbilities('Wisdom', 3)), { tirelessUses: { current: 3, max: 3 }, naturesVeilUses: { current: 3, max: 3 } }],
    ];
    for (const [label, stats, expected] of rows) expectPools(stats, both, expected, label);
  });

  it('preserveLifePool :268-270 — cleric+Life Domain 5*level; non-cleric gate; 5e near-miss 0', () => {
    const cle = (majorName, level, viaSubclass = false, rules = '2024') => basePlayerStats({
      rules,
      level,
      class: cls('Cleric', viaSubclass ? undefined : majorName, viaSubclass ? { subclass: { name: majorName } } : {}),
    });
    const rows = [
      ['major Life lv5 -> 25 (disk 5*cleric_level)', cle(LIFE.name, 5), { current: 25, max: 25 }],
      ['subclass Life lv8 -> 40', cle(LIFE.name, 8, true), { current: 40, max: 40 }],
      ['major War lv10 -> 0', cle(WAR.name, 10), { current: 0, max: 0 }],
      ['GATE: druid major Life Domain -> 0 (isCleric gate)', basePlayerStats({ rules: '2024', level: 5, class: cls('Druid', LIFE.name) }), { current: 0, max: 0 }],
      ['level undefined -> 0 (|| 0)', cle(LIFE.name, undefined), { current: 0, max: 0 }],
      ['lv1 -> 5 (no lv gate; channel cost gated in handler)', cle(LIFE.name, 1), { current: 5, max: 5 }],
      ['5e near-miss disk name Life -> 0 (gates are 2024 names; drift reported)', basePlayerStats({ rules: '5e', level: 8, class: cls('Cleric', 'Life') }), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPools(stats, ['preserveLifePool'], expected, label);
  });

  it('ancestral trait gates :319-333 — disk trait bytes, subrace placement flag, automation truthiness, proficiency formula, exact-name match', () => {
    const rows = [
      ['Dwarf Stonecunning (disk) prof 4', basePlayerStats({ race: { name: 'Dwarf', traits: [stonecunningDisk] }, proficiency: 4 }), { stonecunningUses: { current: 4, max: 4 } }],
      ['Stonecunning automation:false / missing -> 0', basePlayerStats({ race: { name: 'Dwarf', traits: [{ name: stonecunningDisk.name, automation: false }, { name: stonecunningDisk.name }] }, proficiency: 4 }), { stonecunningUses: { current: 0, max: 0 } }],
      ['lowercase near-miss stonecunning -> 0 (exact match)', basePlayerStats({ race: { name: 'Dwarf', traits: [{ name: stonecunningDisk.name.toLowerCase(), automation: stonecunningDisk.automation }] }, proficiency: 4 }), { stonecunningUses: { current: 0, max: 0 } }],
      ['Stone Giant (disk) prof 3 — endurance live, thunder 0 (cross-key separation)', basePlayerStats({ race: { name: 'Goliath', traits: [], subrace: { name: 'Stone Giant', traits: goliathSub('Stone Giant').traits } }, proficiency: 3 }), { stonesEnduranceUses: { current: 3, max: 3 }, stormsThunderUses: { current: 0, max: 0 } }],
      ['Storm Giant (disk) prof 3 — thunder live, endurance 0', basePlayerStats({ race: { name: 'Goliath', traits: [], subrace: { name: 'Storm Giant', traits: goliathSub('Storm Giant').traits } }, proficiency: 3 }), { stonesEnduranceUses: { current: 0, max: 0 }, stormsThunderUses: { current: 3, max: 3 } }],
      ["placement: Stone's Endurance on race.traits (not subrace) -> 0 (fromSubrace flag)", basePlayerStats({ race: { name: 'Goliath', traits: [{ name: stonesEnduranceDisk.name, automation: stonesEnduranceDisk.automation }] }, proficiency: 3 }), { stonesEnduranceUses: { current: 0, max: 0 } }],
      ['subrace missing -> both 0', basePlayerStats({ race: { name: 'Goliath', traits: [] }, proficiency: 3 }), { stonesEnduranceUses: { current: 0, max: 0 }, stormsThunderUses: { current: 0, max: 0 } }],
      ['race missing -> all 0', basePlayerStats(), { stonecunningUses: { current: 0, max: 0 }, stonesEnduranceUses: { current: 0, max: 0 }, stormsThunderUses: { current: 0, max: 0 } }],
      ['trait present, proficiency undefined -> 0 (|| 0)', basePlayerStats({ race: { name: 'Dwarf', traits: [stonecunningDisk] } }), { stonecunningUses: { current: 0, max: 0 } }],
    ];
    for (const [label, stats, expected] of rows) expectPools(stats, Object.keys(expected), expected, label);
  });
});

// ── applyServerOverride extra arms (:419-423) — registry-add half, NOT the
//    computed-key merge contract (base lane owns that) ──

describe('applyServerOverride extra arms (:419-423)', () => {
  it('full-set: registry-key adds ({0,0}, {2,2}, subclass key), null preserves absence, unknown ignored, _Star_Map_freeCastCount not re-addable (registry gap), non-object fresh copies, inputs pure', () => {
    const computed = {
      hitPoints: { current: 20, max: 20 },
      _Star_Map_freeCastCount: { current: 3, max: 3 },
      tirelessUses: { current: 2, max: 6 },
    };
    const snapshot = JSON.parse(JSON.stringify(computed));
    const result = applyServerOverride(computed, {
      _Star_Map_freeCastCount: 7,   // computed key NOT in registry: override arm only (:415-418), max preserved
      tirelessUses: 1,               // computed registry key: current-only override
      stonecunningUses: 2,          // registry, computed-absent -> ADDED {2,2} (:419-421)
      _Steps_of_the_Fey_freeCastCount: 4, // subclass registry member added (:68)
      naturesVeilUses: 0,           // :0-vs-absent quantified — 0 IS added
      sorceryPoints: null,          // null for new tracked key -> stays absent (:420)
      totallyUnknownKey: 99,        // not in registry -> ignored (:419)
    });
    expect(result).toEqual({
      hitPoints: { current: 20, max: 20 },
      _Star_Map_freeCastCount: { current: 7, max: 3 },
      tirelessUses: { current: 1, max: 6 },
      stonecunningUses: { current: 2, max: 2 },
      _Steps_of_the_Fey_freeCastCount: { current: 4, max: 4 },
      naturesVeilUses: { current: 0, max: 0 },
    });
    expect(result.sorceryPoints).toBeUndefined();
    expect(result.totallyUnknownKey).toBeUndefined();
    // The registry gap has an owner-side consequence: _Star_Map free-cast can be
    // OVERRIDDEN but never RE-ADDED once absent from computed.
    expect(applyServerOverride({}, { _Star_Map_freeCastCount: 5 })).toEqual({});

    // Purity: input never mutated; untouched entries shared; touched entries fresh.
    expect(computed).toEqual(snapshot);
    expect(result).not.toBe(computed);
    expect(result.hitPoints).toBe(computed.hitPoints);
    expect(result.tirelessUses).not.toBe(computed.tirelessUses);

    // Non-object serverData (:412): fresh shallow copy of computed, same entries.
    for (const junk of ['not an object', null, undefined, 42]) {
      const out = applyServerOverride(computed, junk);
      expect(out).toEqual(computed);
      expect(out).not.toBe(computed);
      expect(out.hitPoints).toBe(computed.hitPoints);
    }
  });
});
