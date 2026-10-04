// CLA-050 regression: Circle of the Land spells (2024 Druid lv3, passive).
// After each Long Rest the druid chooses one land type; the chosen land's
// spells are always-prepared AT THEIR FIXED classes.json LEVELS (arid:
// Blur/Burning Hands/Fire Bolt at 3, Fireball at 5, Blight at 7, Wall of
// Stone at 9) — not at their spells-DB canonical levels. The fixed level must
// survive the spells-DB detail remap in finalizeSpellRows via
// _circleOfTheLandFixedLevel so display, slot cost and damage formula all
// resolve at the stamped level (Fire Bolt is a level 3 row, not a Cantrip).
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

const runtimeStore = vi.hoisted(() => ({}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeStore[`${name}:${key}`] ?? null),
}));

// ── Fixtures (levels mirror public/data/2024/classes.json Circle of the Land) ──

const ARID_SPELLS = [
  { name: 'Blur', level: 3, landType: 'arid' },
  { name: 'Burning Hands', level: 3, landType: 'arid' },
  { name: 'Fire Bolt', level: 3, landType: 'arid' },
  { name: 'Fireball', level: 5, landType: 'arid' },
  { name: 'Blight', level: 7, landType: 'arid' },
  { name: 'Wall of Stone', level: 9, landType: 'arid' },
];

const POLAR_SPELLS = [
  { name: 'Fog Cloud', level: 3, landType: 'polar' },
  { name: 'Hold Person', level: 3, landType: 'polar' },
  { name: 'Ray of Frost', level: 3, landType: 'polar' },
];

// Canonical spells-DB levels deliberately DIFFER from the fixed land levels
// (Fire Bolt cantrip→3, Burning Hands 1→3, Blur 2→3, Fireball 3→5,
// Blight 4→7, Wall of Stone 5→9).
const CANONICAL_LEVELS = {
  'Blur': 2,
  'Burning Hands': 1,
  'Fire Bolt': 0,
  'Fireball': 3,
  'Blight': 4,
  'Wall of Stone': 5,
  'Fog Cloud': 1,
  'Hold Person': 2,
  'Ray of Frost': 0,
};

function slotLadder(base, perLevel = 1) {
  const ladder = {};
  for (let lv = base; lv <= 9; lv++) {
    const dice = 1 + (lv - base) * perLevel;
    ladder[lv] = `${dice}d8`;
  }
  return ladder;
}

