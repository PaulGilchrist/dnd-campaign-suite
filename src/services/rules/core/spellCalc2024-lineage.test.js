// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

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

const lv1Casting = { cantrips_known: 3, spell_slots_level_1: 2, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spell_type: 'prepared' };
const lv5Casting = { cantrips_known: 4, spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 2, spell_slots_level_5: 1, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spell_type: 'prepared' };
// class_levels is indexed by level-1 — pad the holes.
const lv5WizardClass = {
  name: 'Wizard',
  class_levels: [{ level: 1, spellcasting: lv1Casting }, undefined, undefined, undefined, { level: 5, spellcasting: lv5Casting }],
  spell_casting_ability: 'Intelligence',
};

describe('spellCalc2024-lineage', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await import('../../../hooks/runtime/useRuntimeState.js');
    await import('../../character/classRules2024.js');
  });

  describe('getSpellAbilities', () => {
    // ── Automation: elfish_lineage ──

    it('adds elfish lineage cantrip, level 3, and level 5 spells at level 5 when lineage matches', () => {
      const allSpells = [
        makeSpell('Blade Ward', 0),
        makeSpell('Burning Hands', 1),
        makeSpell('Crown of Madness', 1),
      ];

      const stats = makePlayerStats({ level: 5, class: lv5WizardClass });
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

    it('CLA-118: level 1 elfish lineage adds ONLY the cantrip — ladder spells stay gated', () => {
      const allSpells = [
        makeSpell('Druidcraft', 0),
        makeSpell('Longstrider', 1),
        makeSpell('Pass Without Trace', 2),
      ];

      const stats = makePlayerStats();
      stats.automation = {
        specialActions: [{
          type: 'elfish_lineage',
          options: [{ name: 'Wood Elf', spellcastingAbility: 'Wisdom', cantrip: 'Druidcraft', level3Spell: 'Longstrider', level5Spell: 'Pass Without Trace', speedBonus: 5 }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'test-campaign', race: { name: 'Elf', subrace: { name: 'Wood Elf' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Druidcraft');
      expect(names).not.toContain('Longstrider');
      expect(names).not.toContain('Pass Without Trace');
      expect(result.spells.filter(s => s.level > 0)).toHaveLength(0);
    });

    it('CLA-118: level 3 elfish lineage adds the level 3 spell but not the level 5 spell', () => {
      const allSpells = [
        makeSpell('Druidcraft', 0),
        makeSpell('Longstrider', 1),
        makeSpell('Pass Without Trace', 2),
      ];

      const stats = makePlayerStats({
        level: 3,
        class: {
          name: 'Fighter',
          class_levels: [{ level: 3 }],
          spell_casting_ability: 'Wisdom',
        },
      });
      stats.automation = {
        specialActions: [{
          type: 'elfish_lineage',
          options: [{ name: 'Wood Elf', spellcastingAbility: 'Wisdom', cantrip: 'Druidcraft', level3Spell: 'Longstrider', level5Spell: 'Pass Without Trace', speedBonus: 5 }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'test-campaign', race: { name: 'Elf', subrace: { name: 'Wood Elf' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Druidcraft');
      expect(names).toContain('Longstrider');
      expect(names).not.toContain('Pass Without Trace');
      expect(result.spells_known).toBe(1);
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

    it('adds gnomish lineage cantrip at level 1 and gates ladder spells until their levels', () => {
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

      const lv1 = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Gnome', subrace: { name: 'Deep Gnome' } } });
      const lv1Names = lv1.spells.map(s => s.name);
      expect(lv1Names).toContain('Friends');
      expect(lv1Names).not.toContain('Web');
      expect(lv1Names).not.toContain('Hold Monster');

      const lv5Stats = makePlayerStats({ level: 5, class: lv5WizardClass });
      lv5Stats.automation = stats.automation;
      const lv5 = getSpellAbilities(allSpells, lv5Stats, { campaignName: 'TestCampaign', race: { name: 'Gnome', subrace: { name: 'Deep Gnome' } } });
      const lv5Names = lv5.spells.map(s => s.name);
      expect(lv5Names).toContain('Friends');
      expect(lv5Names).toContain('Web');
      expect(lv5Names).toContain('Hold Monster');
    });

    // ── Automation: fiendish_legacy ──

    it('gates fiendish legacy ladder spells until the character reaches their levels', () => {
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

      const lv1Names = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Fiend Tiefling' } } }).spells.map(s => s.name);
      expect(lv1Names).toContain('Infestation');
      expect(lv1Names).not.toContain('Scorching Ray');
      expect(lv1Names).not.toContain('Dominate Person');

      const lv5Stats = makePlayerStats({ level: 5, class: lv5WizardClass });
      lv5Stats.automation = stats.automation;
      const lv5Names = getSpellAbilities(allSpells, lv5Stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Fiend Tiefling' } } }).spells.map(s => s.name);
      expect(lv5Names).toContain('Infestation');
      expect(lv5Names).toContain('Scorching Ray');
      expect(lv5Names).toContain('Dominate Person');
    });

    it('creates spellAbilities for non-spellcasting character with fiendish legacy (ladder gated by level)', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0),
        makeSpell('Hellish Rebuke', 1),
        makeSpell('Darkness', 2),
      ];

      const stats = makePlayerStats({
        class: {
          name: 'Fighter',
          class_levels: [{ level: 3 }],
          spell_casting_ability: 'Intelligence',
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

      // Level 1: cantrip only, ladder spells gated.
      const lv1 = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Infernal Tiefling' } } });
      expect(lv1).not.toBeNull();
      const lv1Names = lv1.spells.map(s => s.name);
      expect(lv1Names).toContain('Fire Bolt');
      expect(lv1Names).not.toContain('Hellish Rebuke');
      expect(lv1Names).not.toContain('Darkness');
      expect(lv1.cantrips_known).toBe(1);
      expect(lv1.spells_known).toBe(0);

      const lv5Stats = { ...stats, level: 5 };
      const result = getSpellAbilities(allSpells, lv5Stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Infernal Tiefling' } } });

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

    // CLA-139 mirror: Abyssal ladder per races.json:880 (Ray of Sickness lv1 in the
    // 2024 spells DB, Hold Person lv2) — the level keys, not the slot filter, gate.
    it('CLA-139: lv1/lv3 Abyssal Tiefling ladder is gated by the levelNSpell keys', () => {
      const allSpells = [
        makeSpell('Poison Spray', 0),
        makeSpell('Ray of Sickness', 1),
        makeSpell('Hold Person', 1),
      ];

      const abyssal = [{ name: 'Abyssal', cantrip: 'Poison Spray', level3Spell: 'Ray of Sickness', level5Spell: 'Hold Person' }];
      const automation = { specialActions: [{ type: 'fiendish_legacy', options: abyssal }] };
      const tiefling = { campaignName: 'test-campaign', race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } } };

      const lv1Names = getSpellAbilities(allSpells, makePlayerStats({ automation }), tiefling).spells.map(s => s.name);
      expect(lv1Names).toContain('Poison Spray');
      expect(lv1Names).not.toContain('Ray of Sickness');
      expect(lv1Names).not.toContain('Hold Person');

      const lv3Casting = { cantrips_known: 4, spell_slots_level_1: 4, spell_slots_level_2: 2, spell_slots_level_3: 2, spell_slots_level_4: 0, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spell_type: 'prepared' };
      const lv3Stats = makePlayerStats({
        level: 3,
        class: {
          name: 'Wizard',
          class_levels: [{ level: 1, spellcasting: lv1Casting }, undefined, { level: 3, spellcasting: lv3Casting }],
          spell_casting_ability: 'Intelligence',
        },
        automation,
      });
      const lv3Names = getSpellAbilities(allSpells, lv3Stats, tiefling).spells.map(s => s.name);
      expect(lv3Names).toContain('Poison Spray');
      expect(lv3Names).toContain('Ray of Sickness');
      expect(lv3Names).not.toContain('Hold Person');

      const lv5Stats = makePlayerStats({ level: 5, class: lv5WizardClass, automation });
      const lv5Names = getSpellAbilities(allSpells, lv5Stats, tiefling).spells.map(s => s.name);
      expect(lv5Names).toContain('Ray of Sickness');
      expect(lv5Names).toContain('Hold Person');
    });

    // CLA-139: no subrace → the sheet-chooser runtime selection refines the lane.
    it('CLA-139: Tiefling without subrace resolves legacy from the runtime selection', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0),
        makeSpell('Hellish Rebuke', 1),
        makeSpell('Darkness', 2),
      ];

      getRuntimeValue.mockImplementation((_name, key) => (key === '_fiendishLegacySelection' ? 'Infernal' : null));

      const stats = makePlayerStats({
        level: 5,
        class: lv5WizardClass,
        automation: {
          specialActions: [{
            type: 'fiendish_legacy',
            options: [{ name: 'Infernal', cantrip: 'Fire Bolt', level3Spell: 'Hellish Rebuke', level5Spell: 'Darkness' }],
          }],
        },
      });

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'test-campaign', race: { name: 'Tiefling', subrace: null } });
      const names = result.spells.map(s => s.name);
      expect(names).toContain('Fire Bolt');
      expect(names).toContain('Hellish Rebuke');
      expect(names).toContain('Darkness');
      expect(getRuntimeValue).toHaveBeenCalledWith('TestCharacter', '_fiendishLegacySelection', 'test-campaign');
    });
  });
});
