// CLA-308 regression: Shadow Arts (2024 Warrior of Shadow lv3 Monk).
// The Monk class/major has NO spellcasting table, so getSpellAbilities must create a
// SLOTLESS spellAbilities container (no spell_slots_level_* keys — the half-caster
// fallback would wrongly grant the lv17 Monk 4×L1/3×L2/3×L3 slots) with the four
// major.spells (Darkness, Darkvision, Pass Without Trace, Silence) stamped prepared
// 'Always' + _shadowArtsFreeCast + spellCastingAbility WIS, surviving the slot-level
// filter with no slots at all. saveDc must come from Wisdom (8 + 4 + PB6 = 18),
// never the DC 10 fallback (CLA-277 family).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

// ── Fixtures ──

const SHADOW_ARTS_SPELLS = [
  { name: 'Darkness', level: 2 },
  { name: 'Darkvision', level: 2 },
  { name: 'Pass Without Trace', level: 2 },
  { name: 'Silence', level: 2 },
];

function makeShadowArtsPassive() {
  return {
    type: 'shadow_arts',
    name: 'Shadow Arts',
    effect: 'shadow_arts',
    casting_time: 'passive',
    hasAutomation: true,
    freeCastSpells: SHADOW_ARTS_SPELLS.map(s => s.name),
    usesMax: 1,
    recharge: 'long_rest',
    saveAbility: 'WIS',
  };
}

function makeWarriorOfShadowMajor() {
  return {
    name: 'Warrior of Shadow',
    features: [
      { name: 'Shadow Arts', description: 'You can cast the Darkness, Darkvision, Pass Without Trace, and Silence spells without expending spell slots or preparing them, using Wisdom as your spellcasting ability. Each of these spells can be cast in this way once per Long Rest.', level: 3 },
      { name: 'Shadow Step', description: 'teleport', level: 6 },
    ],
    spells: SHADOW_ARTS_SPELLS,
  };
}

function makeSpellDetail(name, level, extra = {}) {
  return {
    name,
    level,
    casting_time: '1 action',
    range: 'Self',
    damage: null,
    ritual: false,
    school: 'Evocation',
    description: [`<p>${name} spell text.</p>`],
    ...extra,
  };
}

function makeAllSpells() {
  return [
    ...SHADOW_ARTS_SPELLS.map(s => makeSpellDetail(s.name, s.level)),
    makeSpellDetail('Fire Bolt', 0),
    makeSpellDetail('Magic Missile', 1),
    makeSpellDetail('Haste', 3),
  ];
}

function makeMonkStats({ level = 17, major = makeWarriorOfShadowMajor(), automation = null, spells = [] } = {}) {
  return {
    name: 'Disciplined_Monk',
    level,
    rules: '2024',
    proficiency: level >= 17 ? 6 : 5,
    class: {
      name: 'Monk',
      spell_casting_ability: 'Wisdom',
      major,
    },
    spells,
    abilities: [
      { name: 'Strength', bonus: 1 },
      { name: 'Dexterity', bonus: 3 },
      { name: 'Wisdom', bonus: 4 },
    ],
    automation: automation || { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

function makeShadowArtsAutomation() {
  return { actions: [], bonusActions: [], specialActions: [], passives: [makeShadowArtsPassive()] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('spellCalc2024 — CLA-308 Shadow Arts (Warrior of Shadow)', () => {
  it('creates a slotless spellAbilities container for the non-casting Monk with the shadow_arts passive', () => {
    const stats = makeMonkStats({ automation: makeShadowArtsAutomation() });
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    expect(abilities).toBeTruthy();
    // Slotless — "without expending spell slots": no slot table keys at all.
    for (let lv = 1; lv <= 9; lv++) {
      expect(abilities[`spell_slots_level_${lv}`]).toBeUndefined();
    }
    expect(abilities.cantrips_known).toBe(0);
  });

  it('stamps the four Shadow Arts spells prepared Always with _shadowArtsFreeCast + WIS casting ability', () => {
    const stats = makeMonkStats({ automation: makeShadowArtsAutomation() });
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    for (const spellName of ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence']) {
      const entry = abilities.spells.find(s => s.name === spellName);
      expect(entry, `${spellName} should surface in spellAbilities.spells`).toBeTruthy();
      expect(entry.prepared).toBe('Always');
      expect(entry.level).toBe(2);
      expect(entry._shadowArtsFreeCast).toBe(true);
      expect(entry.spellCastingAbility).toBe('WIS');
    }
  });

  it('never drops the free casts in the slot-level filter (no slot table exists)', () => {
    const stats = makeMonkStats({ automation: makeShadowArtsAutomation() });
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    expect(abilities.spells.filter(s => s._shadowArtsFreeCast).length).toBe(4);
  });

  it('computes saveDc 18 from Wisdom (8 + WIS 4 + PB 6), never the DC 10 fallback', () => {
    const stats = makeMonkStats({ automation: makeShadowArtsAutomation() });
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    expect(abilities.spellCastingAbility).toBe('Wisdom');
    expect(abilities.modifier).toBe(4);
    expect(abilities.saveDc).toBe(18);
    expect(abilities.saveDc).not.toBe(10);
  });

  it('never grants the half-caster slot fallback even if spells were persisted', () => {
    const stats = makeMonkStats({
      automation: makeShadowArtsAutomation(),
      spells: ['Darkness', 'Silence', 'Haste'],
    });
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    for (let lv = 1; lv <= 9; lv++) {
      expect(abilities[`spell_slots_level_${lv}`]).toBeUndefined();
    }
  });

  it('returns null for a non-casting Monk WITHOUT the shadow_arts passive (control)', () => {
    const stats = makeMonkStats({ major: { name: 'Warrior of the Open Hand', features: [], spells: [] } });
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    expect(abilities).toBeNull();
  });
});
