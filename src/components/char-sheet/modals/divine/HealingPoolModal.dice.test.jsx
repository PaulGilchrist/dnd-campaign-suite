// @maintained-by-ai 2026-11-27 dice lane: cap/drain gate census, distinct-face fixtures, zero-CD roll-anyway quirk
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the DICE seam only: dice-pool display (Pool: n / m dX,
// feature name, Roll a dX button per configured dieType, no HP-apply lane),
// roll gating by pool (disabled at zero) and by the CHA-modifier max-dice cap
// ("(Max N dice)" badge byte-exact, disabled AT the cap while pool > 0 so the
// cap operand is distinguished from the pool operand, enabled BELOW a finite
// cap), exact ordered pool-deduction census through the live tracked-resource
// store on every roll, frozen-dice roll display (formula, face list,
// accumulated total, remaining count), exact accumulated self-heal on Done —
// currentHitPoints write tuple, healing_pool payload full-shape, "Roll NdX"
// log-row bytes, accumulation reset, double-Done detector, Done inert with
// nothing accumulated, and Escape-applies-pending-rolls-then-closes exactly
// once (a second Escape must not re-heal). Also owns the dice-path face of the
// zero-CD heals-anyway quirk (HealingPoolModal.jsx:417-425): the once-per-
// mount latch is set BEFORE the charge check, so exhausted charges log
// console.error exactly once per mount and every roll still spends a die.
// Deferred to owners (re-verified against current sibling tests, 2026-11-27):
// - HealingPoolModal.overheal.test.jsx — the noHealCapacity FULL-HP dice gate
//   :175-241 (disabled roll at max target, "already at full HP. No die spent."
//   / "already fill ... to maximum HP" notes, restorable-copy clamp, partial-
//   overflow ledger, refund + amount-0 commit). Stronger there, so NOT
//   re-pinned here.
// - HealingPoolModal.stale-closure.test.jsx — commit-time fresh HP re-read,
//   incl. the combat-summary player-branch cap-at-target-max commit (:217-238)
//   and the full-refund dice commit (:189-215).
// - HealingPoolModal.healing.test.jsx — applyHeal HP-pool plumbing and that
//   lane's payloads/deduction (verified: it owns no dice content).
// - HealingPoolModal.channel-divinity.test.jsx — channel_divinity charge
//   SPEND census/resolution and the amount-lane zero-charge face (:342).
// - HealingPoolModal.curing.test.jsx — condition-cure mechanics.
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/gate/restriction note.
// - HealingPoolModal.test.jsx — loading state, HP-pool display strings,
//   target-selection rendering, and the generic close plumbing: Done-once
//   (:341), Escape-once (:348), and "does not close when clicking the overlay
//   background" (:354) — the component has NO overlay click handler, so the
//   former overlay-inert-with-pending-roll case here was base plumbing and is
//   purged (same purge the channel-divinity and curing lanes applied).
// (This pass: display it.each 3→1 same-branch arms; cap it.each + drain test
// re-cut into cap-REACHED and finite-cap-not-reached/drain-to-zero pair so
// each disabled reason (cap vs empty pool) is pinned with pool > 0 vs pool 0
// respectively; roll faces made byte-distinct per queue (#1919 discipline) —
// [5]/[2,5,6,3]/[3,7]/[6] — with roll sum, pool balance and heal cap each
// distinguishable; the "caps the accumulated heal at the combat-summary
// player maximum HP" test REMOVED as same-branch redundancy with
// stale-closure:217-238 + overheal:222; the empty-pool arm of the inert-Done
// test dropped (a zero pool cannot accumulate — same `accumulatedTotal <= 0`
// branch); forced-click-on-disabled-roll pins removed — React suppresses
// onClick through disabled buttons in jsdom (probe-verified #1920), so they
// pinned nothing beyond the disabled-attribute assertion.)
// NOTE — verified against source: HealingPoolModal.jsx has NO inline styles
// (the former roll-details inline-style claim was stale, same correction the
// curing lane made). No timestamp field rides on the dice healing_pool log
// (:649-659), so no Date.now pin is needed in this lane; the CD lane's
// ability_use row and the curing lane's condition rows carry their own.

// ── Mocked modules ──
// Keys mirror ONLY what the loaded render graph imports: HealingPoolModal.jsx
// itself, SecondaryTargetModal.jsx (real component) and healingPoolHandler.js
// (deliberately NOT mocked — resolveChannelDivinityCharges runs for real here,
// its own imports damageUtils/useRuntimeState/logService are covered below).
// Phantom keys getTargetFromAttacker and addStorageChangeListener purged
// (nothing in the graph imports them — #1918/#1919/#1920 family purge), and
// the 4-of-15 CONDITIONS mirror-fixture mock is retired: conditionUtils is a
// pure data module and the REAL 15-entry catalog now loads.

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null), // display-echo subscription seam (return value unused by the heal modals)
}));

