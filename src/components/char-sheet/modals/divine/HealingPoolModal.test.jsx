// @maintained-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// BASE lane (migrated to the live-store template used by all five siblings —
// former clearAllMocks/static-mock style retired here). This file owns the
// generic open/close contract only: the loading → loaded transition, static
// pool/target/feature-name display strings, heal-input display capping at
// render, section rendering (no log table until an action), target-selection
// rendering and the generic select/skip flow into the main modal, and generic
// Done/Escape/overlay close plumbing (onClose callback contract, non-bloodied,
// no action taken).
// Deferred to owners:
// - HealingPoolModal.healing.test.jsx — applyHeal plumbing, applyHealingToTarget
//   args, live pool deduction, healing_pool log payloads, post-heal amount
//   re-clamp, gating matrix, and inertness of closes without healing.
// - HealingPoolModal.curing.test.jsx — cure-section rendering, condition
//   filtering/merge, activeConditions writes, cure gating, and closes with a
//   pending selection curing nothing.
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/gate/restriction note.
// - HealingPoolModal.dice.test.jsx — dice-pool lane (Pool: n / m dX, Roll a dX,
//   accumulation, close-heal, Escape-applies-pending).
// - HealingPoolModal.channel-divinity.test.jsx — channel_divinity charge
//   consumption and ability_use logging.
// (Subsumes former cases: "renders heal amount input" — folded into the input
// attributes test, which queries the same spinbutton exactly; "updates heal
// amount on input change" and "caps heal amount to remaining pool" —
// consolidated into the parameterised input-change test; "displays pool amount
// / shows pool as 0" — consolidated into the parameterised pool-display test;
// the three target-heading resolution cases — consolidated into the
// parameterised target-resolution test with the live hp store replacing
// per-test getRuntimeValue re-mocks; the loading test now pins BOTH sides of
// the transition via a deferred combat context, absorbing the mount-contract
// and no-log-table cases.)

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

const basePlayerStats = {
  name: 'Paladin1',
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};

const combatSummary = {
  creatures: [
    { name: 'Paladin1', type: 'player' },
    { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15, conditions: [{ key: 'blinded' }] },
  ],
};

// Live mutable stores — tests mutate/read these directly instead of re-mocking.
let poolStore; // { current, max } — poolUpdate writes land in current
let hpStore; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
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

const doneBtn = () => screen.getByRole('button', { name: 'Done' });
const healInput = () => screen.getByRole('spinbutton');
const featureHeading = (name) => screen.getByRole('heading', { level: 3, name });
const healHeading = (name) => screen.getByRole('heading', { level: 4, name });

// The pool <p> nests a <b>, so match the whole paragraph by textContent.
const poolLine = (text) =>
  screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === text);

async function selectTarget(name) {
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^${name}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
}

// NOTE — flagged component quirk (unchanged, also flagged in sibling lanes):
// the heal amount input and dice roll-details block use inline styles.

// ── Tests ──

