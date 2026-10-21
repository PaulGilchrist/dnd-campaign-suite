// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Automation lane: automation.actions/bonusActions/passives → spell-row payload assembly
// for 2024 spells. Ownership map — cited, not re-pinned here:
//   slotless trait container + fallback container: spellCalc2024.test.js (base)
//   free_spell slot-filter exemption (FT-035): spellCalc2024.ft035-free-spell-row.test.js
//   psionic tier gating (CLA-272): spellCalc2024-psionic-tiers.test.js
//   Mystic Arcanum rows: spellCalc2024-arcanum.test.js; ritual stamps: spellCalc2024-rituals*.test.js

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
  beforeEach(() => {
    vi.resetAllMocks();
    // resetAllMocks clears the factory impl — restore the null default for determinism.
    vi.mocked(getRuntimeValue).mockImplementation(() => null);
  });

  describe('getSpellAbilities', () => {
    // ── Automation: passive_rule (always_prepared_spells) — feature-name gate ──

    it('always_prepared_spells: grants Always rows when the passive name matches a major feature, and no row when it matches neither major nor base features', () => {
      const light = makeSpell('Light', 0);
      const allSpells = [light, makeSpell('Fire Bolt', 0)];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 2 } } }],
          spell_casting_ability: 'Charisma',
          major: { name: 'Draconic Sorcery', features: [{ name: 'Draconic Spells' }] },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        spells: ['Fire Bolt'],
        automation: {
          passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Draconic Spells', spells: ['Light'] }],
        },
      });

      const granted = getSpellAbilities(allSpells, stats);
      // Exact automation-row payload: DB detail + Always preparation, nothing smuggled.
      expect(granted.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Light']);
      expect(granted.spells.find(s => s.name === 'Light')).toEqual({ ...light, prepared: 'Always' });

      // Negative: a name matching no major feature AND no level-gated base feature is skipped.
      stats.automation.passives[0].name = 'Mystic Theurge Bonus';
      expect(getSpellAbilities(allSpells, stats).spells.map(s => s.name)).toEqual(['Fire Bolt']);
    });

    it('CLA-392: base-class feature grants (Bard lv20 Words of Creation) auto-prepare as Always rows', () => {
      const allSpells = [makeSpell('Power Word Heal', 9), makeSpell('Power Word Kill', 9)];
      const stats = makePlayerStats({
        level: 20,
        class: {
          name: 'Bard',
          class_levels: [
            ...Array.from({ length: 19 }, (_, i) => ({ level: i + 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } })),
            { level: 20, spellcasting: { cantrips_known: 6, spell_slots: { '9': 1 } }, features: [{ name: 'Words of Creation', level: 20, type: 'class_feature' }] },
          ],
          spell_casting_ability: 'Charisma',
        },
        abilities: [{ name: 'Charisma', baseScore: 20, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 5 }],
        automation: {
          passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Words of Creation', spells: ['Power Word Heal', 'Power Word Kill'] }],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      // No class.major at all — only the class_levels[].features channel can grant these.
      for (const detail of allSpells) {
        expect(result.spells.find(s => s.name === detail.name)).toEqual({ ...detail, prepared: 'Always' });
      }
    });

    it('CLA-392: does not inject base-class feature grants from a level above the current level', () => {
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
        automation: {
          passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Words of Creation', spells: ['Power Word Kill'] }],
        },
      });

      expect(getSpellAbilities([makeSpell('Power Word Kill', 9)], stats).spells.map(s => s.name)).not.toContain('Power Word Kill');
    });

    // ── Automation: free_spell (slot-filter exemption owned by FT-035 lane file) ──

    it('free_spell normalizes an array grant into one castable Always row per spell', () => {
      const shieldOfFaith = makeSpell('Shield of Faith', 1);
      const spiritualWeapon = makeSpell('Spiritual Weapon', 2);
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } }],
          spell_casting_ability: 'Wisdom',
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        proficiency: 3,
        automation: {
          passives: [{ type: 'free_spell', spell: ['Shield of Faith', 'Spiritual Weapon'] }],
        },
      });

      const result = getSpellAbilities([shieldOfFaith, spiritualWeapon], stats);

      // Row shape includes the FT-035 free-cast stamp assembled here (its slot-filter
      // survival behaviour is pinned by spellCalc2024.ft035-free-spell-row.test.js).
      expect(result.spells.find(s => s.name === 'Shield of Faith')).toEqual({ ...shieldOfFaith, prepared: 'Always', _freeSpellGrantFreeCast: true });
      expect(result.spells.find(s => s.name === 'Spiritual Weapon')).toEqual({ ...spiritualWeapon, prepared: 'Always', _freeSpellGrantFreeCast: true });
    });

    it('spell_breaker injects its alwaysPreparedSpells as full castable rows', () => {
      const shield = makeSpell('Shield', 1);
      const stats = makePlayerStats();
      stats.automation = { passives: [{ type: 'spell_breaker', alwaysPreparedSpells: ['Shield'] }] };

      const result = getSpellAbilities([shield], stats);

      expect(result.spells.find(s => s.name === 'Shield')).toEqual({ ...shield, prepared: 'Always' });
    });

    // ── Automation: cantrip_spellcasting_ability (CLA-212 LightBearer) ──

    // CLA-212: production always has Light in the spells DB, so the full-spell-detail
    // remap always runs for the granted cantrip — the fixture must include Light
    // (allSpells=[] masked that path).
    it('CLA-212: grants the trait cantrip even when not in the spell list, and its Charisma override survives the spell-detail remap', () => {
      const light = makeSpell('Light', 0);
      const stats = makePlayerStats({
        abilities: [
          { name: 'Intelligence', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
          { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
        ],
        spells: ['Fire Bolt'],
        automation: {
          passives: [{ type: 'cantrip_spellcasting_ability', name: 'LightBearer', cantripName: 'Light', spellcastingAbility: 'Charisma' }],
        },
      });

      const lightRow = getSpellAbilities([light, makeSpell('Fire Bolt', 0)], stats).spells.find(s => s.name === 'Light');

      expect(lightRow).toEqual({ ...light, prepared: 'Always', spellCastingAbility: 'Charisma' });
    });

    it('CLA-212: stamps the Charisma override on an already-known Light without touching the class header ability or sibling rows', () => {
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

      const result = getSpellAbilities([makeSpell('Light', 0), makeSpell('Bless', 1)], stats);

      // Class ability stays Wisdom; only the Light cantrip is overridden to Charisma.
      expect(result.spellCastingAbility).toBe('Wisdom');
      expect(result.spells.find(s => s.name === 'Light')).toEqual({ ...makeSpell('Light', 0), prepared: 'Always', spellCastingAbility: 'Charisma' });
      expect(result.spells.find(s => s.name === 'Bless').spellCastingAbility).toBeUndefined();
    });

    // CLA-212: a zero-caster host (no class spellcasting table, spells: []) used to get
    // null from ensureSpellAbilitiesContainer before applyAutomationSpellGrants could
    // stamp the Light row — no Spells section rendered at all.
    it('CLA-212: zero-caster host (Rogue Assassin, spells: []) gets a slotless container and the LightBearer Light row with Charisma header math', () => {
      const stats = makePlayerStats({
        level: 20,
        proficiency: 6,
        class: {
          name: 'Rogue',
          subclass: { name: 'Assassin' },
          class_levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1 })),
          // Mirror production classes.json Rogue — Intelligence (Arcane Trickster) must
          // NOT overwrite the trait container's Charisma (CLA-212).
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 1, bonus: 0 },
          { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 1, bonus: 3 },
        ],
        spells: [],
        automation: {
          passives: [{ type: 'cantrip_spellcasting_ability', name: 'LightBearer', cantripName: 'Light', spellcastingAbility: 'Charisma' }],
        },
      });

      const result = getSpellAbilities([makeSpell('Light', 0)], stats);

      // Slotless: no spell slots granted to a zero-caster host.
      expect(result).not.toBeNull();
      expect(result.spell_slots_level_1).toBeUndefined();
      // Header math reflects the trait's Charisma (+3 mod, +6 prof → +9 to hit, DC 17) —
      // the Rogue's Intelligence would produce modifier 0 / DC 14 if it leaked through.
      expect(result.spellCastingAbility).toBe('Charisma');
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(9);
      expect(result.saveDc).toBe(17);
      expect(result.spells.find(s => s.name === 'Light')).toEqual({ name: 'Light', level: 0, damage: {}, casting_time: '1 action', range: 'Self', prepared: 'Always', spellCastingAbility: 'Charisma' });
    });

    // ── Mixed automation dispatch across actions/bonusActions/passives ──

    it('collects grants from actions, bonusActions and passives, and tolerates malformed passive entries', () => {
      const stats = makePlayerStats();
      stats.class.major = {
        name: 'Order',
        features: [{ name: 'Minor Illusion Feature' }, { name: 'Light Feature' }],
      };
      stats.automation = {
        actions: [{ type: 'free_spell', spell: 'Shield' }],
        bonusActions: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Minor Illusion Feature', spells: ['Minor Illusion'] }],
        passives: [
          { type: 'passive_rule', effect: 'always_prepared_spells', name: 'Light Feature', spells: ['Light'] },
          { type: 'passive_rule', effect: 'always_prepared_spells' }, // malformed: no spells array — must not throw
          { type: 'other_feature_type' },
        ],
      };

      const result = getSpellAbilities(
        [makeSpell('Shield', 1), makeSpell('Minor Illusion', 1), makeSpell('Light', 0)],
        stats
      );

      expect(result).not.toBeNull();
      expect(result.spells.map(s => s.name)).toEqual(['Light', 'Minor Illusion', 'Shield']);
    });

    // ── Automation: psionic_spells_list — feature-name gate only (tiers owned by CLA-272 lane file) ──

    it('psionic_spells_list: grants only when the passive name matches a major feature', () => {
      const allSpells = [makeSpell('Mind Sliver', 0), makeSpell('Detect Thoughts', 1)];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3 } } }],
          spell_casting_ability: 'Charisma',
          major: { name: 'Aberrant Sorcery', features: [{ name: 'Psionic Spells' }, { name: 'Telepathic Speech' }] },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        automation: {
          passives: [{ type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: ['Mind Sliver', 'Detect Thoughts'] }],
        },
      });

      const granted = getSpellAbilities(allSpells, stats);
      expect(granted.spells.map(s => s.name)).toEqual(['Mind Sliver', 'Detect Thoughts']);
      expect(granted.spells.every(s => s.prepared === 'Always')).toBe(true);

      // Name mismatch (and by extension major.features missing entirely — same
      // empty-name-set guard) never grants.
      stats.automation.passives[0].name = 'Draconic Spells';
      expect(getSpellAbilities(allSpells, stats).spells.map(s => s.name)).toEqual([]);
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

    const mageHandDetail = () => ({ name: 'Mage Hand', level: 0, casting_time: 'Action', range: '30 feet', duration: '1 minute', description: ['<p>A spectral, floating hand appears.</p>'] });

    it('CLA-218: overrides Mage Hand to Bonus Action with Legerdemain text at lv3+', () => {
      const mageHand = getSpellAbilities([mageHandDetail()], makeArcaneTricksterStats(3)).spells.find(s => s.name === 'Mage Hand');

      expect(mageHand.casting_time).toBe('Bonus Action');
      expect(mageHand.description.join('')).toContain('Mage Hand Legerdemain');
    });

    it('CLA-218: leaves Mage Hand as an Action below lv3 (level-gate control)', () => {
      const mageHand = getSpellAbilities([mageHandDetail()], makeArcaneTricksterStats(2)).spells.find(s => s.name === 'Mage Hand');

      expect(mageHand.casting_time).toBe('Action');
      expect(mageHand.description.join('')).not.toContain('Legerdemain');
    });

    it('CLA-218: leaves a non-Arcane-Trickster Mage Hand and sibling cantrips untouched (class-gate control)', () => {
      const wizardStats = makePlayerStats({
        level: 3,
        class: {
          name: 'Wizard',
          class_levels: [1, 2, 3].map(level => ({
            level,
            spellcasting: { cantrips_known: 3, spells: [{ name: 'Light', prepared: 'Always' }, { name: 'Mage Hand', prepared: 'Always' }], spell_slots_level_1: 2 },
          })),
          spell_casting_ability: 'Intelligence',
        },
        spells: ['Light', 'Mage Hand'],
      });

      const result = getSpellAbilities([mageHandDetail(), makeSpell('Light', 0, { range: 'Touch', duration: '1 hour' })], wizardStats);

      const mageHand = result.spells.find(s => s.name === 'Mage Hand');
      expect(mageHand.casting_time).toBe('Action');
      expect(mageHand.description.join('')).not.toContain('Legerdemain');
      expect(result.spells.find(s => s.name === 'Light').casting_time).toBe('1 action');
    });
  });

  describe('spell thief - stolen spell castability (CLA-325)', () => {
    function stubRuntimeLists(stolenList, casterBlockList) {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_spellThiefStolenList') return stolenList;
        if (key === '_spellThiefCasterBlock') return casterBlockList || null;
        return null;
      });
    }

    it('injects full castable rows for resolvable stolen names (normalizing numbered monster labels), dedupes, and keeps unresolvable names display-only with a console.error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const rayOfFrost = { name: 'Ray of Frost', level: 1, casting_time: '1 action', range: '60 feet', school: 'evocation', damage: { dice: '1d8', type: 'cold' } };
      const stats = makePlayerStats({ spells: ['Fire Bolt'], automation: {} });
      stubRuntimeLists(JSON.stringify([
        { casterName: 'Gazer 1', spellName: 'Ray of Frost' },
        { casterName: 'Gazer 1', spellName: '3. Frost Ray' }, // no DB entry — display-only
        { casterName: 'Gazer 2', spellName: 'Ray of Frost' },  // duplicate injection — guarded
      ]));

      const result = getSpellAbilities([makeSpell('Fire Bolt'), rayOfFrost], stats);

      const stolen = result.spells.find(s => s.name === 'Ray of Frost');
      expect(stolen).toEqual({ ...rayOfFrost, prepared: 'Always' });
      const displayOnly = result.spells.find(s => s.name === 'Frost Ray');
      expect(displayOnly).toEqual({ name: 'Frost Ray', prepared: 'Always' });
      expect(result.spells.filter(s => s.name === 'Ray of Frost')).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('no spells.json entry'));
      consoleSpy.mockRestore();
    });

    it('filters blocked caster spells using normalized names (legacy numbered labels)', () => {
      const stats = makePlayerStats({ spells: ['Fire Bolt', 'Light'], automation: {} });
      stubRuntimeLists(null, JSON.stringify([{ thiefName: 'AasimarTest', spellName: '3. Fire Bolt' }]));

      const result = getSpellAbilities([makeSpell('Fire Bolt'), makeSpell('Light')], stats);

      expect(result.spells.map(s => s.name)).toEqual(['Light']);
    });
  });
});