vi.mock('../../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(), // never called on the dice commit path
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n?.toLowerCase().trim()) },
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
let store; // { [characterName]: { currentHitPoints, hitPoints, activeConditions, ... } }
let poolUpdate;
let randomSpy;
let consoleErrorSpy;

// Frozen dice fixtures: each queued face value becomes the next roll exactly
// (roll = Math.floor(random * dieType) + 1). Extra rolls past the queue
// repeat the last face — exact poolUpdate censuses catch any surprise rolls.
function freezeRolls(dieType, faces) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    const face = faces[Math.min(i, faces.length - 1)];
    i++;
    return (face - 1) / dieType + 0.001;
  });
}

function setupPoolStore(current, max) {
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
const doneBtn = () => screen.getByRole('button', { name: 'Done' });

function poolText() {
  return document.querySelector('.short-rest-section p')?.textContent;
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

function diceHealLog({ amount, rolls, poolAfter }) {
  return {
    type: 'healing_pool',
    sourceName: 'Paladin1',
    featureName: FEATURE,
    targetName: 'Paladin1',
    amount,
    diceUsed: rolls.length,
    dieType: 12,
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
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.setRuntimeValue.mockReset();
    useTrackedResource.mockReset();
    damageUtils.getCombatContext.mockReset();
    logService.addEntry.mockReset();
    randomSpy?.mockRestore();
    randomSpy = null;
    consoleErrorSpy.mockRestore();
  });

  // ── Dice-pool display ──

  it('renders the dice pool as Pool: 3 / 4 d12 with a Roll a d12 button, uncapped heading, and no HP-apply lane', async () => {
    await renderModal({}, { current: 3, max: 4 });

    expect(screen.getByRole('heading', { level: 3, name: FEATURE })).toBeInTheDocument();
    expect(screen.queryByText('Lay On Hands')).not.toBeInTheDocument();
    expect(poolText()).toBe('Pool: 3 / 4 d12');
    expect(screen.getByRole('heading', { level: 4, name: 'Roll Dice — Paladin1 (20 / 40 HP)' })).toBeInTheDocument();
    expect(screen.queryByText(/\(Max \d+ dice\)/)).not.toBeInTheDocument();
    expect(rollBtn()).toBeEnabled();
    expect(screen.queryByText(/Apply Heal/)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="number"]')).toBeNull();
    expect(document.querySelector('.healing-roll-details')).toBeNull();
  });

  // ── Gating ──

  it('disables Roll a d12 on an empty pool', async () => {
    // No forced-click pin: React suppresses onClick through disabled buttons
    // in jsdom (probe-verified family-wide #1920), so a forced click would
    // assert nothing the disabled attribute does not already prove.
    await renderModal({}, { current: 0, max: 4 });

    expect(rollBtn()).toBeDisabled();
    expect(poolText()).toBe('Pool: 0 / 4 d12');
    expect(document.querySelector('.healing-roll-details')).toBeNull();
    expect(screen.queryByText(/HP to restore/)).not.toBeInTheDocument();
  });

  it('caps rolls at the CHA modifier (CHA 3 → "(Max 1 dice)") and gates the button at the cap while the pool still has dice', async () => {
    freezeRolls(12, [5]);
    await renderModal(
      { maxDicePerUse: 'true', playerStats: { ...basePlayerStats, abilities: { CHA: 3 } } },
      { current: 7, max: 7 },
    );

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('(Max 1 dice)');

    fireEvent.click(rollBtn());

    // Pool stays > 0 (6), so the post-roll disable is the CAP operand, not
    // the empty-pool operand.
    expect(poolUpdate.mock.calls).toEqual([[6]]);
    expect(poolStore.current).toBe(6);
    expect(rollDetails()).toEqual({ formula: 'Rolled 1d12: ', faces: '5', total: ' = 5 HP to restore' });
    expect(screen.getByText('Remaining: 6 dice')).toBeInTheDocument();
    expect(rollBtn()).toBeDisabled();
    // No second-roll click pin: the button is disabled, and React suppresses
    // onClick through disabled buttons in jsdom, so the applyDiceHeal cap
    // guard is unreachable-by-click defense-in-depth (#1920 rule).
  });

  it('shows "(Max 6 dice)" for CHA 14 but never gates below the cap, draining the pool die by die with exact ordered deductions', async () => {
    freezeRolls(12, [2, 5, 6, 3]);
    await renderModal({ maxDicePerUse: 'true' }, { current: 4, max: 5 });

    // Exact CHA-modifier floor (Math.floor(13/2) = 6) — a ceil/off-by-one
    // mutant renders (Max 7)/(Max 5) and dies here.
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('(Max 6 dice)');

    fireEvent.click(rollBtn());
    fireEvent.click(rollBtn());
    // Finite cap 6 is NOT gating at 2 rolled faces with pool left.
    expect(rollBtn()).toBeEnabled();
    fireEvent.click(rollBtn());
    fireEvent.click(rollBtn());

    expect(poolUpdate.mock.calls).toEqual([[3], [2], [1], [0]]);
    expect(poolStore.current).toBe(0);
    expect(poolText()).toBe('Pool: 0 / 5 d12');
    expect(rollDetails()).toEqual({
      formula: 'Rolled 4d12: ',
      faces: '2 + 5 + 6 + 3',
      total: ' = 16 HP to restore',
    });
    expect(screen.getByText('Remaining: 0 dice')).toBeInTheDocument();
    // 4 faces < cap 6, so this disable is the empty-pool operand.
    expect(rollBtn()).toBeDisabled();
  });

  // ── Accumulation and Done ──

  it('Done applies the accumulated self-heal exactly once with exact HP and healing_pool payloads, logs one Roll 2d12 row, and resets the accumulation', async () => {
    freezeRolls(12, [3, 7]); // sum 10 — distinct from pool (2 left) and cap (40)
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 4, max: 4 });

    fireEvent.click(rollBtn());
    fireEvent.click(rollBtn());
    expect(poolUpdate.mock.calls).toEqual([[3], [2]]);

    fireEvent.click(doneBtn());

    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 30, CAMPAIGN]]);
    expect(store.Paladin1.currentHitPoints).toBe(30);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 10, rolls: [3, 7], poolAfter: 2 })],
    ]);
    expect(logRows()).toEqual([['Roll 2d12', 'Paladin1', '10', '2']]);
    // Accumulation is consumed — no stale pending total remains.
    expect(document.querySelector('.healing-roll-details')).toBeNull();
    expect(screen.queryByText(/HP to restore/)).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Double-apply detector: a second Done (nothing accumulated) commits
    // nothing further.
    fireEvent.click(doneBtn());
    expect(hpWrites()).toHaveLength(1);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(poolStore.current).toBe(2);
  });

  it('Done is inert when nothing is accumulated — no HP write, no log, pool untouched, still closes', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 4, max: 4 });

    fireEvent.click(doneBtn());

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(4);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Close seam with a pending accumulation ──

  it('Escape applies the pending roll exactly once, then closes', async () => {
    freezeRolls(12, [6]);
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 3, max: 4 });

    fireEvent.click(rollBtn());
    expect(poolUpdate.mock.calls).toEqual([[2]]);

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

  // ── Zero-CD heals-anyway quirk, dice path (HealingPoolModal.jsx:417-425) ──

  it('with zero Channel Divinity charges, each dice roll logs exactly one console.error, spends no charge, and still accumulates', async () => {
    // Store value 0 is distinctive vs the fallback (no class_levels → default
    // max 2): a mutant resolving through the fallback would spend charges
    // instead of refusing, and every assertion below dies.
    store.Paladin1.channelDivinityCharges = 0;
    freezeRolls(12, [4, 2]);
    await renderModal({ resourceCost: 'channel_divinity' }, { current: 4, max: 4 });

    fireEvent.click(rollBtn());
    fireEvent.click(rollBtn());

    // Quirk (cross-referenced by the CD lane's :342 amount-path face): the
    // once-per-mount latch is set BEFORE the charge check, so the error fires
    // on the first roll only and the rolls are never blocked.
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[HealingPoolModal] Paladin1 has no Channel Divinity charges to expend for ${FEATURE}.`,
    );
    // CD seam untouched: no charge write, no ability_use row at all.
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    // Dice still spend and accumulate anyway.
    expect(poolUpdate.mock.calls).toEqual([[3], [2]]);
    expect(rollDetails()).toEqual({ formula: 'Rolled 2d12: ', faces: '4 + 2', total: ' = 6 HP to restore' });
  });
});
