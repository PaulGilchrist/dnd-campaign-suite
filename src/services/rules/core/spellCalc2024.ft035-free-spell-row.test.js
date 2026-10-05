// @improved-by-ai
// BUG FT-035(a) lock: a feat's free_spell automation MUST surface its fixed spells as
// castable sheet rows on ANY holder. Fey Touched's feats.json automation
// `spell:["Misty Step"]` (lv2 in the 2024 DB) was collected into automation.actions but
// silently dropped by keepSpellRow — the lv4 Fighter fallback slot table has only lv1
// slots — so the spell row never rendered and its free cast was untestable. Fix shape:
// applyFreeSpellGrant stamps `_freeSpellGrantFreeCast` (generic lane, NOT feat-name
// hardcoded), remapSpellRow carries it, keepSpellRow exempts it (CLA-356/CLA-234
// exemption family). Authorization/consumption stay in spellPreparationService latches.
import { describe, it, expect, vi } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

const detectMagic = { name: 'Detect Magic', level: 1, casting_time: 'Action or Ritual', range: 'Self', school: 'divination', damage: {} };
const mistyStep = { name: 'Misty Step', level: 2, casting_time: 'Bonus Action', range: 'Self', school: 'conjuration', damage: {} };
const invisibility = { name: 'Invisibility', level: 2, casting_time: 'Action', range: 'Touch', school: 'illusion', damage: {} };

// lv4 Battle Master Fighter (FeyNewTest shape): no class spellcasting table; the
// half-caster fallback gives lv1 slots only — a lv2 row would die in keepSpellRow.
function makeFeyTouchedFighter(automation) {
  return {
    name: 'FeyNewTest',
    level: 4,
    proficiency: 2,
    rules: '2024',
    class: {
      name: 'Fighter',
      class_levels: [
        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
      ],
    },
    abilities: [{ name: 'Charisma', baseScore: 9, featIncrease: 1, miscIncrease: 0, backgroundIncrease: 0, bonus: -1 }],
    spells: ['Detect Magic'],
    automation,
  };
}

const FEY_MAGIC_ACTIONS = [{
  type: 'free_spell',
  name: 'Fey Magic',
  spell: ['Misty Step'],
  uses: 1,
  usesMax: 1,
  recharge: 'long_rest',
  perSpellTracking: true,
  casting_time: '1 bonus action',
}];

describe('FT-035(a) free_spell automation row injection (spellCalc2024)', () => {
  it('surfaces the feat automation lv2 Misty Step row on a lv1-slot-only Fighter', () => {
    const stats = makeFeyTouchedFighter({
      actions: FEY_MAGIC_ACTIONS,
      bonusActions: [],
      passives: [],
      specialActions: [{ type: 'free_spell', name: 'Fey Magic', spell: 'Detect Magic', uses: 1, recharge: 'long_rest' }],
    });

    const result = getSpellAbilities([detectMagic, mistyStep], stats);

    expect(result).not.toBeNull();
    expect(result.spell_slots_level_1).toBe(3);
    expect(result.spell_slots_level_2).toBeUndefined();

    const names = result.spells.map(s => s.name);
    expect(names).toEqual(['Detect Magic', 'Misty Step']);

    const row = result.spells.find(s => s.name === 'Misty Step');
    expect(row.level).toBe(2);
    expect(row.prepared).toBe('Always');
    // Remapped to full DB detail and STILL exempt from the slot-level filter.
    expect(row.school).toBe('conjuration');
    expect(row._freeSpellGrantFreeCast).toBe(true);
  });

  it('control: without the automation grant the lv2 disk spell row stays dropped by the slot filter', () => {
    const stats = makeFeyTouchedFighter({ actions: [], bonusActions: [], passives: [], specialActions: [] });
    stats.spells = ['Detect Magic', 'Misty Step'];

    const result = getSpellAbilities([detectMagic, mistyStep], stats);

    expect(result.spells.map(s => s.name)).toEqual(['Detect Magic']);
  });

  it('generic lane: ANY feat free_spell automation row survives the slot filter (not feat-name hardcoded)', () => {
    const stats = makeFeyTouchedFighter({
      actions: [],
      bonusActions: [],
      passives: [],
      specialActions: [{
        type: 'free_spell',
        name: 'Shadow Magic',
        spell: ['Invisibility'],
        uses: 1,
        usesMax: 1,
        recharge: 'long_rest',
        perSpellTracking: true,
      }],
    });

    const result = getSpellAbilities([detectMagic, invisibility], stats);

    const row = result.spells.find(s => s.name === 'Invisibility');
    expect(row).toBeDefined();
    expect(row.level).toBe(2);
    expect(row.prepared).toBe('Always');
    expect(row._freeSpellGrantFreeCast).toBe(true);
  });

  it('stamps an already-present granted row so its free-cast exemption survives the filter', () => {
    const stats = makeFeyTouchedFighter({
      actions: FEY_MAGIC_ACTIONS,
      bonusActions: [],
      passives: [],
      specialActions: [],
    });
    // Spell already persisted on disk (row arrives BEFORE the automation grant).
    stats.spells = ['Detect Magic', 'Misty Step'];

    const result = getSpellAbilities([detectMagic, mistyStep], stats);

    const row = result.spells.find(s => s.name === 'Misty Step');
    expect(row, 'free_spell grant exemption must apply to rows that arrived via disk too').toBeDefined();
    expect(row._freeSpellGrantFreeCast).toBe(true);
  });
});
