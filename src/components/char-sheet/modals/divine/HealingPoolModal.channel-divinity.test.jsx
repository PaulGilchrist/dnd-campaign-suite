import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the CHANNEL DIVINITY seam only: consumeChannelDivinity's
// gating (resourceCost === 'channel_divinity', once-per-mount ref latch),
// charge resolution via resolveChannelDivinityCharges (runtime store first,
// class_levels fallback), the exact channelDivinityCharges write payloads and
// state transitions in the live store, the exact ability_use log payload,
// zero-charge console.error behavior, and charge inertness when no CD
// action has been taken (close/Escape/overlay) or the feature is non-CD.
// Deferred to owners:
// - HealingPoolModal.bloodied.test.jsx — bloodied gating/badge/restriction
//   note, gate-blocked inertness.
// - HealingPoolModal.healing.test.jsx — general applyHeal plumbing,
//   applyHealingToTarget args, pool deduction, healing_pool log payloads.
// - HealingPoolModal.curing.test.jsx — condition-cure mechanics.
// - HealingPoolModal.dice.test.jsx — dice accumulation/close-heal mechanics.
// - HealingPoolModal.test.jsx — loading state, display strings, target
//   selection, Done/Escape plumbing (generic).
// (Subsumes this file's former separate "logs an ability_use entry" case —
// the log is asserted alongside the exact consume payload of the same action.
// Also drops the former pool-mechanics assertion count on updateFn — pool
// deduction belongs to healing.test.jsx; here pool movement is only
// negative-control evidence that a gated action did or did not run.)

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
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
const CLERIC = 'Divine_Cleric';
const FIXED_TS = 1750000000000; // deterministic timestamp for exact log payloads

// Level-17 cleric: class_levels[16].channel_divinity = 3 (max charges source
// for resolveChannelDivinityCharges when the runtime store is empty).
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

function cdWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(
    ([, key]) => key === 'channelDivinityCharges',
  );
}

function abilityUseLogs() {
  return logService.addEntry.mock.calls.filter(([, entry]) => entry.type === 'ability_use');
}

function expectedAbilityLog(remaining) {
  return {
    type: 'ability_use',
    characterName: CLERIC,
    abilityName: 'Preserve Life',
    description: `${CLERIC} expended 1 Channel Divinity to use Preserve Life (${remaining}/3 remaining).`,
    timestamp: FIXED_TS,
  };
}

// NOTE — flagged component defects (not fixed here):
// 1. The amount input and dice roll-details block use inline styles
//    (also flagged in bloodied lane).
// 2. With zero CD charges, applyHeal still heals and drains the pool — it
//    only skips the charge spend (console.error). healingPoolHandler returns
//    a blocking popup in the same situation; the modal does not. Asserted
//    as-is below.

// ── Tests ──

describe('HealingPoolModal - Channel Divinity', () => {
  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    setupPoolStore();
    hpStore = {
      [CLERIC]: {
        currentHitPoints: 10,
        hitPoints: 90,
        channelDivinityCharges: 3,
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
    applyHealingService.applyHealingToTarget.mockImplementation((cs, name, amount) => ({
      actualHeal: amount,
      oldHp: 10,
      newHp: 10 + amount,
    }));
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
    consoleErrorSpy.mockRestore();
  });

  // ── First CD action: exact spend + exact log ──

  it('expend exactly one charge on first Apply Heal and logs the matching ability_use entry', async () => {
    await renderModal();
    setHealAmount(5);
    fireEvent.click(healBtn());

    expect(cdWrites()).toEqual([[CLERIC, 'channelDivinityCharges', 2, CAMPAIGN]]);
    expect(hpStore[CLERIC].channelDivinityCharges).toBe(2);
    expect(abilityUseLogs()).toEqual([[CAMPAIGN, expectedAbilityLog(2)]]);
  });

  // ── Once-per-mount latch across actions and lanes ──

  it('does not expend additional charges on subsequent heals in the same session', async () => {
    await renderModal();

    setHealAmount(5);
    fireEvent.click(healBtn());
    setHealAmount(3);
    fireEvent.click(healBtn());
    setHealAmount(4);
    fireEvent.click(healBtn());

    expect(cdWrites()).toEqual([[CLERIC, 'channelDivinityCharges', 2, CAMPAIGN]]);
    expect(abilityUseLogs()).toHaveLength(1);
    // Negative control: all three heals ran (pool drained 12 → 0), the latch
    // only suppressed charges.
    expect(poolUpdate.mock.calls.map(([v]) => v)).toEqual([7, 4, 0]);
    expect(poolStore.current).toBe(0);
  });

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

    expect(cdWrites()).toEqual([[CLERIC, 'channelDivinityCharges', 2, CAMPAIGN]]);
    expect(hpStore[CLERIC].channelDivinityCharges).toBe(2);
    expect(abilityUseLogs()).toEqual([[CAMPAIGN, expectedAbilityLog(2)]]);
  });

  // ── Charge resolution fallback ──

  it('resolves charges from class_levels when the runtime store is empty, spending down from max', async () => {
    delete hpStore[CLERIC].channelDivinityCharges;

    await renderModal();
    setHealAmount(5);
    fireEvent.click(healBtn());

    expect(cdWrites()).toEqual([[CLERIC, 'channelDivinityCharges', 2, CAMPAIGN]]);
    expect(abilityUseLogs()).toEqual([[CAMPAIGN, expectedAbilityLog(2)]]);
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
    expect(cdWrites()).toEqual([]);
    expect(abilityUseLogs()).toEqual([]);
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

    expect(cdWrites()).toEqual([]);
    expect(abilityUseLogs()).toEqual([]);
    // Negative control: the action itself ran — pool deducted, no spend.
    expect(poolUpdate).toHaveBeenCalledWith(7);
    expect(poolStore.current).toBe(7);
  });

  // ── Inertness without a CD action ──

  it('closing via overlay, Escape, or Done without healing expends no charges and logs nothing', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    setHealAmount(5);

    fireEvent.click(document.querySelector('.short-rest-overlay'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    expect(cdWrites()).toEqual([]);
    expect(hpStore[CLERIC].channelDivinityCharges).toBe(3);
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(12);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
