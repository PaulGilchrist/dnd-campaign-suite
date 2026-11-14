// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the AMOUNT-lane heal-CAPACITY seam
// (bug-amount-heal-lane-charges-pool-on-full-hp-target): a press that can
// restore zero HP refuses with an inline .healing-restriction-note and ZERO
// pool spend / ZERO target write / ZERO audit row — both at render (disabled
// Apply Heal button, dice-lane parity) and at COMMIT (live re-read; the modal
// dwells across external bucket writes). Partial-capacity presses charge and
// log exactly the HP that restores, and a damaged-target control heals
// honestly (pool delta == HP gained). Both target lanes are pinned (board via
// the engine's actualHeal, off-board/self via the clamped write) — the same
// guard covers the 5e and 2024 Lay On Hands twins (healingPoolHandler emits
// this HP-pool payload for both rulesets) and every other non-dice pool.
// Deferred to owners: HealingPoolModal.healing.test.jsx (applyHeal plumbing,
// deduction order, log payload shapes, gating matrix);
// HealingPoolModal.overheal.test.jsx (dice-lane over-heal honesty);
// HealingPoolModal.dice.test.jsx; HealingPoolModal.curing.test.jsx;
// HealingPoolModal.bloodied.test.jsx; HealingPoolModal.channel-divinity.test.jsx.

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
  CONDITIONS: [],
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as applyHealingService from '../../../../services/rules/combat/applyHealing.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures / live stores ──

const CAMPAIGN = 'test-campaign';

const basePlayerStats = {
  name: 'Paladin1',
  level: 20, // LoH HP pool = 5 × level = 100 — mirrors the live ElderPaladin rig
  hitPoints: 40,
  abilities: { CHA: 14 },
};

// Live mutable stores — tests mutate/read these directly instead of re-mocking.
let poolStore; // { current, max } — poolUpdate writes land in current
let hpStore; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let summary; // combat summary the engine mock mutates in place
let poolUpdate;

// Deterministic stand-in for the real healing engine (same shape as
// healing.test.jsx): clamps at the target maximum, writes the live holder,
// returns the same result shape.
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

function setupPoolStore(current = 100, max = 100) {
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
    alsoCures: [],
    cureCost: 5,
    restoringTouchConditions: null,
    onClose: vi.fn(),
    ...overrides,
  };
}

async function renderModal(overrides = {}, pool = { current: 100, max: 100 }) {
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
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^Select ${name}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
  await screen.findByRole('button', { name: 'Apply Heal' });
}

function hpWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === 'currentHitPoints');
}

function refusalNote(name) {
  return screen.getByText(`${name} is already at full HP. No pool spent.`);
}

function expectZeroCommit() {
  expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
  expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  expect(poolUpdate).not.toHaveBeenCalled();
  expect(logService.addEntry).not.toHaveBeenCalled();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
}

// ── Tests ──

