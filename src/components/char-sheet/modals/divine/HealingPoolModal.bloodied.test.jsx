// @maintained-by-ai 2026-11-27 bloodied-gate lane: exact-threshold badge/gate/inertness pins
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns BLOODIED-state behavior only: the "(Bloodied only)" badge in
// the heal heading, the bloodied threshold gate (currentHp > 0 &&
// currentHp <= floor(maxHp / 2)) pinned at EXACT boundary values across both
// HP-resolution lanes (combat player-creature runtime reads and the no-combat
// playerStats.hitPoints fallback incl. odd max floor), the restriction-note
// visibility, the open-gate commit for a selected bloodied NPC, and full
// zero-silence inertness while the gate blocks.
// Deferred to owners:
// - HealingPoolModal.test.jsx — loading state, pool/target display strings,
//   heal-input capping, default feature name, target-selection rendering,
//   Done/Escape/overlay close plumbing (generic, non-bloodied).
// - HealingPoolModal.healing.test.jsx — general applyHeal plumbing:
//   applyHealingToTarget args, pool-zero disable, successive-heal pool
//   deduction, self-heal max-HP cap, no-combat self-heal exact write/payload,
//   and inertness of overlay/Escape/Done closes when no heal was taken
//   (close inertness is not bloodied-specific, so the former "closing a
//   blocked modal via Done/Escape/overlay" case lives there).
//   (Also subsumes the former "disables apply heal when bloodiedOnly is true
//   and pool is zero" case — pool-zero disable is pool behavior.)
// - HealingPoolModal.curing.test.jsx — condition-cure lane.
// - HealingPoolModal.dice.test.jsx — dice-pool lane (Roll a dX, accumulation).
// - HealingPoolModal.channel-divinity.test.jsx — Channel Divinity charge
//   consumption and ability_use logging.

// ── Mocked modules ──
// Keys mirror ONLY what the loaded render graph imports:
// HealingPoolModal.jsx itself, SecondaryTargetModal.jsx (real component, its
// own deps load for real), combatData.js and healingPoolHandler.js
// (getCombatContext), rangeCheck/spellOverlayService/healingPoolHandler
// (getRuntimeValue). Former phantom keys getTargetFromAttacker,
// addStorageChangeListener and the unused services/ui/storage.js mock were
// purged (nothing in the graph imports them). conditionUtils is a pure data
// module — the mirror-fixture mock (4 of 15 CONDITIONS) is retired in favor
// of the real catalog.

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
const RESTRICTION_NOTE = 'This feature can only heal Bloodied creatures (at half HP or less).';

const basePlayerStats = {
  name: 'Paladin1',
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};

// Live mutable stores — tests mutate these directly instead of re-mocking.
let poolStore; // { current, max } — poolUpdate writes land in current
let hpStore; // { [characterName]: { currentHitPoints, hitPoints, ... } }
let poolUpdate;

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
    bloodiedOnly: true,
    onClose: vi.fn(),
    ...overrides,
  };
}

