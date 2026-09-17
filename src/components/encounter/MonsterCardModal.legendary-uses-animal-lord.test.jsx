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
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName,
  regainLegendaryUses,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Animal Lord 1', type: 'npc', monsterType: 'celestial', targetName: 'TestPC', currentHp: 323, maxHp: 323, ac: 19, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Animal Lord 1.monsterLegendaryUses';
const LATCH_KEY = 'Animal Lord 1._legendaryUses_usedRound';

const lord = () => monstersData.find(m => m.index === 'animal-lord');
const legendary = () => lord().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const action = (name) => lord().actions.find(a => a.name === name);

// MA-0277 data lock: economy header authors numeric uses:3 (was: 3 only in
// the name string — legendaryHeaderAction null, ungated branch, no counter).
describe('MA-0277 monsters.json data: animal-lord legendary header authors uses:3', () => {
  it('rows[0] carries uses:3 and arms legendaryHeaderAction', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3');
    expect(legendary()[0].uses).toBe(3);
    expect(legendaryHeaderAction(lord())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
  });

  it('header boilerplate mirrors the VERIFIED adult dragon siblings (dragon→animal lord)', () => {
    for (const idx of ['adult-white-dragon', 'adult-silver-dragon']) {
      const sibling = monstersData.find(m => m.index === idx).legendary_actions[0];
      const mirror = sibling.description.replace(/\bdragon\b/g, 'animal lord').replace(/ In its lair the animal lord has 4 uses \(advisory — no lair flag consumer; GM-enforced\)\./, '');
      expect(legendary()[0].description).toBe(mirror);
    }
  });
});

// MA-0278/MA-0279 same-pass children (MA-0164 silent-burn rule): both prose
// rows delegate to the lord's OWN attack rows by exact actions[] name.
describe('MA-0278/0279 monsters.json data: children delegate to Rend / Radiant Ray', () => {
  it('Feral Strike delegates_to Rend, resolves +13 / 2d6 + 7 Slashing (+2d6 Force)', () => {
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
    expect(legendaryDelegateAction(lord(), feral)).toBe(rend);
    expect(legendaryDelegateAttackName(feral, rend)).toBe('Feral Strike (Rend attack)');
  });

  it('Radiant Strike delegates_to Radiant Ray, resolves +12 / 4d6 + 6 Radiant', () => {
    const radiant = row('Radiant Strike');
    expect(radiant.delegates_to).toBe('Radiant Ray');
    expect(radiant.attack_bonus).toBeUndefined();
    expect(radiant.save_dc).toBeUndefined();
    const ray = action('Radiant Ray');
    expect(ray.attack_bonus).toBe(12);
    expect(ray.damage_dice_primary).toBe('4d6 + 6');
    expect(ray.damage_type_primary).toBe('Radiant');
    expect(legendaryDelegateAction(lord(), radiant)).toBe(ray);
    expect(legendaryDelegateAttackName(radiant, ray)).toBe('Radiant Strike (Radiant Ray attack)');
  });

  it('anchor discipline: gynosphinx block and cyclops Radiant Strike row UNTOUCHED', () => {
    const gy = monstersData.find(m => m.index === 'gynosphinx').legendary_actions;
    expect(gy.length).toBe(3);
    expect(gy[0].name).toBe('Claw Attack');
    expect(gy[0].delegates_to).toBeUndefined();
    expect(gy[0].uses).toBeUndefined();
    const cyclopsRadiant = monstersData
      .find(m => (m.actions || []).some(a => a.name === 'Radiant Strike' && a.attack_bonus === 10))
      ?.actions.find(a => a.name === 'Radiant Strike');
    expect(cyclopsRadiant.delegates_to).toBeUndefined();
    expect(cyclopsRadiant.attack_bonus).toBe(10);
  });
});

// MA-0277 live seam: counter mounts, gated spend resolves the REAL delegated
// numbers on both children, refusals (same-window latch / exhaustion /
// own-turn) hold, turn-start regain clears (was: no counter, 0-affordance
// rows, zero-delta clicks).
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

  it('Feral Strike gated click spends 1 and rolls the delegated +13 / 2d6 + 7 attack, zero console dead-end', async () => {
    renderALord({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Radiant Strike gated click spends 1 and rolls the delegated +12 / 4d6 + 6 attack, zero console dead-end', async () => {
    renderALord({ max: 3, used: 1 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(lordRow('Radiant Strike').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Radiant Strike (Radiant Ray attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    expect(ROLLERS.rollAttack.mock.calls[0][2].autoDamageFormula).toBe('4d6 + 6');
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('repeat same-window refuses (turn latch): zero extra spend, one spend log', async () => {
    renderALord({ max: 3, used: 0 });
    const chip = lordRow('Feral Strike').querySelector('.mc-dice-link-legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    const spends = addEntry.mock.calls.map(c => c[1]).filter(e => /expends a legendary use for Feral Strike/.test(String(e.description)));
    expect(spends.length).toBe(1);
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(1);
  });

  it('exhausted (3/3): chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderALord({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(lordRow('Radiant Strike').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero roll', async () => {
    renderALord({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Animal Lord 1', creatures: CREATURES };
    fireEvent.click(lordRow('Feral Strike').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn-start regain clears uses and latch with an ability_use log', async () => {
    runtime.store[KEY] = { max: 3, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    const res = await regainLegendaryUses({
      monsterName: 'Animal Lord 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry,
      },
    });
    expect(res).toEqual({ regained: true, max: 3 });
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => /regains all expended legendary action uses/.test(String(e.description)));
    expect(regain.description).toMatch(/Animal Lord 1 regains all expended legendary action uses at the start of its turn — 3 available\./);
  });
});