describe('HealingPoolModal - amount-lane heal capacity', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    hpStore = {
      Paladin1: { currentHitPoints: 40, hitPoints: 40, activeConditions: [] },
      Ally: { currentHitPoints: 50, hitPoints: 50, activeConditions: [] },
    };
    summary = {
      creatures: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Ally', type: 'player' },
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
  });

  // ── Board-target face (engine branch) ──

  it('full-HP board target: Apply Heal disabled with the inline note, force-click spends nothing', async () => {
    await renderModal({ creatureTargets: [
      { name: 'Paladin1', type: 'player' },
      { name: 'Ally', type: 'player' },
    ] });
    await selectTarget('Ally');
    setHealAmount(10);

    expect(screen.getByRole('heading', { level: 4, name: 'Heal — Ally (50 / 50 HP)' })).toBeInTheDocument();
    expect(healBtn()).toBeDisabled();
    expect(refusalNote('Ally')).toHaveClass('healing-restriction-note');

    fireEvent.click(healBtn()); // disabled — click must be inert
    expectZeroCommit();
    expect(hpStore.Ally.currentHitPoints).toBe(50);
    expect(poolStore.current).toBe(100);
  });

  it('full-HP board target drained mid-dwell: the COMMIT-time re-read refuses — zero pool spend, zero writes, zero rows, inline note', async () => {
    // The honesty law lives at commit, not render: the button is enabled while
    // the target has room, an external writer (tab/AI referee) fills it to max
    // while the modal dwells. Pre-fix this press charged the pool for the full
    // amount and logged an `amount: 0` row.
    hpStore.Ally.currentHitPoints = 45;
    await renderModal({ creatureTargets: [
      { name: 'Paladin1', type: 'player' },
      { name: 'Ally', type: 'player' },
    ] });
    await selectTarget('Ally');
    setHealAmount(10);
    expect(healBtn()).toBeEnabled();

    hpStore.Ally.currentHitPoints = 50; // external fill — no re-render dispatched

    fireEvent.click(healBtn());

    expect(refusalNote('Ally')).toHaveClass('healing-restriction-note');
    expectZeroCommit();
    expect(hpStore.Ally.currentHitPoints).toBe(50);
    expect(poolStore.current).toBe(100);
  });

  it('race after the capacity check: an engine commit that restores nothing charges and logs nothing', async () => {
    // The commit-time check passes, then the engine's own re-read finds the
    // target already full (actualHeal 0). Pool-spend must still equal the HP
    // restored (zero) — no `amount: 0` ledger row, no pool write.
    hpStore.Ally.currentHitPoints = 45;
    await renderModal({ creatureTargets: [
      { name: 'Paladin1', type: 'player' },
      { name: 'Ally', type: 'player' },
    ] });
    await selectTarget('Ally');
    setHealAmount(10);
    // Between the modal's commit re-read and the engine's own read, another
    // healer fills the bucket to max; the engine returns actualHeal 0.
    applyHealingService.applyHealingToTarget.mockImplementation((cs, name) => {
      const old = hpStore[name].currentHitPoints;
      return { actualHeal: 0, oldHp: old, newHp: old };
    });

    fireEvent.click(healBtn());

    expect(refusalNote('Ally')).toHaveClass('healing-restriction-note');
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(poolStore.current).toBe(100);
  });

  it('partial-capacity press: the engine is called with, the pool spends, and the row states the CLAMPED heal', async () => {
    hpStore.Ally.currentHitPoints = 45; // 5 HP of room for a 10 request

    await renderModal({ creatureTargets: [
      { name: 'Paladin1', type: 'player' },
      { name: 'Ally', type: 'player' },
    ] });
    await selectTarget('Ally');
    setHealAmount(10);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Ally', 5, CAMPAIGN);
    expect(hpStore.Ally.currentHitPoints).toBe(50);
    expect(poolUpdate.mock.calls).toEqual([[95]]);
    expect(poolStore.current).toBe(95);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, {
        type: 'healing_pool',
        sourceName: 'Paladin1',
        featureName: 'Lay On Hands',
        targetName: 'Ally',
        amount: 5,
        poolAfter: 95,
      }],
    ]);
    expect(screen.getByRole('table').querySelectorAll('tbody tr')[0].textContent).toBe('HealAlly595');
    // No refusal happened (the heal committed) — but the target is now at max,
    // so the render gate legitimately shows its note for the NEXT press.
    expect(refusalNote('Ally')).toBeInTheDocument();
  });

  // ── Off-board / self face (runtime-store branch) ──

  it('full-HP self (no board row): press is refused — zero pool spend, NO fabricated row, inline note', async () => {
    // Mirrors the live repro: source off the board, self at max. Pre-fix this
    // face charged the pool AND logged a row ASSERTING a heal that never
    // happened.
    damageUtils.getCombatContext.mockResolvedValue(null);

    await renderModal({});
    setHealAmount(10);

    expect(screen.getByRole('heading', { level: 4, name: 'Heal — Paladin1 (40 / 40 HP)' })).toBeInTheDocument();
    expect(healBtn()).toBeDisabled();
    expect(refusalNote('Paladin1')).toHaveClass('healing-restriction-note');

    fireEvent.click(healBtn()); // disabled — click must be inert
    expectZeroCommit();
    expect(hpStore.Paladin1.currentHitPoints).toBe(40);
    expect(poolStore.current).toBe(100);
  });

  it('full-HP self drained mid-dwell: COMMIT-time re-read refuses — zero writes and no fabricated row', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    hpStore.Paladin1.currentHitPoints = 35;

    await renderModal({});
    setHealAmount(10);
    expect(healBtn()).toBeEnabled();

    hpStore.Paladin1.currentHitPoints = 40; // external fill while the modal dwells

    fireEvent.click(healBtn());

    expect(refusalNote('Paladin1')).toHaveClass('healing-restriction-note');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled(); // never a row claiming a heal that did not occur
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(hpStore.Paladin1.currentHitPoints).toBe(40);
    expect(poolStore.current).toBe(100);
  });

  it('partial-capacity self press: clamps the write AND the charge — row states the true healed amount', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    hpStore.Paladin1.currentHitPoints = 38; // 2 HP of room for a 10 request

    await renderModal({});
    setHealAmount(10);
    fireEvent.click(healBtn());

    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 40, CAMPAIGN]]);
    expect(hpStore.Paladin1.currentHitPoints).toBe(40);
    expect(poolUpdate.mock.calls).toEqual([[98]]); // pool lost only the 2 that restored
    expect(poolStore.current).toBe(98);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, {
        type: 'healing_pool',
        sourceName: 'Paladin1',
        featureName: 'Lay On Hands',
        targetName: 'Paladin1',
        amount: 2, // the TRUE restored amount — never the raw request
        poolAfter: 98,
      }],
    ]);
    expect(screen.getByRole('table').querySelectorAll('tbody tr')[0].textContent).toBe('HealPaladin1298');
  });

  // ── Honest control ──

  it('damaged-target control heals honestly: pool delta equals HP gained with a matching row', async () => {
    hpStore.Ally.currentHitPoints = 30;

    await renderModal({ creatureTargets: [
      { name: 'Paladin1', type: 'player' },
      { name: 'Ally', type: 'player' },
    ] });
    await selectTarget('Ally');
    setHealAmount(10);
    fireEvent.click(healBtn());

    expect(hpStore.Ally.currentHitPoints).toBe(40); // +10
    expect(poolUpdate.mock.calls).toEqual([[90]]); // −10 — pool delta == HP gained
    expect(poolStore.current).toBe(90);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, {
        type: 'healing_pool',
        sourceName: 'Paladin1',
        featureName: 'Lay On Hands',
        targetName: 'Ally',
        amount: 10,
        poolAfter: 90,
      }],
    ]);
    expect(screen.getByRole('table').querySelectorAll('tbody tr')[0].textContent).toBe('HealAlly1090');
    expect(screen.queryByText(/already at full HP/)).not.toBeInTheDocument();
  });
});
