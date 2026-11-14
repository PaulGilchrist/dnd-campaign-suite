// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the commit-time fresh-read seam (bug-healing-pool-dice-commit-
// stale-closure-damages-hp): a mounted modal never re-renders when another
// writer changes the target's currentHitPoints bucket, so every commit lane
// must re-read the bucket at COMMIT time instead of trusting the render
// closure. Faces owned here:
// - dice lane: target filled to full between the rolls and Done → refund every
//   die, write NO HP, honest amount:0 ledger row (the d595cff2c refund promise,
//   dead while the closure was stale);
// - dice lane: target partially raised between the rolls and Done → commit from
//   the FRESH bucket (never lower than current), ledger logs only the
//   capacity that actually restored;
// - amount lane (no-creature branch): target raised between render and Apply
//   Heal → the write can never land below the target's current HP.
// Deferred to owners: HealingPoolModal.dice.test.jsx (dice display/gating/
// deduction/happy-path commit), HealingPoolModal.healing.test.jsx (amount-lane
// happy plumbing), HealingPoolModal.overheal.test.jsx (over-cap allocation).

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(() => () => {}),
  useRuntimeValue: vi.fn(() => null), // display-echo subscription seam (return value unused by the heal modals)
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
    { key: 'poisoned', label: 'Poisoned' },
  ],
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures / live stores ──

const CAMPAIGN = 'test-campaign';
const FEATURE = 'Healing Light';

const basePlayerStats = {
  name: 'CelestialWarlock',
  level: 3,
  hitPoints: 143,
  abilities: { CHA: 14 },
};

// Live mutable stores — external writers are simulated by mutating `store`
// AFTER the modal has rendered (no component re-render fires, exactly like a
// settled tab adopting an SSE-echoed bucket write while the modal dwells open).
let poolStore; // { current, max } — poolUpdate writes land in current
let store; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let poolUpdate;
let randomSpy;

// Frozen dice fixtures: each queued face value becomes the next roll exactly
// (roll = Math.floor(random * dieType) + 1).
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
    dieType: 6,
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

const rollBtn = () => screen.getByRole('button', { name: 'Roll a d6' });

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
    sourceName: 'CelestialWarlock',
    featureName: FEATURE,
    targetName: 'CelestialWarlock',
    amount,
    diceUsed: rolls.length,
    dieType: 6,
    rolls,
    poolAfter,
  };
}

// ── Tests ──

describe('HealingPoolModal - commit-time fresh HP read (stale-closure integrity)', () => {
  beforeEach(() => {
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    store = {
      CelestialWarlock: { currentHitPoints: 100, hitPoints: 143, activeConditions: [] },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      const entry = store[name];
      return entry && key in entry ? entry[key] : null;
    });
    useRuntimeState.setRuntimeValue.mockImplementation((name, key, value) => {
      const entry = store[name] ??= {};
      entry[key] = value;
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'CelestialWarlock', type: 'player' }],
    });
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

  it('dice lane: target filled to FULL between the rolls and Done refunds every die and writes NO HP', async () => {
    freezeRolls(6, [6, 4]);
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 21, max: 21 });

    fireEvent.click(rollBtn());
    fireEvent.click(rollBtn());
    expect(poolStore.current).toBe(19);

    // External healer fills the target to 143 while the modal dwells open.
    store.CelestialWarlock.currentHitPoints = 143;

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // Zero HP written — the stale closure must not overwrite 143 with 100 + 10.
    expect(hpWrites()).toEqual([]);
    expect(store.CelestialWarlock.currentHitPoints).toBe(143);
    // Both dice refunded to the pool (21).
    expect(poolUpdate.mock.calls).toEqual([[20], [19], [21]]);
    expect(poolStore.current).toBe(21);
    // Ledger honestly records a zero heal with the dice returned.
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 0, rolls: [6, 4], poolAfter: 21 })],
    ]);
    expect(logRows()).toEqual([['Roll 2d6', 'CelestialWarlock', '0', '21']]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dice lane: target partially raised between the rolls and Done commits from the FRESH bucket and logs only the restored capacity', async () => {
    freezeRolls(6, [6, 4]);
    await renderModal({}, { current: 21, max: 21 });

    fireEvent.click(rollBtn());
    fireEvent.click(rollBtn());

    // External tab heals 100 → 140: only 3 HP of capacity remains for the 10 rolled.
    store.CelestialWarlock.currentHitPoints = 140;

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // Never lower than the fresh bucket — caps at max instead of the stale 100 + 10.
    expect(hpWrites()).toEqual([['CelestialWarlock', 'currentHitPoints', 143, CAMPAIGN]]);
    expect(store.CelestialWarlock.currentHitPoints).toBe(143);
    // Dice were spent and landed — no refund.
    expect(poolUpdate.mock.calls).toEqual([[20], [19]]);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 3, rolls: [6, 4], poolAfter: 19 })],
    ]);
    expect(logRows()).toEqual([['Roll 2d6', 'CelestialWarlock', '3', '19']]);
  });

  it('amount lane (no-creature branch): raised between render and Apply Heal, the write never lands below the target current HP', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null); // no combat → else branch
    const onClose = vi.fn();
    await renderModal({ isDicePool: false, name: 'Lay On Hands', onClose }, { current: 10, max: 10 });

    const input = document.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '5' } });

    // External write raises the bucket to 140 AFTER the last render of the
    // closure — a stale commit would write 100 + 5 = 105 (a 35 HP loss).
    store.CelestialWarlock.currentHitPoints = 140;

    fireEvent.click(screen.getByRole('button', { name: 'Apply Heal' }));

    expect(hpWrites()).toEqual([['CelestialWarlock', 'currentHitPoints', 143, CAMPAIGN]]);
    expect(store.CelestialWarlock.currentHitPoints).toBe(143);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
  });
});
