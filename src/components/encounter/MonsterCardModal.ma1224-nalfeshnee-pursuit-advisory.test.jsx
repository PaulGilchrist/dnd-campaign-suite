// @maintained-by-ai
// MA-1224 modal press seam: Nalfeshnee "Pursuit" REACTION-row advisory chip
// → resolveMonsterActionAdvisoryRow (DATA-only fix, zero code — reactions[]
// already route through the MonsterCardBody generic section carrying
// handleAdvisoryRow). OWNERSHIP: Pursuit disk row shape, detector, popup/log
// builders and the record-only resolver contract (incl. service-level refire)
// are owned by services/encounters/monsterActionAdvisory.ma1224-nalfeshnee-
// pursuit.test.js; the AdvisoryLink chip internals (label, honest title,
// single-affordance fork, "(At Will)" sentinel, press payload routing) are
// owned by MonsterAction.ma1224-nalfeshnee-pursuit-advisory-chip.test.jsx.
// This file locks ONLY the full-card modal seam: the advisory chip survives
// the merged modal render of the REACTIONS section (red if disk data or the
// reactions[] wiring regresses), press lands popup + exactly ONE ability_use
// log per press with the byte-distinct Pursuit prose (/has no move-end
// producer app-wide/, /GM-enforced gridless \(CLA-320\)/), zero roll calls,
// ZERO runtime-store writes (zero lastAttack pollution), console clean, and
// refire stays record-only (At Will sentinel). Byte-distinct from the
// ma1223 Teleport twin. The advisory lane never rolls — no diceRoller mock.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollDamage: null, rollSavingThrow: null }));
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
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit', creatures: [] } }));
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
  { name: 'Nalfeshnee 1', type: 'npc', monsterType: 'fiend', targetName: 'Bandit', currentHp: 184, maxHp: 184, ac: 16, conditions: [] },
  { name: 'Bandit', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const nalfeshnee = () => monstersData.find((m) => m.index === 'nalfeshnee');

const renderPursuitRow = () => {
  render(<MonsterCardModal {...makeProps(makeMonster({ name: 'Nalfeshnee', actions: nalfeshnee().actions, reactions: nalfeshnee().reactions }), { creatureName: 'Nalfeshnee 1', creatures: CREATURES })} />);
  const row = Array.from(document.querySelectorAll('.mc-action')).find((r) => r.textContent.startsWith('Pursuit'));
  const chip = row.querySelector('.mc-dice-link-advisory');
  // Disk-data regression pins: the advisory chip survives the merged modal
  // render of the REACTIONS section (was zero affordance) and it is the
  // row's ONLY affordance — the junk "+0" chip must stay dead.
  expect(chip).not.toBe(null);
  expect(Array.from(row.querySelectorAll('.mc-dice-link')).filter((c) => c !== chip)).toHaveLength(0);
  expect(row.textContent).not.toContain('+0');
  return { row, chip };
};

describe('MA-1224 MonsterCardModal reaction advisory press seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach((k) => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit', creatures: CREATURES };
  });

  it('press lands popup + exactly ONE ability_use advisory log — zero rolls, zero runtime-store writes, console clean', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { chip } = renderPursuitRow();
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(1));
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    const [entry] = addEntry.mock.calls.map((c) => c[1]);
    expect(entry).toMatchObject({ type: 'ability_use', abilityName: 'Pursuit', characterName: 'Nalfeshnee 1' });
    expect(entry.description).toMatch(/has no move-end producer app-wide/);
    expect(entry.description).toMatch(/GM-enforced gridless \(CLA-320\)/);
    expect(String(setPopupHtml.mock.calls.map((c) => String(c[0])).find((h) => /Pursuit/.test(h)))).toMatch(/Action — Pursuit/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    // zero lastAttack/spend pollution: the press writes NOTHING to the store
    expect(Object.keys(runtime.store)).toHaveLength(0);
    expect(errSpy.mock.calls.flat().some((a) => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('refire press stays record-only (At Will sentinel): two presses → two ability_use logs, still zero rolls, no spends written', async () => {
    const { chip } = renderPursuitRow();
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(1));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(2));
    expect(addEntry.mock.calls.map((c) => c[1]).every((e) => e.type === 'ability_use')).toBe(true);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(Object.keys(runtime.store)).toHaveLength(0);
  });
});
