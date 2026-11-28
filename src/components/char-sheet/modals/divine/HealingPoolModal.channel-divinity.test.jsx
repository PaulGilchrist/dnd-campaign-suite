// @maintained-by-ai 2026-11-27 channel-divinity lane: distinct-value store/fallback fixtures + ordered commit census
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the CHANNEL DIVINITY seam only: consumeChannelDivinity's
// gating (resourceCost === 'channel_divinity', once-per-mount ref latch — the
// classic double-channel detector), charge resolution through the REAL
// resolveChannelDivinityCharges (healingPoolHandler.js is deliberately NOT
// mocked; runtime-store-first read of the 'channelDivinityCharges' key with
// the class_levels[level-1].channel_divinity fallback). The store fixture is
// deliberately DISTINCT from the class max (store 1 vs class_levels[16] = 3)
// so a mutant that resolves from the fallback while the store has a value
// writes 2/(2/3) instead of the pinned 0/(0/3) — and the fallback leg (store
// key deleted, class max 3 ≠ hardcoded default 2) kills a
// hardcoded-fallback mutant the reverse way. Also owns the exact ordered
// commit census (charge write + ability_use row land BEFORE the pool write
// and the healing_pool row — the heal row is asserted only as the ordering
// witness; its payload shape is healing.test.jsx's), the exact ability_use
// payload under frozen Date.now, zero-silence on charges exhausted (no
// charge write, no ability_use row, console.error), and charge inertness for
// non-CD features and closes with no CD action.
// Deferred to owners:
// - HealingPoolModal.bloodied.test.jsx — bloodied gating/badge/restriction
//   note, gate-blocked inertness (this lane must NOT re-pin).
// - HealingPoolModal.healing.test.jsx — general applyHeal plumbing,
//   applyHealingToTarget args, pool deduction, healing_pool log payload
//   shape (incl. the exact self-heal currentHitPoints write/pool/log row),
//   generic close-inertness plumbing.
// - HealingPoolModal.curing.test.jsx — condition-cure mechanics (write
//   payloads, condition-log rows, gating) — this lane pins only the CD
//   spend triggered through those lanes' first action.
// - HealingPoolModal.dice.test.jsx — dice accumulation/close-heal mechanics.
// - HealingPoolModal.test.jsx — loading state, display strings, target
//   selection, Done/Escape/overlay close plumbing (generic — including that
//   an overlay click never closes: the component has no overlay click
//   handler, so the former overlay leg here was base plumbing, purged).

// ── Mocked modules ──
// Keys mirror ONLY what the loaded render graph imports: HealingPoolModal.jsx
// itself, SecondaryTargetModal.jsx (real component, its own deps load for
// real), and healingPoolHandler.js's own imports (damageUtils getCombatContext,
// useRuntimeState getRuntimeValue, logService addEntry). Former phantom keys
// getTargetFromAttacker, addStorageChangeListener and the unused
// services/ui/storage.js mock are purged (nothing in the graph imports them —
// same purge the bloodied lane applied). conditionUtils is a pure data
// module — the 4-of-15 CONDITIONS mirror-fixture mock is retired in favor of
// the real catalog ('Poisoned' resolves against it).

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
const CLERIC = 'Divine_Cleric';
const FIXED_TS = 1750000000000; // deterministic timestamp for exact log payloads

// Level-17 cleric: class_levels[16].channel_divinity = 3 — the class max
// resolveChannelDivinityCharges falls back to ONLY when the store key is
// absent. Distinct from the live store value (1 charge) so the store-first
// read and the fallback leg cannot be swapped by a mutant unnoticed.
const clericStats = {
  name: CLERIC,
  level: 17,
  hitPoints: 90,
  abilities: { CHA: 16 },
  class: {
    class_levels: Array.from({ length: 17 }, (_, i) => ({
      level: i + 1,
      channel_divinity: i === 16 ? 3 : undefined,
    })),
  },
};

const combatSummary = {
  creatures: [{ name: CLERIC, type: 'player' }],
};

// Live mutable stores — tests mutate/read these directly instead of re-mocking.
let poolStore; // { current, max } — poolUpdate writes land in current
let hpStore; // { [characterName]: { currentHitPoints, hitPoints, channelDivinityCharges, activeConditions } }
let poolUpdate;
let dateNowSpy;
let consoleErrorSpy;

function setupPoolStore(current = 12, max = 12) {
  poolStore = { current, max };
  useTrackedResource.mockImplementation(() => ({
    current: poolStore.current,
    max: poolStore.max,
    update: poolUpdate,
  }));
}

function makeProps(overrides = {}) {
  return {
    playerStats: clericStats,
    campaignName: CAMPAIGN,
    name: 'Preserve Life',
    bloodiedOnly: true,
    resourceCost: 'channel_divinity',
    onClose: vi.fn(),
    ...overrides,
  };
}