async function renderModal(poolConfig, overrides) {
  setupPoolStore(poolConfig?.current, poolConfig?.max);
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
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

// Zero-silence contract: a blocked gate must move nothing anywhere.
function expectTotalInertness(poolUntouched) {
  expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
  expect(poolUpdate).not.toHaveBeenCalled();
  expect(poolStore.current).toBe(poolUntouched);
  expect(logService.addEntry).not.toHaveBeenCalled();
}

// NOTE — flagged component defects (not fixed here): HealingApplySection's
// amount input and HealingDiceSection's roll-details block use inline
// styles, and the target-selection overlay renders a second modal layer with
// no aria wiring. Neither affects the bloodied gate asserted below.

// ── Tests ──

describe('HealingPoolModal - Bloodied', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    // Re-baseline every overridable stub (clearAllMocks alone would keep
    // mockReturnValue chains across tests).
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      const entry = hpStore?.[name];
      return entry && key in entry ? entry[key] : null;
    });
    useRuntimeState.setRuntimeValue.mockImplementation(() => {});
    damageUtils.getCombatContext.mockResolvedValue(null);
    applyHealingService.applyHealingToTarget.mockReturnValue(undefined);
    logService.addEntry.mockReturnValue(Promise.resolve());
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    hpStore = {
      Paladin1: { currentHitPoints: 20, hitPoints: 40, activeConditions: [] },
    };
  });

  afterEach(() => {
    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.setRuntimeValue.mockReset();
    useTrackedResource.mockReset();
    damageUtils.getCombatContext.mockReset();
    applyHealingService.applyHealingToTarget.mockReset();
    logService.addEntry.mockReset();
  });

  // ── Bloodied-only badge (in the heal heading) ──

  it.each([
    { bloodiedOnly: true, heading: 'Heal — Paladin1 (20 / 40 HP)(Bloodied only)' },
    { bloodiedOnly: false, heading: 'Heal — Paladin1 (20 / 40 HP)' },
  ])('renders heal heading "$heading" when bloodiedOnly is $bloodiedOnly', async ({ bloodiedOnly, heading }) => {
    await renderModal({ current: 15, max: 20 }, { bloodiedOnly });
    expect(screen.getByRole('heading', { level: 4, name: heading })).toBeInTheDocument();
    if (bloodiedOnly) {
      expect(screen.getByText('(Bloodied only)')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('(Bloodied only)')).not.toBeInTheDocument();
    }
  });

  // ── Threshold gate via combat player-creature (runtime HP reads):
  //    exact boundary values of currentHp > 0 && currentHp <= floor(40 / 2) ──

  it.each([
    { currentHp: 20, isBloodied: true, label: 'exactly half max HP' },
    { currentHp: 21, isBloodied: false, label: 'just above half max HP' },
    { currentHp: 1, isBloodied: true, label: '1 HP' },
    { currentHp: 0, isBloodied: false, label: '0 HP (dying is not bloodied)' },
  ])('combat self-target at $currentHp ($label) gates Apply Heal to enabled=$isBloodied', async ({ currentHp, isBloodied }) => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
      ],
    });
    hpStore.Paladin1.currentHitPoints = currentHp;

    await renderModal({ current: 15, max: 20 });
    setHealAmount(5);

    if (isBloodied) {
      expect(healBtn()).toBeEnabled();
      expect(screen.queryByText(RESTRICTION_NOTE)).not.toBeInTheDocument();
    } else {
      expect(healBtn()).toBeDisabled();
      expect(screen.getByText(RESTRICTION_NOTE)).toBeInTheDocument();
    }
  });

  // ── Threshold gate via no-combat fallback (playerStats.hitPoints,
  //    odd max pins floor(25 / 2) = 12) ──

  it.each([
    { currentHp: 12, isBloodied: true, label: 'floor(25 / 2) — bloodied' },
    { currentHp: 13, isBloodied: false, label: 'floor(25 / 2) + 1 — not bloodied' },
  ])('no-combat self-target at $currentHp of 25 HP is $label', async ({ currentHp, isBloodied }) => {
    hpStore.Paladin1.currentHitPoints = currentHp;
    hpStore.Paladin1.hitPoints = null; // fallback must come from playerStats

    await renderModal(
      { current: 15, max: 20 },
      { playerStats: { ...basePlayerStats, hitPoints: 25 } },
    );
    setHealAmount(5);

    expect(screen.getByRole('heading', { level: 4, name: `Heal — Paladin1 (${currentHp} / 25 HP)(Bloodied only)` })).toBeInTheDocument();
    if (isBloodied) {
      expect(healBtn()).toBeEnabled();
      expect(screen.queryByText(RESTRICTION_NOTE)).not.toBeInTheDocument();
    } else {
      expect(healBtn()).toBeDisabled();
      expect(screen.getByText(RESTRICTION_NOTE)).toBeInTheDocument();
    }
  });

  // ── Gate follows the SELECTED target: bloodied NPC opens it ──

  it('opens the gate for a bloodied NPC chosen in target selection and commits the exact heal', async () => {
    const summary = {
      creatures: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 12 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ],
    };
    damageUtils.getCombatContext.mockResolvedValue(summary);
    // Real applyHealingToTarget return shape (applyHealing.js:78).
    applyHealingService.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 12, newHp: 17, maxHp: 30 });

    await renderModal({ current: 15, max: 20 }, {
      creatureTargets: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 12 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ],
    });

    await selectTarget('Orc Warrior'); // 12 <= floor(30/2) — bloodied
    expect(screen.getByRole('heading', { level: 4, name: 'Heal — Orc Warrior (12 / 30 HP)(Bloodied only)' })).toBeInTheDocument();
    setHealAmount(5);
    expect(healBtn()).toBeEnabled();
    expect(screen.queryByText(RESTRICTION_NOTE)).not.toBeInTheDocument();
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Orc Warrior', 5, CAMPAIGN);
    expect(poolUpdate).toHaveBeenCalledTimes(1);
    expect(poolUpdate).toHaveBeenCalledWith(10);
    expect(poolStore.current).toBe(10);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'healing_pool',
      sourceName: 'Paladin1',
      featureName: 'Lay On Hands',
      targetName: 'Orc Warrior',
      amount: 5,
      poolAfter: 10,
    });
  });

  // ── Gate follows the SELECTED target: non-bloodied NPC blocks it ──

  it('blocks the gate for a non-bloodied NPC chosen in target selection with total inertness', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 12 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ],
    });

    await renderModal({ current: 15, max: 20 }, {
      creatureTargets: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 12 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ],
    });

    await selectTarget('Goblin'); // 6 > floor(7/2) — not bloodied
    expect(screen.getByRole('heading', { level: 4, name: 'Heal — Goblin (6 / 7 HP)(Bloodied only)' })).toBeInTheDocument();
    setHealAmount(2);
    expect(healBtn()).toBeDisabled();
    expect(screen.getByText(RESTRICTION_NOTE)).toBeInTheDocument();

    fireEvent.click(healBtn()); // disabled — click must be inert
    expectTotalInertness(15);
  });

  // ── Inertness while the gate blocks (no-combat lane) ──

  it('forced click on blocked Apply Heal changes no HP, pool, or log', async () => {
    hpStore.Paladin1.currentHitPoints = 30;

    await renderModal({ current: 15, max: 20 });
    setHealAmount(5);
    fireEvent.click(healBtn()); // disabled — click must be inert

    expectTotalInertness(15);
    expect(screen.getByText(RESTRICTION_NOTE)).toBeInTheDocument();
  });
});
