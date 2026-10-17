// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the DICE seam only: dice-pool display (Pool: n / m dX,
// feature name, Roll a dX button per configured dieType, no HP-apply lane),
// roll gating (empty pool, max-dice-per-use cap via the CHA modifier), exact
// ordered pool deduction through the live tracked-resource store on every
// roll, frozen-dice roll display (formula, face list, accumulated total,
// remaining count), forced-click inertness on gated rolls, exact accumulated
// self-heal on Done — currentHitPoints write, healing_pool log payload
// (rolls/diceUsed/dieType/poolAfter), log table row, cap-at-target-max via
// the combat-summary player branch, accumulated reset after apply, Done inert
// with nothing accumulated, and Escape-applies-pending-rolls-then-closes
// (exactly once).
// Deferred to owners:
// - HealingPoolModal.healing.test.jsx — applyHeal HP-pool plumbing, that
//   lane's pool deduction and healing_pool log payloads (verified: it owns no
//   dice content — applyDiceHeal deduction is asserted here).
// - HealingPoolModal.channel-divinity.test.jsx — channel_divinity charge
//   consumption on dice/any action.
// - HealingPoolModal.curing.test.jsx — condition-cure mechanics.
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/gate/restriction note.
// - HealingPoolModal.test.jsx — loading state, HP-pool display strings,
//   target selection rendering, generic Done/Escape close plumbing.
// (Subsumes former cases: "shows dice count and die type in heading",
// "shows Roll a d12 button instead of Apply Heal", "roll button text and
// display reflect the configured die type", "roll display reflects a
// different die type" — consolidated into the parameterised display test;
// "dice pool deducts pool on each roll", "deducts pool and shows updated
// remaining count", "shows individual roll values in accumulated total",
// "displays accumulated total with correct sum and roll format" —
// consolidated into the exact ordered deduction/display test; "does not apply
// healing on Done when pool is zero" — a subsumed lane of the inert-Done
// parameterised test (a zero pool cannot accumulate); "enables roll button
// again when max dice per use not reached" — consolidated with the cap-
// reached case into the parameterised cap test.)
// NOTE — flagged component quirk (not fixed here): the roll-details block uses
// inline styles (also flagged in bloodied, healing, curing and
// channel-divinity lanes); no timestamp field rides on the dice healing_pool
// log, so no Date.now pin is needed in this lane.

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n?.toLowerCase().trim()) },
}));

vi.mock('../../../../services/combat/conditions/conditionUtils.js', () => ({
  CONDITIONS: [
    { key: 'blinded', label: 'Blinded' },
    { key: 'charmed', label: 'Charmed' },
    { key: 'poisoned', label: 'Poisoned' },
    { key: 'frightened', label: 'Frightened' },
  ],
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures / live stores ──

const CAMPAIGN = 'test-campaign';
const FEATURE = 'Warrior of the Gods';

const basePlayerStats = {
  name: 'Paladin1',
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};

// Live mutable stores — tests mutate/read these directly instead of re-mocking.
let poolStore; // { current, max } — poolUpdate writes land in current
let store; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let poolUpdate;
let randomSpy;

// Frozen dice fixtures: each queued face value becomes the next roll exactly
// (roll = Math.floor(random * dieType) + 1). Extra rolls past the queue
// repeat the last face — call-count assertions catch any surprise rolls.
function freezeRolls(dieType, faces) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    const face = faces[Math.min(i, faces.length - 1)];
    i++;
    return (face - 1) / dieType + 0.001;
  });
}

function setupPoolStore(current = 4, max = 4) {
  poolStore = { current, max };
  useTrackedResource.mockImplementation(() => ({
    current: poolStore.current,
    max: poolStore.max,
    update: poolUpdate,
  }));
}

function makeProps(overrides = {}) {
  return {
    playerStats: basePlayerStats,
    campaignName: CAMPAIGN,
    isDicePool: true,
    dieType: 12,
    name: FEATURE,
    alsoCures: [],
    cureCost: 3,
    restoringTouchConditions: null,
    onClose: vi.fn(),
    ...overrides,
  };
}

async function renderModal(overrides = {}, pool = { current: 4, max: 4 }) {
  setupPoolStore(pool.current, pool.max);
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
  return rendered;
}

const rollBtn = (dieType = 12) => screen.getByRole('button', { name: `Roll a d${dieType}` });

