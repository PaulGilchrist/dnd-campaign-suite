import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the CURING seam only: cure-section rendering for both lanes
// (individual alsoCures vs restoring-touch batch), the condition-filtering
// contract through the live runtime/combat-summary stores (merge, match,
// hide), exact activeConditions write payloads and live-store transitions for
// single and batch cures, exact condition-log payloads, cure-cost gating
// (enabled/disabled, Pool after / Not enough pool! notes), forced-click
// inertness on blocked cures, and inertness of close/Escape/overlay (a
// pending selection must never cure on close).
// Deferred to owners:
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/gate/restriction note
//   and gate-blocked inertness.
// - HealingPoolModal.healing.test.jsx — applyHeal plumbing, pool deduction,
//   healing_pool log payloads.
// - HealingPoolModal.channel-divinity.test.jsx — CD charge consumption on
//   cure/heal/dice actions (including the cure lanes' CD seam).
// - HealingPoolModal.dice.test.jsx — dice-pool accumulation/close-heal.
// - HealingPoolModal.test.jsx — loading state, display strings, target
//   selection rendering, Done/Escape plumbing (generic).
// (Subsumes former cases: "does not call storage.set for player targets" —
// vacuous, the component never imports storage.js directly (persistence is
// useTrackedResource's); "resets selected conditions after batch cure" —
// subsumed by the batch-cure exact-payload test, which now shows the whole
// section unmount as conditions leave the live store; standalone
// insufficient/exact-pool, warning, and count/cost cases — consolidated into
// parameterised gating tests.)
//
// Curing-owner cleanup (done here): the duplicated NPC condition-filter
// re-write blocks in applyCure (~510-522) and applyBatchCure were removed —
// they re-read the just-written value and re-ran an identical predicate
// (conditionMatches lowercases internally), producing a byte-identical second
// setRuntimeValue write. Pinned below by exact single-write assertions.
// Flagged product quirk (asserted as-is): individual cures log the label
// ("Blinded") while batch cures log the key ("blinded") in the campaign log.

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
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures / live stores ──

const CAMPAIGN = 'test-campaign';
const FIXED_TS = 1750000000000; // deterministic timestamp for exact log payloads

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
let store; // { [characterName]: { currentHitPoints, hitPoints, activeConditions } }
let poolUpdate;
let dateNowSpy;

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
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
  return rendered;
}

const cureBtn = (name) => screen.getByRole('button', { name });
const batchBtn = () => screen.getByRole('button', { name: /^Cure Selected/ });

function selectConditions(names) {
  names.forEach((n) => fireEvent.click(cureBtn(n)));
}

async function selectTarget(name) {
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^${name}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
}

function cureWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === 'activeConditions');
}

function logRows() {
  const rows = screen.getByRole('table').querySelectorAll('tbody tr');
  return Array.from(rows).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent));
}

function conditionLog(targetName, condition) {
  return {
    type: 'condition',
    characterName: targetName,
    condition,
    action: 'broken',
    sourceName: 'Paladin1',
    featureName: 'Lay On Hands',
    timestamp: FIXED_TS,
  };
}

// NOTE — flagged component defects (not fixed here): the heal amount input and
// dice roll-details block use inline styles (also flagged in bloodied and
// channel-divinity lanes). Neither affects the curing contract asserted below.

// ── Tests ──

