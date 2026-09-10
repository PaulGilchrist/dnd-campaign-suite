// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Module-level mocks for all ESM dependencies ──
vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, _prop) => null),
}));

// ── Helpers ──

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCharacter',
    level: 1,
    proficiency: 2,
    class: {
      name: 'Wizard',
      class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots_level_1: 2, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spell_type: 'prepared' } }],
      spell_casting_ability: 'Intelligence',
      ...overrides.class,
    },
    abilities: [
      { name: 'Intelligence', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
    ],
    spells: [],
    automation: {},
    ...overrides,
  };
}

function makeSpell(name, level = 0, extra = {}) {
  return { name, level, damage: {}, casting_time: '1 action', range: 'Self', ...extra };
}

describe('spellCalc2024-automation', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await import('../../../hooks/runtime/useRuntimeState.js');
    await import('../../character/classRules2024.js');
  });

  describe('getSpellAbilities', () => {
    // ── Automation: passive_rule (always_prepared_spells) ──

    it('adds always_prepared_spells from automation passives when feature name matches a major feature', () => {
      const allSpells = [makeSpell('Light', 0)];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 2 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Draconic Sorcery',
            features: [{ name: 'Draconic Spells' }],
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Draconic Spells', spells: ['Light'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Light']);
    });

    it('skips always_prepared_spells when feature name does not match major features', () => {
      const allSpells = [makeSpell('Light', 0)];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 2 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Draconic Sorcery',
            features: [{ name: 'Draconic Spells' }],
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Psionic Spells', spells: ['Light'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt']);
    });

    it('CLA-392: adds always_prepared_spells from a BASE class feature (Words of Creation lv20)', () => {
      const allSpells = [
        makeSpell('Power Word Heal', 9),
        makeSpell('Power Word Kill', 9),
      ];
      const lv20Spellcasting = { cantrips_known: 6, spell_slots: { '9': 1 } };
      const stats = makePlayerStats({
        level: 20,
        class: {
          name: 'Bard',
          class_levels: [
            ...Array.from({ length: 19 }, (_, i) => ({ level: i + 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } })),
            {
              level: 20,
              spellcasting: lv20Spellcasting,
              features: [{ name: 'Words of Creation', level: 20, type: 'class_feature' }],
            },
          ],
          spell_casting_ability: 'Charisma',
        },
        abilities: [{ name: 'Charisma', baseScore: 20, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 5 }],
      });
      stats.automation = {
        passives: [{
          type: 'passive_rule',
          effect: 'always_prepared_spells',
          name: 'Words of Creation',
          spells: ['Power Word Heal', 'Power Word Kill'],
        }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const pwh = result.spells.find(s => s.name === 'Power Word Heal');
      const pwk = result.spells.find(s => s.name === 'Power Word Kill');
      expect(pwh).toBeDefined();
      expect(pwh.prepared).toBe('Always');
      expect(pwk).toBeDefined();
      expect(pwk.prepared).toBe('Always');
    });

    it('CLA-392: still skips always_prepared_spells when the name matches no major OR base class feature', () => {
      const allSpells = [makeSpell('Power Word Kill', 9)];
      const stats = makePlayerStats({
        level: 20,
        class: {
          name: 'Bard',
          class_levels: [
            ...Array.from({ length: 19 }, (_, i) => ({ level: i + 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } })),
            { level: 20, spellcasting: { cantrips_known: 6, spell_slots: { '9': 1 } }, features: [{ name: 'Words of Creation', level: 20 }] },
          ],
          spell_casting_ability: 'Charisma',
        },
        abilities: [{ name: 'Charisma', baseScore: 20, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 5 }],
      });
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Mystic Theurge Bonus', spells: ['Power Word Kill'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).not.toContain('Power Word Kill');
    });

    it('CLA-392: does not inject always_prepared_spells from a base class feature above the current level', () => {
      const allSpells = [makeSpell('Power Word Kill', 9)];
      const stats = makePlayerStats({
        level: 18,
        class: {
          name: 'Bard',
          class_levels: [
            ...Array.from({ length: 17 }, (_, i) => ({ level: i + 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } })),
            { level: 18, spellcasting: { cantrips_known: 4, spell_slots: { '9': 1 } } },
            { level: 19, spellcasting: { cantrips_known: 4, spell_slots: { '9': 1 } } },
            { level: 20, spellcasting: { cantrips_known: 4, spell_slots: { '9': 1 } }, features: [{ name: 'Words of Creation', level: 20 }] },
          ],
          spell_casting_ability: 'Charisma',
        },
        abilities: [{ name: 'Charisma', baseScore: 20, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 5 }],
      });
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Words of Creation', spells: ['Power Word Kill'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).not.toContain('Power Word Kill');
    });

    it('skips passive_rule when spells array is missing', () => {
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells' }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    // ── Automation: free_spell and fey_reinforcements ──

    it('adds a free_spell from automation passives', () => {
      const allSpells = [makeSpell('Prestidigitation', 0)];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'free_spell', spell: 'Prestidigitation' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Prestidigitation');
    });

    it('adds multiple spells from an array free_spell', () => {
      const allSpells = [
        makeSpell('Shield of Faith', 1),
        makeSpell('Spiritual Weapon', 2),
      ];
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } }],
          spell_casting_ability: 'Wisdom',
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        proficiency: 3,
      });
      stats.automation = {
        passives: [{ type: 'free_spell', spell: ['Shield of Faith', 'Spiritual Weapon'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Shield of Faith', 'Spiritual Weapon']);
    });

    // ── Automation: spell_breaker ──

    it('adds alwaysPreparedSpells from spell_breaker', () => {
      const allSpells = [makeSpell('Shield', 1)];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'spell_breaker', alwaysPreparedSpells: ['Shield'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Shield');
    });

    // ── Automation: cantrip_spellcasting_ability ──

    // CLA-212: production always has Light in the spells DB, so the
    // full-spell-detail remap always runs for the granted cantrip.
    // The fixture must include Light to exercise that path (allSpells=[] masked it).
    it('adds cantrip_spellcasting_ability cantrip even when not in spell list, and its casting-ability override survives the spell-detail remap', () => {
      const allSpells = [makeSpell('Light', 0), makeSpell('Fire Bolt', 0)];
      const stats = makePlayerStats({
        abilities: [
          { name: 'Intelligence', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
          { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
        ],
      });
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'cantrip_spellcasting_ability', name: 'LightBearer', cantripName: 'Light', spellcastingAbility: 'Charisma' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const light = result.spells.find(s => s.name === 'Light');
      expect(light).toBeDefined();
      expect(light.level).toBe(0);
      expect(light.prepared).toBe('Always');
      expect(light.spellCastingAbility).toBe('Charisma');
    });

    it('LightBearer override survives the remap when Light is already in the spell list', () => {
      const allSpells = [makeSpell('Light', 0), makeSpell('Bless', 1)];
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          class_levels: [{ level: 6, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3, '3': 3 } } }],
          spell_casting_ability: 'Wisdom',
        },
        abilities: [
          { name: 'Wisdom', baseScore: 9, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: -1 },
          { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
        ],
        proficiency: 3,
        spells: ['Light', 'Bless'],
        automation: {
          passives: [{ type: 'cantrip_spellcasting_ability', name: 'LightBearer', cantripName: 'Light', spellcastingAbility: 'Charisma' }],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      const light = result.spells.find(s => s.name === 'Light');
      expect(light).toBeDefined();
      expect(light.prepared).toBe('Always');
      // Class ability stays Wisdom; only the Light cantrip is overridden to Charisma.
      expect(result.spellCastingAbility).toBe('Wisdom');
      expect(light.spellCastingAbility).toBe('Charisma');
    });

    // ── Mixed automation ──

    it('handles mixed automation features across all three arrays', () => {
      const allSpells = [
        makeSpell('Shield', 1),
        makeSpell('Minor Illusion', 1),
        makeSpell('Light', 0),
      ];
      const stats = makePlayerStats();
      stats.class.major = {
        name: 'Order',
        features: [
          { name: 'Minor Illusion Feature' },
          { name: 'Light Feature' },
        ],
      };
      stats.automation = {
        actions: [{ type: 'free_spell', spell: 'Shield' }],
        bonusActions: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Minor Illusion Feature', spells: ['Minor Illusion'] }],
        passives: [
          { type: 'passive_rule', effect: 'always_prepared_spells', name: 'Light Feature', spells: ['Light'] },
          { type: 'other_feature_type' },
        ],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result).not.toBeNull();
      expect(result.spells.map(s => s.name)).toEqual(['Light', 'Minor Illusion', 'Shield']);
    });

    // ── Automation: psionic_spells_list ──

    it('adds psionic_spells_list when feature name matches a major feature', () => {
      const allSpells = [
        makeSpell('Mind Sliver', 0),
        makeSpell('Detect Thoughts', 1),
      ];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Aberrant Sorcery',
            features: [
              { name: 'Psionic Spells' },
              { name: 'Telepathic Speech' },
            ],
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        automation: {
          passives: [
            { type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: ['Mind Sliver', 'Detect Thoughts'] },
          ],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Mind Sliver');
      expect(names).toContain('Detect Thoughts');
    });

    it('skips psionic_spells_list when feature name does not match major features', () => {
      const allSpells = [
        makeSpell('Mind Sliver', 0),
        makeSpell('Detect Thoughts', 1),
      ];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Draconic Sorcery',
            features: [
              { name: 'Draconic Resilience' },
              { name: 'Draconic Spells' },
            ],
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        automation: {
          passives: [
            { type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: ['Mind Sliver', 'Detect Thoughts'] },
          ],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).not.toContain('Mind Sliver');
      expect(names).not.toContain('Detect Thoughts');
    });

    it('skips psionic_spells_list when major has no features array', () => {
      const allSpells = [makeSpell('Mind Sliver', 0)];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Draconic Sorcery',
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        automation: {
          passives: [
            { type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: ['Mind Sliver'] },
          ],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).not.toContain('Mind Sliver');
    });

    // ── CLA-218: Mage Hand Legerdemain (Arcane Trickster lv3) ──

    function makeArcaneTricksterStats(level) {
      return makePlayerStats({
        level,
        class: {
          name: 'Rogue',
          major: { name: 'Arcane Trickster', spellcasting: { cantrips_known: 3, spells: [], spell_slots_level_1: 2 } },
          class_levels: [],
          spell_casting_ability: 'Intelligence',
        },
        spells: ['Mage Hand'],
      });
    }

    it('overrides Mage Hand casting time to Bonus Action with legerdemain markers at lv3+ (CLA-218)', () => {
      const mageHandDetail = { name: 'Mage Hand', level: 0, casting_time: 'Action', range: '30 feet', duration: '1 minute', description: ['<p>A spectral, floating hand appears.</p>'] };
      const result = getSpellAbilities([mageHandDetail], makeArcaneTricksterStats(3));
      const mageHand = result.spells.find(s => s.name === 'Mage Hand');
      expect(mageHand).toBeDefined();
      expect(mageHand.casting_time).toBe('Bonus Action');
      expect(mageHand._mageHandLegerdemain).toBe(true);
      expect(mageHand.description.join('')).toContain('Mage Hand Legerdemain');
    });

    it('does NOT override Mage Hand casting time below lv3 (CLA-218 control)', () => {
      const mageHandDetail = { name: 'Mage Hand', level: 0, casting_time: 'Action', range: '30 feet', duration: '1 minute', description: ['<p>A spectral, floating hand appears.</p>'] };
      const result = getSpellAbilities([mageHandDetail], makeArcaneTricksterStats(2));
      const mageHand = result.spells.find(s => s.name === 'Mage Hand');
      expect(mageHand).toBeDefined();
      expect(mageHand.casting_time).toBe('Action');
      expect(mageHand._mageHandLegerdemain).toBeUndefined();
    });

    it('does NOT override other spells or non-Arcane Trickster Mage Hands (CLA-218 control)', () => {
      const mageHandDetail = { name: 'Mage Hand', level: 0, casting_time: 'Action', range: '30 feet', duration: '1 minute', description: ['<p>Hand.</p>'] };
      const lightDetail = { name: 'Light', level: 0, casting_time: 'Action', range: 'Touch', duration: '1 hour', description: ['<p>Light.</p>'] };
      const cl = { spellcasting: { cantrips_known: 3, spells: [{ name: 'Light', prepared: 'Always' }, { name: 'Mage Hand', prepared: 'Always' }], spell_slots_level_1: 2 } };
      const wizardStats = makePlayerStats({
        level: 3,
        class: {
          name: 'Wizard',
          class_levels: [{ level: 1, ...cl }, { level: 2, ...cl }, { level: 3, ...cl }],
          spell_casting_ability: 'Intelligence',
        },
        spells: ['Light', 'Mage Hand'],
      });
      const result = getSpellAbilities([mageHandDetail, lightDetail], wizardStats);
      const mageHand = result.spells.find(s => s.name === 'Mage Hand');
      expect(mageHand.casting_time).toBe('Action');
      expect(mageHand._mageHandLegerdemain).toBeUndefined();
    });
  });

  describe('spell thief - stolen spell castability (CLA-325)', () => {
    // @improved-by-ai
    function stubStolenList(stolenList, casterBlockList) {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_spellThiefStolenList') return stolenList;
        if (key === '_spellThiefCasterBlock') return casterBlockList || null;
        return null;
      });
    }

    it('injects FULL spell data (castable row) for a resolvable stolen spell name', () => {
      const rayOfFrost = { name: 'Ray of Frost', level: 1, casting_time: '1 action', range: '60 feet', school: 'evocation', damage: { dice: '1d8', type: 'cold' } };
      const stats = makePlayerStats({ spells: ['Fire Bolt'], automation: {} });
      stubStolenList(JSON.stringify([{ casterName: 'Gazer 1', spellName: 'Ray of Frost' }]));

      const result = getSpellAbilities([makeSpell('Fire Bolt'), rayOfFrost], stats);
      const stolen = result.spells.find(s => s.name === 'Ray of Frost');

      expect(stolen).toBeDefined();
      expect(stolen.prepared).toBe('Always');
      expect(stolen.level).toBe(1);
      expect(stolen.school).toBe('evocation');
      expect(stolen.damage).toEqual({ dice: '1d8', type: 'cold' });
      expect(stolen.casting_time).toBe('1 action');
    });

    it('normalizes monster-card action labels ("3. Frost Ray") before resolving spell data', () => {
      const frostRay = { name: 'Frost Ray', level: 0, casting_time: '1 action', range: '30 feet', school: 'evocation', damage: { dice: '3d6', type: 'cold' } };
      const stats = makePlayerStats({ spells: ['Fire Bolt'], automation: {} });
      stubStolenList(JSON.stringify([{ casterName: 'Gazer 1', spellName: '3. Frost Ray' }]));

      const result = getSpellAbilities([makeSpell('Fire Bolt'), frostRay], stats);
      const stolen = result.spells.find(s => s.name === 'Frost Ray');

      expect(stolen).toBeDefined();
      expect(stolen.damage).toEqual({ dice: '3d6', type: 'cold' });
      expect(result.spells.filter(s => s.name === 'Frost Ray')).toHaveLength(1);
    });

    it('keeps a display-only row and logs when the stolen name has no spell data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const stats = makePlayerStats({ spells: ['Fire Bolt'], automation: {} });
      stubStolenList(JSON.stringify([{ casterName: 'Gazer 1', spellName: '3. Frost Ray' }]));

      const result = getSpellAbilities([makeSpell('Fire Bolt')], stats);
      const stolen = result.spells.find(s => s.name === 'Frost Ray');

      expect(stolen).toBeDefined();
      expect(stolen.prepared).toBe('Always');
      expect(stolen.level).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("no spells.json entry"));
      consoleSpy.mockRestore();
    });

    it('filters blocked caster spells using normalized names (legacy numbered labels)', () => {
      const stats = makePlayerStats({ spells: ['Fire Bolt'], automation: {} });
      stubStolenList(null, JSON.stringify([{ thiefName: 'AasimarTest', spellName: '3. Fire Bolt' }]));

      const result = getSpellAbilities([makeSpell('Fire Bolt'), makeSpell('Light')], stats);

      expect(result.spells.map(s => s.name)).not.toContain('Fire Bolt');
    });
  });
});