function poolText() {
  const p = document.querySelector('.short-rest-section p');
  return p?.textContent;
}

function rollDetails() {
  return {
    formula: document.querySelector('.healing-formula')?.textContent,
    faces: document.querySelector('.healing-dice-rolled')?.textContent,
    total: document.querySelector('.healing-total')?.textContent,
  };
}

function hpWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === 'currentHitPoints');
}

function logRows() {
  const rows = screen.getByRole('table').querySelectorAll('tbody tr');
  return Array.from(rows).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent));
}

function diceHealLog({ targetName = 'Paladin1', featureName = FEATURE, amount, rolls, poolAfter, dieType = 12 }) {
  return {
    type: 'healing_pool',
    sourceName: 'Paladin1',
    featureName,
    targetName,
    amount,
    diceUsed: rolls.length,
    dieType,
    rolls,
    poolAfter,
  };
}

// ── Tests ──

describe('HealingPoolModal - Dice Pool', () => {
  beforeEach(() => {
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    store = {
      Paladin1: { currentHitPoints: 20, hitPoints: 40, activeConditions: [] },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      const entry = store[name];
      return entry && key in entry ? entry[key] : null;
    });
    useRuntimeState.setRuntimeValue.mockImplementation((name, key, value) => {
      const entry = store[name] ??= {};
      entry[key] = value;
    });
    damageUtils.getCombatContext.mockResolvedValue(null);
  });

  afterEach(() => {
    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.setRuntimeValue.mockReset();
    useTrackedResource.mockReset();
    damageUtils.getCombatContext.mockReset();
    damageUtils.getTargetFromAttacker.mockReset();
    logService.addEntry.mockReset();
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  // ── Dice-pool display per die type ──

  it.each([
    { dieType: 12, current: 3, max: 4, name: FEATURE },
    { dieType: 8, current: 4, max: 8, name: 'Divine Fury' },
    { dieType: 6, current: 2, max: 6, name: 'Test Feature' },
  ])('renders the $name dice pool as $current / $max d$dieType with a Roll a d$dieType button and no HP-apply lane', async ({ dieType, current, max, name }) => {
    await renderModal({ dieType, name }, { current, max });

    expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    expect(screen.queryByText('Lay On Hands')).not.toBeInTheDocument();
    expect(poolText()).toBe(`Pool: ${current} / ${max} d${dieType}`);
    expect(screen.getByRole('heading', { level: 4, name: `Roll Dice — Paladin1 (20 / 40 HP)` })).toBeInTheDocument();
    expect(screen.queryByText(/\(Max \d+ dice\)/)).not.toBeInTheDocument();
    expect(rollBtn(dieType)).toBeEnabled();
    expect(screen.queryByText(/Apply Heal/)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="number"]')).toBeNull();
    expect(document.querySelector('.healing-roll-details')).toBeNull();
  });

  // ── Gating ──

  it('disables Roll a d12 on an empty pool and stays fully inert when force-clicked', async () => {
    await renderModal({}, { current: 0, max: 4 });

    expect(rollBtn()).toBeDisabled();
    fireEvent.click(rollBtn()); // disabled — click must be inert

    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(0);
    expect(document.querySelector('.healing-roll-details')).toBeNull();
    expect(screen.queryByText(/HP to restore/)).not.toBeInTheDocument();
  });

  it.each([
    {
      lane: 'cap reached (CHA 3 → 1 die)',
      stats: { ...basePlayerStats, abilities: { CHA: 3 } },
      expectedCap: 1,
      disabledAfter: 1,
    },
    {
      lane: 'cap not reached (CHA 14 → 6 dice)',
      stats: basePlayerStats,
      expectedCap: 6,
      disabledAfter: null,
    },
  ])('caps rolls at $expectedCap dice per use when $lane', async ({ stats, expectedCap, disabledAfter }) => {
    await renderModal({ maxDicePerUse: 1, playerStats: stats });
    freezeRolls(12, [5]);

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent(`(Max ${expectedCap} dice)`);
    fireEvent.click(rollBtn());

    expect(poolUpdate.mock.calls).toEqual([[3]]);
    expect(poolStore.current).toBe(3);
    expect(rollDetails()).toEqual({ formula: 'Rolled 1d12: ', faces: '5', total: ' = 5 HP to restore' });
    expect(screen.getByText('Remaining: 3 dice')).toBeInTheDocument();

    fireEvent.click(rollBtn()); // second click — capped at 1 die
    if (disabledAfter !== null) {
      expect(rollBtn()).toBeDisabled();
      expect(poolUpdate.mock.calls).toEqual([[3]]); // forced click inert
      expect(poolStore.current).toBe(3);
      expect(rollDetails()).toEqual({ formula: 'Rolled 1d12: ', faces: '5', total: ' = 5 HP to restore' });
    } else {
      expect(rollBtn()).toBeEnabled();
      expect(poolUpdate.mock.calls).toEqual([[3], [2]]); // uncapped lane keeps rolling
      expect(poolStore.current).toBe(2);
      expect(rollDetails()).toEqual({ formula: 'Rolled 2d12: ', faces: '5 + 5', total: ' = 10 HP to restore' });
    }
  });

  it('drains the pool die by die with exact ordered deductions and disables the roll button at zero', async () => {
    freezeRolls(12, [2, 2, 2, 2]);
    await renderModal({}, { current: 4, max: 4 });

    for (let i = 0; i < 4; i++) fireEvent.click(rollBtn());

    expect(poolUpdate.mock.calls).toEqual([[3], [2], [1], [0]]);
    expect(poolStore.current).toBe(0);
    expect(poolText()).toBe('Pool: 0 / 4 d12');
    expect(rollDetails()).toEqual({
      formula: 'Rolled 4d12: ',
      faces: '2 + 2 + 2 + 2',
      total: ' = 8 HP to restore',
    });
    expect(screen.getByText('Remaining: 0 dice')).toBeInTheDocument();
    expect(rollBtn()).toBeDisabled();
  });

  // ── Accumulation and Done ──

  it('Done applies the accumulated self-heal with exact HP and healing_pool payloads, logs one row, resets the accumulation, and closes', async () => {
    freezeRolls(12, [5, 4]);
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 4, max: 4 });

    fireEvent.click(rollBtn());
    fireEvent.click(rollBtn());
    expect(poolUpdate.mock.calls).toEqual([[3], [2]]);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 29, CAMPAIGN]]);
    expect(store.Paladin1.currentHitPoints).toBe(29);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 9, rolls: [5, 4], poolAfter: 2 })],
    ]);
    expect(logRows()).toEqual([['Roll 2d12', 'Paladin1', '9', '2']]);
    // Accumulation is consumed — no stale pending total remains.
    expect(document.querySelector('.healing-roll-details')).toBeNull();
    expect(screen.queryByText(/HP to restore/)).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('caps the accumulated heal at the combat-summary player target maximum HP', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Paladin1', type: 'player' }],
    });
    store.Paladin1.currentHitPoints = 36;
    freezeRolls(12, [12]);
    await renderModal({}, { current: 3, max: 4 });

    fireEvent.click(rollBtn());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 40, CAMPAIGN]]);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 12, rolls: [12], poolAfter: 2 })],
    ]);
  });

  it.each([
    { lane: 'no rolls made', current: 4 },
    { lane: 'empty pool', current: 0 },
  ])('Done is inert when $lane — no HP write, no log, pool untouched, still closes', async ({ current }) => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current, max: 4 });

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(current);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Close seams with a pending accumulation ──

  it('Escape applies the pending roll exactly once, then closes', async () => {
    freezeRolls(12, [6]);
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 3, max: 4 });

    fireEvent.click(rollBtn());
    expect(poolStore.current).toBe(2);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 26, CAMPAIGN]]);
    expect(store.Paladin1.currentHitPoints).toBe(26);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 6, rolls: [6], poolAfter: 2 })],
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Accumulation was consumed — a second Escape must not re-heal.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(hpWrites()).toHaveLength(1);
    expect(poolStore.current).toBe(2);
  });

  it('clicking the overlay is inert — pending roll, pool, and log untouched, no close', async () => {
    freezeRolls(12, [6]);
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 3, max: 4 });

    fireEvent.click(rollBtn());

    fireEvent.click(document.querySelector('.short-rest-overlay'));

    expect(onClose).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(poolUpdate.mock.calls).toEqual([[2]]); // only the pending roll's own deduction
    expect(poolStore.current).toBe(2);
    expect(document.querySelector('.healing-total')?.textContent).toBe(' = 6 HP to restore');
  });
});
