// @maintained-by-ai
// MA-0277 regression: Animal Lord legendary_actions[0] carried "Legendary
// Action Uses: 3" ONLY as name-text — no numeric `uses` field — so
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (live: 0 .mc-legendary-counter, Feral Strike / Radiant Strike bare prose
// with 0 affordances, 2× clicks zero log delta, monsterLegendaryUses never
// created; control Rend +13 chip alive). Fix mirrors the MA-0136/MA-0217/
// MA-0259 DATA-only template: header "uses":3 arms counter/spend/refusal/
// regain, and BOTH prose children are authored the SAME pass (MA-0164
// silent-burn): Feral Strike delegates_to:"Rend" (MA-0278/0220/0022 seam,
// +13 / 2d6 + 7 Slashing + 2d6 Force; the move-up-to-Speed / no-OA clause
// stays §7 GM-enforced residual), Radiant Strike delegates_to:"Radiant Ray"
// (MA-0279/0274 seam, +12 / 4d6 + 6 Radiant) — exact actions[] name match.
//
// Trimmed per #619-#623 template settled: generic header/max/remaining,
// expend-gate reasons, delegation resolution, regain and refusal builders are
// cite-skipped (monsterLegendaryUses.test.js :65-73/:86/:93-103/:124/:136/
// :146-155/:164/:216); modal-level exhausted/latch/own-turn refusals are
// cite-skipped (legendary-uses.test.jsx :190/:310 + beholder/blob/arch-hag
// own-turn lanes). This file keeps only animal-lord-BY-name data locks and
// the two effect-distinct gated clicks (each once): the counter/chip mount
// that was absent, Feral Ride secondary-Force bytes, Radiant Ray bytes.
// Gynosphinx MA-0956 block lives in its own lane
// (legendary-uses-gynosphinx.test.jsx :116-165); only the cyclops row-anchor
// discipline (exclusive to this file) rides the data lock below.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 5),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';

const CREATURES = [
  { name: 'Animal Lord 1', type: 'npc', monsterType: 'celestial', targetName: 'TestPC', currentHp: 323, maxHp: 323, ac: 19, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Animal Lord 1.monsterLegendaryUses';

const lord = () => monstersData.find(m => m.index === 'animal-lord');
const row = (name) => lord().legendary_actions.find(a => a.name === name);
const action = (name) => lord().actions.find(a => a.name === name);

// MA-0277/0278/0279 data lock (BY-name rows): header authors numeric uses:3
// (was: 3 only in the name string → ungated branch, no counter — the counter
// mount below proves legendaryHeaderAction arms LIVE), and BOTH prose children
// delegate to the lord's OWN attack rows by exact actions[] name (MA-0164
// silent-burn rule) with the delegate owning every numeric.
describe('MA-0277/0278/0279 monsters.json data: animal-lord header + children', () => {
  it('header uses:3; Feral Strike/Radiant Strike delegate BY-name with exact numerics; cyclops anchor untouched', () => {
    expect(lord().legendary_actions[0].name).toBe('Legendary Action Uses: 3');
    expect(lord().legendary_actions[0].uses).toBe(3);

    const feral = row('Feral Strike');
    expect(feral.delegates_to).toBe('Rend');
    expect(feral.attack_bonus).toBeUndefined();
    expect(feral.save_dc).toBeUndefined();
    const rend = action('Rend');
    expect(rend.attack_bonus).toBe(13);
    expect(rend.damage_dice_primary).toBe('2d6 + 7');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('2d6');
    expect(rend.damage_type_secondary).toBe('Force');

    const radiant = row('Radiant Strike');
    expect(radiant.delegates_to).toBe('Radiant Ray');
    expect(radiant.attack_bonus).toBeUndefined();
    expect(radiant.save_dc).toBeUndefined();
    const ray = action('Radiant Ray');
    expect(ray.attack_bonus).toBe(12);
    expect(ray.damage_dice_primary).toBe('4d6 + 6');
    expect(ray.damage_type_primary).toBe('Radiant');

    // Row-anchor discipline (MA-0956 twin): an UNRELATED monster's identically
    // named actions row keeps its own numbers and gains no delegates_to.
    const cyclopsRadiant = monstersData
      .find(m => m.index === 'cyclops-oracle')?.actions.find(a => a.name === 'Radiant Strike');
    expect(cyclopsRadiant.delegates_to).toBeUndefined();
    expect(cyclopsRadiant.attack_bonus).toBe(10);
  });
});

// MA-0277 live seam: counter mounts and both children render gated chips
// (was: 0 affordances, zero-delta clicks); each effect-distinct child click
// spends 1 and rolls the REAL delegated numbers once. Refusals (turn latch,
// exhaustion, own-turn) are the generic gate — see cite-skips up top.
describe('MA-0277 MonsterCardModal animal-lord gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderALord(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Animal Lord',
      actions: lord().actions,
      legendary_actions: lord().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Animal Lord 1', creatures: CREATURES })} />);
  }
  function lordRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); both children render gated chips', () => {
    renderALord({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    for (const name of ['Feral Strike', 'Radiant Strike']) {
      const chip = lordRow(name).querySelector('.mc-dice-link-legendary');
      expect(chip).not.toBe(null);
      expect(chip.textContent).toContain('Expend Legendary');
    }
  });

  it('Feral Strike gated click spends 1 and rolls the delegated +13 / 2d6 + 7 (+2d6 Force) attack', async () => {
    renderALord({ max: 3, used: 0 });
    fireEvent.click(lordRow('Feral Strike').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Feral Strike (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(13);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d6 + 7');
    expect(options.autoDamageSecondaryFormula).toBe('2d6');
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Feral Strike/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Feral Strike/);
  });

  it('Radiant Strike gated click spends 1 and rolls the delegated +12 / 4d6 + 6 attack', async () => {
    renderALord({ max: 3, used: 1 });
    fireEvent.click(lordRow('Radiant Strike').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Radiant Strike (Radiant Ray attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    expect(ROLLERS.rollAttack.mock.calls[0][2].autoDamageFormula).toBe('4d6 + 6');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Radiant Strike/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Radiant Strike/);
  });
});
