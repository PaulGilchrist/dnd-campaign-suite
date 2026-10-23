// @maintained-by-ai
// CLA-356 regression: Telekinetic Master (2024 Psi Warrior lv18 Fighter).
// A Fighter has NO spellcasting table for a Psi Warrior (the disk class_levels
// spellcasting rows are gated required_major 'Eldritch Knight'), so the persisted
// lv1 Magic Missile (Magic Initiate/feat) builds a half-caster fallback container
// capped to the HIGHEST persisted spell level — has slots, but ZERO lv5+ slots.
// Pre-fix, keepSpellRow silently dropped the lv5 Telekinesis row there. The fix is
// the CLA-356 stamp/exemption pair: applyAlwaysPreparedGrantSpells / applyFreeSpellGrant
// stamp _telekineticMasterFreeCast (spellCalc2024.js:232/:237/:264) and keepSpellRow
// exempts it (:748) so Telekinesis surfaces castable slot-free, remapped to full
// spells-DB detail, with Intelligence as the casting ability (8 + INT + disk PB saveDc).
// Lane map: free-cast payment/authorization counters → spellPreparationService
// .isFreeCastAuthorized.test.js; the generic _freeSpellGrantFreeCast feat lane →
// spellCalc2024.ft035-free-spell-row.test.js; concentration bonus attack →
// concentrationBonusAttackHandler.test.js. Not re-pinned here.
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import { getSpellAbilities } from './spellCalc2024.js';
import classes2024 from '../../../../public/data/2024/classes.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

// Fixture discipline: class ladder, Psi Warrior major, the Telekinetic Master automation
// payload and the spells-DB rows are ALL read from disk and deep-cloned before use —
// a classes.json/spells.json edit re-drives these rows.
const fighter = classes2024.find(c => c.name === 'Fighter');
const psiWarrior = fighter.majors.find(m => m.name === 'Psi Warrior');
const tmFeature = psiWarrior.features.find(f => f.name === 'Telekinetic Master');
const LADDER = cloneDeep(fighter.class_levels);
const PB = LADDER[17].proficiency_bonus;
const INT_BONUS = 3;

const diskLevel = name => spells2024.find(s => s.name === name).level;
const ALL_SPELLS = cloneDeep(spells2024.filter(s => ['Magic Missile', 'Telekinesis'].includes(s.name)));

// The real collector stamps feature.name onto every automation row
// (automationCollector.js) — mirror that on the disk automation entries.
const tmAutomationRow = type => ({
  ...cloneDeep(tmFeature.automation.find(a => a.type === type)),
  name: tmFeature.name,
});

function makeTMAutomation({ actions = [tmAutomationRow('free_spell')], bonusActions = [tmAutomationRow('concentration_bonus_attack')], passives = [tmAutomationRow('passive_rule')] } = {}) {
  return { actions, bonusActions, passives, specialActions: [] };
}

function makeFighterStats({ automation = makeTMAutomation(), spells = ['Magic Missile'], level = 18 } = {}) {
  return {
    name: 'PsiWarriorFighter',
    level,
    rules: '2024',
    proficiency: PB,
    class: {
      name: 'Fighter',
      spell_casting_ability: fighter.spell_casting_ability,
      class_levels: LADDER,
      major: cloneDeep(psiWarrior),
    },
    // Magic Missile persists from Magic Initiate/feat → the fallback container is lv1-only.
    spells,
    abilities: [
      { name: 'Strength', bonus: -1 },
      { name: 'Dexterity', bonus: -1 },
      { name: 'Intelligence', bonus: INT_BONUS },
    ],
    automation,
  };
}

const rowNames = abilities => abilities.spells.map(s => s.name).sort();
const findRow = (abilities, name) => abilities.spells.find(s => s.name === name);

