// MA-0675 regression: Elemental Cataclysm legendary_actions[0] was the
// Eruption CHILD with uses:1 — legendaryHeaderAction() swallowed it as the
// header, so the card printed "Eruption (1 left)" as inert header text with
// ZERO affordance (MonsterCardBody renders slice(1)): no .mc-dice-link-
// legendary, no "Expend Legendary" chip, no console.error (LegendarySpendLink
// never ran on the swallowed row), economy unreachable (§99 harder-zero than
// MA-0510). Fix mirrors the §165 Colossus/Death Knight/MA-0620 byte-shape
// DATA-only one-pass template: header "Legendary Action Uses: 3" + numeric
// uses:3 (CR 22 twins ancient-bronze/ancient-green in this file both stamp
// numeric 3; canonical total is a named honest gap — a correction is a
// one-line edit of la[0].uses + its name), and Eruption authored the SAME
// pass as a delegating child onto the byte-existing +15 Elemental Burst
// attack row (MA-0672 live-proven) with its own uses dropped.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const ELEMENTAL_BURST = { name: 'Elemental Burst', attack_bonus: 15, reach: '30 ft.', range: '150 ft.', damage_dice_primary: '5d6 + 8', damage_type_primary: 'Acid' };

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
  { name: 'Elemental Cataclysm 1', type: 'npc', targetName: 'Bandit 1', currentHp: 555, maxHp: 555, ac: 22, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const cataclysm = () => monstersData.find(m => m.name === 'Elemental Cataclysm');

describe('MA-0675 monsters.json data: elemental cataclysm legendary header+delegates shape', () => {
  it('legendary_actions[0] is the header with numeric uses 3 (no longer the Eruption child)', () => {
    const la = cataclysm().legendary_actions;
    expect(la[0].name).toBe('Legendary Action Uses: 3');
    expect(la[0].uses).toBe(3);
    expect(la[0].name).not.toMatch(/Eruption|Rumbling/);
    expect(la[0].description).toMatch(/Immediately after another creature's turn, the cataclysm can expend a use/);
    expect(la[0].description).toMatch(/regains all expended uses at the start of each of its turns/);
  });

  it('Eruption child delegates_to the byte-existing +15 Elemental Burst row, own uses dropped', () => {
    const eruption = cataclysm().legendary_actions.find(a => a.name === 'Eruption');
    expect(eruption.delegates_to).toBe('Elemental Burst');
    expect(eruption.uses).toBeUndefined();
    expect(eruption.description).toBe('The cataclysm makes one Elemental Burst attack.');
    const burst = cataclysm().actions.find(a => a.name === 'Elemental Burst');
    expect(burst.attack_bonus).toBe(15);
    expect(burst.damage_dice_primary).toBe('5d6 + 8');
    expect(burst.damage_type_primary).toBe('Acid');
  });

  it('Rumbling Movement child stays byte-unchanged (save_dc 23 rides its own chip)', () => {
    const rumbling = cataclysm().legendary_actions.find(a => a.name === 'Rumbling Movement');
    expect(rumbling.save_dc).toBe(23);
    expect(rumbling.save_type).toBe('Constitution');
    expect(rumbling.delegates_to).toBeUndefined();
    expect(rumbling.uses).toBeUndefined();
  });
});

describe('MA-0675 MonsterCardModal elemental cataclysm legendary gated rows', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderCataclysm(uses) {
    if (uses !== undefined) runtime.store['Elemental Cataclysm 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Elemental Cataclysm',
      actions: [ELEMENTAL_BURST],
      legendary_actions: cataclysm().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Elemental Cataclysm 1', creatures: CREATURES })} />);
  }
  function legendaryRowLink(name) {
    return Array.from(document.querySelectorAll('.mc-action'))
      .find(r => r.textContent.trim().startsWith(name))?.querySelector('.mc-dice-link') || null;
  }

  it('header shows (3 left); Eruption renders Expend-Legendary chip, spends 1, delegates +15 attack', async () => {
    renderCataclysm({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const link = legendaryRowLink('Eruption');
    expect(link).not.toBeNull();
    expect(link.className).toContain('mc-dice-link-legendary');
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Elemental Cataclysm 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Eruption (Elemental Burst attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Eruption/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Eruption/);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('same active creature second Eruption click refuses on the turn latch, counter held', async () => {
    renderCataclysm({ max: 3, used: 0 });
    fireEvent.click(legendaryRowLink('Eruption'));
    await waitFor(() => expect(runtime.store['Elemental Cataclysm 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    ROLLERS.rollAttack.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(legendaryRowLink('Eruption'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(runtime.store['Elemental Cataclysm 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): Eruption click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderCataclysm({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(legendaryRowLink('Eruption'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Elemental Cataclysm 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
