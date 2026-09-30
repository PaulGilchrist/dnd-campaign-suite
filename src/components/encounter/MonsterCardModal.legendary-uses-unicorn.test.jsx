// MA-1635 regression: Unicorn legendary_actions[0] was the Charging Horn
// CHILD with numeric uses:1 — legendaryHeaderAction() swallowed it as the
// header, so the card printed "Charging Horn (1 left)" as inert header text
// with ZERO affordance (MonsterCardBody renders slice(1)): no click, no
// console.error, delegated Radiant Horn attack unreachable (§99 MA-0675
// harder-zero family). Fix mirrors the §165/MA-0675 byte-shape DATA-only
// one-pass template: canonical header "Legendary Action Uses: 2" + numeric
// uses:2 (floor = children count; unicorn lair_actions is a raw-string block
// with no "(N in Lair)" clause, no lair bump; RAW = 2), and Charging Horn
// authored the SAME pass as a delegating child onto the byte-existing +7
// Radiant Horn attack row (MA-1633 live-proven) with its own uses/recharge
// dropped. No advisory rides the delegating row: resolveLegendaryRowMechanic
// checks advisory on the RESOLVED delegate (attack_bonus routes first,
// MonsterCardModal.jsx:688-691), so a move advisory alongside delegates_to
// is inert — the half-Speed/no-OA clause stays gridless advisory §87/§70.
// Shimmering Shield stays byte-unchanged (MA-1636 owns its mechanic; it
// rides the shared header gate with no gate breakage).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction } from '../../services/encounters/monsterLegendaryUses.js';

const RADIANT_HORN = { name: 'Radiant Horn', description: 'Melee Attack Roll: +7, reach 5 ft. Hit: 9 (1d10 + 4) Radiant damage.', attack_bonus: 7, reach: '5 ft.', damage_dice_primary: '1d10 + 4', damage_type_primary: 'Radiant' };

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
  { name: 'Unicorn 1', type: 'npc', targetName: 'Bandit 1', currentHp: 67, maxHp: 67, ac: 12, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const unicorn = () => monstersData.find(m => m.name === 'Unicorn');

describe('MA-1635 monsters.json data lock: unicorn legendary header+delegates shape', () => {
  it('legendary_actions[0] is the canonical header with numeric uses 2 (no longer the Charging Horn child)', () => {
    const la = unicorn().legendary_actions;
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].name).not.toMatch(/Charging|Shimmering/);
    expect(la[0].description).toMatch(/Immediately after another creature's turn, the unicorn can expend a use/);
    expect(la[0].description).toMatch(/regains all expended uses at the start of each of its turns/);
    expect(la[0].delegates_to).toBeUndefined();
  });

  it('Charging Horn child delegates_to the byte-existing +7 Radiant Horn row, own uses/recharge dropped', () => {
    const charging = unicorn().legendary_actions.find(a => a.name === 'Charging Horn');
    expect(charging.delegates_to).toBe('Radiant Horn');
    expect(charging.uses).toBeUndefined();
    expect(charging.recharge).toBeUndefined();
    expect(charging.description).toBe('The unicorn moves up to half its Speed without provoking Opportunity Attacks, and it makes one Radiant Horn attack.');
    const horn = unicorn().actions.find(a => a.name === 'Radiant Horn');
    expect(horn.attack_bonus).toBe(7);
    expect(horn.damage_dice_primary).toBe('1d10 + 4');
    expect(horn.damage_type_primary).toBe('Radiant');
    expect(legendaryDelegateAction(unicorn(), charging)).toBe(horn);
  });

  it('legendaryHeaderAction splits canonical header + 2 children', () => {
    const la = unicorn().legendary_actions;
    expect(legendaryHeaderAction(unicorn())).toBe(la[0]);
    expect(la.slice(1).map(a => a.name)).toEqual(['Charging Horn', 'Shimmering Shield']);
  });

  it('Shimmering Shield stays byte-unchanged (MA-1636 owns its mechanic; rides the shared gate)', () => {
    const shield = unicorn().legendary_actions.find(a => a.name === 'Shimmering Shield');
    expect(shield.uses).toBe(1);
    expect(shield.delegates_to).toBeUndefined();
    expect(shield.description).toMatch(/gains 10 \(3d6\) Temporary Hit Points/);
  });
});

describe('MA-1635 MonsterCardModal unicorn legendary gated rows', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderUnicorn(uses) {
    if (uses !== undefined) runtime.store['Unicorn 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Unicorn',
      actions: [RADIANT_HORN],
      legendary_actions: unicorn().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Unicorn 1', creatures: CREATURES })} />);
  }
  function legendaryRowLink(name) {
    return Array.from(document.querySelectorAll('.mc-action'))
      .find(r => r.textContent.trim().startsWith(name))?.querySelector('.mc-dice-link') || null;
  }

  it('header shows (2 left); Charging Horn renders Expend-Legendary chip, spends 1, delegates +7 attack', async () => {
    renderUnicorn({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const link = legendaryRowLink('Charging Horn');
    expect(link).not.toBeNull();
    expect(link.className).toContain('mc-dice-link-legendary');
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Charging Horn (Radiant Horn attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(7);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Charging Horn/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Charging Horn/);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('same active creature second Charging Horn click refuses on the turn latch, counter held', async () => {
    renderUnicorn({ max: 2, used: 0 });
    fireEvent.click(legendaryRowLink('Charging Horn'));
    await waitFor(() => expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    ROLLERS.rollAttack.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(legendaryRowLink('Charging Horn'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('exhausted (2/2): Charging Horn click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderUnicorn({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(legendaryRowLink('Charging Horn'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
