// @maintained-by-ai
// MA-1847 modal seam: the Apep "Devour the Boat (Costs 2 Actions)" row renders its
// OWN "DC 26 Constitution" save chip riding the shared legendary gate (MA-0567 twin).
// OWNED HERE (modal accept/refuse lane): chips-on-card wiring through the modal
// (MonsterAction-level chip set + onSaveRoll payload → MonsterAction.ma1847-apep-
// devour-the-boat-save.test.jsx:69); pre-spend refusal via evaluateTargetPrerequisite-
// Gate — popup + devour_the_boat_costs_2_actions_refused log, ZERO spend/roll/stamp
// (MA-0023 pre-spend model, MA-0019 gate copy owner); MA-1883 RAW cost-parsed spend
// ("(Costs 2 Actions)" spends 2, "spends 2 legendary uses" copy — monsterLegendaryUses.
// js:310 owner) then the DC 26 CON save ctx with the 6d10 Piercing pool + no_healing
// rider threaded (§233 grammar; grant/choke → saveProcessing.ma1847-apep-devour-no-
// healing.test.js); same-boundary refire → MA-0021 turn-latch refusal on the monster-
// LegendaryUses lane (vocabulary + latch copy owners: monsterLegendaryUses.js:187-199,
// :260-277 — cited, not re-pinned). No wall-clock timers in this lane.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const apep = monstersData.find((m) => m.index === 'apep');

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) } }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml, _resetPopup: () => { _popupHtml = null; } };
});
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'ElderPaladin', creatures: [] } }));
const armed = vi.hoisted(() => ({ target: null }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => armed.target),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
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
const resetPopup = useLoggedDiceRoll._resetPopup;

const CREATURES = [
  { name: 'Apep 1', type: 'npc', targetName: 'ElderPaladin', currentHp: 624, maxHp: 624, ac: 23, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 175, maxHp: 175, conditions: [] },
];

function renderApep() {
  runtime.store['Apep 1.monsterLegendaryUses'] = { max: 3, used: 0 };
  runtime.store['Apep 1._legendaryUses_usedRound'] = null;
  ctx.value = { round: 2, activeCreatureName: 'ElderPaladin', creatures: CREATURES };
  const m = makeMonster({ name: 'Apep', legendary_actions: apep.legendary_actions });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Apep 1', creatures: CREATURES })} />);
}

function devourRow() {
  const rows = [...document.querySelectorAll('.mc-action')].filter((r) => r.querySelector('strong')?.textContent.startsWith('Devour the Boat'));
  expect(rows.length).toBe(1);
  return rows[0];
}

function devourChip() {
  return devourRow().querySelector('.mc-dice-link-save-clickable');
}

const devourLogs = () => addEntry.mock.calls.map((c) => c[1]);

describe('MA-1847 Devour chip rides the legendary gate with its own save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPopup();
    Object.keys(runtime.store).forEach((k) => delete runtime.store[k]);
    armed.target = CREATURES[1];
  });

  it('row renders its own 6d10 + DC 26 Constitution chips on the card (no Expend chip, no delegated attack chip)', () => {
    renderApep();
    const chips = [...devourRow().querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['6d10', 'DC 26 Constitution']);
  });

  it('UN-grappled armed target: refused BEFORE the spend — popup + devour_the_boat_costs_2_actions_refused log, zero LA, no stamp, no save', async () => {
    runtime.store['ElderPaladin.activeConditions'] = [];
    runtime.store['ElderPaladin.activeConditionMeta'] = {};
    renderApep();
    fireEvent.click(devourChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(devourLogs().some((e) => e.automationType === 'devour_the_boat_costs_2_actions_refused')).toBe(true));
    expect(runtime.store['Apep 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(runtime.store['Apep 1._legendaryUses_usedRound']).toBeNull(); // refused press stamps no turn latch
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(devourLogs().some((e) => e.type === 'ability_use')).toBe(false);
  });

  it('grappled armed target: spends 2 (MA-1883 RAW cost), DC 26 CON save ctx carries 6d10 Piercing + no_healing rider; same-boundary refire refuses on the turn latch, no second save', async () => {
    runtime.store['ElderPaladin.activeConditions'] = ['grappled'];
    runtime.store['ElderPaladin.activeConditionMeta'] = { grappled: { dc: 26, source: 'Apep 1' } };
    renderApep();
    fireEvent.click(devourChip());

    // MA-1883: "(Costs 2 Actions)" pays its RAW cost with the honest multi-spend copy.
    await waitFor(() => expect(runtime.store['Apep 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
    expect(runtime.store['Apep 1._legendaryUses_usedRound']).toEqual({ round: 2, activeCreature: 'ElderPaladin' });
    const spend = devourLogs().find((e) => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Devour the Boat (Costs 2 Actions)');
    expect(spend.description).toMatch(/spends 2 legendary uses/);
    expect(devourLogs().some((e) => e.automationType === 'devour_the_boat_costs_2_actions_refused')).toBe(false);

    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(call[0]).toBe('CON');
    expect(call[2]).toMatchObject({
      attackerName: 'Apep 1',
      actionName: 'Devour the Boat (Costs 2 Actions)',
      saveDc: 26,
      saveType: 'Constitution',
      targetName: 'ElderPaladin',
      autoDamageFormula: '6d10',
      autoDamageDamageType: 'Piercing',
      dcSuccess: 'half',
      saveTargetEffect: { effect: 'no_healing' },
    });

    // Same-boundary refire: turn-latch refusal BEFORE any re-check (MA-0021 lane),
    // zero extra spend, no second victim save, no devour refusal vocabulary.
    fireEvent.click(devourChip());
    await waitFor(() => expect(devourLogs().some((e) => e.automationType === 'legendary_use_refused' && /refused \(turn\)/.test(String(e.description)))).toBe(true));
    expect(runtime.store['Apep 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(devourLogs().some((e) => e.automationType === 'devour_the_boat_costs_2_actions_refused')).toBe(false);
  });
});
