// @maintained-by-ai
/**
 * Durable rules-data pin for the 5e spell-data completeness pass (2026-11-19).
 *
 * public/data/spells.json once lacked five SRD-5.1 staples that the 2024 table
 * carries (Hex, Chromatic Orb, Blade Ward, Mind Sliver, Tasha's Hideous
 * Laughter), so a 5e warlock had no Hex and 2024→5e wizard switches truthfully
 * dropped those names. This suite locks:
 *  1. the five rows EXIST by canonical name with the canonical 5e row shape
 *     (same field set/order as sibling rows, NO 2024-shape fields);
 *  2. their SRD-5.1 rules face (level/school/casting/range/components/
 *     material/duration/concentration/save+damage dialects) and the canonical
 *     class lists the wizard/spell-step lanes read (spell.classes);
 *  3. the old 5e twins stay GONE (bare 'Hideous Laughter'/'hideous-laughter'
 *     migrated to the canonical name — the retired compat literal at
 *     triggerSpells.js is pinned rejecting in spellCastService.special.test.js);
 *  4. classes.json reachability for the lane this pass fixed: the Great Old
 *     One 'tashas-hideous-laughter' reference resolves against the 5e table
 *     by BOTH name and index (pre-existing unrelated dangling refs, e.g. the
 *     'Dissonant Wispers' typo, are carried, not re-litigated here).
 *
 * Disk-read style mirrors spellPreparationService.quickRitual.test.js:
 * readFileSync + drift-throw, so future authored-data edits trip here loudly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const readDisk = (rel) => JSON.parse(readFileSync(resolve(process.cwd(), rel), 'utf8'));
const spells5e = readDisk('public/data/spells.json');
const classes5e = readDisk('public/data/classes.json');

const byName = new Map(spells5e.map(s => [s.name, s]));
const byIndex = new Map(spells5e.map(s => [s.index, s]));

// The canonical 5e row shape (dnd-5e-api lineage). Optional keys are asserted
// per-spell below. 2024 rows are distinguishable by SHAPE — explicit `null`
// paddings (attack_type/damage/material/area_of_effect), 'Concentration, up
// to …' durations and TitleCase casting times ('Action') — none of which may
// appear on a 5e row.
const CANONICAL_5E_KEYS = [
  'index', 'name', 'description', 'higher_level', 'range', 'components',
  'material', 'ritual', 'duration', 'concentration', 'casting_time', 'level',
  'attack_type', 'damage', 'dc', 'area_of_effect', 'school', 'classes', 'subclasses',
];
const REQUIRED_5E_KEYS = [
  'index', 'name', 'description', 'range', 'components', 'ritual', 'duration',
  'concentration', 'casting_time', 'level', 'school', 'classes', 'subclasses',
];

function expectRowShape(row) {
  expect(row).toBeDefined();
  const unknown = Object.keys(row).filter(k => !CANONICAL_5E_KEYS.includes(k));
  expect(unknown, `${row.name}: non-canonical 5e keys`).toStrictEqual([]);
  for (const key of REQUIRED_5E_KEYS) {
    expect(row, `${row.name} missing ${key}`).toHaveProperty(key);
  }
  // 2024-shape never rides a 5e row: no null paddings, 5e casting dialect,
  // concentration expressed by the boolean + plain duration string.
  const nulls = Object.entries(row).filter(([, v]) => v === null).map(([k]) => k);
  expect(nulls, `${row.name}: 2024-style null paddings`).toStrictEqual([]);
  expect(row.casting_time).toMatch(/^(\d+ (action|bonus action|reaction)|\d+ (minutes?|hours?))$/); // golden 5e dialect
  expect(row.duration).not.toMatch(/^Concentration,/);
  expect(row.components).not.toContain('M '); // material note lives in `material`, never inlined
  if (row.components.includes('M')) expect(typeof row.material).toBe('string');
  expect(Array.isArray(row.description)).toBe(true);
  expect(row.description.length).toBe(1); // house style: ONE <br/><br/>-joined paragraph string
  expect(row.index).toBe(row.index.toLowerCase()); // lowercase-hyphen sibling format
  expect(Array.isArray(row.classes)).toBe(true);
  expect(Array.isArray(row.subclasses)).toBe(true);
}

describe('5e spell-data completeness pass: the five SRD staples', () => {
  it('all five rows are present, uniquely named, and conform to the canonical 5e row shape', () => {
    const names = spells5e.map(s => s.name);
    expect(names.length).toBe(new Set(names).size); // zero duplicate names file-wide
    for (const name of ['Hex', 'Chromatic Orb', 'Blade Ward', 'Mind Sliver', "Tasha's Hideous Laughter"]) {
      expect(names.filter(n => n === name), `${name} occurrence count`).toHaveLength(1);
      expectRowShape(byName.get(name));
    }
  });

  it('the migrated twins stay gone: no bare Hideous Laughter row in either byte form', () => {
    expect(byName.get('Hideous Laughter')).toBeUndefined();
    expect(byIndex.get('hideous-laughter')).toBeUndefined();
  });

  it('Hex — Warlock-only enchantment cantrip-scaled curse (1 bonus action, concentration, 1h)', () => {
    const hex = byName.get('Hex');
    expect(hex.index).toBe('hex');
    expect(hex).toMatchObject({
      level: 1,
      school: 'Enchantment',
      casting_time: '1 bonus action',
      range: '90 feet',
      components: ['V', 'S', 'M'],
      material: 'The petrified eye of a newt.',
      duration: 'Up to 1 hour',
      concentration: true,
      ritual: false,
      classes: ['Warlock'],
    });
    expect(hex.description[0]).toContain('extra 1d6 necrotic damage');
    expect(hex.higher_level[0]).toContain('up to 8 hours'); // Hunter's Mark-style duration upcast
  });

  it('Chromatic Orb — Sorcerer/Wizard evocation, slot-scaled ranged attack, no save', () => {
    const orb = byName.get('Chromatic Orb');
    expect(orb.index).toBe('chromatic-orb');
    expect(orb).toMatchObject({
      level: 1,
      school: 'Evocation',
      casting_time: '1 action',
      range: '90 feet',
      components: ['V', 'S', 'M'],
      duration: 'Instantaneous',
      concentration: false,
      attack_type: 'ranged',
      classes: ['Sorcerer', 'Wizard'],
    });
    expect(orb.material).toContain('diamond worth at least 50gp'); // Identify-style '50gp' house spelling
    expect(orb.damage.damage_type).toBe('Acid, Cold, Fire, Force, Lightning, Poison, or Thunder'); // chosen type, 2024-row precedent
    expect(orb.damage.damage_at_slot_level).toMatchObject({ 1: '3d8', 2: '4d8', 9: '11d8' }); // Burning Hands dialect
    expect(orb.damage.damage_at_slot_level).not.toHaveProperty('0');
    expect(orb.dc).toBeUndefined(); // attack roll, not a save
  });

  it('Blade Ward — the 5e face (1 round, NOT concentration), distinct from the 2024 redesign', () => {
    const ward = byName.get('Blade Ward');
    expect(ward.index).toBe('blade-ward');
    expect(ward).toMatchObject({
      level: 0,
      school: 'Abjuration',
      casting_time: '1 action',
      range: 'Self',
      components: ['V', 'S'],
      duration: '1 round',
      concentration: false, // 2024 made it concentration-up-to-1-minute; 5e never was
      ritual: false,
      classes: ['Sorcerer', 'Warlock', 'Wizard'],
    });
    expect(ward.description[0]).toContain('resistance against bludgeoning, piercing, and slashing damage dealt by weapon attacks');
  });

  it('Mind Sliver — INT-save psychic cantrip, half on save, character-level scaling', () => {
    const sliver = byName.get('Mind Sliver');
    expect(sliver.index).toBe('mind-sliver');
    expect(sliver).toMatchObject({
      level: 0,
      school: 'Enchantment',
      casting_time: '1 action',
      range: '60 feet',
      components: ['V', 'S'],
      duration: 'Instantaneous',
      concentration: false,
      classes: ['Sorcerer', 'Warlock', 'Wizard'],
    });
    expect(sliver.dc).toEqual({ dc_success: 'half', dc_type: 'INT' }); // half damage on a successful save
    expect(sliver.attack_type).toBeUndefined(); // save, not attack roll (Acid Splash/Frostbite precedent)
    expect(sliver.damage).toMatchObject({
      damage_type: 'Psychic',
      damage_at_character_level: { 1: '1d6', 5: '2d6', 11: '3d6', 17: '4d6' }, // Vicious Mockery dialect
    });
  });

  it("Tasha's Hideous Laughter — Bard/Druid/Wizard WIS-save enchantment, concentration up to 1 minute", () => {
    const tasha = byName.get("Tasha's Hideous Laughter");
    expect(tasha.index).toBe('tashas-hideous-laughter');
    expect(tasha).toMatchObject({
      level: 1,
      school: 'Enchantment',
      casting_time: '1 action',
      range: '30 feet',
      components: ['V', 'S', 'M'],
      duration: 'Up to 1 minute',
      concentration: true,
      ritual: false,
      classes: ['Bard', 'Druid', 'Wizard'], // Druid added with the migration
    });
    expect(tasha.dc).toEqual({ dc_success: 'none', dc_type: 'WIS' });
    expect(tasha.material).toContain('tarts');
    expect(tasha.higher_level[0]).toContain('type other than psychic');
  });

  it('rows sit adjacent to their neighbors in the file\'s alphabetical placement', () => {
    const idx = (n) => spells5e.findIndex(s => s.name === n);
    const adjacency = (name, before, after) => {
      const i = idx(name);
      expect(i, `${name} present`).toBeGreaterThan(-1);
      if (before) expect(spells5e[i - 1].name, `${name} immediately after`).toBe(before);
      if (after) expect(spells5e[i + 1].name, `${name} immediately before`).toBe(after);
    };
    adjacency('Blade Ward', 'Blade Barrier', 'Bless');
    adjacency('Chromatic Orb', 'Chill Touch', 'Circle of Death');
    adjacency('Hex', 'Heroism', 'Hold Monster');
    adjacency('Mind Sliver', 'Mind Blank', 'Minor Illusion');
    adjacency("Tasha's Hideous Laughter", 'Symbol', 'Telekinesis');
  });
});

describe('classes.json reachability resolves against the migrated 5e table', () => {
  it('the Great Old One subclass references Tasha\'s Hideous Laughter by the canonical name AND index that now resolve to a disk row', () => {
    const goo = classes5e.find(c => c.name === 'Warlock').subclasses.find(s => s.index === 'the-great-old-one');
    const tashaRef = goo.spells.map(e => e.spell).find(s => s.index === 'tashas-hideous-laughter');
    expect(tashaRef, 'classes.json carries the tashas-hideous-laughter ref').toBeDefined();
    expect(tashaRef.name).toBe("Tasha's Hideous Laughter");
    // The migration made this previously-dangling class ref resolve BOTH ways.
    expect(byName.get("Tasha's Hideous Laughter").index).toBe('tashas-hideous-laughter');
    expect(byIndex.get('tashas-hideous-laughter').name).toBe("Tasha's Hideous Laughter");
  });

  it('the five staples are on the canonical SRD class lists the wizard/spell-step lanes read (spell.classes)', () => {
    const canonical = {
      'Hex': ['Warlock'],
      'Chromatic Orb': ['Sorcerer', 'Wizard'],
      'Blade Ward': ['Sorcerer', 'Warlock', 'Wizard'],
      'Mind Sliver': ['Sorcerer', 'Warlock', 'Wizard'],
      "Tasha's Hideous Laughter": ['Bard', 'Druid', 'Wizard'],
    };
    for (const [name, classes] of Object.entries(canonical)) {
      expect(byName.get(name).classes, `${name} class list`).toStrictEqual(classes);
    }
  });
});
