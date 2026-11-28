// @maintained-by-ai 2026-11-27 base lane: close zero-action witnesses, phantom/mirror purge, same-branch trim
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// BASE lane: the generic open/close contract only — the loading → loaded
// transition (deferred combat context), static chrome (pool line, feature
// heading incl. custom name, heal-target heading across the HP-resolution
// lanes), heal-amount input defaults/attributes and display capping at
// render, target-picker gate (opens only for >1 creatureTargets) and its
// selection→dispatch threading into the main modal, and the generic
// Done/Escape/overlay close plumbing. Per the healing-lane handoff, the
// close tests carry full zero-action witnesses (no store write, no pool
// update, no log row, store deep-unchanged) — the healing lane purged its
// close-inertness test on the basis that base owns close plumbing.
// Deferred to owners (re-verified against current sibling tests, 2026-11-27):
// - HealingPoolModal.healing.test.jsx — applyHeal payloads/deduction/gate
//   matrix, healing_pool payload shape, live engine result consumption.
// - HealingPoolModal.amount-capacity.test.jsx — full-HP refusals and the
//   commit-time clamp both lanes.
// - HealingPoolModal.curing.test.jsx — cure-section rendering, condition
//   filtering/merge, activeConditions writes, cure gating.
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/threshold gate/
//   restriction note.
// - HealingPoolModal.dice.test.jsx — dice-pool lane (Roll a dX, accumulation,
//   close-heal, Escape-applies-pending).
// - HealingPoolModal.channel-divinity.test.jsx — CD charge spend and
//   ability_use logging.
// - HealingPoolModal.pool-clamp-hints.test.jsx — typed-over-pool and
//   exhausted-pool inline notes.
// - HealingPoolModal.{live-hp,live-conditions}-echo.test.jsx — the display
//   echo subscriptions (useRuntimeValue calls are never pinned here).
// - HealingPoolModal.dialog-semantics.test.jsx — role/aria dialog contract.
// - SecondaryTargetModal.test.jsx / .inverted-hp.test.jsx — picker
//   list-internals (HP percent chips, aria-label composition, Skip chrome);
//   this file pins only the title/note strings HealingPoolModal itself
//   builds and the targets threading at the seam.
// (This pass: phantom mock keys getTargetFromAttacker — disk export but
// imported by nothing in the loaded graph — addStorageChangeListener (only
// useTrackedResource.js imports it, and that hook is fully mocked) and the
// 4-of-15 CONDITIONS mirror mock retired, matching the healing/dice/curing/
// CD/bloodied lanes; conditionUtils is a pure data module so the REAL
// catalog now backs any label resolution beside this lane's renders. The
// stale inline-style note was purged — HealingPoolModal.jsx has no inline
// styles (grep style= finds nothing). Same-branch trim: pool-line it.each
// 3→1 arms (all exercise the one safePool/safeMax interpolation; the
// exhausted-pool note is pool-clamp-hints'), heading it.each 4→3 (missing
// key vs empty-string currentHitPoints take the same fallback branch — the
// empty-string arm is kept, strictly stronger), feature-name it.each 2→1
// (the default name is witnessed by every other test's heading),
// picker-gate it.each 3→1 (1-target/empty/undefined all collapse the same
// `length > 1` false branch). Fixed: the overlay-never-closes test asserted
// a locally-built onClose that was never passed into the component — a
// vacuous witness; it now wires the real prop. renderModal/load waits moved
// to the findByRole mount-flush pattern (no no-op waitFor).
// Family-known items cross-referenced, NOT re-pinned: duplicated
// noHealCapacity prop (HealingPoolModal.jsx:823/:829, harmless) and the
// once-per-mount CD latch-before-charge quirk (:417-425, owned by the
// channel-divinity + dice lanes).)

// ── Mocked modules ──
// Keys mirror ONLY what the loaded render graph imports: HealingPoolModal.jsx
// itself, SecondaryTargetModal.jsx (real component) and healingPoolHandler.js
// (deliberately NOT mocked — the CD lane owns it).

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
  // Flush the async getCombatContext effect: the Done button (main modal) or
  // the picker's Heal confirm (multi-target) only exist once loaded.
  if (overrides?.creatureTargets?.length > 1) {
    await screen.findByRole('button', { name: 'Heal' });
  } else {
    await screen.findByRole('button', { name: 'Done' });
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
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^Select ${name}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
  await screen.findByRole('button', { name: 'Done' });
}

