// @maintained-by-ai
// Base spellCalc coverage: the spellcasting gate, DC math, race traits, subclass
// cantrip/school adjustments, class prepared rules, catalog population, sorting and
// the feat/race fallback. Subclass-prerequisite, passive-gate and spell-thief
// block/stolen list branches are owned by spellCalc-advanced.test.js (#1262).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSpellAbilities } from './spellCalc.js';
import { getStore } from '../../../hooks/runtime/useRuntimeState.js';
import classes from '../../../../public/data/classes.json';
import spellsDisk from '../../../../public/data/spells.json';

// Disk catalog rows by name (fix#120: load by name, never hand-transcribe).
const diskSpell = (name) => {
  const row = spellsDisk.find(s => s.name === name);
  if (!row) throw new Error(`test fixture names a spell absent from disk spells.json: ${name}`);
  return row;
};

const ABILITIES = [
  { name: 'Intelligence', bonus: 4 },
  { name: 'Wisdom', bonus: 3 },
  { name: 'Charisma', bonus: 2 },
  { name: 'Strength', bonus: 1 },
  { name: 'Dexterity', bonus: 0 },
  { name: 'Constitution', bonus: -1 },
];

// Level-5 default with the standard proficiency formula. Class overrides merge onto
// the full Wizard scaffold so callers never rebuild class_levels by hand.
const makePlayerStats = (overrides = {}) => {
  const level = overrides.level ?? 5;
  return {
    name: 'TestWizard',
    level,
    proficiency: overrides.proficiency ?? Math.floor((level - 1) / 4) + 2,
    abilities: overrides.abilities ?? ABILITIES,
    class: {
      name: 'Wizard',
      spell_casting_ability: 'Intelligence',
      major: null,
      subclass: null,
      class_levels: Array.from({ length: level }, () => ({ spellcasting: null })),
      ...(overrides.class || {}),
    },
    race: { name: 'Human', subrace: null, ...(overrides.race || {}) },
    spells: overrides.spells ?? null,
  };
};

const setSpellcasting = (playerStats, spellcasting) => {
  playerStats.class.class_levels[playerStats.level - 1] = { spellcasting };
};

const spellcasting = (opts = {}) => ({
  cantrips_known: 3,
  spells_known: 0,
  spellCastingAbility: 'Intelligence',
  ...opts,
});

const names = (result) => result.spells.map(s => s.name);

const casterWith = (castingAbility, { class: classOverrides, spellcasting: scOverrides, ...rest } = {}) => {
  const stats = makePlayerStats({
    ...rest,
    class: { spell_casting_ability: castingAbility, ...classOverrides },
  });
  setSpellcasting(stats, spellcasting({ spellCastingAbility: castingAbility, ...scOverrides }));
  return stats;
};

