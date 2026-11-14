// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the AMOUNT-LANE HINT seam (backlog 2026-11-14 IZ silent-clamp):
// typing an amount above the remaining pool surfaces an inline
// .healing-restriction-note explaining the clamp next to the display rewrite
// (the display math itself — value={Math.min(healAmount, safePool)},
// max={safePool} — is owned by HealingPoolModal.amount-capacity.test.jsx and
// stays unchanged here), and an exhausted pool explains WHY Apply Heal is
// disabled instead of leaving the `Pool: 0 / N` line as the only clue. The
// full-HP refusal note and the commit paths are DEFERRED to
// HealingPoolModal.amount-capacity.test.jsx / HealingPoolModal.healing.test.jsx.

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
  level: 13, // 5 × level = 65 pool max — mirrors the live ElderPaladin L13 rig
  hitPoints: 65,
  abilities: { CHA: 14 },
};

let poolStore; // { current, max } — poolUpdate writes land in current
let hpStore; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let summary; // combat summary the engine mock mutates in place
let poolUpdate;

// Deterministic stand-in for the real healing engine (same shape as the
// capacity file): clamps at the target maximum, writes the live holder.
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

function setupPoolStore(current = 60, max = 65) {
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

async function renderModal(overrides = {}, pool = { current: 60, max: 65 }) {
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

const clampHint = (pool) =>
  screen.getByText(`Amount clamped to the remaining pool of ${pool} HP.`);

const exhaustedNote = () =>
  screen.getByText('Healing pool exhausted — no HP left to spend, so Apply Heal is disabled until the pool recovers.');

// ── Tests ──

describe('HealingPoolModal - amount-lane clamp and pool-exhaustion hints', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    hpStore = {
      // Big room (20 / 112) so the ONLY clamp pressure on a 90 request is the
      // pool itself — the live IZ EF victim rig.
      Paladin1: { currentHitPoints: 20, hitPoints: 112, activeConditions: [] },
      Ally: { currentHitPoints: 20, hitPoints: 112, activeConditions: [] },
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

  // ── Clamped-to-pool hint ──

  it('typed 90 vs pool 60: inline hint names the remaining pool, display still clamps to 60 (math unchanged)', async () => {
    await renderModal({ creatureTargets: [
      { name: 'Paladin1', type: 'player' },
      { name: 'Ally', type: 'player' },
    ] });
    await selectTarget('Ally');
    setHealAmount(90);

    // Display math untouched: visible value rewrites to the pool, max stays the pool.
    expect(healInput()).toHaveValue(60);
    expect(healInput()).toHaveAttribute('max', '60');
    // No longer silent: the same .healing-restriction-note seam explains it.
    expect(clampHint(60)).toHaveClass('healing-restriction-note');
    // The full-HP note seam is untouched — the target has 92 HP of room.
    expect(screen.queryByText(/already at full HP/)).not.toBeInTheDocument();
    expect(healBtn()).toBeEnabled(); // hint is disclosure only, never a new gate
  });

  it('amount within the pool renders no hint (default 1 and typed 30 both quiet)', async () => {
    await renderModal({});

    expect(screen.queryByText(/clamped to the remaining pool/)).not.toBeInTheDocument();
    setHealAmount(30);
    expect(screen.queryByText(/clamped to the remaining pool/)).not.toBeInTheDocument();

    setHealAmount(60); // exactly the pool — not above it, so still no hint
    expect(screen.queryByText(/clamped to the remaining pool/)).not.toBeInTheDocument();
  });

  it('clamped commit spends exactly the pool: ledger poolAfter 0, hint retires, exhausted note takes over live', async () => {
    await renderModal({ creatureTargets: [
      { name: 'Paladin1', type: 'player' },
      { name: 'Ally', type: 'player' },
    ] });
    await selectTarget('Ally');
    setHealAmount(90);
    expect(clampHint(60)).toBeInTheDocument();

    fireEvent.click(healBtn());

    // Commit restores EXACTLY the pool — the clamp math is unchanged.
    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(summary, 'Ally', 60, CAMPAIGN);
    expect(hpStore.Ally.currentHitPoints).toBe(80); // 20 + 60, zero overshoot
    expect(poolUpdate.mock.calls).toEqual([[0]]);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      amount: 60,
      poolAfter: 0,
    }));
    expect(screen.getByRole('table').querySelectorAll('tbody tr')[0].textContent).toBe('HealAlly600');

    // The 90-vs-60 hint retires (healAmount re-clamped to the new pool 0) and
    // the exhaustion note explains why nothing else is pressable.
    expect(screen.queryByText(/clamped to the remaining pool/)).not.toBeInTheDocument();
    expect(exhaustedNote()).toHaveClass('healing-restriction-note');
    expect(healBtn()).toBeDisabled();
  });

  // ── Pool-exhausted note ──

  it('pool 0 at open: exhausted note explains the disabled Apply Heal, Pool line stays, force-click inert', async () => {
    const { container } = await renderModal({}, { current: 0, max: 65 });

    expect(exhaustedNote()).toHaveClass('healing-restriction-note');
    expect(healBtn()).toBeDisabled();
    // The `Pool: X / Y` line is untouched — still the plain truth, now with a sibling.
    const poolLine = Array.from(container.querySelectorAll('p'))
      .find((p) => p.textContent === 'Pool: 0 / 65 HP');
    expect(poolLine).toBeTruthy();
    // Display math unchanged: max 0, visible value 0.
    expect(healInput()).toHaveAttribute('max', '0');
    expect(healInput()).toHaveValue(0);

    fireEvent.click(healBtn()); // disabled — brute-click must stay fully inert
    expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(poolStore.current).toBe(0);
  });

  it('pool 0 with a typed 90: only the exhausted note renders (no misleading clamp-to-0 hint)', async () => {
    await renderModal({}, { current: 0, max: 65 });
    setHealAmount(90);

    expect(exhaustedNote()).toBeInTheDocument();
    expect(screen.queryByText(/clamped to the remaining pool/)).not.toBeInTheDocument();
  });

  it('pool 0 AND target at full HP: the pre-existing full-HP note renders exactly as before beside the exhausted note', async () => {
    hpStore.Paladin1.currentHitPoints = 112; // self at its 112 max, pool exhausted

    await renderModal({}, { current: 0, max: 65 });

    expect(screen.getByText('Paladin1 is already at full HP. No pool spent.'))
      .toHaveClass('healing-restriction-note');
    expect(exhaustedNote()).toBeInTheDocument();
    expect(healBtn()).toBeDisabled();
  });
});