// Zero-action witness for the close plumbing: nothing may be committed by
// merely opening and closing an untouched modal.
function expectCloseInert() {
  expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  expect(poolUpdate).not.toHaveBeenCalled();
  expect(logService.addEntry).not.toHaveBeenCalled();
  expect(applyHealingService.applyHealingToTarget).not.toHaveBeenCalled();
  expect(hpStore).toEqual({
    Paladin1: { currentHitPoints: 15, hitPoints: 40, activeConditions: [] },
  });
}

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

  // ── Pool display string ──

  it('displays the pool line from the tracked-resource store', async () => {
    await renderModal({}, { current: 15, max: 20 });
    expect(poolLine('Pool: 15 / 20 HP')).toBeInTheDocument();
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
      // A missing key takes this SAME branch; the empty-string fixture is
      // kept because it additionally kills removal of the `stored !== ''`
      // operand (Number('') would render "0 / 40 HP").
      lane: 'empty-string currentHitPoints falls back to playerStats.hitPoints',
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
  // The default 'Lay On Hands' heading is witnessed by every other test in
  // this file; only the verbatim custom-name passthrough is pinned here.

  it('renders a custom feature name verbatim in the heading', async () => {
    await renderModal({ name: 'Channel Divinity: Preserve Life' });
    expect(featureHeading('Channel Divinity: Preserve Life')).toBeInTheDocument();
  });

  // ── Target selection rendering ──

  it('opens the main modal directly when a single creatureTarget is passed', async () => {
    // Empty/undefined arrays collapse the same `length > 1` false branch and
    // are the default of every other test here.
    await renderModal({ creatureTargets: [{ name: 'Orc Warrior', maxHp: 30, currentHp: 15 }] });
    expect(screen.queryByText(/Choose target for/i)).not.toBeInTheDocument();
    expect(doneBtn()).toBeInTheDocument();
  });

  it('renders the target picker with the exact title and note built from the feature name, one radio per target, and Skip/Heal actions', async () => {
    const creatureTargets = [
      { name: 'Orc Warrior', maxHp: 30, currentHp: 15 },
      { name: 'Goblin', maxHp: 7, currentHp: 3 },
    ];
    await renderModal({ creatureTargets });

    // Title/note strings are built INSIDE HealingPoolModal.jsx (:791/:796);
    // per-target HP chip bytes and aria composition are SecondaryTargetModal
    // internals owned by its own suite.
    expect(screen.getByText('Choose target for Lay On Hands')).toBeInTheDocument();
    expect(screen.getByText('Choose a creature within range to heal with Lay On Hands.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /^Select Orc Warrior/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Select Goblin/ })).toBeInTheDocument();
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
      await screen.findByRole('button', { name: 'Done' });
    } else {
      await selectTarget(select);
    }

    expect(healHeading(heading)).toBeInTheDocument();
    expect(screen.queryByText(/Choose target for/i)).not.toBeInTheDocument();
  });

  // ── Generic close plumbing (onClose callback contract) ──
  // The healing lane purged its close-inertness test on the basis that this
  // base lane owns close plumbing — every close here therefore pairs the
  // once-only onClose call with a zero-write/zero-row witness.

  it('calls onClose exactly once when Done is clicked and commits nothing', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 15, max: 20 });
    fireEvent.click(doneBtn());
    expect(onClose).toHaveBeenCalledTimes(1);
    expectCloseInert();
  });

  it('calls onClose exactly once on Escape keydown and commits nothing', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose }, { current: 15, max: 20 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expectCloseInert();
  });

  it('does not close when clicking the overlay background and commits nothing', async () => {
    const onClose = vi.fn();
    // The component has NO overlay click handler; the former version of this
    // test asserted a locally-built onClose it never passed in — vacuous.
    // It now wires the real prop so the not-called witness means something.
    await renderModal({ onClose }, { current: 15, max: 20 });
    fireEvent.click(document.querySelector('.short-rest-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(doneBtn()).toBeInTheDocument();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