describe('spellCalc', () => {
  beforeEach(() => {
    const store = getStore('TestWizard');
    Array.from(store.keys()).forEach(key => store.delete(key));
  });

  describe('getSpellAbilities', () => {
    it('gates spellcasting on container presence and required_major', () => {
      // No class spellcasting row and no fallback spells: nothing to build from.
      expect(getSpellAbilities([], makePlayerStats())).toBeNull();

      // required_major matching neither major nor subclass blocks the row.
      const blocked = casterWith('Intelligence', {
        spellcasting: { required_major: 'OtherSubclass' },
        class: { major: { name: 'Evocation' } },
      });
      expect(getSpellAbilities([], blocked)).toBeNull();

      // Matching the major name admits the row...
      const majorMatch = casterWith('Intelligence', {
        spellcasting: { required_major: 'Evocation' },
        class: { major: { name: 'Evocation' } },
      });
      const majorResult = getSpellAbilities([], majorMatch);
      expect(majorResult.spellCastingAbility).toBe('Intelligence');
      expect(majorResult.saveDc).toBe(15);

      // ...and so does matching the subclass name.
      const subclassMatch = casterWith('Intelligence', {
        spellcasting: { required_major: 'School of Necromancy' },
        class: { subclass: { name: 'School of Necromancy' } },
      });
      const subclassResult = getSpellAbilities([], subclassMatch);
      expect(subclassResult.spellCastingAbility).toBe('Intelligence');
      expect(subclassResult.saveDc).toBe(15);
    });

    it('computes modifier, toHit and saveDc from the resolved casting ability', () => {
      const castWith = (ability) => getSpellAbilities([], casterWith(ability));
      // Level 5: proficiency +3, save DC = 8 + mod + prof.
      expect(castWith('Intelligence')).toMatchObject({ modifier: 4, toHit: 7, saveDc: 15 });
      // Falsifying swap: INT -> CHA moves DC and toHit by the ability delta (-2).
      expect(castWith('Charisma')).toMatchObject({ modifier: 2, toHit: 5, saveDc: 13 });
      // Negative modifiers subtract from both.
      expect(castWith('Constitution')).toMatchObject({ modifier: -1, toHit: 2, saveDc: 10 });
    });

    it('stacks Tiefling traits with a level-3 gate on Hellish Rebuke', () => {
      const tieflingAt = (level) => {
        const stats = makePlayerStats({ level, race: { name: 'Tiefling', subrace: null } });
        setSpellcasting(stats, spellcasting());
        return getSpellAbilities([], stats);
      };
      // Level 3 boundary: both traits granted, stamped Always on top of class
      // casting. Catalog-less rows sort alphabetically (localeCompare fallback).
      const lvl3 = tieflingAt(3);
      expect(lvl3.cantrips_known).toBe(4);
      expect(lvl3.spells).toEqual([
        { name: 'Hellish Rebuke', prepared: 'Always' },
        { name: 'Thaumaturgy', prepared: 'Always' },
      ]);
      expect(lvl3.spells_known).toBe(1);

      // Below level 3: only Thaumaturgy.
      const lvl2 = tieflingAt(2);
      expect(lvl2.cantrips_known).toBe(4);
      expect(names(lvl2)).toEqual(['Thaumaturgy']);
      expect(lvl2.spells_known).toBe(0);
    });

    it('grants High Elf cantrip count and Forest Gnome Minor Illusion while casting', () => {
      const highElf = casterWith('Intelligence', { race: { name: 'Elf', subrace: { name: 'High Elf' } } });
      const heResult = getSpellAbilities([], highElf);
      expect(heResult.cantrips_known).toBe(4);
      // High Elf bumps the count only — no spell row is stamped.
      expect(heResult.spells).toEqual([]);

      const gnome = casterWith('Intelligence', { race: { name: 'Gnome', subrace: { name: 'Forest Gnome' } } });
      const fgResult = getSpellAbilities([], gnome);
      expect(fgResult.cantrips_known).toBe(4);
      expect(fgResult.spells).toEqual([{ name: 'Minor Illusion', prepared: 'Always' }]);
    });

    it('creates a race-only spellcasting container for non-caster classes', () => {
      // Tiefling Barbarian: Charisma container with its trait spells.
      const tiefling = getSpellAbilities([], makePlayerStats({
        class: { name: 'Barbarian', spell_casting_ability: null },
        race: { name: 'Tiefling', subrace: null },
      }));
      expect(tiefling.spellCastingAbility).toBe('Charisma');
      expect(tiefling.cantrips_known).toBe(1);
      expect(tiefling.spells_known).toBe(1);
      expect(tiefling.spells).toEqual([
        { name: 'Hellish Rebuke', prepared: 'Always' },
        { name: 'Thaumaturgy', prepared: 'Always' },
      ]);
      // Container ability resolves through the ability rows: CHA +2, prof +3.
      expect(tiefling).toMatchObject({ modifier: 2, toHit: 5, saveDc: 13 });

      // High Elf Ranger: Intelligence container, cantrip count only.
      const highElf = getSpellAbilities([], makePlayerStats({
        class: { name: 'Ranger', spell_casting_ability: null },
        race: { name: 'Elf', subrace: { name: 'High Elf' } },
      }));
      expect(highElf.spellCastingAbility).toBe('Intelligence');
      expect(highElf.cantrips_known).toBe(1);
      expect(highElf.spells).toEqual([]);

      // Forest Gnome Fighter: Intelligence container with stamped Minor Illusion.
      const gnome = getSpellAbilities([], makePlayerStats({
        class: { name: 'Fighter', spell_casting_ability: null },
        race: { name: 'Gnome', subrace: { name: 'Forest Gnome' } },
      }));
      expect(gnome.spellCastingAbility).toBe('Intelligence');
      expect(gnome.cantrips_known).toBe(1);
      expect(gnome.spells).toEqual([{ name: 'Minor Illusion', prepared: 'Always' }]);
    });

    // #1268 5e twin (mirrors fix#91 spellCalc2024.js bumpCounterIfTracked): the 5e
    // disk census of public/data/classes.json shows 60/160 spellcasting rows carry NO
    // spells_known key (Wizard/Druid/Paladin lv1-20) and 40/160 carry NO cantrips_known
    // (Paladin/Ranger lv1-20). The race-trait lane used to `+=` straight onto those
    // absent keys, seeding NaN — baked straight out on a Wizard host, masked on
    // Druid/Paladin where addAllClassListSpells stamps null later. Post-fix the
    // race-trait lane bumps ONLY tracked keys: absent + count>0 skips LOUD, absent + 0
    // stays silent, tracked keys accumulate byte-intact (tracked-host lanes pinned above).
    describe('#1268 twin: race-trait counters never seed NaN on untracked disk hosts', () => {
      const diskLevels = (className) => classes.find(c => c.name === className).class_levels;
      const diskHost = (className, level, race, castingAbility) => makePlayerStats({
        level,
        race,
        spells: ['Magic Missile'],
        class: {
          name: className,
          spell_casting_ability: castingAbility,
          class_levels: diskLevels(className),
        },
      });

      it('census: disk rows lack spells_known on Wizard/Druid/Paladin and cantrips_known on Paladin/Ranger', () => {
        for (const name of ['Wizard', 'Druid', 'Paladin']) {
          diskLevels(name).forEach((row, i) => {
            expect('spells_known' in row.spellcasting, `${name} lv${i + 1}`).toBe(false);
          });
        }
        for (const name of ['Paladin', 'Ranger']) {
          diskLevels(name).forEach((row, i) => {
            expect('cantrips_known' in row.spellcasting, `${name} lv${i + 1}`).toBe(false);
          });
        }
      });

      it('Wizard host: Tiefling lv3 spells_known loud-skips absent key, lv2 silent, never NaN; cantrips track', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const tiefling = { name: 'Tiefling', subrace: null };

        const lv3 = getSpellAbilities([], diskHost('Wizard', 3, tiefling, 'Intelligence'));
        expect(Number.isNaN(lv3.spells_known), 'lv3 spells_known must never be NaN').toBe(false);
        expect(lv3.spells_known, 'untracked host keeps the key absent').toBeUndefined();
        expect(errSpy.mock.calls.some(c => String(c[0]).includes("lineage counter 'spells_known' absent"))).toBe(true);
        // cantrips_known IS present on the Wizard disk row — tracked bump accumulates.
        expect(lv3.cantrips_known).toBe(diskLevels('Wizard')[2].spellcasting.cantrips_known + 1);
        // Always-prepared rows are the canonical record on the untracked counter.
        expect(lv3.spells.map(s => [s.name, s.prepared])).toContainEqual(['Hellish Rebuke', 'Always']);
        expect(lv3.spells.map(s => [s.name, s.prepared])).toContainEqual(['Thaumaturgy', 'Always']);

        // lv2: no leveled grant gated in — absent-key arm stays silent.
        errSpy.mockClear();
        const lv2 = getSpellAbilities([], diskHost('Wizard', 2, tiefling, 'Intelligence'));
        expect(Number.isNaN(lv2.spells_known)).toBe(false);
        expect(lv2.spells_known).toBeUndefined();
        expect(errSpy.mock.calls.some(c => String(c[0]).includes("lineage counter 'spells_known' absent"))).toBe(false);
        errSpy.mockRestore();
      });

      it('Paladin host: both counters absent — Tiefling bumps skip loud; class-list rule canonicalises spells_known to null', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = getSpellAbilities([], diskHost('Paladin', 3, { name: 'Tiefling', subrace: null }, 'Charisma'));
        expect(Number.isNaN(result.cantrips_known)).toBe(false);
        expect(result.cantrips_known).toBeUndefined();
        expect(Number.isNaN(result.spells_known)).toBe(false);
        // addAllClassListSpells stamps spells_known null (whole-list prepared) — the
        // loud race-lane skip still fired before that canonicalisation.
        expect(result.spells_known).toBeNull();
        expect(errSpy.mock.calls.some(c => String(c[0]).includes("lineage counter 'cantrips_known' absent"))).toBe(true);
        expect(errSpy.mock.calls.some(c => String(c[0]).includes("lineage counter 'spells_known' absent"))).toBe(true);
        errSpy.mockRestore();
      });

      it('Ranger host: High Elf cantrip loud-skips untracked cantrips_known; tracked spells_known untouched silent', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = getSpellAbilities([], diskHost('Ranger', 5, { name: 'Elf', subrace: { name: 'High Elf' } }, 'Wisdom'));
        expect(Number.isNaN(result.cantrips_known)).toBe(false);
        expect(result.cantrips_known).toBeUndefined();
        expect(errSpy.mock.calls.some(c => String(c[0]).includes("lineage counter 'cantrips_known' absent"))).toBe(true);
        // spells_known is tracked on Ranger disk rows and High Elf grants no leveled spell.
        expect(result.spells_known).toBe(diskLevels('Ranger')[4].spellcasting.spells_known);
        expect(errSpy.mock.calls.some(c => String(c[0]).includes("lineage counter 'spells_known' absent"))).toBe(false);
        errSpy.mockRestore();
      });
    });

    it('applies subclass bonus cantrips: Light pushes a row, Nature bumps the count', () => {
      const light = makePlayerStats({ class: { subclass: { name: 'Light' } }, spells: ['Fire Bolt'] });
      setSpellcasting(light, spellcasting());
      const lightResult = getSpellAbilities([], light);
      expect(lightResult.cantrips_known).toBe(4);
      expect(lightResult.spells).toEqual([
        { name: 'Fire Bolt', prepared: '' },
        { name: 'Light', prepared: '' },
      ]);

      // fix#348(b): spells:null NO LONGER skips the grants — the whole-list Druid still
      // canonicalises spells_known to null, and the Nature bump lands with a null bag.
      const nature = casterWith('Wisdom', {
        class: { name: 'Druid', subclass: { name: 'Nature' } },
        spells: [],
        spellcasting: { cantrips_known: 2 },
      });
      const natureResult = getSpellAbilities([], nature);
      expect(natureResult.cantrips_known).toBe(3);
      expect(natureResult.spells).toEqual([]);
      expect(natureResult.spells_known).toBeNull();
    });

    it('sets school limits and arcane trickster cantrip bonus', () => {
      // Arcane Trickster pushes Mage Hand when absent and adds 3 cantrips;
      // Rogue is an all-prepared class so the pushed row is stamped Always.
      const trickster = makePlayerStats({ class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } }, spells: [] });
      setSpellcasting(trickster, spellcasting());
      const trickResult = getSpellAbilities([], trickster);
      expect(trickResult.schoolLimits).toEqual(['enchantment', 'illusion']);
      expect(trickResult.cantrips_known).toBe(6);
      expect(trickResult.spells).toEqual([{ name: 'Mage Hand', prepared: 'Always' }]);

      // fix#348(b) falsifiability arm: NULL spell bag still receives the AT bonus
      // cantrip grant — the grants belong to the subclass feature, not the bag.
      // Pre-fix the early-return on null spells skipped both the pushed row and the
      // +3 bump (cantrips_known stayed 3, spells stayed []).
      const nullBagTrickster = makePlayerStats({ class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } }, spells: null });
      setSpellcasting(nullBagTrickster, spellcasting());
      const nullBagResult = getSpellAbilities([], nullBagTrickster);
      expect(nullBagResult.cantrips_known).toBe(6);
      expect(nullBagResult.spells).toEqual([{ name: 'Mage Hand', prepared: 'Always' }]);

      // Null-bag Light caster: the pushed Light row lands even with no persisted bag.
      // Cleric is a prepared caster (maxPreparedSpells branch) — the pushed row keeps
      // prepared:'' until the sheet selects it (all-prepared stamping belongs to Rogue).
      const nullBagLight = makePlayerStats({ class: { name: 'Cleric', subclass: { name: 'Light' } }, spells: null });
      setSpellcasting(nullBagLight, spellcasting());
      const nullBagLightResult = getSpellAbilities([], nullBagLight);
      expect(nullBagLightResult.cantrips_known).toBe(4);
      expect(nullBagLightResult.spells).toEqual([{ name: 'Light', prepared: '' }]);

      // Eldritch Knight gets its own limit pair and no bonus cantrips.
      const knight = makePlayerStats({ class: { name: 'Fighter', subclass: { name: 'Eldritch Knight' } } });
      setSpellcasting(knight, spellcasting());
      const knightResult = getSpellAbilities([], knight);
      expect(knightResult.schoolLimits).toEqual(['abjuration', 'evocation']);
      expect(knightResult.cantrips_known).toBe(3);
      expect(knightResult.spells).toEqual([]);
    });

    it('caps prepared spells by class formula (full caster and half caster)', () => {
      // Wizard level 5 + INT +4 = 9.
      expect(getSpellAbilities([], casterWith('Intelligence')).maxPreparedSpells).toBe(9);
      // Paladin half-caster: CHA +2 + floor(5/2) = 4.
      expect(getSpellAbilities([], casterWith('Charisma', { class: { name: 'Paladin' } })).maxPreparedSpells).toBe(4);
    });

    it('marks every spell Always and sets no cap for all-prepared classes', () => {
      const allSpells = [
        { name: 'Charm Person', level: 1, classes: ['Sorcerer'] },
        { name: 'Fire Bolt', level: 0, classes: ['Sorcerer'] },
      ];
      const result = getSpellAbilities(allSpells, casterWith('Charisma', {
        class: { name: 'Sorcerer' },
        spells: ['Charm Person', 'Fire Bolt'],
        spellcasting: { spells_known: 3 },
      }));
      expect(result.maxPreparedSpells).toBeUndefined();
      expect(result.spells.map(s => [s.name, s.prepared])).toEqual([
        ['Fire Bolt', 'Always'],
        ['Charm Person', 'Always'],
      ]);
    });

    it('expands rows from the catalog, stamps cantrips Always, preserves unknown spells', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
        { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
      ];
      const wizard = makePlayerStats({ spells: ['Magic Missile', 'Fire Bolt', 'Unknown Spell'] });
      setSpellcasting(wizard, spellcasting());
      const result = getSpellAbilities(allSpells, wizard);

      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.level).toBe(0); // expanded from the catalog
      expect(fireBolt.prepared).toBe('Always'); // cantrips are never "prepareable"

      // Leveled wizard spells keep their unprepared status; the prepared class is
      // NOT blanket-stamped (contrast with the all-prepared default branch above).
      const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
      expect(magicMissile.level).toBe(1);
      expect(magicMissile.prepared).toBe('');

      // Spells missing from the catalog pass through as bare rows.
      expect(result.spells.find(s => s.name === 'Unknown Spell')).toEqual({ name: 'Unknown Spell', prepared: '' });
    });

    it('populates the full Druid class list filtered by class and slot level', () => {
      const allSpells = [
        { name: 'Acid Splash', level: 1, classes: ['Druid'] },
        { name: 'Sacred Flame', level: 1, classes: ['Druid'] },
        { name: 'Cure Wounds', level: 1, classes: ['Cleric'] },
        { name: 'Shapechange', level: 9, classes: ['Druid'] },
        { name: 'Druidcraft', level: 0, classes: ['Druid'] },
      ];
      const result = getSpellAbilities(allSpells, casterWith('Wisdom', {
        class: { name: 'Druid' },
        spellcasting: { spell_slots_level_1: 2 },
      }));
      expect(result.spells_known).toBeNull(); // whole class list is "known"
      // Class filter drops Cure Wounds, slot ceiling drops Shapechange,
      // cantrips are handled by cantrips_known, not the spell list.
      expect(names(result)).toEqual(['Acid Splash', 'Sacred Flame']);
    });

    it('sorts spells by level ascending then name alphabetically', () => {
      const allSpells = [
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        { name: 'Shield', level: 1, classes: ['Wizard'] },
        { name: 'Charm Person', level: 1, classes: ['Wizard'] },
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
      ];
      const wizard = makePlayerStats({ spells: ['Fireball', 'Magic Missile', 'Shield', 'Charm Person', 'Fire Bolt'] });
      setSpellcasting(wizard, spellcasting());
      expect(names(getSpellAbilities(allSpells, wizard))).toEqual([
        'Fire Bolt', 'Charm Person', 'Magic Missile', 'Shield', 'Fireball',
      ]);
    });

    it('feat/race fallback lands sheet-carrier rows beside half-caster slots capped to highest known spell level', () => {
      // #1348 FLIP of the honest #1263 drop-pin: the fallback used to honor
      // playerStats.spells for slot sizing but DROPP the spell rows (spells:[]).
      // Rows now land exactly like the class path (spellCalc.js:92) and the 2024
      // twin's post-container rebuild (spellCalc2024.js:853-857): names from the
      // sheet, expanded by name against the disk catalog, sorted, counters tracked.
      const allSpells = [diskSpell('Detect Magic'), diskSpell('Fire Bolt')];
      const fallbackFighter = (spells) => getSpellAbilities(allSpells, makePlayerStats({
        class: { name: 'Fighter', spell_casting_ability: null },
        spells,
      }));

      const leveled = fallbackFighter(['Detect Magic']);
      expect(names(leveled)).toEqual(['Detect Magic']);
      expect(leveled.spells[0].level).toBe(1);
      expect(leveled.spells[0].prepared).toBe('Always'); // Fighter default: all prepared (:291 branch)
      expect(leveled.spells_known).toBe(1);
      expect(leveled.spell_slots_level_1).toBe(3); // half-caster level 5, uncapped
      expect(leveled.cantrips_known).toBe(0);
      expect(leveled.spellCastingAbility).toBeUndefined();
      // No casting ability: DC comes from proficiency alone (8 + 3).
      expect(leveled).toMatchObject({ modifier: 0, toHit: 3, saveDc: 11 });

      // Cantrip-only input: highest spell level 0 caps every slot away, row still lands.
      const cantripOnly = fallbackFighter(['Fire Bolt']);
      expect(cantripOnly.spell_slots_level_1).toBeUndefined();
      expect(names(cantripOnly)).toEqual(['Fire Bolt']);
      expect(cantripOnly.cantrips_known).toBe(1);
      expect(cantripOnly.spells_known).toBe(0);

      // Slot sizing math is byte-preserved from the drop era: level 7 half-caster with
      // a persisted lv2 spell keeps lv1+lv2 slots; lv1-persisted caps lv2 away.
      const caster = (spells) => getSpellAbilities(
        [diskSpell('Magic Missile'), diskSpell('Misty Step')],
        makePlayerStats({ level: 7, class: { name: 'Fighter', spell_casting_ability: null }, spells })
      );
      expect(caster(['Magic Missile']).spell_slots_level_2).toBeUndefined();
      expect(caster(['Magic Missile']).spell_slots_level_1).toBe(4);
      const both = caster(['Magic Missile', 'Misty Step']);
      expect(both.spell_slots_level_1).toBe(4);
      expect(both.spell_slots_level_2).toBe(2);
    });

    it('#1348 feat-caster rows land: Magic Initiate cantrip + level-1 rows on a no-table Fighter', () => {
      // Sheet shape: spells persisted by the Magic Initiate modals (rules.js:269
      // addMagicInitiateFreeCasts consumes the same instances; the spell LIST lanes
      // consume these spellAbilities rows — previously empty for this character).
      const allSpells = [diskSpell('Fire Bolt'), diskSpell('Magic Missile'), diskSpell('Shield')];
      const result = getSpellAbilities(allSpells, makePlayerStats({
        level: 1,
        class: { name: 'Fighter', spell_casting_ability: 'Intelligence' },
        spells: ['Shield', 'Fire Bolt', 'Magic Missile'],
      }));
      expect(names(result)).toEqual(['Fire Bolt', 'Magic Missile', 'Shield']);
      expect(result.spells.map(s => s.level)).toEqual([0, 1, 1]);
      expect(result.spells.map(s => s.prepared)).toEqual(['Always', 'Always', 'Always']);
      expect(result.cantrips_known).toBe(1);
      expect(result.spells_known).toBe(2);
      expect(result.spell_slots_level_1).toBe(2); // HALF_CASTER_SLOTS[1]
      // Rows carry real disk detail through the finalize remap (loaded-by-name):
      expect(result.spells.find(s => s.name === 'Shield').casting_time).toBe('1 reaction');
    });

    it('#1348 multi-source caster: feat rows and race trait rows union without duplicates', () => {
      // Tiefling Fighter at level 5 with two feat-persisted spells: race stamps
      // Thaumaturgy/Hellish Rebuke on top of the fallback rows (stampAlwaysPrepared
      // dedupes by name); the union sorts level-then-name with unique names.
      const allSpells = [diskSpell('Fire Bolt'), diskSpell('Magic Missile'), diskSpell('Thaumaturgy'), diskSpell('Hellish Rebuke')];
      const result = getSpellAbilities(allSpells, makePlayerStats({
        class: { name: 'Fighter', spell_casting_ability: null },
        race: { name: 'Tiefling', subrace: null },
        spells: ['Magic Missile', 'Fire Bolt'],
      }));
      expect(names(result)).toEqual(['Fire Bolt', 'Thaumaturgy', 'Hellish Rebuke', 'Magic Missile']);
      expect(new Set(names(result)).size).toBe(4);
      expect(result.cantrips_known).toBe(2); // 1 feat cantrip + 1 Tiefling grant
      expect(result.spells_known).toBe(2); // 1 feat spell + 1 Tiefling lv3 grant
      expect(result.spell_slots_level_1).toBe(3); // persisted highest is lv1

      // Overlapping name across sources: a single stamped row, never a second push.
      const overlap = getSpellAbilities([diskSpell('Thaumaturgy'), diskSpell('Hellish Rebuke')], makePlayerStats({
        class: { name: 'Fighter', spell_casting_ability: null },
        race: { name: 'Tiefling', subrace: null },
        spells: ['Thaumaturgy'],
      }));
      expect(names(overlap)).toEqual(['Thaumaturgy', 'Hellish Rebuke']);
      expect(new Set(names(overlap)).size).toBe(2);
      expect(overlap.spells[0].prepared).toBe('Always');
    });

    it('catalog-less fallback spell lands name-only, LOUD, uncounted, and invents no slot tier', () => {
      // fix#209 nothing-invented law: an unresolvable name never becomes a counted
      // or leveled row — it lands name-only with a console.error (no-fallback law).
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = getSpellAbilities([], makePlayerStats({
        class: { name: 'Fighter', spell_casting_ability: null },
        spells: ['Not A Real Spell'],
      }));
      expect(names(result)).toEqual(['Not A Real Spell']);
      expect(result.spells[0].level).toBeUndefined();
      expect(result.cantrips_known).toBe(0);
      expect(result.spells_known).toBe(0);
      expect(result.spell_slots_level_1).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Not A Real Spell'));
      errorSpy.mockRestore();
    });
  });
});
