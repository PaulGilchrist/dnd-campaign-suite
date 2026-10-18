// @maintained-by-ai
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
// MA-1636 same-monster follow-up: Shimmering Shield was the live
// silent-burn child (MA-0957 shape: chip armed, click spent the shared
// header pool honestly, console.error "no resolvable mechanic", zero
// popup). Fix rides the MA-0058/MA-0270 legendary advisory seam with
// flat advisory + advisory_message (Androsphinx/Gynosphinx/Tarrasque
// child byte-shape — flat strings only, nested advisory dict grep-zero);
// its stray uses:1/recharge:false dropped per §165 (header owns the pool).
// Trim pass 2026-10-18: generic lanes cited elsewhere — turn-latch and
// exhausted refusals live in monsterLegendaryUses.test.js:124 and
// monsterLegendaryUses.ma1579-tarrasque-general.test.js:107 (modal-level
// refusal mirrors cut per #635: beholder :213-223 owns the generic exhausted
// click); advisory-builder byte-copy cited monsterLegendaryUses.test.js:609
// /949 (unicorn describe-4 vacuous-transform mirror cut). Kept
// unicorn-distinct: delegate+7 lane, flat-advisory lane, two-row data lock,
// one latch + one exhausted refusal each clicking both effect rows once.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

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

describe('MA-1635/MA-1636 monsters.json unicorn legendary data lock', () => {
  it('canonical header uses:2; Charging Horn delegates to the byte-existing +7 Radiant Horn row, own uses/recharge dropped (§165)', () => {
    const la = unicorn().legendary_actions;
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].delegates_to).toBeUndefined();
    const charging = la.find(a => a.name === 'Charging Horn');
    expect(charging.delegates_to).toBe('Radiant Horn');
    expect(charging.uses).toBeUndefined();
    expect(charging.recharge).toBeUndefined();
    const horn = unicorn().actions.find(a => a.name === 'Radiant Horn');
    expect(horn.attack_bonus).toBe(7);
    expect(horn.damage_dice_primary).toBe('1d10 + 4');
    expect(horn.damage_type_primary).toBe('Radiant');
  });

  // MA-1636: inverts the MA-1635 pin that byte-pinned the pre-fix
  // silent-burn shape (uses:1, no advisory) — §216 stale-pin inversion.
  it('Shimmering Shield is a flat advisory child — advisory + advisory_message, uses/recharge/mechanic fields dropped (§165)', () => {
    const shield = unicorn().legendary_actions.find(a => a.name === 'Shimmering Shield');
    expect(shield.advisory).toBe('shimmering_shield');
    expect(typeof shield.advisory_message).toBe('string');
    expect(shield.advisory_message).toMatch(/GM-enforced/);
    expect(shield.uses).toBeUndefined();
    expect(shield.recharge).toBeUndefined();
    expect(shield.delegates_to).toBeUndefined();
    expect(shield.attack_bonus).toBeUndefined();
    expect(shield.save_dc).toBeUndefined();
  });
});

describe('MA-1635/MA-1636 MonsterCardModal unicorn legendary lanes', () => {
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

  it('MA-1635 Charging Horn: Expend chip spends 1, delegates the +7 Radiant Horn attack; same-boundary re-click refuses on the turn latch, counter held, zero extra roll', async () => {
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
    ROLLERS.rollAttack.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(legendaryRowLink('Charging Horn'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  // MA-1636 silent-burn fix: honest shared-gate spend, advisory popup +
  // record-only ability_use log, console.error dead-end dies, zero rolls.
  it('MA-1636 Shimmering Shield: press spends the shared pool honestly, lands advisory popup + record-only log, zero rolls', async () => {
    renderUnicorn({ max: 2, used: 0 });
    const link = legendaryRowLink('Shimmering Shield');
    expect(link).not.toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const popup = String(setPopupHtml.mock.calls.find(c => /Shimmering Shield/.test(String(c[0])))[0]);
    expect(popup).toContain('Legendary Action — Shimmering Shield');
    expect(popup).toContain('10 (3d6) THP + AC+2 until end of unicorn\'s next turn');
    expect(popup).toContain('GM-enforced');
    const logs = addEntry.mock.calls.map(c => c[1]);
    const spend = logs.find(e => e.type === 'ability_use' && /expends a legendary use for Shimmering Shield/.test(e.description));
    expect(spend).toBeDefined();
    const record = logs.find(e => e.type === 'ability_use' && e.abilityName === 'Shimmering Shield' && /legendary action Shimmering Shield:/.test(e.description));
    expect(record.description).toMatch(/legendary action Shimmering Shield: Unicorn 1 10 \(3d6\) THP \+ AC\+2/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('exhausted (2/2): both legendary rows refuse with popup + legendary_use_refused, counter held, zero spend, zero rolls, zero advisory log', async () => {
    renderUnicorn({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(legendaryRowLink('Charging Horn'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    setPopupHtml.mockClear();
    fireEvent.click(legendaryRowLink('Shimmering Shield'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(runtime.store['Unicorn 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'ability_use')).toBe(false);
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
