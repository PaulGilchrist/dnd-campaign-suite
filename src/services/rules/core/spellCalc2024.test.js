// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// ── Module-level mocks for all ESM dependencies ──
vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, _prop) => null),
}));

vi.mock('../../automation/handlers/class-other/elfishLineageHandler.js', () => ({
  getElfisLineageSelection: vi.fn(),
  getElfisLineageCantrip: vi.fn(),
  getElfisLineageLevel3Spell: vi.fn(),
  getElfisLineageLevel5Spell: vi.fn(),
}));

vi.mock('../../automation/handlers/class-other/gnomishLineageHandler.js', () => ({
  getGnomishLineageSelection: vi.fn(),
  getGnomishLineageCantrip: vi.fn(),
  getGnomishLineageLevel3Spell: vi.fn(),
  getGnomishLineageLevel5Spell: vi.fn(),
}));

vi.mock('../../automation/handlers/class-other/fiendishLegacyHandler.js', () => ({
  getFiendishLegacySelection: vi.fn(),
  getFiendishLegacyCantrip: vi.fn(),
  getFiendishLegacyLevel3Spell: vi.fn(),
  getFiendishLegacyLevel5Spell: vi.fn(),
}));

vi.mock('../../automation/handlers/feats/magicInitiateHandler.js', () => ({
  getMagicInitiateCantrips: vi.fn(),
  getMagicInitiateLevel1Spell: vi.fn(),
}));

// ── Helpers ──

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCharacter',
    level: 1,
    proficiency: 2,
    class: {
      name: 'Wizard',
      class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } }],
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

