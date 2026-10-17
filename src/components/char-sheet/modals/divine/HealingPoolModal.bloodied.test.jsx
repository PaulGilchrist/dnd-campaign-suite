import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns BLOODIED-state behavior only: the "(Bloodied only)" badge in
// the heal heading, the bloodied threshold gate (currentHp > 0 &&
// currentHp <= floor(maxHp / 2)) across both HP-resolution lanes (combat
// player-creature runtime reads and the no-combat playerStats fallback),
// the restriction-note visibility, exact heal payloads that pass the gate,
// and heal/overlay inertness while the gate blocks.
// Deferred to owners:
// - HealingPoolModal.test.jsx — loading state, pool/target display strings,
//   heal-input capping, default feature name, target-selection rendering,
//   Done/Escape/overlay close plumbing (generic, non-bloodied).
// - HealingPoolModal.healing.test.jsx — general applyHeal plumbing:
//   applyHealingToTarget args, pool-zero disable, successive-heal pool
//   deduction, self-heal max-HP cap. (Subsumes the former "disables apply
//   heal when bloodiedOnly is true and pool is zero" case — pool-zero
//   disable is pool behavior, not bloodied behavior.)
// - HealingPoolModal.curing.test.jsx — condition-cure lane.
// - HealingPoolModal.dice.test.jsx — dice-pool lane (Roll a dX, accumulation).
// - HealingPoolModal.channel-divinity.test.jsx — Channel Divinity charge
//   consumption and ability_use logging.

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
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^${name}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
  await screen.findByRole('button', { name: 'Apply Heal' });
}

// NOTE — flagged component defects (not fixed here): HealingApplySection's
// amount input and HealingDiceSection's roll-details block use inline
// styles, and the target-selection overlay renders a second modal layer with
// no aria wiring. Neither affects the bloodied gate asserted below.

// ── Tests ──

describe('HealingPoolModal - Bloodied', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    hpStore = {
      Paladin1: { currentHitPoints: 20, hitPoints: 40, activeConditions: [] },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      const entry = hpStore[name];
      return entry && key in entry ? entry[key] : null;
    });
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

  // ── Threshold gate via combat player-creature (runtime HP reads) ──

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

  // ── Threshold gate via no-combat fallback (playerStats.hitPoints, odd max) ──

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
    } else {
      expect(healBtn()).toBeDisabled();
    }
  });

  // ── Exact heal payloads while the gate is open ──

  it('applies an exact self-heal payload to a bloodied target with no combat context', async () => {
    hpStore.Paladin1.currentHitPoints = 20;
    hpStore.Paladin1.hitPoints = null;

    await renderModal({ current: 15, max: 20 });
    setHealAmount(8);
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Paladin1', 'currentHitPoints', 28, CAMPAIGN);
    expect(poolUpdate).toHaveBeenCalledTimes(1);
    expect(poolUpdate).toHaveBeenCalledWith(7);
    expect(poolStore.current).toBe(7);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'healing_pool',
      sourceName: 'Paladin1',
      featureName: 'Lay On Hands',
      targetName: 'Paladin1',
      amount: 8,
      poolAfter: 7,
    });
  });

  // ── Gate re-evaluates per selected target ──

  it('opens the gate for a bloodied NPC and blocks a non-bloodied NPC chosen in target selection', async () => {
    const summary = {
      creatures: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 12 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
      ],
    };
    damageUtils.getCombatContext.mockResolvedValue(summary);
    applyHealingService.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 12, newHp: 17 });

    const creatureTargets = [
      { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 12 },
      { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 6 },
    ];

    const first = await renderModal({ current: 15, max: 20 }, { creatureTargets });

    // Bloodied NPC (12 <= floor(30/2)) — gate opens, exact payload flows.
    await selectTarget('Orc Warrior');
    expect(screen.getByRole('heading', { level: 4, name: 'Heal — Orc Warrior (12 / 30 HP)(Bloodied only)' })).toBeInTheDocument();
    setHealAmount(5);
    expect(healBtn()).toBeEnabled();
    fireEvent.click(healBtn());

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Orc Warrior', 5, CAMPAIGN);
    expect(poolUpdate).toHaveBeenCalledWith(10);
    expect(poolStore.current).toBe(10);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'healing_pool',
      sourceName: 'Paladin1',
      featureName: 'Lay On Hands',
      targetName: 'Orc Warrior',
      amount: 5,
      poolAfter: 10,
    });

    // Non-bloodied NPC (6 > floor(7/2)) — fresh session, gate blocks.
    first.unmount();
    await renderModal({ current: poolStore.current, max: 20 }, { creatureTargets });
    await selectTarget('Goblin');
    expect(screen.getByRole('heading', { level: 4, name: 'Heal — Goblin (6 / 7 HP)(Bloodied only)' })).toBeInTheDocument();
    setHealAmount(2);
    expect(healBtn()).toBeDisabled();
    expect(screen.getByText(RESTRICTION_NOTE)).toBeInTheDocument();
    expect(poolStore.current).toBe(10);
  });

  // ── Inertness while the gate blocks ──

  it('forced click on blocked Apply Heal changes no HP, pool, or log', async () => {
    hpStore.Paladin1.currentHitPoints = 30;

    await renderModal({ current: 15, max: 20 });
    setHealAmount(5);
    fireEvent.click(healBtn()); // disabled — click must be inert

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(15);
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(screen.getByText(RESTRICTION_NOTE)).toBeInTheDocument();
  });

  it('closing a blocked modal via Done, Escape, or overlay neither heals nor spends pool', async () => {
    const onClose = vi.fn();
    hpStore.Paladin1.currentHitPoints = 30;

    await renderModal({ current: 15, max: 20 }, { onClose });
    setHealAmount(5);

    fireEvent.click(document.querySelector('.short-rest-overlay'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(15);
  });
});