describe('spellCalc2024 — CLA-356 Telekinetic Master (Psi Warrior lv18 Fighter)', () => {
  it('lv18 disk payload: lv5 Telekinesis free-cast row survives on the lv1-slot-only fallback sheet', () => {
    const abilities = getSpellAbilities(ALL_SPELLS, makeFighterStats(), {});

    expect(abilities).toBeTruthy();
    // The half-caster fallback is capped to the highest PERSISTED spell level: the
    // container HAS lv1 slots but ZERO lv5 slots — the exact trap that silently killed
    // the row pre-CLA-356.
    expect(abilities.spell_slots_level_1).toBeGreaterThan(0);
    expect(abilities.spell_slots_level_2).toBeUndefined();
    expect(abilities.spell_slots_level_5).toBeUndefined();
    expect(rowNames(abilities)).toEqual(['Magic Missile', 'Telekinesis']);

    const tk = findRow(abilities, 'Telekinesis');
    // Remapped to full spells-DB detail (the disk major.spells byte is the lv18
    // UNLOCK tier per #1348, never a spell level), always prepared, stamped for
    // the slotless exemption, INT as its casting ability.
    expect(tk.level).toBe(diskLevel('Telekinesis'));
    expect(tk.prepared).toBe('Always');
    expect(tk._telekineticMasterFreeCast).toBe(true);
    expect(tk.spellCastingAbility).toBe('Intelligence');
    expect(tk.concentration).toBe(true);

    expect(abilities.spellCastingAbility).toBe('Intelligence');
    expect(abilities.saveDc).toBe(8 + INT_BONUS + PB);
    expect(abilities.toHit).toBe(INT_BONUS + PB);
  });

  it('the exemption is _telekineticMasterFreeCast, not the FT-035 generic lane: passive-only payload survives the slot filter', () => {
    // Remove the free_spell ACTION from the payload — only the always_prepared_spells
    // passive remains, so the row carries the CLA-356 stamp alone. Deleting keepSpellRow
    // :748 fails here (and NOT in the full-payload test, where the co-stamped
    // _freeSpellGrantFreeCast would mask it); deleting the passive-side stamps at
    // :232/:237 fails the next test.
    const abilities = getSpellAbilities(
      ALL_SPELLS,
      makeFighterStats({ automation: makeTMAutomation({ actions: [], bonusActions: [] }) }),
      {},
    );

    const tk = findRow(abilities, 'Telekinesis');
    expect(tk, 'CLA-356 exemption must keep the lv5 row with lv1 slots only').toBeTruthy();
    expect(tk._telekineticMasterFreeCast).toBe(true);
    expect(tk._freeSpellGrantFreeCast, 'the generic free_spell lane must NOT be what keeps this row alive here').toBeUndefined();
    expect(tk.spellCastingAbility).toBe('Intelligence');
  });

  it('unstamped control: the disk major.spells grant alone adds Telekinesis, but keepSpellRow drops the lv5 row', () => {
    // No automation → no _telekineticMasterFreeCast / _freeSpellGrantFreeCast stamp.
    // psiWarrior.spells (disk) still adds the row via addMajorSubclassSpells, so this
    // falsifies the exemption itself: the row arrives and is filtered out, lv5 > lv1.
    const abilities = getSpellAbilities(
      ALL_SPELLS,
      makeFighterStats({ automation: { actions: [], bonusActions: [], passives: [], specialActions: [] } }),
      {},
    );

    expect(rowNames(abilities)).toEqual(['Magic Missile']);
  });

  // #1348 — DATA verdict on the psi major.spells Telekinesis row (was level:0 on disk,
  // oddity pinned #1274). The field is the CHARACTER-UNLOCK TIER, not the spell level:
  // consumers gate on it (spellCalc2024.js:136 `playerStats.level >= spellLevel`;
  // getPreSelectedSpells.js:186 `charLevel >= (entry.level || 1)`) and the spell's lv5
  // CAST level is canonically carried by the spells.json DB clone in remapSpellRow.
  // Family law: every level:0 row on disk is a true cantrip (Eldritch Knight Ray of
  // Frost/Shocking Grasp, Arcane Trickster trio, Monk Elementalism, Stars Guidance);
  // every >2 value is the RAW unlock tier (Wildheart Commune lv10, Warlock/Aberrant
  // Telekinesis lv9, domain 3/5/7/9). RAW 2024 PHB lv18 Telekinetic Master: "You
  // always have the telekinesis spell prepared. With this feature, you can cast it
  // without a spell slot or components" — slotless CAST, still the lv5 spell, unlocked
  // at exactly Fighter lv18. level:0 was a corrupt cantrip-shaped token (copy-paste
  // adjacency to the Eldritch Knight cantrip rows, born in e4ec998f0, never mutated):
  // it let the row join at lv3-17 and survive keepSpellRow's !hasAnySlot pass on any
  // slotless-container Psi Fighter (e.g. High Elf lineage), and getPreSelectedSpells
  // preselected it from lv1. The honest byte is 18.
  it('#1348 disk law: the major.spells byte is the lv18 unlock tier and gates the row exactly', () => {
    // Byte law — re-reads disk: a classes.json edit of this row re-drives this pin.
    expect(psiWarrior.spells).toEqual([{ name: 'Telekinesis', level: 18 }]);

    // Slotless-container scaffold: an elfish_lineage specialAction with no matching
    // lineage options seeds SLOTLESS_CONTAINER (spellCalc2024.js:624) and grants no
    // rows itself — the only way a lv<18 Fighter carries a spell sheet at all. The
    // Fighter has no spellcasting table (class_levels gated required_major 'Eldritch
    // Knight'), so hasAnySlot is false and keepSpellRow keeps every granted row: this
    // carrier isolates addMajorSubclassSpells' level gate from the slot filter.
    const slotlessAutomation = {
      actions: [],
      bonusActions: [],
      passives: [],
      specialActions: [{ type: 'elfish_lineage', name: 'Elven Lineage', options: [] }],
    };

    const lv17 = getSpellAbilities(
      ALL_SPELLS,
      makeFighterStats({ spells: [], automation: slotlessAutomation, level: 17 }),
      {},
    );
    expect(findRow(lv17, 'Telekinesis'), 'lv17 psi cannot cast lv18 Telekinetic Master — the disk unlock byte must gate the row out').toBeUndefined();

    const lv18 = getSpellAbilities(
      ALL_SPELLS,
      makeFighterStats({ spells: [], automation: slotlessAutomation }),
      {},
    );
    const tk = findRow(lv18, 'Telekinesis');
    expect(tk, 'the byte unlocks the row at exactly lv18').toBeTruthy();
    expect(tk.level).toBe(diskLevel('Telekinesis')); // lv5 cast level rides the DB clone, not the gate byte
    expect(tk.prepared).toBe('Always');

    // Leak proof (memory-only pre-fix bytes, disk untouched): replaying the corrupt
    // level:0 on the SAME lv17 slotless carrier joins AND keeps the lv5 row —
    // falsifies the gate claim by showing what the fix prevents.
    const corruptMajor = cloneDeep(psiWarrior);
    corruptMajor.spells = [{ name: 'Telekinesis', level: 0 }];
    const lv17Corrupt = makeFighterStats({ spells: [], automation: slotlessAutomation, level: 17 });
    lv17Corrupt.class.major = corruptMajor;
    const leaked = getSpellAbilities(ALL_SPELLS, lv17Corrupt, {});
    expect(findRow(leaked, 'Telekinesis'), 'pre-fix level:0 leaked a lv17 always-prepared lv5 row').toBeTruthy();
  });
});