function makeSpellDetail(name) {
  const level = CANONICAL_LEVELS[name];
  if (level == null) throw new Error(`fixture missing canonical level for ${name}`);
  const detail = {
    name,
    level,
    casting_time: '1 action',
    range: 'Self',
    damage: null,
    ritual: false,
    school: 'Evocation',
    description: [`<p>${name} spell text.</p>`],
  };
  if (name === 'Fire Bolt') {
    detail.casting_time = '1 action';
    detail.range = '120 feet';
    detail.attack_type = 'ranged';
    detail.damage = { damage_type: 'Fire', damage_at_slot_level: { 0: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' } };
  } else if (name === 'Ray of Frost') {
    detail.attack_type = 'ranged';
    detail.damage = { damage_type: 'Cold', damage_at_slot_level: { 0: '1d8', 5: '2d8', 11: '3d8', 17: '4d8' } };
  } else if (['Burning Hands', 'Fireball', 'Blight'].includes(name)) {
    detail.attack_type = undefined;
    detail.range = name === 'Burning Hands' ? 'Self (15-foot cone)' : '150 feet';
    detail.damage = {
      damage_type: name === 'Blight' ? 'Necrotic' : 'Fire',
      damage_at_slot_level: slotLadder(Math.max(level, 1)),
      dc: { dc_type: 'Dexterity', dc_success: 'half' },
    };
    detail.dc = { dc_type: name === 'Blight' ? 'Constitution' : 'Dexterity', dc_success: 'half' };
  }
  return detail;
}

function makeAllSpells() {
  return [...ARID_SPELLS, ...POLAR_SPELLS].map(s => makeSpellDetail(s.name));
}

function makeCircleOfTheLandMajor() {
  return {
    name: 'Circle of the Land',
    type: 'arid',
    features: [
      {
        name: 'Circle of the Land Spells',
        level: 3,
        description: 'Choose one land type (arid, polar, temperate, tropical) after each Long Rest.',
        automation: { type: 'circle_of_the_land_spells', casting_time: 'passive' },
      },
    ],
    spells: [...ARID_SPELLS, ...POLAR_SPELLS],
    spellcasting: {
      spellCastingAbility: 'Wisdom',
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 3,
      spell_slots_level_4: 3,
      spell_slots_level_5: 3,
      spell_slots_level_6: 2,
      spell_slots_level_7: 2,
      spell_slots_level_8: 1,
      spell_slots_level_9: 1,
    },
  };
}

function makeDruidStats({ level = 20 } = {}) {
  return {
    name: 'Wild_Sage_Druid',
    level,
    rules: '2024',
    proficiency: 6,
    class: {
      name: 'Druid',
      spell_casting_ability: 'Wisdom',
      major: makeCircleOfTheLandMajor(),
    },
    spells: [],
    abilities: [
      { name: 'Strength', bonus: -1 },
      { name: 'Wisdom', bonus: 3 },
    ],
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(runtimeStore)) delete runtimeStore[key];
});

describe('spellCalc2024 — CLA-050 Circle of the Land fixed granted levels', () => {
  it('grants nothing before a land type is chosen', () => {
    const abilities = getSpellAbilities(makeAllSpells(), makeDruidStats(), {});
    for (const spell of [...ARID_SPELLS, ...POLAR_SPELLS]) {
      expect(abilities.spells.find(s => s.name === spell.name)).toBeUndefined();
    }
  });

  it('grants exactly the chosen land spells at their FIXED classes.json levels, surviving the detail remap', () => {
    runtimeStore['Wild_Sage_Druid:_circleOfTheLandType'] = 'Arid';
    const abilities = getSpellAbilities(makeAllSpells(), makeDruidStats(), {});
    const fixedBySpell = Object.fromEntries(ARID_SPELLS.map(s => [s.name, s.level]));
    for (const [spellName, fixedLevel] of Object.entries(fixedBySpell)) {
      const row = abilities.spells.find(s => s.name === spellName);
      expect(row, `${spellName} should surface after choosing Arid`).toBeTruthy();
      expect(row.prepared).toBe('Always');
      expect(row._circleOfTheLandFixedLevel).toBe(fixedLevel);
      expect(row.level, `${spellName} row level`).toBe(fixedLevel);
    }
  });

  it('never renders the granted Fire Bolt as a Cantrip row (fixed level 3)', () => {
    runtimeStore['Wild_Sage_Druid:_circleOfTheLandType'] = 'Arid';
    const abilities = getSpellAbilities(makeAllSpells(), makeDruidStats(), {});
    const fireBolt = abilities.spells.find(s => s.name === 'Fire Bolt');
    expect(fireBolt.level).toBe(3);
    expect(fireBolt.level).not.toBe(CANONICAL_LEVELS['Fire Bolt']);
  });

  it('filters out spells of the other land types', () => {
    runtimeStore['Wild_Sage_Druid:_circleOfTheLandType'] = 'Arid';
    const abilities = getSpellAbilities(makeAllSpells(), makeDruidStats(), {});
    for (const spell of POLAR_SPELLS) {
      expect(abilities.spells.find(s => s.name === spell.name)).toBeUndefined();
    }
  });

  it('keeps the fixed lv9 Wall of Stone row for a lv20 druid (slot-level filter)', () => {
    runtimeStore['Wild_Sage_Druid:_circleOfTheLandType'] = 'Arid';
    const abilities = getSpellAbilities(makeAllSpells(), makeDruidStats({ level: 20 }), {});
    expect(abilities.spells.find(s => s.name === 'Wall of Stone').level).toBe(9);
    expect(abilities.spells.find(s => s.name === 'Blight').level).toBe(7);
  });

  it('does not stamp fixed levels for a non-Circle-of-the-Land major', () => {
    const stats = makeDruidStats();
    stats.class.major = {
      name: 'Circle of the Sea',
      features: [],
      spells: [{ name: 'Blur', level: 3 }],
      spellcasting: makeCircleOfTheLandMajor().spellcasting,
    };
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    const blur = abilities.spells.find(s => s.name === 'Blur');
    expect(blur).toBeTruthy();
    expect(blur._circleOfTheLandFixedLevel).toBeUndefined();
    expect(blur.level).toBe(CANONICAL_LEVELS['Blur']);
  });
});