describe('HealingPoolModal - Curing', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS);
    poolUpdate = vi.fn((v) => { poolStore.current = v; });
    store = {
      Paladin1: { currentHitPoints: 15, hitPoints: 40, activeConditions: ['blinded'] },
      'Orc Warrior': { activeConditions: ['blinded', 'poisoned'] },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      const entry = store[name];
      return entry && key in entry ? entry[key] : null;
    });
    useRuntimeState.setRuntimeValue.mockImplementation((name, key, value) => {
      const entry = store[name] ??= {};
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
    logService.addEntry.mockReset();
    dateNowSpy.mockRestore();
  });

  // ── Cure section rendering ──

  it.each([
    {
      lane: 'individual (deduped)',
      props: { alsoCures: ['Blinded', 'Blinded', 'Poisoned'], cureCost: 5 },
      buttons: ['Blinded', 'Poisoned'],
    },
    { lane: 'alsoCures empty', props: { alsoCures: [] }, buttons: [] },
    { lane: 'alsoCures null', props: { alsoCures: null }, buttons: [] },
  ])('renders the $lane cure section', async ({ props, buttons }) => {
    await renderModal(props);

    if (buttons.length === 0) {
      expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Select conditions affecting/)).not.toBeInTheDocument();
      return;
    }
    expect(screen.getByRole('heading', { level: 4, name: 'Cure Conditions (5 HP each)' })).toBeInTheDocument();
    buttons.forEach((name) => {
      // getByRole fails on duplicates — this is the dedup assertion.
      expect(cureBtn(name)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^Cure Selected/ })).not.toBeInTheDocument();
  });

  it.each([
    {
      lane: 'merges runtime + combat-summary conditions',
      runtimeConditions: ['blinded'],
      summaryCreatureConditions: [{ key: 'charmed' }],
      buttons: ['Blinded', 'Charmed'],
    },
    {
      lane: 'hides section when nothing matches',
      runtimeConditions: [],
      summaryCreatureConditions: [],
      buttons: [],
    },
  ])('batch section $lane', async ({ runtimeConditions, summaryCreatureConditions, buttons }) => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Paladin1', type: 'player', conditions: summaryCreatureConditions },
        combatSummary.creatures[1],
      ],
    });
    store.Paladin1.activeConditions = runtimeConditions;

    await renderModal({
      alsoCures: [],
      restoringTouchConditions: ['Blinded', 'Charmed', 'Poisoned', 'Frightened'],
    });

    if (buttons.length === 0) {
      expect(screen.queryByText(/Select conditions affecting/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();
      return;
    }
    expect(screen.getByRole('heading', { level: 4, name: 'Cure Conditions (3 HP each)' })).toBeInTheDocument();
    expect(screen.getByText('Select conditions affecting Paladin1 to cure:')).toBeInTheDocument();
    buttons.forEach((name) => expect(cureBtn(name)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Poisoned' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Frightened' })).not.toBeInTheDocument();
  });

  // ── Individual cure gating ──

  it.each([
    { current: 0, disabled: true },
    { current: 2, disabled: true },
    { current: 3, disabled: false }, // pool exactly equals cost
  ])('individual cure button disabled=$disabled when pool is $current (cost 3)', async ({ current, disabled }) => {
    await renderModal({}, { current, max: 20 });
    const btn = cureBtn('Blinded');
    if (disabled) {
      expect(btn).toBeDisabled();
    } else {
      expect(btn).toBeEnabled();
    }
  });

  // ── Individual cure: exact payload through the live store ──

  it('single self-cure writes the filtered conditions once, deducts the pool exactly, and logs one condition entry', async () => {
    store.Paladin1.activeConditions = ['blinded', 'charmed', 'poisoned'];

    await renderModal({ alsoCures: ['Blinded', 'Charmed'] }, { current: 10, max: 20 });
    fireEvent.click(cureBtn('Blinded'));

    expect(cureWrites()).toEqual([['Paladin1', 'activeConditions', ['charmed', 'poisoned'], CAMPAIGN]]);
    expect(store.Paladin1.activeConditions).toEqual(['charmed', 'poisoned']);
    expect(poolUpdate).toHaveBeenCalledTimes(1);
    expect(poolUpdate).toHaveBeenCalledWith(7);
    expect(poolStore.current).toBe(7);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, conditionLog('Paladin1', 'Blinded'));
    expect(logRows()).toEqual([['Cure Blinded', 'Paladin1', '3', '7']]);
  });

  it('single cure on an NPC chosen via target selection writes one exact activeConditions payload for the NPC', async () => {
    // The removed duplicate NPC filter block would add a second identical
    // write here — the exact single-write assertion pins the dedupe.
    store['Orc Warrior'].activeConditions = ['blinded', 'poisoned'];

    await renderModal(
      { alsoCures: ['Blinded'], creatureTargets: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
        { name: 'Goblin', type: 'npc', maxHp: 7, currentHp: 3 },
      ] },
      { current: 10, max: 20 },
    );
    await selectTarget('Orc Warrior');
    fireEvent.click(cureBtn('Blinded'));

    expect(cureWrites()).toEqual([['Orc Warrior', 'activeConditions', ['poisoned'], CAMPAIGN]]);
    expect(store['Orc Warrior'].activeConditions).toEqual(['poisoned']);
    expect(poolUpdate).toHaveBeenCalledWith(7);
    expect(poolStore.current).toBe(7);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, conditionLog('Orc Warrior', 'Blinded'));
    expect(logRows()).toEqual([['Cure Blinded', 'Orc Warrior', '3', '7']]);
  });

  // ── Batch cure: selection lifecycle and exact payloads ──

  it('toggles selection state and labels the batch button with count, cost, and pool after', async () => {
    store.Paladin1.activeConditions = ['blinded', 'charmed'];

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['Blinded', 'Charmed'] },
      { current: 20, max: 20 },
    );

    const blindedBtn = cureBtn('Blinded');
    expect(blindedBtn).not.toHaveClass('cure-btn-active');
    expect(batchBtn()).toHaveTextContent('Cure Selected (0 for 0 HP)');
    expect(batchBtn()).toBeDisabled();

    fireEvent.click(blindedBtn);
    expect(blindedBtn).toHaveClass('cure-btn-active');
    expect(cureBtn('Cure Selected (1 for 3 HP)')).toBeInTheDocument();
    expect(batchBtn()).toBeEnabled();
    expect(screen.getByText('Pool after: 17 HP')).toBeInTheDocument();

    fireEvent.click(blindedBtn); // toggle off
    expect(blindedBtn).not.toHaveClass('cure-btn-active');
    expect(cureBtn('Cure Selected (0 for 0 HP)')).toBeInTheDocument();
    expect(screen.queryByText(/Pool after/)).not.toBeInTheDocument();
  });

  it('batch cure writes filtered conditions once per selection in click order, deducts the total, logs each cure, and unmounts the section when the store empties', async () => {
    store.Paladin1.activeConditions = ['blinded', 'charmed'];

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['Blinded', 'Charmed'] },
      { current: 20, max: 20 },
    );
    selectConditions(['Blinded', 'Charmed']);
    fireEvent.click(cureBtn('Cure Selected (2 for 6 HP)'));

    expect(cureWrites()).toEqual([
      ['Paladin1', 'activeConditions', ['charmed'], CAMPAIGN],
      ['Paladin1', 'activeConditions', [], CAMPAIGN],
    ]);
    expect(store.Paladin1.activeConditions).toEqual([]);
    expect(poolUpdate).toHaveBeenCalledTimes(1);
    expect(poolUpdate).toHaveBeenCalledWith(14);
    expect(poolStore.current).toBe(14);
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, conditionLog('Paladin1', 'blinded')],
      [CAMPAIGN, conditionLog('Paladin1', 'charmed')],
    ]);
    expect(logRows()).toEqual([
      ['Cure blinded', 'Paladin1', '3', '14'],
      ['Cure charmed', 'Paladin1', '3', '14'],
    ]);
    // Live store is empty and the summary carries no self conditions — the
    // whole cure section (and its stale selection) must unmount.
    expect(screen.queryByRole('button', { name: /^Cure Selected/ })).not.toBeInTheDocument();
  });

  // ── Batch gating and shortfall warnings ──

  it.each([
    {
      lane: 'nothing selected',
      sel: [], current: 20, cost: 3,
      disabled: true, note: null,
    },
    {
      lane: 'sufficient pool',
      sel: ['Blinded'], current: 20, cost: 3,
      disabled: false, note: 'Pool after: 17 HP',
    },
    {
      lane: 'one cure short',
      sel: ['Blinded'], current: 1, cost: 5,
      disabled: true, note: 'Not enough pool! Need 4 more HP',
    },
    {
      lane: 'three cures short of 12',
      sel: ['Blinded', 'Charmed', 'Poisoned'], current: 3, cost: 5,
      disabled: true, note: 'Not enough pool! Need 12 more HP',
    },
  ])('batch button disabled=$disabled when $lane', async ({ sel, current, cost, disabled, note }) => {
    store.Paladin1.activeConditions = ['blinded', 'charmed', 'poisoned'];

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['Blinded', 'Charmed', 'Poisoned'], cureCost: cost },
      { current, max: 20 },
    );
    selectConditions(sel);

    const btn = batchBtn();
    if (disabled) {
      expect(btn).toBeDisabled();
    } else {
      expect(btn).toBeEnabled();
    }
    if (note) {
      expect(screen.getByText(note)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/Not enough pool!/)).not.toBeInTheDocument();
    }
  });

  // ── Inertness ──

  it('forced click on a pool-blocked individual cure is inert — no writes, no spend, no log', async () => {
    await renderModal({ cureCost: 3 }, { current: 1, max: 20 });
    fireEvent.click(cureBtn('Blinded')); // disabled — click must be inert

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(store.Paladin1.activeConditions).toEqual(['blinded']);
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(1);
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('closing with a pending selection cures nothing — Escape closes without touching conditions, pool, or log', async () => {
    store.Paladin1.activeConditions = ['blinded', 'charmed'];
    const onClose = vi.fn();

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['Blinded', 'Charmed'], onClose },
      { current: 20, max: 20 },
    );
    selectConditions(['Blinded', 'Charmed']);

    fireEvent.click(document.querySelector('.short-rest-overlay'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(store.Paladin1.activeConditions).toEqual(['blinded', 'charmed']);
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(20);
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
