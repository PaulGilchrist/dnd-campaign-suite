// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the HP-HEAL seam only: applyHeal plumbing for both target
// lanes (combat-summary creatures via applyHealingToTarget args, no-combat
// self-heal via exact currentHitPoints writes through the live hp store),
// HP-pool deduction ordering across sequential heals through the live
// tracked-resource store, overheal clamping in both lanes, heal gating
// (Apply Heal enabled/disabled matrix: drained pool, zero amount,
// pool-equals-amount boundary), forced-click inertness on gated heals, exact
// healing_pool log payloads and log rows, post-heal amount re-clamping, and
// inertness of overlay/Escape/Done closes when no heal was taken.
// Deferred to owners:
// - HealingPoolModal.dice.test.jsx — dice-pool lane (Roll a dX, applyDiceHeal
//   dice deduction, accumulation, close-heal).
// - HealingPoolModal.curing.test.jsx — condition-cure lane.
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/gate/restriction note.
// - HealingPoolModal.channel-divinity.test.jsx — channel_divinity charge
//   consumption and ability_use logging on any action.
// - HealingPoolModal.test.jsx — loading state, static pool/target display
//   strings, heal-input display capping at render, default feature name,
//   target-selection rendering, generic Done/Escape close plumbing.
// (Subsumes former cases: "does not apply healing when pool is zero" —
// folded into the parameterised gating/inertness test; "reduces pool after
// each successive heal" — the former static-mock version pinned the stale
// double deduction [7, 7] caused by mockReturnValue never advancing, now
// replaced by the exact live-store ordered deduction [7, 4, 1]; "accumulates
// multiple log entries for sequential heals" — count-only assertion subsumed
// by the sequential test's exact log-row tuples; "applies self-heal when no
// combat context exists" — expect.any(Number) replaced by an exact write
// tuple through the live store.)
//
// Flagged product quirks (asserted as-is, not fixed here):
// 1. The combat lane deducts the FULL requested amount from the pool but
//    logs the engine's clamped actualHeal — an overheal over-deducts pool.
// 2. The no-combat lane clamps HP at the target maximum but logs the
//    requested amount in the healing_pool payload and log row.
// 3. The heal amount input and dice roll-details block use inline styles
//    (also flagged in the bloodied, curing, dice and channel-divinity lanes).
// The healing_pool payload carries no timestamp field, so the Date.now pin
// below is template hygiene only — no assertion depends on it.

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
import * as applyHealingService from '../../../../services/rules/combat/applyHealing.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures / live stores ──

const CAMPAIGN = 'test-campaign';
const FIXED_TS = 1750000000000; // deterministic timestamp (healing_pool logs carry none)

const basePlayerStats = {
  name: 'Paladin1',
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};

// Live mutable stores — tests mutate/read these directly instead of re-mocking.
let poolStore; // { current, max } — poolUpdate writes land in current
let hpStore; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let summary; // fresh per-test combat summary — the engine mock mutates NPC HP in place
let poolUpdate;
let dateNowSpy;

// Deterministic stand-in for the real healing engine: clamps at the target
// maximum, writes the new HP back to the live holder (hp store for players,
// combat-summary creature for NPCs), and returns the same result shape.
function engineHeal(cs, name, amount) {
  const creature = cs.creatures.find((c) => c.name === name);
  const isPlayer = creature.type === 'player';
  const maxHp = isPlayer ? hpStore[name].hitPoints : creature.maxHp;
  const oldHp = isPlayer ? hpStore[name].currentHitPoints : creature.currentHp;
  const newHp = Math.min(maxHp, oldHp + amount);
  if (isPlayer) {
    hpStore[name].currentHitPoints = newHp;
  } else {
    creature.currentHp = newHp;
  }
  return { actualHeal: newHp - oldHp, oldHp, newHp };
}

function setupPoolStore(current = 15, max = 20) {
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
    alsoCures: ['Blinded'],
    cureCost: 3,
    restoringTouchConditions: null,
    onClose: vi.fn(),
    ...overrides,
  };
}

async function renderModal(overrides = {}, pool = { current: 15, max: 20 }) {
  setupPoolStore(pool.current, pool.max);
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
  if (overrides?.creatureTargets?.length > 1) {
    await screen.findByRole('button', { name: 'Heal' });
  } else {
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
  }
  return rendered;
}

