// CLA-356 regression: Telekinetic Master (2024 Psi Warrior lv18 Fighter).
// A Fighter has NO spellcasting table. The half-caster fallback (playerStats.spells
// from Magic Initiate/feats) creates a container capped to the HIGHEST persisted spell
// level (lv1 Magic Missile). The lv5 Telekinesis free-cast row was silently DROPPED by
// the slot-level filter (hasAnySlot=true via lv1, no lv5+ slot → filtered out). Fix:
// the free_spell/always_prepared branches stamp _telekineticMasterFreeCast, and the
// filter exempts it (CLA-234/_ritualOnly carry pattern) so Telekinesis surfaces castable
// slot-free with Intelligence as the casting ability + saveDc 17 (8 + INT 3 + PB 6).
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

// ── Fixtures ──

function makePsiWarriorMajor() {
  return {
    name: 'Psi Warrior',
    features: [
      { name: 'Telekinetic Master', description: 'Always have Telekinesis prepared.', level: 18 },
    ],
  };
}

function makeAutomation() {
  return {
    actions: [{
      type: 'free_spell',
      name: 'Telekinetic Master',
      spell: 'Telekinesis',
      uses: 1,
      usesMax: 1,
      recharge: 'long_rest',
      action: 'action',
      concentration: true,
      casting_time: '1 action',
      hasAutomation: true,
    }],
    bonusActions: [{
      type: 'concentration_bonus_attack',
      name: 'Telekinetic Master',
      concentrationSpell: 'Telekinesis',
      action: 'bonus_action',
      weaponAttack: true,
      hasAutomation: true,
    }],
    passives: [{
      type: 'passive_rule',
      effect: 'always_prepared_spells',
      name: 'Telekinetic Master',
      spells: ['Telekinesis'],
      hasAutomation: true,
    }],
    specialActions: [],
  };
}

function makeFighterStats() {
  return {
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    proficiency: 6,
    class: {
      name: 'Fighter',
      spell_casting_ability: 'Intelligence',
      major: makePsiWarriorMajor(),
    },
    // Magic Missile persists from Magic Initiate/feat → the fallback creates lv1 slots only.
    spells: ['Magic Missile'],
    abilities: [
      { name: 'Strength', bonus: -1 },
      { name: 'Dexterity', bonus: -1 },
      { name: 'Intelligence', bonus: 3 },
    ],
    automation: makeAutomation(),
  };
}

function makeAllSpells() {
  return [
    { name: 'Magic Missile', level: 1, casting_time: '1 action', range: '120 ft.', damage: null, ritual: false, school: 'Evocation', description: ['<p>Magic Missile.</p>'] },
    { name: 'Telekinesis', level: 5, casting_time: '1 action', range: '60 ft.', damage: null, ritual: false, school: 'Transmutation', description: ['<p>Telekinesis.</p>'] },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('spellCalc2024 — CLA-356 Telekinetic Master (Psi Warrior lv18 Fighter)', () => {
  it('surfaces the lv5 Telekinesis slotless free cast on a Fighter that only has lv1 slots', () => {
    const abilities = getSpellAbilities(makeAllSpells(), makeFighterStats(), {});
    expect(abilities).toBeTruthy();
    // The fallback container only has lv1 slots (Magic Missile). Without the exemption the
    // lv5 row would be filtered out — assert lv1 exists but NO lv5 slot.
    expect(abilities.spell_slots_level_1).toBeGreaterThan(0);
    expect(abilities.spell_slots_level_5 ?? 0).toBe(0);
    const tk = abilities.spells.find(s => s.name === 'Telekinesis');
    expect(tk, 'Telekinesis must survive the slot-level filter').toBeTruthy();
    expect(tk.level).toBe(5);
    expect(tk.prepared).toBe('Always');
    expect(tk._telekineticMasterFreeCast).toBe(true);
  });

  it('stamps Intelligence as the Telekinesis casting ability + computes saveDc 17 (8+INT3+PB6)', () => {
    const abilities = getSpellAbilities(makeAllSpells(), makeFighterStats(), {});
    const tk = abilities.spells.find(s => s.name === 'Telekinesis');
    expect(tk.spellCastingAbility).toBe('Intelligence');
    expect(abilities.saveDc).toBe(17);
    expect(abilities.saveDc).not.toBe(10);
  });

  it('does NOT surface Telekinesis when there is no Telekinetic Master grant (control)', () => {
    const stats = makeFighterStats();
    stats.automation = { actions: [], bonusActions: [], passives: [], specialActions: [] };
    stats.class.major = { name: 'Battle Master', features: [{ name: 'Combat Superiority', level: 3 }] };
    const abilities = getSpellAbilities(makeAllSpells(), stats, {});
    expect(abilities).toBeTruthy();
    expect(abilities.spells.find(s => s.name === 'Telekinesis')).toBeFalsy();
  });
});
