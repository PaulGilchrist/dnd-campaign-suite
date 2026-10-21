// @maintained-by-ai
// CLA-050 regression: Circle of the Land spells (2024 Druid, passive).
// After each Long Rest the druid chooses one land type; the chosen land's
// spells are always-prepared AT THEIR FIXED classes.json LEVELS (arid:
// Blur/Burning Hands/Fire Bolt at 3, Fireball at 5, Blight at 7, Wall of
// Stone at 9) — not at their spells-DB canonical levels. The fixed level must
// survive the spells-DB detail remap in finalizeSpellRows via
// _circleOfTheLandFixedLevel so display, slot cost and damage formula all
// resolve at the stamped level (Fire Bolt is a level 3 row, not a Cantrip).
//
// Fixtures are read straight from disk (public/data/2024/classes.json +
// spells.json) — no hand-transcribed circle table (per #1264 fixture drift).
// Adjacent CLA-050 lanes live elsewhere and are NOT re-pinned here:
// damage-formula resolution — spellDamageUtils.test.js; fixed-level upcast
// picker — useSpellUpcastFlow.cla050-fixed-level.test.js; capitalised modal
// write contract for '_circleOfTheLandType' — CircleOfTheLandSpellsModal
// .test.jsx; long-rest re-choose clear — restRules-longRest.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';
import classes2024 from '../../../../public/data/2024/classes.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

const runtimeStore = vi.hoisted(() => ({}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeStore[`${name}:${key}`] ?? null),
}));

// ── Disk fixtures ──
const druidClass = classes2024.find(c => c.name === 'Druid');
const landMajor = druidClass.majors.find(m => m.name === 'Circle of the Land');
const seaMajor = druidClass.majors.find(m => m.name === 'Circle of the Sea');
const classLevels = druidClass.class_levels; // index = level - 1
const CANONICAL_LEVELS = Object.fromEntries(spells2024.map(s => [s.name, s.level]));

// Sanity: every land spell's fixed level must differ from its spells-DB
// canonical level, otherwise the remap-survival pins below go vacuous.
for (const spell of landMajor.spells) {
  if (CANONICAL_LEVELS[spell.name] === spell.level) {
    throw new Error(`CLA-050 fixture degenerate: ${spell.name} fixed level equals canonical`);
  }
}

const maxSlotAt = (level) => {
  const casting = classLevels[level - 1].spellcasting;
  for (let i = 9; i >= 1; i--) {
    if ((casting[`spell_slots_level_${i}`] || 0) > 0) return i;
  }
  return 0;
};

// Exact rows the sheet must show for a druid of this level on this land:
// feature gate (spell level <= druid level) AND slot-level filter
// (fixed level <= highest slot held), sorted like finalizeSpellRows.
const expectedLandRows = (landType, druidLevel) =>
  landMajor.spells
    .filter(s => s.landType === landType && s.level <= druidLevel && s.level <= maxSlotAt(druidLevel))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

function makeDruidStats(level, major) {
  return {
    name: 'Wild_Sage_Druid',
    level,
    rules: '2024',
    proficiency: 2 + Math.floor((level - 1) / 4),
    class: {
      name: 'Druid',
      spell_casting_ability: druidClass.spell_casting_ability,
      class_levels: classLevels,
      major,
    },
    spells: [],
    abilities: [
      { name: 'Strength', bonus: -1 },
      { name: 'Wisdom', bonus: 3 },
    ],
    automation: { actions: [], bonusActions: [], passives: [], specialActions: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(runtimeStore)) delete runtimeStore[key];
});

describe('spellCalc2024 — CLA-050 Circle of the Land fixed granted levels', () => {
  it('grants no circle spells before a land type is chosen', () => {
    const abilities = getSpellAbilities(spells2024, makeDruidStats(5, landMajor), {});
    expect(abilities.spells).toEqual([]);
  });

  // Exact per-tier unlock rows from disk classes.json for each land type:
  // lv3 druid holds no lv3 slot yet (4/2) so the stamped lv3 trio is
  // slot-filtered; lv5 unlocks the lv3 trio (Fire Bolt a level-3 row, not
  // the canonical Cantrip); lv9/13/17 unlock lv5/7/9 spells. Row-set
  // equality also falsifies cross-land leakage — choosing Arid must never
  // surface Polar/temperate/tropical spells and vice versa. The runtime key
  // is written CAPITALISED as the spells modal does; the calc lowercases it.
  it.each(['arid', 'polar'].flatMap(landType =>
    [3, 5, 9, 13, 17].map(druidLevel => [landType, druidLevel])
  ))('%s land at druid lv%i surfaces exactly its fixed-level rows', (landType, druidLevel) => {
    runtimeStore[`Wild_Sage_Druid:_circleOfTheLandType`] = landType[0].toUpperCase() + landType.slice(1);
    const abilities = getSpellAbilities(spells2024, makeDruidStats(druidLevel, landMajor), {});
    const expected = expectedLandRows(landType, druidLevel);

    expect(abilities.spells.map(s => s.name)).toEqual(expected.map(s => s.name));
    expected.forEach(({ name, level: fixedLevel }, i) => {
      const row = abilities.spells[i];
      expect(row.prepared, `${name} always-prepared`).toBe('Always');
      expect(row._circleOfTheLandFixedLevel, `${name} stamp`).toBe(fixedLevel);
      expect(row.level, `${name} survives the spells-DB remap at fixed level`).toBe(fixedLevel);
      expect(row.level).not.toBe(CANONICAL_LEVELS[name]);
    });
  });

  it('non-Land major (Circle of the Sea) never stamps fixed levels and ignores the land choice', () => {
    runtimeStore['Wild_Sage_Druid:_circleOfTheLandType'] = 'Arid';
    const abilities = getSpellAbilities(spells2024, makeDruidStats(5, seaMajor), {});
    // Sea spells unlock by classes.json level but cast at canonical DB levels
    // (no fixed stamp), so the slot filter applies at the canonical level —
    // the lv5-scheduled Lightning Bolt (canon lv3) stays castable at lv5.
    const expected = seaMajor.spells
      .filter(s => s.level <= 5 && CANONICAL_LEVELS[s.name] <= maxSlotAt(5))
      .map(s => ({ name: s.name, level: CANONICAL_LEVELS[s.name] }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

    expect(abilities.spells.map(s => [s.name, s.level])).toEqual(expected.map(s => [s.name, s.level]));
    for (const row of abilities.spells) {
      expect(row, `${row.name} must not carry the Land stamp`).not.toHaveProperty('_circleOfTheLandFixedLevel');
    }
  });
});
