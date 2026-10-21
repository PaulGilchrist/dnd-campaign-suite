// @maintained-by-ai
import { describe, it, expect, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc.js';
import { getStore, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const ABILITIES = [
  { name: 'Intelligence', bonus: 4 },
  { name: 'Wisdom', bonus: 3 },
  { name: 'Charisma', bonus: 2 },
];

// Full-caster scaffolding; class_levels[level-1] carries the spellcasting container
// so resolveClassSpellcasting() finds it. Proficiency uses the standard table formula.
const makeCaster = (level, opts = {}) => ({
  level,
  name: 'TestWizard',
  proficiency: Math.floor((level - 1) / 4) + 2,
  abilities: ABILITIES,
  class: {
    name: opts.className ?? 'Wizard',
    spell_casting_ability: opts.castingAbility ?? 'Intelligence',
    major: opts.major ?? null,
    subclass: opts.subclass ?? null,
    class_levels: Array.from({ length: level }, () => ({
      spellcasting: opts.spellcasting ?? null,
    })),
  },
  race: opts.race ?? { name: 'Human', subrace: null },
  spells: opts.spells ?? null,
  automation: opts.automation,
});

const spellcasting = (overrides = {}) => ({
  cantrips_known: 3,
  spell_slots: {},
  spells_known: 3,
  ...overrides,
});

const names = (spellAbilities) => spellAbilities.spells.map(s => s.name);

describe('spellCalc advanced', () => {
  beforeEach(() => {
    const store = getStore('TestWizard');
    Array.from(store.keys()).forEach(key => store.delete(key));
  });

  describe('getSpellAbilities', () => {
    it('adds subclass spells as Always prepared, whether or not already in the spellbook', () => {
      const subclass = {
        name: 'Life',
        spells: [
          { spell: { name: 'Lesser Restoration' }, prerequisites: [{ index: 'class-3' }] },
        ],
      };

      // Not known, not in the catalog: pushed as a bare Always row.
      const unknown = makeCaster(5, {
        className: 'Cleric',
        castingAbility: 'Wisdom',
        subclass,
        spellcasting: spellcasting({ spells_known: 0 }),
        spells: [],
      });
      const unknownResult = getSpellAbilities([], unknown);
      const pushed = unknownResult.spells.find(s => s.name === 'Lesser Restoration');
      expect(pushed).toBeDefined();
      expect(pushed.prepared).toBe('Always');
      expect(pushed.level).toBeUndefined(); // row came from subclass data, not the catalog

      // Already in the spellbook: the existing row is stamped and catalog-expanded.
      const known = makeCaster(5, {
        className: 'Cleric',
        castingAbility: 'Wisdom',
        subclass,
        spellcasting: spellcasting({ spells_known: 0 }),
        spells: ['Lesser Restoration'],
      });
      const knownResult = getSpellAbilities([{ name: 'Lesser Restoration', level: 2, classes: ['Cleric'] }], known);
      const stamped = knownResult.spells.find(s => s.name === 'Lesser Restoration');
      expect(stamped.prepared).toBe('Always');
      expect(stamped.level).toBe(2);
    });

    it('grants subclass spells only from their prerequisite class level', () => {
      const subclass = {
        name: 'Life',
        spells: [
          { spell: { name: 'Spiritual Weapon' }, prerequisites: [{ index: 'class-3' }] },
          { spell: { name: 'Death Ward' }, prerequisites: [{ index: 'class-5' }] },
        ],
      };
      const stats = makeCaster(3, {
        className: 'Cleric',
        castingAbility: 'Wisdom',
        subclass,
        spellcasting: spellcasting({ spells_known: 0 }),
        spells: [],
      });
      expect(names(getSpellAbilities([], stats))).toEqual(['Spiritual Weapon']);
    });

    it('filters Land subclass spells by circle prerequisite', () => {
      const subclassSpells = [
        { spell: { name: 'Modify Memory' }, prerequisites: [{ index: 'class-5' }, { name: 'Spells of the Dreams' }] },
      ];
      const base = {
        className: 'Druid',
        castingAbility: 'Wisdom',
        spellcasting: spellcasting({ spells_known: 0 }),
        spells: [],
      };
      const dreams = makeCaster(5, { ...base, subclass: { name: 'Land', circle: 'Dreams', spells: subclassSpells } });
      const dreamsResult = getSpellAbilities([], dreams);
      const dreamSpell = dreamsResult.spells.find(s => s.name === 'Modify Memory');
      expect(dreamSpell).toBeDefined();
      expect(dreamSpell.prepared).toBe('Always');

      const grass = makeCaster(5, { ...base, subclass: { name: 'Land', circle: 'Grass', spells: subclassSpells } });
      expect(names(getSpellAbilities([], grass))).not.toContain('Modify Memory');
    });

    it('adds always_prepared_spells passives only when the passive is backed by a major feature', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
        { name: 'Charm Person', level: 1, classes: ['Wizard'] },
        { name: 'Suggestion', level: 2, classes: ['Wizard'] },
      ];
      const statsFor = (passiveName) => makeCaster(5, {
        spells: ['Fire Bolt'],
        spellcasting: spellcasting({ spells_known: 3 }),
        major: { features: [{ name: 'Beguiling Magic' }] },
        automation: {
          passives: [{
            type: 'passive_rule',
            effect: 'always_prepared_spells',
            name: passiveName,
            spells: ['Charm Person', 'Suggestion'],
          }],
        },
      });

      const matched = getSpellAbilities(allSpells, statsFor('Beguiling Magic'));
      expect(matched.spells_known).toBe(5); // 3 + one per added spell
      expect(names(matched)).toEqual(expect.arrayContaining(['Fire Bolt', 'Charm Person', 'Suggestion']));
      matched.spells
        .filter(s => ['Charm Person', 'Suggestion'].includes(s.name))
        .forEach(s => expect(s.prepared).toBe('Always'));

      const unmatched = getSpellAbilities(allSpells, statsFor('Not A Major Feature'));
      expect(unmatched.spells_known).toBe(3);
      expect(names(unmatched)).toEqual(['Fire Bolt']);
    });

    it('spell thief blocklist removes only real spell names and tolerates malformed state', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
        { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        { name: 'Shield', level: 1, classes: ['Wizard'] },
      ];
      const stats = makeCaster(5, { spells: ['Fire Bolt', 'Magic Missile', 'Shield'], spellcasting: spellcasting({ spells_known: 0 }) });

      // Baseline: no blocklist in the runtime store.
      expect(names(getSpellAbilities(allSpells, stats))).toEqual(['Fire Bolt', 'Magic Missile', 'Shield']);

      // A non-array JSON payload must not crash or remove anything.
      setRuntimeValue('TestWizard', '_spellThiefCasterBlock', JSON.stringify({ spellName: 'Magic Missile' }), 'test-campaign');
      expect(names(getSpellAbilities(allSpells, stats))).toEqual(['Fire Bolt', 'Magic Missile', 'Shield']);

      // Null entries are ignored; listed names are removed.
      setRuntimeValue('TestWizard', '_spellThiefCasterBlock', JSON.stringify([{ spellName: null }, { spellName: 'Magic Missile' }]), 'test-campaign');
      expect(names(getSpellAbilities(allSpells, stats))).toEqual(['Fire Bolt', 'Shield']);
    });

    it('spell thief stolen list adds one expanded Always row, dedupes known spells, tolerates malformed state', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
        { name: 'Charm Person', level: 1, classes: ['Bard'] },
      ];
      const stats = makeCaster(5, { spells: ['Fire Bolt'], spellcasting: spellcasting({ spells_known: 0 }) });

      // A non-array JSON payload must not crash or add anything.
      setRuntimeValue('TestWizard', '_spellThiefStolenList', JSON.stringify({ spellName: 'Charm Person' }), 'test-campaign');
      expect(names(getSpellAbilities(allSpells, stats))).not.toContain('Charm Person');

      // Valid entries (null spellName ignored) add exactly one catalog-expanded Always row.
      setRuntimeValue('TestWizard', '_spellThiefStolenList', JSON.stringify([{ spellName: null }, { spellName: 'Charm Person' }]), 'test-campaign');
      const result = getSpellAbilities(allSpells, stats);
      const stolen = result.spells.filter(s => s.name === 'Charm Person');
      expect(stolen).toHaveLength(1);
      expect(stolen[0].prepared).toBe('Always');
      expect(stolen[0].level).toBe(1);
      expect(result.spells_known).toBe(0); // counter only increments when truthy

      // A stolen spell already in the spellbook stays a single row.
      const knownStats = makeCaster(5, { spells: ['Fire Bolt', 'Charm Person'], spellcasting: spellcasting({ spells_known: 0 }) });
      expect(getSpellAbilities(allSpells, knownStats).spells.filter(s => s.name === 'Charm Person')).toHaveLength(1);
    });
  });
});
