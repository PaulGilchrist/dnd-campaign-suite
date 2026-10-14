import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, _prop) => null),
}));

// CLA-272: Aberrant Sorcery psionic grant — tier gating via major.spells[].level
// (char-unlock tiers 3/5/7/9) and spells-DB name resolution guard.

const PSIONIC_TIER_SPELLS = [
  { name: 'Arms of Hadar', level: 3 },
  { name: 'Calm Emotions', level: 3 },
  { name: 'Detect Thoughts', level: 3 },
  { name: 'Dissonant Whispers', level: 3 },
  { name: 'Mind Sliver', level: 3 },
  { name: 'Hunger of Hadar', level: 5 },
  { name: 'Sending', level: 5 },
  { name: "Evard's Black Tentacles", level: 7 },
  { name: 'Summon Aberration', level: 7 },
  { name: "Rary's Telepathic Bond", level: 9 },
  { name: 'Telekinesis', level: 9 },
];

const PSIONIC_NAMES = PSIONIC_TIER_SPELLS.map(s => s.name);

const SPELL_DB_LEVELS = {
  'Mind Sliver': 0,
  'Dissonant Whispers': 1,
  'Arms of Hadar': 2,
  'Calm Emotions': 2,
  'Detect Thoughts': 2,
  'Hunger of Hadar': 3,
  'Sending': 3,
  "Evard's Black Tentacles": 4,
  'Summon Aberration': 4,
  "Rary's Telepathic Bond": 5,
  'Telekinesis': 5,
};

function makeSpell(name, level = 0) {
  return { name, level, damage: {}, casting_time: '1 action', range: 'Self' };
}

function makeAllSpells() {
  return Object.entries(SPELL_DB_LEVELS).map(([name, level]) => makeSpell(name, level));
}

const FULL_CASTER_SLOTS = [
  { 1: 2 },
  { 1: 3 },
  { 1: 4, 2: 2 },
  { 1: 4, 2: 3 },
  { 1: 4, 2: 3, 3: 2 },
  { 1: 4, 2: 3, 3: 3 },
  { 1: 4, 2: 3, 3: 3, 4: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
];

function sorcererClassLevels(level) {
  const levels = [];
  for (let l = 1; l <= level; l++) {
    const spellcasting = { cantrips_known: 4 };
    for (let i = 1; i <= 9; i++) {
      spellcasting[`spell_slots_level_${i}`] = FULL_CASTER_SLOTS[l - 1]?.[i] || 0;
    }
    levels.push({ level: l, spellcasting });
  }
  return levels;
}

function makeAberrantSorcerer(level) {
  return {
    name: 'AberrantSorcerer',
    level,
    proficiency: 3,
    class: {
      name: 'Sorcerer',
      class_levels: sorcererClassLevels(level),
      spell_casting_ability: 'Charisma',
      major: {
        name: 'Aberrant Sorcery',
        spells: PSIONIC_TIER_SPELLS,
        features: [
          { name: 'Psionic Spells' },
          { name: 'Telepathic Speech' },
        ],
      },
    },
    abilities: [
      { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
    ],
    spells: [],
    automation: {
      passives: [
        { type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: [...PSIONIC_NAMES] },
      ],
    },
  };
}

describe('spellCalc2024 psionic_spells_list tier gating (CLA-272)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('grants only tier<=level psionic spells at lv6 (7 spells) with no undefined-level rows', () => {
    const result = getSpellAbilities(makeAllSpells(), makeAberrantSorcerer(6));

    expect(result).not.toBeNull();
    const psionicRows = result.spells.filter(s => PSIONIC_NAMES.includes(s.name));
    expect(psionicRows.map(s => s.name).sort()).toEqual([
      'Arms of Hadar',
      'Calm Emotions',
      'Detect Thoughts',
      'Dissonant Whispers',
      'Hunger of Hadar',
      'Mind Sliver',
      'Sending',
    ].sort());
    expect(psionicRows.some(s => s.name === "Evard's Black Tentacles")).toBe(false);
    expect(psionicRows.some(s => s.level === undefined)).toBe(false);
    psionicRows.forEach(s => expect(s.prepared).toBe('Always'));
  });

  it('grants Evard\'s Black Tentacles at lv7 as a castable lv4 spell with a lv4 slot', () => {
    const result = getSpellAbilities(makeAllSpells(), makeAberrantSorcerer(7));

    const evard = result.spells.find(s => s.name === "Evard's Black Tentacles");
    expect(evard).toBeDefined();
    expect(evard.level).toBe(4);
    expect(evard.prepared).toBe('Always');
    expect(result.spell_slots_level_4).toBe(1);
  });

  it('grants 9 psionic spells at lv8 (tiers 3/5/7 unlocked) all with defined levels', () => {
    const result = getSpellAbilities(makeAllSpells(), makeAberrantSorcerer(8));

    const psionicRows = result.spells.filter(s => PSIONIC_NAMES.includes(s.name));
    expect(psionicRows).toHaveLength(9);
    expect(psionicRows.some(s => s.name === "Evard's Black Tentacles")).toBe(true);
    expect(psionicRows.some(s => s.name === 'Summon Aberration')).toBe(true);
    expect(psionicRows.some(s => s.name === "Rary's Telepathic Bond")).toBe(false);
    expect(psionicRows.some(s => s.name === 'Telekinesis')).toBe(false);
    expect(psionicRows.some(s => s.level === undefined)).toBe(false);
  });

  it('skips unresolvable spell names with console.error instead of pushing blank-level rows', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stats = makeAberrantSorcerer(6);
    stats.automation.passives[0].psionicSpells = ['Mind Sliver', 'Evar\'s Black Tentacles'];

    const result = getSpellAbilities(makeAllSpells(), stats);

    expect(result.spells.some(s => s.name === 'Evar\'s Black Tentacles')).toBe(false);
    expect(result.spells.some(s => s.name === 'Mind Sliver')).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
