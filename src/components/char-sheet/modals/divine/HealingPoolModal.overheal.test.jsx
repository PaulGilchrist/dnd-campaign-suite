// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the OVERHEAL honesty seam of the dice lane only
// (bug-healing-light-dice-pool-silent-zero-heal): rolls are refused BEFORE the
// die is spent when the target is at max HP (disabled button, restriction
// note, forced-click inertness), the "N HP to restore" copy never promises
// more than the target's remaining capacity, the healing_pool ledger row logs
// the HP that actually restores (clamped partial overflow), and a commit that
// would restore nothing (target filled after the rolls) refunds the dice and
// logs amount 0 with no HP write.
// Deferred to owners: HealingPoolModal.dice.test.jsx (display, pool
// deduction, cap gating, honest accumulated self-heal, close seams);
// HealingPoolModal.healing.test.jsx (amount lane);
// HealingPoolModal.channel-divinity.test.jsx; HealingPoolModal.test.jsx
// (chooser/target-selection rendering).

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
  CONDITIONS: [],
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
  name: 'Paladin1',
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};

let poolStore; // { current, max } — poolUpdate writes land in current
let store; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let poolUpdate;
let randomSpy;

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
  const props = makeProps(overrides);
  const rendered = render(<HealingPoolModal {...props} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
  // Re-usable handle for re-render-driven mirror hydration (race legs).
  rendered.refresh = () => rendered.rerender(<HealingPoolModal {...props} />);
  return rendered;
}

const rollBtn = () => screen.getByRole('button', { name: 'Roll a d6' });
const doneBtn = () => screen.getByRole('button', { name: 'Done' });

function hpWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === 'currentHitPoints');
}

function diceHealLog({ targetName = 'Paladin1', amount, rolls, poolAfter }) {
  return {
    type: 'healing_pool',
    sourceName: 'Paladin1',
    featureName: FEATURE,
    targetName,
    amount,
    diceUsed: rolls.length,
    dieType: 6,
    rolls,
    poolAfter,
  };
}

// ── Tests ──

describe('HealingPoolModal - dice lane vs over-healing', () => {
  beforeEach(() => {
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    store = {
      Paladin1: { currentHitPoints: 40, hitPoints: 40, activeConditions: [] },
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

  it('refuses rolls on a self target at max HP — button disabled with an honest note, force-click spends nothing', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 4, max: 4 });

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Roll Dice — Paladin1 (40 / 40 HP)');
    expect(rollBtn()).toBeDisabled();
    expect(screen.getByText('Paladin1 is already at full HP. No die spent.')).toBeInTheDocument();

    fireEvent.click(rollBtn()); // disabled — click must be inert
    fireEvent.click(doneBtn());

    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(4);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(document.querySelector('.healing-roll-details')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refuses rolls on a full-HP ally picked through the target chooser (combat-summary player row)', async () => {
    store.Ally = { currentHitPoints: 50, hitPoints: 50, activeConditions: [] };
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Ally', type: 'player' },
      ],
    });
    await renderModal({
      creatureTargets: [
        { name: 'Paladin1', type: 'player' },
        { name: 'Ally', type: 'player' },
      ],
    }, { current: 4, max: 4 });

    fireEvent.click(screen.getByText('Ally').closest('label'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Roll Dice — Ally (50 / 50 HP)');
    expect(rollBtn()).toBeDisabled();
    expect(screen.getByText('Ally is already at full HP. No die spent.')).toBeInTheDocument();

    fireEvent.click(rollBtn()); // forced click on the disabled button

    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(4);
  });

  it('clamps the roll copy and the ledger amount to the HP that actually restores on partial overflow', async () => {
    store.Paladin1.currentHitPoints = 38; // 2 HP of room
    freezeRolls(6, [6]);
    await renderModal({}, { current: 4, max: 4 });

    fireEvent.click(rollBtn());

    // Copy never promises more than the 2 HP of room available.
    expect(document.querySelector('.healing-total')?.textContent).toBe(' = 2 HP to restore');
    expect(rollBtn()).toBeDisabled();
    expect(screen.getByText('These rolls already fill Paladin1 to maximum HP — further dice would restore nothing.')).toBeInTheDocument();

    fireEvent.click(doneBtn());

    expect(hpWrites()).toEqual([['Paladin1', 'currentHitPoints', 40, CAMPAIGN]]);
    // Die stays spent (it healed 2 HP), ledger logs the 2 actually restored, not the 6 rolled.
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 2, rolls: [6], poolAfter: 3 })],
    ]);
  });

  it('refunds the die and logs amount 0 when the target reached full HP between roll and commit — no HP write', async () => {
    store.Paladin1.currentHitPoints = 39; // 1 HP of room
    freezeRolls(6, [5]);
    const rendered = await renderModal({}, { current: 4, max: 4 });

    fireEvent.click(rollBtn());
    expect(poolUpdate.mock.calls).toEqual([[3]]); // die spent on the roll

    // Another tab heals the target to max before the commit lands.
    store.Paladin1.currentHitPoints = 40;
    rendered.refresh();

    fireEvent.click(doneBtn());

    // Die returned to the pool, nothing written, ledger honest about the zero.
    expect(poolUpdate.mock.calls).toEqual([[3], [4]]);
    expect(poolStore.current).toBe(4);
    expect(hpWrites()).toEqual([]);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, diceHealLog({ amount: 0, rolls: [5], poolAfter: 4 })],
    ]);
  });
});
