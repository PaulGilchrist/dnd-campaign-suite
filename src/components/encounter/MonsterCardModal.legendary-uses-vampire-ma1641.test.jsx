// MA-1641 regression: Vampire Deathless Strike (legendary_actions[2]) was a
// prose-only child with NO delegates_to — the "Expend Legendary" chip
// (LegendarySpendLink, sole live .mc-dice-link-legendary on the card) spent
// the shared MA-1640 header use, then resolveLegendaryRowMechanic
// (MonsterCardModal.jsx:687-712) fell through every branch (no attack_bonus,
// no save_dc, no advisory, no self-buff, extractDamageDiceFromDescription
// needs "Hit|Failure|Success: N (XdY)" — no match) to console.error
// "no resolvable mechanic" = MA-0510/0696/0957/1636 silent-burn fingerprint
// (spend logged, ZERO popup/roll/damage). Fix is the one-field delegate
// lanes of monsterLegendaryUses.js:3-9 (legendaryDelegateAction spans
// actions[]): delegates_to:"Grave Strike" (live twins MA-0675 Eruption→
// Elemental Burst, MA-0956 Claw→Claw, MA-1635 Charging Horn→Radiant Horn
// byte-shape {name, description, delegates_to}). The move clause stays
// gridless advisory in the description prose — an advisory key WOULD
// preempt the numeric delegate leg (MA-1457/MA-1494 ordering). Header
// uses:2 + clean child keys verified in the MA-1640 sibling file.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryDelegateAction, legendaryDelegateAttackName } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollDamage: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  ROLLERS.rollAttack = vi.fn();
  ROLLERS.rollDamage = vi.fn();
  ROLLERS.rollSavingThrow = vi.fn();
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: ROLLERS.rollAttack, rollDamage: ROLLERS.rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow: ROLLERS.rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
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
  rangeToFeet: vi.fn(() => 30),
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
  { name: 'Vampire 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 195, maxHp: 195, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const KEY = 'Vampire 1.monsterLegendaryUses';
const vampire = () => monstersData.find(m => m.name === 'Vampire');
const legendary = () => vampire().legendary_actions;
const dsRow = () => legendary().find(a => a.name === 'Deathless Strike');

describe('MA-1641 monsters.json data lock: Deathless Strike delegates_to Grave Strike', () => {
  it('row byte-shape mirrors the MA-1635 unicorn twin {name, description, delegates_to}', () => {
    const ds = dsRow();
    expect(ds.delegates_to).toBe('Grave Strike');
    expect(ds.description).toBe('The vampire moves up to half its Speed, and it makes one Grave Strike attack.');
    expect(Object.keys(ds)).toEqual(['name', 'description', 'delegates_to']);
    expect(ds.uses).toBeUndefined();
    expect(ds.recharge).toBeUndefined();
    expect(ds.advisory).toBeUndefined();
    expect(ds.advisory_message).toBeUndefined();
    expect(ds.attack_bonus).toBeUndefined();
    expect(ds.save_dc).toBeUndefined();
  });

  it('delegate spans actions[] and resolves the byte-existing +9 Grave Strike row', () => {
    const delegate = legendaryDelegateAction(vampire(), dsRow());
    expect(delegate).not.toBe(null);
    expect(delegate.name).toBe('Grave Strike');
    expect(delegate.attack_bonus).toBe(9);
    expect(delegate.damage_dice_primary).toBe('1d8 + 4');
    expect(delegate.damage_dice_secondary).toBe('2d6');
    expect(delegate.damage_type_secondary).toBe('Necrotic');
    expect(legendaryDelegateAttackName(dsRow(), delegate)).toBe('Deathless Strike (Grave Strike attack)');
  });
});

describe('MA-1641 MonsterCardModal delegated legendary attack adjudication', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderVampire(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Vampire',
      actions: vampire().actions,
      legendary_actions: legendary(),
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Vampire 1', creatures: CREATURES })} />);
  }
  function expendChip() {
    return Array.from(document.querySelectorAll('.mc-action'))
      .find(r => r.textContent.trim().startsWith('Deathless Strike'))?.querySelector('.mc-dice-link-legendary') || null;
  }

  it('Expend-Legendary chip spends 2→1 and adjudicates the delegated +9 Grave Strike attack, console clean', async () => {
    renderVampire({ max: 2, used: 0 });
    const chip = expendChip();
    expect(chip).not.toBeNull();
    expect(chip.textContent.trim()).toBe('Expend Legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Deathless Strike (Grave Strike attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(9);
    const attacked = ROLLERS.rollAttack.mock.calls[0][2];
    expect(attacked.autoDamageFormula).toBe('1d8 + 4');
    expect(attacked.autoDamageSecondaryFormula).toBe('2d6');
    expect(attacked.autoDamageSecondaryDamageType).toBe('Necrotic');
    expect(attacked.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Deathless Strike/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Deathless Strike/);
    expect(spend.description).toMatch(/1 of 2 left/);
    expect(consoleSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('same active creature refire refuses on the turn latch, counter held, zero extra attack', async () => {
    renderVampire({ max: 2, used: 0 });
    fireEvent.click(expendChip());
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    ROLLERS.rollAttack.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(expendChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('exhausted (2/2): press refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderVampire({ max: 2, used: 2 });
    fireEvent.click(expendChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('own-turn refusal leg: refuses before spend, zero attack rolled (§204 exhaustion/turn gates first)', async () => {
    renderVampire({ max: 2, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Vampire 1', creatures: CREATURES };
    fireEvent.click(expendChip());
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
