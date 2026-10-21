// @maintained-by-ai
// BUG FT-035(a) lock: a feat's free_spell automation MUST surface its fixed spells as
// castable sheet rows on ANY holder, even when the holder's slot table has no slot at
// that spell level. Fey Touched's feats.json automation `spell:["Misty Step"]` was
// collected into automation but silently dropped by keepSpellRow — the lv4 Fighter
// half-caster fallback table (spellCalc2024.js HALF_CASTER_SLOTS) has only lv1 slots.
// Fix shape (spellCalc2024.js): applyFreeSpellGrant stamps `_freeSpellGrantFreeCast` on
// fresh rows (:276) AND on already-present rows (:256 — the exemption belongs to the
// grant, not to how the row arrived); remapSpellRow carries the stamp across the detail
// remap (:713); keepSpellRow exempts it (:754, CLA-356/CLA-234 exemption family,
// data-driven, not feat-name hardcoded). The full-row toEqual below is the non-masking
// proof: the exemption is the FT-035 key alone — no `_telekineticMasterFreeCast`
// (:748) or `_ritualOnly` (:745) bytes smuggled onto these rows (that lane is owned by
// spellCalc2024-telekinetic-master.test.js:124, which asserts the converse).
// Authorization/consumption stay in spellPreparationService latches.
//
// NOT covered here (owned elsewhere): array-grant injection onto a slot-bearing caster
// and free_spell dispatch across containers — spellCalc2024-automation.test.js:136/:260.
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import feats2024 from '../../../../public/data/2024/feats.json' with { type: 'json' };
import spells2024 from '../../../../public/data/2024/spells.json' with { type: 'json' };
import classes2024 from '../../../../public/data/2024/classes.json' with { type: 'json' };

import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: () => undefined,
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: () => null,
}));

// ── Disk-derived fixtures (read, never transcribed) ──
// Fresh clones per call: rows are stamped in place and the JSON module instances are
// cached across tests in this worker.
const diskSpell = name => cloneDeep(spells2024.find(s => s.name === name));

// The feat's fixed-spell automation straight off disk, field-for-field — this byte is
// the FT-035 input; hand-transcribing it would let the test pass on stale shape.
const diskFreeSpellAuto = (featIndex, fixedSpell) => {
  const feat = feats2024.find(f => f.index === featIndex);
  const auto = feat?.benefits
    ?.find(b => b.automation?.type === 'free_spell' && [].concat(b.automation.spell).includes(fixedSpell))
    ?.automation;
  if (!auto) throw new Error(`disk free_spell automation missing for ${featIndex}/${fixedSpell} — fixture drifted from feats.json`);
  return cloneDeep(auto);
};

// lv4 Fighter (FeyNewTest repro shape): disk lv3/4 spellcasting is
// required_major 'Eldritch Knight' and is rejected at spellCalc2024.js:517, so a
// major-less Fighter falls through to the lv1-slot-only half-caster fallback container —
// any lv2 row reaching the sheet must be alive via an FT-035 exemption, nothing else.
const EMPTY_AUTOMATION = () => ({ actions: [], bonusActions: [], passives: [], specialActions: [] });

function makeFighterStats(automation, spells) {
  const fighter = classes2024.find(c => c.name === 'Fighter');
  return {
    name: 'FeyNewTest',
    level: 4,
    proficiency: fighter.class_levels[3].proficiency_bonus,
    rules: '2024',
    class: { name: 'Fighter', class_levels: cloneDeep(fighter.class_levels.slice(0, 4)) },
    // Fey Touched ASI holder: Charisma +1 (base 9 -> 10, mod -1).
    abilities: [{ name: 'Charisma', baseScore: 9, featIncrease: 1, miscIncrease: 0, backgroundIncrease: 0, bonus: -1 }],
    spells,
    automation,
  };
}

// Two DIFFERENT feats exercising the same generic lane — if the exemption were
// feat-name-hardcoded (or a disk edit renamed a fixed spell), one leg would fall.
const DISK_FREE_SPELL_FEATS = [
  { featIndex: 'fey-touched', fixedSpell: 'Misty Step' },
  { featIndex: 'shadow-touched', fixedSpell: 'Invisibility' },
];

describe('FT-035(a) free_spell automation row injection (spellCalc2024)', () => {
  it.each(DISK_FREE_SPELL_FEATS)(
    'surfaces the $featIndex disk automation lv2 spell as a castable row on an lv1-slot-only Fighter (generic lane, full DB detail, FT-035 stamp alone)',
    ({ featIndex, fixedSpell }) => {
      const stats = makeFighterStats(
        { ...EMPTY_AUTOMATION(), actions: [diskFreeSpellAuto(featIndex, fixedSpell)] },
        ['Detect Magic'],
      );

      const result = getSpellAbilities([diskSpell('Detect Magic'), diskSpell(fixedSpell)], stats);

      // Premise: the fallback table has slots but NO lv2 slot — a bare lv2 row dies here.
      expect(result.spell_slots_level_1).toBeGreaterThan(0);
      expect(result.spell_slots_level_2).toBeUndefined();

      expect(result.spells.map(s => s.name)).toEqual(['Detect Magic', fixedSpell]);

      // toEqual (not toMatchObject) is the non-masking proof: row is the full disk
      // spell remapped at its real level with prepared 'Always' plus ONLY the
      // _freeSpellGrantFreeCast stamp — no other exemption key can be what keeps it alive.
      expect(result.spells.find(s => s.name === fixedSpell)).toEqual({
        ...diskSpell(fixedSpell),
        prepared: 'Always',
        _freeSpellGrantFreeCast: true,
      });
    },
  );

  it('control: without the free_spell grant the same lv2 disk spell row stays dropped by the slot filter', () => {
    const stats = makeFighterStats(EMPTY_AUTOMATION(), ['Detect Magic', 'Misty Step']);

    const result = getSpellAbilities([diskSpell('Detect Magic'), diskSpell('Misty Step')], stats);

    // lv1 slots present: the hasAnySlot bypass (keepSpellRow :762) cannot rescue the
    // unstamped lv2 row — it is the missing FT-035 stamp that kills it.
    expect(result.spell_slots_level_1).toBeGreaterThan(0);
    expect(result.spell_slots_level_2).toBeUndefined();
    expect(result.spells.map(s => s.name)).toEqual(['Detect Magic']);
  });

  it('stamps an already-present (disk-persisted) granted row so the exemption survives the filter', () => {
    // Row arrives via persisted spells BEFORE the automation grant: applyFreeSpellGrant
    // must stamp :256, not just push-and-stamp :276 (control above shows the unstamped
    // persisted lv2 row drops).
    const stats = makeFighterStats(
      { ...EMPTY_AUTOMATION(), actions: [diskFreeSpellAuto('fey-touched', 'Misty Step')] },
      ['Detect Magic', 'Misty Step'],
    );

    const result = getSpellAbilities([diskSpell('Detect Magic'), diskSpell('Misty Step')], stats);

    const row = result.spells.find(s => s.name === 'Misty Step');
    expect(row, 'free_spell grant exemption must apply to rows that arrived via disk too').toBeDefined();
    expect(row._freeSpellGrantFreeCast).toBe(true);
    expect(row.level).toBe(2);
  });
});