const healBtn = () => screen.getByRole('button', { name: 'Apply Heal' });
const healInput = () => screen.getByRole('spinbutton');

function setHealAmount(value) {
  fireEvent.change(healInput(), { target: { value: String(value) } });
}

async function selectTarget(name) {
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^${name}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
  await screen.findByRole('button', { name: 'Apply Heal' });
}

function hpWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === 'currentHitPoints');
}

function poolText() {
  return document.querySelector('.short-rest-section p')?.textContent;
}

function logRows() {
  const rows = screen.getByRole('table').querySelectorAll('tbody tr');
  return Array.from(rows).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent));
}

function healLog({ targetName = 'Paladin1', amount, poolAfter }) {
  return {
    type: 'healing_pool',
    sourceName: 'Paladin1',
    featureName: 'Lay On Hands',
    targetName,
    amount,
    poolAfter,
  };
}

// ── Tests ──

describe('HealingPoolModal - HP Healing', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS);
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    hpStore = {
      Paladin1: { currentHitPoints: 20, hitPoints: 40, activeConditions: [] },
    };
    summary = {
      creatures: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15, conditions: [{ key: 'blinded' }] },
      ],
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      const entry = hpStore[name];
      return entry && key in entry ? entry[key] : null;
    });
    useRuntimeState.setRuntimeValue.mockImplementation((name, key, value) => {
      const entry = hpStore[name] ??= {};
      entry[key] = value;
    });
    damageUtils.getCombatContext.mockResolvedValue(summary);
    applyHealingService.applyHealingToTarget.mockImplementation(engineHeal);
  });

  afterEach(() => {
    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.setRuntimeValue.mockReset();
    useTrackedResource.mockReset();
    damageUtils.getCombatContext.mockReset();
    damageUtils.getTargetFromAttacker.mockReset();
    applyHealingService.applyHealingToTarget.mockReset();
    logService.addEntry.mockReset();
    dateNowSpy.mockRestore();
  });

  // ── Combat-context heal (engine lane) ──

  it('applies a combat-context self-heal with exact engine args, pool deduction, healing_pool payload, and log row', async () => {
    await renderModal({}, { current: 10, max: 15 });
    setHealAmount(5);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Paladin1', 5, CAMPAIGN);
    expect(hpWrites()).toEqual([]); // engine owns the write in this lane
    expect(hpStore.Paladin1.currentHitPoints).toBe(25); // written by the live engine mock
    expect(poolUpdate.mock.calls).toEqual([[5]]);
    expect(poolStore.current).toBe(5);
    expect(poolText()).toBe('Pool: 5 / 15 HP');
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ amount: 5, poolAfter: 5 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Paladin1', '5', '5']]);
  });

  it('heals an NPC chosen in target selection through the engine, deducting the pool once with an exact payload', async () => {
    await renderModal(
      { creatureTargets: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ] },
      { current: 10, max: 20 },
    );
    await selectTarget('Orc Warrior');
    setHealAmount(5);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Orc Warrior', 5, CAMPAIGN);
    expect(summary.creatures[1].currentHp).toBe(20); // live summary advanced
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(poolUpdate.mock.calls).toEqual([[5]]);
    expect(poolStore.current).toBe(5);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ targetName: 'Orc Warrior', amount: 5, poolAfter: 5 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Orc Warrior', '5', '5']]);
  });

  // ── No-combat self-heal (runtime store lane) ──

  it('self-heals with no combat context: one exact currentHitPoints write, exact pool deduction and log payload', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);

    await renderModal({}, { current: 10, max: 20 });
    setHealAmount(5);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 25, CAMPAIGN]]);
    expect(hpStore.Paladin1.currentHitPoints).toBe(25);
    expect(poolUpdate.mock.calls).toEqual([[5]]);
    expect(poolStore.current).toBe(5);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ amount: 5, poolAfter: 5 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Paladin1', '5', '5']]);
  });

  it('clamps a no-combat overheal at the target maximum HP (quirk: pool deducts and log records the full requested amount)', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    hpStore.Paladin1.currentHitPoints = 38;

    await renderModal({}, { current: 12, max: 20 });
    setHealAmount(10);
    fireEvent.click(healBtn());

    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 40, CAMPAIGN]]); // clamped at 40
    expect(hpStore.Paladin1.currentHitPoints).toBe(40);
    expect(poolUpdate.mock.calls).toEqual([[2]]); // full 10 deducted despite only 2 healed
    expect(poolStore.current).toBe(2);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ amount: 10, poolAfter: 2 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Paladin1', '10', '2']]);
  });

  it('logs the engine clamped actualHeal while still deducting the full requested amount from the pool (flagged quirk)', async () => {
    summary.creatures[1].currentHp = 28; // Orc at 28/30 — 5-request overheals

    await renderModal(
      { creatureTargets: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 28 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ] },
      { current: 10, max: 20 },
    );
    await selectTarget('Orc Warrior');
    setHealAmount(5);
    fireEvent.click(healBtn());

    expect(summary.creatures[1].currentHp).toBe(30); // engine clamped at max
    expect(poolUpdate.mock.calls).toEqual([[5]]); // pool lost the full 5
    expect(poolStore.current).toBe(5);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ targetName: 'Orc Warrior', amount: 2, poolAfter: 5 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Orc Warrior', '2', '5']]);
  });

  // ── Gating and forced-click inertness ──

  it.each([
    { lane: 'pool drained', current: 0, max: 20, amount: 5, disabled: true },
    { lane: 'heal amount zero', current: 10, max: 20, amount: 0, disabled: true },
    { lane: 'pool equals amount', current: 5, max: 20, amount: 5, disabled: false },
  ])('Apply Heal disabled=$disabled when $lane — force-click stays fully inert when blocked', async ({ current, max, amount, disabled }) => {
    await renderModal({}, { current, max });
    setHealAmount(amount);

    if (disabled) {
      expect(healBtn()).toBeDisabled();
      fireEvent.click(healBtn()); // disabled — click must be inert

      expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(hpStore.Paladin1.currentHitPoints).toBe(20);
      expect(poolUpdate).not.toHaveBeenCalled();
      expect(poolStore.current).toBe(current);
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    } else {
      expect(healBtn()).toBeEnabled();
    }
  });

  // ── Sequential heals: exact ordered deduction through the live pool ──

  it('drains the pool with exact ordered deductions over three sequential heals, with matching logs, rows, and input re-clamp', async () => {
    await renderModal({}, { current: 10, max: 15 });

    for (let i = 0; i < 3; i++) {
      setHealAmount(3);
      fireEvent.click(healBtn());
    }

    expect(applyHealingService.applyHealingToTarget.mock.calls).toEqual([
      [summary, 'Paladin1', 3, CAMPAIGN],
      [summary, 'Paladin1', 3, CAMPAIGN],
      [summary, 'Paladin1', 3, CAMPAIGN],
    ]);
    expect(poolUpdate.mock.calls).toEqual([[7], [4], [1]]); // live, not the former stale [7, 7]
    expect(poolStore.current).toBe(1);
    expect(hpStore.Paladin1.currentHitPoints).toBe(29); // 20 + 3 + 3 + 3
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ amount: 3, poolAfter: 7 })],
      [CAMPAIGN, healLog({ amount: 3, poolAfter: 4 })],
      [CAMPAIGN, healLog({ amount: 3, poolAfter: 1 })],
    ]);
    expect(logRows()).toEqual([
      ['Heal', 'Paladin1', '3', '7'],
      ['Heal', 'Paladin1', '3', '4'],
      ['Heal', 'Paladin1', '3', '1'],
    ]);
    // Amount re-clamps to the drained pool after the last heal.
    expect(healInput()).toHaveValue(1);
  });

  // ── Close seams without a heal ──

  it('closing via overlay, Escape, or Done without healing writes no HP, spends no pool, and logs nothing', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 10, max: 20 });
    setHealAmount(5);

    fireEvent.click(document.querySelector('.short-rest-overlay'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Done closes without healing — HP-pool close applies nothing (only the
    // dice lane's handleClose consumes an accumulation, owned by dice.test).
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(hpStore.Paladin1.currentHitPoints).toBe(20);
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(10);
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