describe('spellCalc2024', () => {
  // References to mocked functions (set in beforeEach via dynamic import)
  let mockGetHighestMajorLevel;
  let mockGetRuntimeValue;
  let mockMagicInitiateCantrips;
  let mockMagicInitiateLevel1Spell;

  beforeEach(async () => {
    vi.resetAllMocks();
    const classRules = await import('../../character/classRules2024.js');
    const runtimeState = await import('../../../hooks/runtime/useRuntimeState.js');
    const magicInitiate = await import('../../automation/handlers/feats/magicInitiateHandler.js');

    mockGetHighestMajorLevel = classRules.default.getHighestMajorLevel;
    mockGetRuntimeValue = runtimeState.getRuntimeValue;
    mockMagicInitiateCantrips = magicInitiate.getMagicInitiateCantrips;
    mockMagicInitiateLevel1Spell = magicInitiate.getMagicInitiateLevel1Spell;
  });

  describe('getSpellAbilities', () => {
    // ── Null / no spellcasting paths ──

    it('returns null when player has no class_levels', () => {
      const stats = makePlayerStats({ class: { class_levels: [] } });
      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    it('returns null when class level has no spellcasting and getHighestMajorLevel returns nothing', () => {
      mockGetHighestMajorLevel.mockReturnValue(undefined);

      const stats = makePlayerStats({
        class: { class_levels: [{ level: 1 }] },
      });
      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    it('returns null when required_major does not match major name', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 }, required_major: 'Evoker' },
          }],
          major: { name: 'Necromancer' },
        },
      });
      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    it('returns null when required_major does not match legacy subclass name', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 }, required_major: 'Life' },
          }],
          subclass: { name: 'Death' },
        },
      });
      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    // ── Successful spellcasting resolution ──

    it('returns spell abilities from class level spellcasting', () => {
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];

      const result = getSpellAbilities([makeSpell('Fire Bolt')], stats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3);
      expect(result.spell_slots).toEqual({ '1': 2 });
      expect(result.spellCastingAbility).toBe('Intelligence');
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(5);
      expect(result.saveDc).toBe(13);
      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Fire Bolt');
    });

    it('returns spell abilities when required_major matches major name', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 }, required_major: 'Evoker' },
          }],
          major: { name: 'Evoker' },
          spell_casting_ability: 'Intelligence',
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result).not.toBeNull();
      expect(result.spellCastingAbility).toBe('Intelligence');
    });

    it('falls back to getHighestMajorLevel when class_levels lack spellcasting', () => {
      mockGetHighestMajorLevel.mockReturnValue({
        spellcasting: { cantrips_known: 2, spell_slots: { '1': 1 } },
      });

      const stats = makePlayerStats({
        class: {
          class_levels: [{ level: 1 }],
          major: { name: 'Evoker', spellcasting: { cantrips_known: 2, spell_slots: { '1': 1 } } },
        },
      });
      const result = getSpellAbilities([], stats);

      expect(mockGetHighestMajorLevel).toHaveBeenCalledWith(stats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(2);
    });

    it('falls back to class.major.spellcasting when class_levels and getHighestMajorLevel have none', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{ level: 1 }],
          major: { spell_casting_ability: 'Intelligence', spellcasting: { cantrips_known: 1, spell_slots: {} } },
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(1);
    });

    // ── Class order bonuses ──

    it('grants +1 cantrip for Divine Order Thaumaturge Cleric', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          divineOrder: 'Thaumaturge',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: {} } }],
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(4);
    });

    it('does not grant Thaumaturge bonus to non-Cleric', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Wizard',
          divineOrder: 'Thaumaturge',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: {} } }],
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(3);
    });

    it('grants +1 cantrip for Primal Order Magician Druid', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Druid',
          primalOrder: 'Magician',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 2, spell_slots: {} } }],
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(3);
    });

    // ── Arcane Trickster ──

    it('adds Mage Hand and +3 cantrips for Arcane Trickster', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Rogue',
          major: { name: 'Arcane Trickster' },
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: {}, spells: [] } }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [{ name: 'Intelligence', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        spells: ['Mage Hand'],
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(6);
      const mageHand = result.spells.find(s => s.name === 'Mage Hand');
      expect(mageHand).toBeDefined();
    });

    it('adds +3 cantrips for Arcane Trickster even with empty known spells array', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Rogue',
          major: { name: 'Arcane Trickster' },
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: {}, spells: [] } }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [{ name: 'Intelligence', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        spells: [],
      });
      const result = getSpellAbilities([], stats);

      // Source checks `if (playerStats.spells)` which is truthy for [], so +3 is always added
      expect(result.cantrips_known).toBe(6);
      expect(result.spells).toHaveLength(0);
    });

    // ── Spell mapping and sorting ──

    it('maps spell names to spell details with prepared=Always for all levels', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { damage_type: 'Fire' }),
        makeSpell('Magic Missile', 1, { damage_type: 'Force' }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt', 'Magic Missile'];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells).toHaveLength(2);
      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.prepared).toBe('Always');
      expect(fireBolt.level).toBe(0);
      const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
      expect(magicMissile.prepared).toBe('Always');
      expect(magicMissile.level).toBe(1);
    });

    it('sorts spells by level ascending then name alphabetically', () => {
      const allSpells = [
        makeSpell('Acid Splash', 0),
        makeSpell('Fire Bolt', 0),
        makeSpell('Shield', 1),
        makeSpell('Magic Missile', 1),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Shield', 'Fire Bolt', 'Magic Missile', 'Acid Splash'];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Acid Splash', 'Fire Bolt', 'Magic Missile', 'Shield']);
    });

    it('uses missing ability fallback values (modifier=0, toHit=proficiency, saveDc=8+proficiency)', () => {
      const stats = makePlayerStats({
        abilities: [{ name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 0 }],
      });

      const result = getSpellAbilities([], stats);

      expect(result.modifier).toBe(0);
      expect(result.toHit).toBe(2);
      expect(result.saveDc).toBe(10);
    });

    it('handles missing playerStats.spells as empty array', () => {
      const stats = makePlayerStats({ spells: undefined });
      const result = getSpellAbilities([], stats);

      expect(result.spells).toEqual([]);
    });

    // ── Subclass (major) spells ──

    it('adds subclass spells when level > 2 and level >= spell level', () => {
      const stats = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            { level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 2, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 2 } } },
          ],
          spell_casting_ability: 'Intelligence',
          major: {
            name: 'School of Evocation',
            spells: [
              { name: 'Lightning Bolt', level: 3 },
              { name: 'Mage Hand', level: 1 },
            ],
          },
        },
      });
      stats.spells = [];

      const result = getSpellAbilities([], stats);

      const names = result.spells.map(s => s.name);
      // Both are added because level 3 >= level 3 (Lightning Bolt) and level 3 >= level 1 (Mage Hand)
      expect(names).toContain('Mage Hand');
      expect(names).toContain('Lightning Bolt');
    });

    it('adds subclass spells unlocked at current level', () => {
      const stats = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            { level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 2, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 2 } } },
          ],
          spell_casting_ability: 'Intelligence',
          major: {
            name: 'School of Evocation',
            spells: [
              { name: 'Mage Hand', level: 1 },
              { name: 'Flaming Sphere', level: 2 },
            ],
          },
        },
      });
      stats.spells = [];

      const result = getSpellAbilities([], stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Mage Hand');
      expect(names).toContain('Flaming Sphere');
    });

    it('does not add subclass spells when level <= 2', () => {
      const stats = makePlayerStats({
        level: 2,
        class: {
          class_levels: [
            { level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 2, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
          ],
          spell_casting_ability: 'Intelligence',
          major: {
            name: 'School of Evocation',
            spells: [{ name: 'Mage Hand', level: 1 }],
          },
        },
      });
      stats.spells = [];

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    it('supports legacy subclassSpell.spell.name format', () => {
      const stats = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            { level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 2, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 2 } } },
          ],
          spell_casting_ability: 'Intelligence',
          major: {
            name: 'School of Evocation',
            spells: [{ spell: { name: 'Mage Hand' }, level: 1 }],
          },
        },
      });
      stats.spells = [];

      const result = getSpellAbilities([], stats);

      expect(result.spells.map(s => s.name)).toContain('Mage Hand');
    });

    it('does not duplicate subclass spells already in known list', () => {
      const stats = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            { level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 2, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 2 } } },
          ],
          spell_casting_ability: 'Intelligence',
          major: {
            name: 'School of Evocation',
            spells: [{ name: 'Fire Bolt', level: 1 }],
          },
        },
      });
      stats.spells = ['Fire Bolt'];

      const result = getSpellAbilities([], stats);

      expect(result.spells.filter(s => s.name === 'Fire Bolt').length).toBe(1);
    });

    // ── Automation: passive_rule (always_prepared_spells) ──

    it('adds always_prepared_spells from automation passives', () => {
      const allSpells = [makeSpell('Light', 0)];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Light'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Light']);
    });

    it('adds always_prepared_spells from automation actions', () => {
      const allSpells = [makeSpell('Sanctuary', 1)];
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } }],
          spell_casting_ability: 'Wisdom',
        },
        abilities: [{ name: 'Wisdom', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 2 }],
        spells: [],
      });
      stats.automation = {
        actions: [{ type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Sanctuary'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Sanctuary');
    });

    it('adds always_prepared_spells from automation bonusActions', () => {
      const allSpells = [makeSpell('Healing Word', 1)];
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } }],
          spell_casting_ability: 'Wisdom',
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        spells: [],
      });
      stats.automation = {
        bonusActions: [{ type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Healing Word'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Healing Word');
    });

    it('does not duplicate a spell already in the known list from always_prepared_spells', () => {
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Fire Bolt'] }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells.filter(s => s.name === 'Fire Bolt').length).toBe(1);
    });

    it('skips passive_rule when effect is not always_prepared_spells', () => {
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'some_other_effect', spells: ['Ghost Sound'] }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
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

    it('adds fey_reinforcement spells the same way as free_spell', () => {
      const allSpells = [makeSpell('Shield', 1)];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'fey_reinforcements', spell: 'Shield' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Shield');
    });

    it('does not duplicate a free_spell already known', () => {
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'free_spell', spell: 'Fire Bolt' }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells.filter(s => s.name === 'Fire Bolt').length).toBe(1);
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

    it('skips free_spell when spell property is missing', () => {
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'free_spell' }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
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

    it('does not duplicate spell_breaker spells already known', () => {
      const stats = makePlayerStats();
      stats.spells = ['Shield'];
      stats.automation = {
        passives: [{ type: 'spell_breaker', alwaysPreparedSpells: ['Shield'] }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells.filter(s => s.name === 'Shield').length).toBe(1);
    });

    // ── Automation: cantrip_spellcasting_ability ──

    it('attempts to update cantrip spellCastingAbility from cantrip_spellcasting_ability feature', () => {
      const allSpells = [makeSpell('Fire Bolt', 0)];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        actions: [{ type: 'cantrip_spellcasting_ability', cantripName: 'Fire Bolt', spellcastingAbility: 'Charisma' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      // The automation handler sets spellCastingAbility on the spell entry,
      // but the final map overwrites with spellDetail (which lacks it).
      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.spellCastingAbility).toBeUndefined();
    });

    it('adds cantrip_spellcasting_ability cantrip even when not in spell list', () => {
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        actions: [{ type: 'cantrip_spellcasting_ability', cantripName: 'Light', spellcastingAbility: 'Charisma' }],
      };

      const result = getSpellAbilities([], stats);

      const light = result.spells.find(s => s.name === 'Light');
      expect(light).toEqual({ name: 'Light', prepared: 'Always', spellCastingAbility: 'Charisma' });
    });

    // ── Automation: elfish_lineage ──

    it('adds elfish lineage cantrip, level 3, and level 5 spells when lineage matches', () => {
      const allSpells = [
        makeSpell('Blade Ward', 0),
        makeSpell('Burning Hands', 1),
        makeSpell('Crown of Madness', 1),
      ];

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'elfish_lineage',
          options: [{ name: 'Shadow Magic', spellcastingAbility: 'Charisma', cantrip: 'Blade Ward', level3Spell: 'Burning Hands', level5Spell: 'Crown of Madness' }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Elf', subrace: { name: 'Shadow Magic' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Blade Ward');
      expect(names).toContain('Burning Hands');
      expect(names).toContain('Crown of Madness');
    });

    it('does not add elfish lineage spells when lineage does not match', () => {
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'elfish_lineage',
          options: [{ name: 'Shadow Magic', spellcastingAbility: 'Charisma', cantrip: 'Blade Ward' }],
        }],
      };

      const result = getSpellAbilities([], stats, { campaignName: 'TestCampaign', race: { name: 'Elf', subrace: { name: 'Wood Elf' } } });

      expect(result.spells).toHaveLength(0);
    });

    // ── Automation: gnomish_lineage ──

    it('adds gnomish lineage spells when lineage matches', () => {
      const allSpells = [
        makeSpell('Friends', 0),
        makeSpell('Web', 1),
        makeSpell('Hold Monster', 1),
      ];

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'gnomish_lineage',
          options: [{ name: 'Deep Gnome', spellcastingAbility: 'Intelligence', cantrip: 'Friends', level3Spell: 'Web', level5Spell: 'Hold Monster' }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Gnome', subrace: { name: 'Deep Gnome' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Friends');
      expect(names).toContain('Web');
      expect(names).toContain('Hold Monster');
    });

    // ── Automation: fiendish_legacy ──

    it('adds fiendish legacy spells when legacy matches', () => {
      const allSpells = [
        makeSpell('Infestation', 0),
        makeSpell('Scorching Ray', 1),
        makeSpell('Dominate Person', 1),
      ];

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'fiendish_legacy',
          options: [{ name: 'Fiend', spellcastingAbility: 'Charisma', cantrip: 'Infestation', level3Spell: 'Scorching Ray', level5Spell: 'Dominate Person' }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Fiend Tiefling' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Infestation');
      expect(names).toContain('Scorching Ray');
      expect(names).toContain('Dominate Person');
    });

    // ── Automation: magic_initiate ──

    it('adds magic initiate cantrips and level 1 spell', () => {
      const allSpells = [
        makeSpell('Minor Illusion', 0),
        makeSpell('Shield', 1),
      ];
      mockMagicInitiateCantrips.mockReturnValue(['Minor Illusion']);
      mockMagicInitiateLevel1Spell.mockReturnValue('Shield');

      const stats = makePlayerStats();
      stats.automation = {
        actions: [{ type: 'magic_initiate' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Minor Illusion');
      expect(names).toContain('Shield');
    });

    it('creates spellAbilities for non-spellcasting character with fiendish legacy', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0),
        makeSpell('Hellish Rebuke', 1),
        makeSpell('Darkness', 2),
      ];

      const stats = makePlayerStats({
        class: {
          name: 'Fighter',
          class_levels: [{ level: 3 }],
        },
        abilities: [
          { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
        ],
        automation: {
          specialActions: [{
            type: 'fiendish_legacy',
            options: [{ name: 'Infernal', spellcastingAbility: 'Charisma', cantrip: 'Fire Bolt', level3Spell: 'Hellish Rebuke', level5Spell: 'Darkness' }],
          }],
        },
      });

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Infernal Tiefling' } } });

      expect(result).not.toBeNull();
      const names = result.spells.map(s => s.name);
      expect(names).toContain('Fire Bolt');
      expect(names).toContain('Hellish Rebuke');
      expect(names).toContain('Darkness');
      expect(result.spellCastingAbility).toBe('Charisma');
      expect(result.cantrips_known).toBe(1);
      expect(result.spells_known).toBe(2);
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(5);
      expect(result.saveDc).toBe(13);
    });

    it('handles magic_initiate with multiple cantrips', () => {
      const allSpells = [
        makeSpell('Minor Illusion', 0),
        makeSpell('Thaumaturgy', 0),
      ];
      mockMagicInitiateCantrips.mockReturnValue(['Minor Illusion', 'Thaumaturgy']);
      mockMagicInitiateLevel1Spell.mockReturnValue(null);

      const stats = makePlayerStats();
      stats.automation = {
        actions: [{ type: 'magic_initiate' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Minor Illusion');
      expect(names).toContain('Thaumaturgy');
    });

    // ── Automation: Spell Mastery ──

    it('adds Spell Mastery level 1 and level 2 spells from runtime state', () => {
      const allSpells = [
        makeSpell('Shield', 1),
        makeSpell('Web', 1),
      ];
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'SpellMastery_level1') return 'Shield';
        if (prop === 'SpellMastery_level2') return 'Web';
        return null;
      });

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'spell_mastery' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Shield');
      expect(names).toContain('Web');
    });

    it('does not duplicate Spell Mastery spells already known', () => {
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'SpellMastery_level1') return 'Fire Bolt';
        return null;
      });

      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'spell_mastery' }],
      };

      const result = getSpellAbilities([], stats, { campaignName: 'TestCampaign' });

      expect(result.spells.filter(s => s.name === 'Fire Bolt').length).toBe(1);
    });

    // ── Automation: Savant features ──

    it('adds Abjuration Savant spells from runtime state', () => {
      const allSpells = [makeSpell('Shield', 1)];
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === '_Abjuration_Savant_selection') return ['Shield'];
        return null;
      });

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'abjuration_savant' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      expect(result.spells.map(s => s.name)).toContain('Shield');
    });

    it('adds Divination Savant spells from runtime state', () => {
      const allSpells = [makeSpell('Detect Magic', 1)];
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === '_Divination_Savant_selection') return ['Detect Magic'];
        return null;
      });

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'divination_savant' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      expect(result.spells.map(s => s.name)).toContain('Detect Magic');
    });

    it('adds Illusion Savant spells from runtime state', () => {
      const allSpells = [makeSpell('Minor Illusion', 0)];
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === '_Illusion_Savant_selection') return ['Minor Illusion'];
        return null;
      });

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'illusion_savant' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      expect(result.spells.map(s => s.name)).toContain('Minor Illusion');
    });

    // ── Automation: Signature Spells ──

    it('adds Signature Spells from runtime state', () => {
      const allSpells = [makeSpell('Shield', 1)];
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'SignatureSpells_selection') return ['Shield'];
        return null;
      });

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'signature_spells' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      expect(result.spells.map(s => s.name)).toContain('Shield');
    });

    // ── Automation: Phantasmal Creatures ──

    it('adds phantasmal creatures always prepared spells', () => {
      const allSpells = [
        makeSpell('Summon Beast', 1),
        makeSpell('Summon Fey', 1),
      ];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [
          { type: 'phantasmal_creatures', alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'] },
        ],
      };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Summon Beast');
      expect(names).toContain('Summon Fey');
    });

    // ── Automation: Improved Illusions ──

    it('adds Minor Illusion from Improved Illusions when not already known', () => {
      const allSpells = [makeSpell('Minor Illusion', 0, { casting_time: '1 action' })];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'improved_illusions' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const minorIllusion = result.spells.find(s => s.name === 'Minor Illusion');
      expect(minorIllusion).toBeDefined();
      expect(minorIllusion.casting_time).toBe('1 action');
    });

    it('attempts to override Minor Illusion casting time but final map overwrites it', () => {
      const allSpells = [makeSpell('Minor Illusion', 0, { casting_time: '1 action' })];
      const stats = makePlayerStats();
      stats.spells = ['Minor Illusion'];
      stats.automation = {
        passives: [{ type: 'improved_illusions' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const minorIllusion = result.spells.find(s => s.name === 'Minor Illusion');
      // The automation handler sets casting_time to '1 bonus action',
      // but the final map spreads spellDetail which has '1 action'.
      expect(minorIllusion.casting_time).toBe('1 action');
    });

    // ── Automation: Ritual Adept ──

    it('adds ritual-tagged spells from spellbook when Ritual Adept is present', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
        makeSpell('Find Familiar', 1, { ritual: true }),
        makeSpell('Detect Magic', 1, { ritual: true, classes: ['Bard', 'Cleric'] }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Adept', hasAutomation: true }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Fire Bolt');
      expect(names).toContain('Alarm');
      expect(names).toContain('Find Familiar');
      expect(names).toContain('Detect Magic');
    });

    it('does not duplicate ritual spells already in known list', () => {
      const allSpells = [makeSpell('Alarm', 1, { ritual: true })];
      const stats = makePlayerStats();
      stats.spells = ['Alarm'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Adept', hasAutomation: true }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.filter(s => s.name === 'Alarm').length).toBe(1);
    });

    it('does not add ritual spells when ritualSpells array is empty', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = { ritualSpells: [] };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).not.toContain('Alarm');
    });

    // ── Automation: missing sub-arrays and null safety ──

    it('handles automation with missing actions/bonusActions arrays', () => {
      const allSpells = [makeSpell('Light', 0)];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Light'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Light');
    });

    it('handles automation with empty sub-arrays', () => {
      const stats = makePlayerStats();
      stats.automation = {
        actions: [],
        bonusActions: [],
        passives: [],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    it('handles automation with no matching feature types', () => {
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'some_other_type', effect: 'something' }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    it('skips automation block when automation is undefined', () => {
      const stats = makePlayerStats({ automation: undefined });

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    it('skips automation block when automation is null', () => {
      const stats = makePlayerStats({ automation: null });

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    // ── Mixed automation ──

    it('handles mixed automation features across all three arrays', () => {
      const allSpells = [
        makeSpell('Shield', 1),
        makeSpell('Minor Illusion', 1),
        makeSpell('Light', 0),
      ];
      const stats = makePlayerStats();
      stats.class.major = { name: 'Order' };
      stats.automation = {
        actions: [{ type: 'free_spell', spell: 'Shield' }],
        bonusActions: [{ type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Minor Illusion'] }],
        passives: [
          { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Light'] },
          { type: 'other_feature_type' },
        ],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result).not.toBeNull();
      expect(result.spells.map(s => s.name)).toEqual(['Light', 'Minor Illusion', 'Shield']);
    });

    // ── Unknown spell handling ──

    it('handles spell not found in allSpells gracefully (no detail to merge)', () => {
      const allSpells = [makeSpell('Fire Bolt', 0)];
      const stats = makePlayerStats();
      stats.spells = ['Unknown Spell'];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Unknown Spell');
    });

    // ── Casting ability from major ──

    it('uses major.spell_casting_ability when class does not have one', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } }],
          spell_casting_ability: undefined,
          major: { spell_casting_ability: 'Charisma' },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });

      const result = getSpellAbilities([], stats);

      expect(result.spellCastingAbility).toBe('Charisma');
      expect(result.modifier).toBe(3);
    });

    // ── Final sort after automation adds spells ──

    it('sorts spells correctly after automation adds spells at various levels', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0),
        makeSpell('Light', 0),
        makeSpell('Shield', 1),
        makeSpell('Magic Missile', 1),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Magic Missile', 'Fire Bolt'];
      stats.automation = {
        passives: [
          { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Light'] },
          { type: 'free_spell', spell: 'Shield' },
        ],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Light', 'Magic Missile', 'Shield']);
    });
  });
});