async function renderModal(overrides = {}, findButton = 'Apply Heal') {
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
  await screen.findByRole('button', { name: findButton });
  return rendered;
}

const healBtn = () => screen.getByRole('button', { name: 'Apply Heal' });

function setHealAmount(value) {
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: String(value) } });
}

function expectedAbilityLog(remaining, max = 3) {
  return {
    type: 'ability_use',
    characterName: CLERIC,
    abilityName: 'Preserve Life',
    description: `${CLERIC} expended 1 Channel Divinity to use Preserve Life (${remaining}/${max} remaining).`,
    timestamp: FIXED_TS,
  };
}

function healLog(amount, poolAfter) {
  return {
    type: 'healing_pool',
    sourceName: CLERIC,
    featureName: 'Preserve Life',
    targetName: CLERIC,
    amount,
    poolAfter,
  };
}

// NOTE — flagged component defects (not fixed here):
// 1. The amount input and dice roll-details block use inline styles
//    (also flagged in bloodied/healing/curing/dice lanes).
// 2. With zero CD charges, applyHeal still heals and drains the pool — it
//    only skips the charge spend (console.error). healingPoolHandler returns
//    a blocking popup in the same situation; the modal does not. Asserted
//    as-is below.
// 3. HealingPoolModal.jsx renders `noHealCapacity={noHealCapacity}` twice on
//    HealingPoolMain (duplicate JSX prop, byte-identical — harmless, flagged).

// ── Tests ──