describe('HealingPoolModal - base open/close contract', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    hpStore = {
      Paladin1: { currentHitPoints: 15, hitPoints: 40, activeConditions: [] },
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

  // ── Loading / mount contract ──

  it('shows the loading spinner while combat context is pending, then renders the loaded modal shell with no log table', async () => {
    let resolveContext;
    damageUtils.getCombatContext.mockImplementation(
      () => new Promise((resolve) => { resolveContext = resolve; })
    );
    setupPoolStore(15, 20);
    render(<HealingPoolModal {...makeProps()} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

    await act(async () => { resolveContext(combatSummary); });

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(featureHeading('Lay On Hands')).toBeInTheDocument();
    expect(doneBtn()).toBeInTheDocument();
    // No action has been taken, so the log section never mounts
    // (log-table content is owned by the healing/curing/dice lanes).
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  // ── Pool display strings ──

  it.each([
    { current: 15, max: 20, text: 'Pool: 15 / 20 HP' },
    { current: 0, max: 20, text: 'Pool: 0 / 20 HP' },
    { current: 3, max: 3, text: 'Pool: 3 / 3 HP' },
  ])('displays the pool line as "$text"', async ({ current, max, text }) => {
    await renderModal({}, { current, max });
    expect(poolLine(text)).toBeInTheDocument();
  });

  // ── Target heading resolution display strings ──

  it.each([
    {
      lane: 'combat player creature via the live hp store',
      summary: combatSummary,
      store: { currentHitPoints: 15, hitPoints: 40 },
      heading: 'Heal — Paladin1 (15 / 40 HP)',
    },
    {
      lane: 'no-combat fallback via runtime currentHitPoints',
      summary: null,
      store: { currentHitPoints: 30, hitPoints: 40 },
      heading: 'Heal — Paladin1 (30 / 40 HP)',
    },
    {
      lane: 'missing currentHitPoints falls back to playerStats.hitPoints',
      summary: null,
      store: { hitPoints: 40 },
      heading: 'Heal — Paladin1 (40 / 40 HP)',
    },
    {
      lane: 'empty-string currentHitPoints is treated as missing',
      summary: null,
      store: { currentHitPoints: '', hitPoints: 40 },
      heading: 'Heal — Paladin1 (40 / 40 HP)',
    },
  ])('resolves the heal heading "$heading" from the $lane', async ({ summary, store: storeHp, heading }) => {
    damageUtils.getCombatContext.mockResolvedValue(summary);
    hpStore.Paladin1 = { activeConditions: [], ...storeHp };
    await renderModal();
    expect(healHeading(heading)).toBeInTheDocument();
  });

  // ── Heal input display ──

  it('renders the heal amount input with default 1 and max pinned to the pool', async () => {
    await renderModal({}, { current: 7, max: 20 });
    const input = healInput();
    expect(input.value).toBe('1');
    expect(input.getAttribute('max')).toBe('7');
  });

  it.each([
    { lane: 'accepts an amount within the pool', pool: 15, typed: '5', display: '5' },
    { lane: 'caps display at the pool when over it', pool: 3, typed: '10', display: '3' },
    { lane: 'clamps a negative amount to 0', pool: 15, typed: '-4', display: '0' },
  ])('$lane', async ({ pool, typed, display }) => {
    await renderModal({}, { current: pool, max: 20 });
    const input = healInput();
    fireEvent.change(input, { target: { value: typed } });
    expect(input.value).toBe(display);
  });

  // ── Feature name ──

  it.each([
    { lane: 'defaults to "Lay On Hands" when name is omitted', name: undefined, heading: 'Lay On Hands' },
    { lane: 'renders a custom name verbatim', name: 'Channel Divinity: Preserve Life', heading: 'Channel Divinity: Preserve Life' },
  ])('feature heading $lane', async ({ name, heading }) => {
    await renderModal({ name });
    expect(featureHeading(heading)).toBeInTheDocument();
  });

  // ── Target selection rendering ──

  it.each([
    { lane: 'one creatureTarget', creatureTargets: [{ name: 'Orc Warrior', maxHp: 30, currentHp: 15 }] },
    { lane: 'empty creatureTargets array', creatureTargets: [] },
    { lane: 'undefined creatureTargets', creatureTargets: undefined },
  ])('opens the main modal directly when $lane is passed', async ({ creatureTargets }) => {
    await renderModal({ creatureTargets });
    expect(screen.queryByText(/Choose target for/i)).not.toBeInTheDocument();
    expect(doneBtn()).toBeInTheDocument();
  });

  it('renders the target selection modal with exact title, note, per-target HP, and Skip/Heal actions', async () => {
    const creatureTargets = [
      { name: 'Orc Warrior', maxHp: 30, currentHp: 15 },
      { name: 'Goblin', maxHp: 7, currentHp: 3 },
    ];
    await renderModal({ creatureTargets });

    expect(screen.getByText('Choose target for Lay On Hands')).toBeInTheDocument();
    expect(screen.getByText('Choose a creature within range to heal with Lay On Hands.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Orc Warrior/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Goblin/ })).toBeInTheDocument();
    expect(screen.getByText('15/30 HP (50%)')).toBeInTheDocument();
    expect(screen.getByText('3/7 HP (43%)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it.each([
    { lane: 'confirm replaces selection with the chosen target', select: 'Orc Warrior', heading: 'Heal — Orc Warrior (15 / 30 HP)' },
    { lane: 'skip resolves to self', skip: true, heading: 'Heal — Paladin1 (15 / 40 HP)' },
  ])('target selection: $lane', async ({ select, skip, heading }) => {
    const creatureTargets = [
      { name: 'Orc Warrior', maxHp: 30, currentHp: 15 },
      { name: 'Goblin', maxHp: 7, currentHp: 3 },
    ];
    await renderModal({ creatureTargets });

    if (skip) {
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    } else {
      await selectTarget(select);
    }

    expect(healHeading(heading)).toBeInTheDocument();
    expect(screen.queryByText(/Choose target for/i)).not.toBeInTheDocument();
  });

  // ── Generic close plumbing (onClose callback contract) ──

  it('calls onClose exactly once when Done is clicked', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 15, max: 20 });
    fireEvent.click(doneBtn());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose exactly once on Escape keydown', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 15, max: 20 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking the overlay background', async () => {
    const onClose = vi.fn();
    await renderModal({}, { current: 15, max: 20 });
    fireEvent.click(document.querySelector('.short-rest-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(doneBtn()).toBeInTheDocument();
  });
});
