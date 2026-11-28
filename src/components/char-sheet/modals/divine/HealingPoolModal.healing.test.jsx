// @maintained-by-ai 2026-11-27 healing lane: real full-shape engine result + phantom/style-claim purge
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the HP-HEAL commit seam only: applyHeal plumbing for both
// target lanes — combat-summary creatures through applyHealingToTarget exact
// 4-arg dispatch with consumption of the REAL engine result shape
// { actualHeal, oldHp, newHp, maxHp } (applyHealing.js:78; the ledger is
// driven ONLY by actualHeal — pool spend, payload amount and log-row amount —
// the fixture values below are byte-distinct so reading newHp/maxHp instead
// would surface as different numbers) — and no-combat self-heal via exact
// currentHitPoints writes through the live runtime store. Also owned: the
// full healing_pool payload shape (no timestamp field), the modal-log row
// census, ordered pool deduction over sequential heals through the live
// tracked-resource store, post-heal amount re-clamp, and the Apply Heal
// enabled/disabled gate matrix (drained pool, zero amount, pool==amount
// exact boundary).
// Deferred to owners (re-verified against current sibling tests, 2026-11-27):
// - HealingPoolModal.amount-capacity.test.jsx — the heal-CAPACITY seam both
//   lanes: full-HP refusals (render-disabled + commit-time re-read + engine
//   actualHeal-0 race) AND the partial-clamp face — its :272 pins the engine
//   called with the clamped amount + spend + row, its :345 pins the self-lane
//   clamped write + charge + row. The former same-branch clamp tests here
//   (engine-lane 28/30 and self 38/40) are purged as weaker copies.
// - HealingPoolModal.overheal.test.jsx — dice-lane noHealCapacity full-HP gate.
// - HealingPoolModal.stale-closure.test.jsx — commit fresh-reads.
// - HealingPoolModal.channel-divinity.test.jsx — CD charge spend census and
//   ordered commit witness (this lane never passes resourceCost).
// - HealingPoolModal.dice.test.jsx — dice-pool lane (Roll a dX, applyDiceHeal
//   deduction, accumulation, close-heal, "Roll NdX" rows).
// - HealingPoolModal.curing.test.jsx — condition-cure lane.
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/gate/restriction note.
// - HealingPoolModal.pool-clamp-hints.test.jsx — typed-over-pool and
//   exhausted-pool inline notes.
// - HealingPoolModal.test.jsx — loading state, static pool/target display
//   strings, target-selection rendering, and the generic close plumbing:
//   Done-once (:341), Escape-once (:348), overlay-never-closes (:354). The
//   former multi-path close-inertness test here was that base plumbing plus a
//   zero-action check the gate matrix already implies (an ungated press
//   commits; a closed modal has no commit call at all) — purged.
//
// Fix discipline notes for this pass (2026-11-27):
// - Phantom mock keys getTargetFromAttacker and addStorageChangeListener
//   purged (audited vs disk + loaded render graph: HealingPoolModal.jsx,
//   SecondaryTargetModal.jsx and healingPoolHandler.js import neither), and
//   the 4-of-15 CONDITIONS mirror-fixture mock is retired — conditionUtils is
//   a pure data module (zero imports) and the REAL 15-entry catalog now backs
//   the curable-section merge path exercised beside the heals.
// - engineHeal previously laundered the result to { actualHeal, oldHp, newHp }
//   — the real engine also returns maxHp (applyHealing.js:78); the mock now
//   returns the exact full shape so a mutant reading maxHp/newHp cannot hide.
// - The heal amount input and roll-details inline-style claim in the former
//   header was STALE: HealingPoolModal.jsx has no inline styles (grep for
//   style= finds nothing) — same correction the dice/curing lanes made.
// - Forced-click-on-disabled pins removed from the gate matrix: React
//   suppresses onClick through disabled buttons in jsdom (probe-verified
//   #1920/#1921), so they pinned nothing beyond the disabled-attribute
//   assertion the arms now make.
// - The dead Date.now pin is removed: the healing_pool payload carries no
//   timestamp field (HealingPoolModal.jsx:577-584) and no row in this lane is
//   stamped — the CD lane's ability_use and the curing lane's condition rows
//   carry their own frozen stamps where they are asserted.
// - Family-known items cross-referenced, NOT re-pinned here: the duplicated
//   noHealCapacity prop (HealingPoolModal.jsx:823/:828, harmless) and the
//   once-per-mount CD latch-before-charge-check quirk (:417-425, owned by the
//   channel-divinity + dice lanes).