describe('HealingPoolModal - Channel Divinity', () => {
  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    setupPoolStore();
    // 1 live charge vs class max 3 — see fixture note: the two resolution
    // legs must never be interchangeable without the pins below noticing.
    hpStore = {
      [CLERIC]: {
        currentHitPoints: 10,
        hitPoints: 90,
        channelDivinityCharges: 1,
        activeConditions: ['poisoned'],
      },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      const entry = hpStore[name];
      return entry && key in entry ? entry[key] : null;
    });
    useRuntimeState.setRuntimeValue.mockImplementation((name, key, value) => {
      const entry = hpStore[name] ??= {};
      entry[key] = value;
    });
    damageUtils.getCombatContext.mockResolvedValue(combatSummary);
    // Real applyHealing.js return shape: { actualHeal, oldHp, newHp, maxHp }.
    applyHealingService.applyHealingToTarget.mockImplementation((cs, name, amount) => ({
      actualHeal: amount,
      oldHp: 10,
      newHp: 10 + amount,
      maxHp: 90,
    }));
  });

  afterEach(() => {
    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.setRuntimeValue.mockReset();
    useTrackedResource.mockReset();
    damageUtils.getCombatContext.mockReset();
    applyHealingService.applyHealingToTarget.mockReset();
    logService.addEntry.mockReset();
    dateNowSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ── First CD action: runtime-store-first resolution + full ordered census ──

  it('expends exactly one store-resolved charge on first Apply Heal, before the pool write and both exact log rows', async () => {
    await renderModal();
    setHealAmount(5);
    fireEvent.click(healBtn());

    // Read-side arity truth: resolveChannelDivinityCharges reads the store
    // key with the 2-param getRuntimeValue contract (no campaignName arg).
    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(CLERIC, 'channelDivinityCharges');
    // Store-first: live charge count is 1 while the class max is 3, so
    // 0/(0/3) can only come from (store=1, fallback max=3) — a fallback-read
    // mutant would write 2/(2/3).
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      [CLERIC, 'channelDivinityCharges', 0, CAMPAIGN],
    ]);
    expect(hpStore[CLERIC].channelDivinityCharges).toBe(0);
    // Ordered commit census: the ability_use row is the FIRST addEntry call,
    // ahead of the healing_pool row (whose payload shape healing.test.jsx
    // owns — pinned here only as the ordering witness). The combat lane
    // writes no HP bucket itself (the engine owns that).
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, expectedAbilityLog(0)],
      [CAMPAIGN, healLog(5, 7)],
    ]);
    expect(poolUpdate.mock.calls).toEqual([[7]]);
    expect(poolStore.current).toBe(7);
  });

  // ── Once-per-mount latch: the double-channel detector ──

  it('does not expend additional charges on subsequent heals in the same session', async () => {
    await renderModal();

    setHealAmount(5);
    fireEvent.click(healBtn());
    setHealAmount(3);
    fireEvent.click(healBtn());
    setHealAmount(4);
    fireEvent.click(healBtn());

    // Exactly one charge write across three heals — channel divinity is
    // 1/short rest; a latch regression shows up as a second tuple here.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      [CLERIC, 'channelDivinityCharges', 0, CAMPAIGN],
    ]);
    expect(logService.addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use')).toHaveLength(1);
    // Negative control: all three heals ran (pool drained 12 → 0), the latch
    // only suppressed charges.
    expect(poolUpdate.mock.calls.map(([v]) => v)).toEqual([7, 4, 0]);
    expect(poolStore.current).toBe(0);
  });

  // ── First action of a fresh mount on every CD lane ──

  it.each([
    {
      lane: 'single cure',
      props: { alsoCures: ['Poisoned'], cureCost: 5 },
      findButton: 'Poisoned',
      perform: () => fireEvent.click(screen.getByRole('button', { name: 'Poisoned' })),
    },
    {
      lane: 'batch cure',
      props: { restoringTouchConditions: ['Poisoned'], cureCost: 5 },
      findButton: 'Poisoned',
      perform: () => {
        fireEvent.click(screen.getByRole('button', { name: 'Poisoned' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cure Selected (1 for 5 HP)' }));
      },
    },
    {
      lane: 'dice roll',
      props: { isDicePool: true, dieType: 8, poolMax: 8 },
      findButton: 'Roll a d8',
      perform: () => fireEvent.click(screen.getByRole('button', { name: 'Roll a d8' })),
    },
  ])('first $lane action of a fresh mount expends exactly one charge', async ({ props, findButton, perform }) => {
    await renderModal(props, findButton);
    perform();

    expect(useRuntimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === 'channelDivinityCharges')).toEqual([
      [CLERIC, 'channelDivinityCharges', 0, CAMPAIGN],
    ]);
    expect(hpStore[CLERIC].channelDivinityCharges).toBe(0);
    expect(logService.addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use')).toEqual([
      [CAMPAIGN, expectedAbilityLog(0)],
    ]);
  });

  // ── Fallback leg: distinct from the hardcoded default (2) ──

  it('resolves charges from class_levels when the runtime store is empty, spending down from max 3', async () => {
    delete hpStore[CLERIC].channelDivinityCharges;

    await renderModal();
    setHealAmount(5);
    fireEvent.click(healBtn());

    // Class max is 3 (class_levels[16]), NOT the hardcoded 2 fallback-of-
    // fallback: a mutant ignoring class_levels would write 1/(1/2).
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      [CLERIC, 'channelDivinityCharges', 2, CAMPAIGN],
    ]);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, expectedAbilityLog(2)],
      [CAMPAIGN, healLog(5, 7)],
    ]);
  });

  // ── Exhausted charges: gated out of the spend, heal still proceeds ──

  it('with zero charges logs console.error, spends nothing, and still applies the heal', async () => {
    hpStore[CLERIC].channelDivinityCharges = 0;

    await renderModal();
    setHealAmount(5);
    fireEvent.click(healBtn());

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[HealingPoolModal] ${CLERIC} has no Channel Divinity charges to expend for Preserve Life.`,
    );
    // Zero-silence on the CD seam: no charge write, no ability_use row.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, healLog(5, 7)]]);
    // Flagged behavior (see header): the heal itself is not blocked.
    expect(poolUpdate).toHaveBeenCalledWith(7);
    expect(poolStore.current).toBe(7);
  });

  // ── Non-CD features never touch the seam ──

  it.each([
    {
      lane: 'heal',
      props: { bloodiedOnly: false },
      perform: () => {
        setHealAmount(5);
        fireEvent.click(healBtn());
      },
    },
    {
      lane: 'cure',
      props: { bloodiedOnly: false, alsoCures: ['Poisoned'], cureCost: 5 },
      perform: () => fireEvent.click(screen.getByRole('button', { name: 'Poisoned' })),
    },
  ])('expends no Channel Divinity for non-CD feature ($lane action, resourceCost "")', async ({ props, perform }) => {
    await renderModal({ name: 'Lay On Hands', resourceCost: '', ...props });
    perform();

    // CD-seam scoped: the cure leg still writes activeConditions (curing
    // lane's own mechanics) — only the charge seam must stay untouched.
    expect(
      useRuntimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === 'channelDivinityCharges'),
    ).toEqual([]);
    expect(logService.addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use')).toEqual([]);
    // Negative control: the action itself ran — pool deducted, no spend.
    expect(poolUpdate).toHaveBeenCalledWith(7);
    expect(poolStore.current).toBe(7);
  });

  // ── Inertness without a CD action ──

  it('closing via Escape or Done without a CD action expends no charges and logs nothing', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    setHealAmount(5);

    // Escape and Done fire the close lanes (overlay clicks never close — the
    // component has no overlay handler; base.test.jsx owns that plumbing).
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    // Full zero-silence: nothing was written or logged anywhere.
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(hpStore[CLERIC].channelDivinityCharges).toBe(1);
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(12);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