// ── Mocked modules ──
// Keys mirror ONLY what the loaded render graph imports: HealingPoolModal.jsx
// itself, SecondaryTargetModal.jsx (real component) and healingPoolHandler.js
// (deliberately NOT mocked — its own imports damageUtils/useRuntimeState/
// logService are covered below).

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
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n?.toLowerCase().trim()) },
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
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};

// Live mutable stores — tests mutate/read these directly instead of re-mocking.
let poolStore; // { current, max } — poolUpdate writes land in current
let hpStore; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let summary; // fresh per-test combat summary — the engine mock mutates NPC HP in place
let poolUpdate;

// Deterministic stand-in for the real healing engine: clamps at the target
// maximum, writes the new HP back to the live holder (hp store for players,
// combat-summary creature for NPCs), and returns the REAL full result shape
// { actualHeal, oldHp, newHp, maxHp } (applyHealing.js:78).
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
  return { actualHeal: newHp - oldHp, oldHp, newHp, maxHp };
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
  // Flush the async getCombatContext effect: the target picker (multi-target)
  // or the Apply Heal button (single target) only exists once loaded.
  if (overrides?.creatureTargets?.length > 1) {
    await screen.findByRole('button', { name: 'Heal' });
  } else {
    await screen.findByRole('button', { name: 'Apply Heal' });
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
    applyHealingService.applyHealingToTarget.mockReset();
    logService.addEntry.mockReset();
  });

  // ── Combat-context heal (engine lane) ──

  it('applies a combat-context self-heal with exact engine args, actualHeal-driven ledger, and healing_pool payload + row', async () => {
    // Distinct bytes per channel (heal 7, pool 11→4, HP 20→27, max 40): if
    // the ledger read result.newHp/maxHp instead of result.actualHeal, every
    // pinned number below would differ.
    await renderModal({}, { current: 11, max: 15 });
    setHealAmount(7);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Paladin1', 7, CAMPAIGN);
    expect(hpWrites()).toEqual([]); // engine owns the write in this lane
    expect(hpStore.Paladin1.currentHitPoints).toBe(27); // written by the live engine mock
    expect(poolUpdate.mock.calls).toEqual([[4]]); // safePool − actualHeal
    expect(poolStore.current).toBe(4);
    expect(poolText()).toBe('Pool: 4 / 15 HP'); // post-heal echo through the tracked-resource store
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ amount: 7, poolAfter: 4 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Paladin1', '7', '4']]);
  });

  it('heals an NPC chosen in target selection through the engine, deducting the pool once with an exact payload', async () => {
    await renderModal(
      { creatureTargets: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ] },
      { current: 13, max: 20 },
    );
    await selectTarget('Orc Warrior');
    setHealAmount(7);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Orc Warrior', 7, CAMPAIGN);
    expect(summary.creatures[1].currentHp).toBe(22); // live summary advanced
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled(); // engine lane writes nothing itself
    expect(poolUpdate.mock.calls).toEqual([[6]]);
    expect(poolStore.current).toBe(6);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ targetName: 'Orc Warrior', amount: 7, poolAfter: 6 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Orc Warrior', '7', '6']]);
  });

  // ── No-combat self-heal (runtime store lane) ──

  it('self-heals with no combat context: one exact currentHitPoints write, exact pool deduction and log payload', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);

    await renderModal({}, { current: 12, max: 20 });
    setHealAmount(7);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 27, CAMPAIGN]]);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1); // no second write
    expect(hpStore.Paladin1.currentHitPoints).toBe(27);
    expect(poolUpdate.mock.calls).toEqual([[5]]);
    expect(poolStore.current).toBe(5);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, healLog({ amount: 7, poolAfter: 5 })],
    ]);
    expect(logRows()).toEqual([['Heal', 'Paladin1', '7', '5']]);
  });

  // ── Apply Heal gating matrix ──
  // Disabled-attribute arms only: forced-click-on-disabled pins were removed
  // (React suppresses onClick through disabled buttons in jsdom — probe-
  // verified #1920/#1921), and the refusal-note copy is owned by the
  // pool-clamp-hints / amount-capacity lanes.

  it.each([
    { lane: 'pool drained', current: 0, max: 20, amount: 5, disabled: true },
    { lane: 'heal amount zero', current: 10, max: 20, amount: 0, disabled: true },
    { lane: 'pool equals amount (exact boundary)', current: 7, max: 20, amount: 7, disabled: false },
  ])('Apply Heal disabled=$disabled when $lane', async ({ current, max, amount, disabled }) => {
    await renderModal({}, { current, max });
    setHealAmount(amount);

    if (disabled) {
      expect(healBtn()).toBeDisabled();
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
    expect(poolUpdate.mock.calls).toEqual([[7], [4], [1]]); // live, not a stale repeated value
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
});
