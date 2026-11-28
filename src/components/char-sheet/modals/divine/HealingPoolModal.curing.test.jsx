// @maintained-by-ai 2026-11-27 curing lane: merged-batch census + phantom purge
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Ownership ──
// This file owns the CURING seam only: cure-section rendering for both lanes
// (individual alsoCures vs restoring-touch batch), the condition-filtering
// contract through the live runtime/combat-summary stores (merge, match,
// hide), exact activeConditions write payloads (single MERGED batch write —
// headline contract) and live-store transitions for single and batch cures,
// exact condition-log rows (catalog display label + frozen Date.now) incl.
// the modal log's RUNNING pool after each row, cure-cost gating (enabled/
// disabled, Pool after / Not enough pool! notes, exact pool==cost boundary),
// the single tier's commit-time no-match refusal (zero pool/write/row +
// inline note) and its non-sticky re-cure, and that closing with a pending
// selection commits nothing.
// Deferred to owners:
// - HealingPoolModal.bloodied.test.jsx — bloodied badge/gate/restriction note
//   and gate-blocked inertness.
// - HealingPoolModal.channel-divinity.test.jsx — CD charge consumption on
//   cure/heal/dice actions (this lane never passes resourceCost; CD spend on
//   cure actions is pinned THERE, not here).
// - HealingPoolModal.dice.test.jsx — dice-pool accumulation/close-heal.
// - HealingPoolModal.live-conditions-echo.test.jsx — real-echo subscription
//   adoption of external activeConditions writes (this lane's stale-enable
//   test only forces a re-render to reach the commit-time re-read).
// - HealingPoolModal.test.jsx — loading state, display strings, target
//   selection rendering, Done/Escape/overlay-close plumbing (generic: an
//   overlay click never closes is owned there, so the former overlay leg of
//   this file's pending-selection close test was base plumbing, purged).
// - HealingPoolModal.healing.test.jsx — applyHeal plumbing, pool deduction,
//   healing_pool log payloads, no-action close inertness.
// (Curing-owner cleanup, still pinned: the duplicated NPC condition-filter
// re-write blocks in applyCure/applyBatchCure were removed — they re-read the
// just-written value and re-ran an identical predicate, producing a
// byte-identical SECOND setRuntimeValue write. Every write assertion below is
// an exact single-write/merged-write census that kills that regression.)
//
// Run-4 trim pass (2026-11-27): purged the dead getTargetFromAttacker and
// addStorageChangeListener mock keys and the 4-of-15 CONDITIONS mirror mock
// (conditionUtils is a pure data module — the REAL 15-entry catalog now backs
// every label/casing claim). Removed as phantom/redundant: the forced-click-
// on-disabled-cure inertness test (React suppresses onClick on disabled
// buttons in jsdom — probe-verified — so it pinned nothing beyond the
// disabled-attr assertion the gating arms already make; the pool-shortfall
// handler guard is unreachable-by-click defense-in-depth); the
// deferred-setLog reactive-render batch test (its per-index running-pool rows
// are structurally eager-computed in the source and byte-identical rows are
// pinned by the merged-write test with distinctive values); three
// same-branch it.each arms (alsoCures null == empty, pool 0 == pool 2 < cost,
// batch-hide == single-tier hide); the standalone running-pool-rows test
// (merged into the headline batch census). The former "inline styles" source
// note was stale — HealingPoolModal.jsx has no inline styles.

// ── Mocked modules ──
// Keys mirror ONLY what the loaded render graph imports: HealingPoolModal.jsx
// itself, SecondaryTargetModal.jsx (real component), and healingPoolHandler.js
// (deliberately NOT mocked — the CD lane owns it). Phantom keys purged per the
// bloodied/channel-divinity lanes.

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
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures / live stores ──

const CAMPAIGN = 'test-campaign';
const FIXED_TS = 1750000000000; // frozen Date.now for exact log payloads

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
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^Select ${name}`) }));
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
    logService.addEntry.mockReset();
    dateNowSpy.mockRestore();
  });

  // ── Cure section rendering ──

  it.each([
    {
      lane: 'individual (deduped, target-filtered)',
      props: { alsoCures: ['Blinded', 'Blinded', 'Poisoned'], cureCost: 5 },
      conditions: ['blinded', 'poisoned'],
      buttons: ['Blinded', 'Poisoned'],
    },
    {
      lane: 'individual on an unafflicted target',
      props: { alsoCures: ['Blinded', 'Poisoned'], cureCost: 5 },
      conditions: [],
      buttons: [],
    },
    { lane: 'alsoCures empty', props: { alsoCures: [] }, conditions: ['blinded'], buttons: [] },
  ])('renders the $lane cure section', async ({ props, conditions, buttons }) => {
    store.Paladin1.activeConditions = conditions;
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

  it('batch section merges runtime + combat-summary conditions and only offers curable ones', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Paladin1', type: 'player', conditions: [{ key: 'charmed' }] },
        combatSummary.creatures[1],
      ],
    });
    store.Paladin1.activeConditions = ['blinded'];

    await renderModal({
      alsoCures: [],
      restoringTouchConditions: ['Blinded', 'Charmed', 'Poisoned', 'Frightened'],
    });

    expect(screen.getByRole('heading', { level: 4, name: 'Cure Conditions (3 HP each)' })).toBeInTheDocument();
    expect(screen.getByText('Select conditions affecting Paladin1 to cure:')).toBeInTheDocument();
    // Merged from both sources:
    expect(cureBtn('Blinded')).toBeInTheDocument();
    expect(cureBtn('Charmed')).toBeInTheDocument();
    // Curable list ∩ target truth — the hide face (empty intersection retires
    // the whole section) is the same branch pinned by the single-tier
    // unafflicted arm above:
    expect(screen.queryByRole('button', { name: 'Poisoned' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Frightened' })).not.toBeInTheDocument();
  });

  // ── Individual cure gating ──

  it.each([
    { current: 2, disabled: true },
    { current: 3, disabled: false }, // exact boundary: pool equals cost
  ])('individual cure button disabled=$disabled when pool is $current (cost 3)', async ({ current, disabled }) => {
    await renderModal({}, { current, max: 20 });
    const btn = cureBtn('Blinded');
    if (disabled) {
      expect(btn).toBeDisabled();
    } else {
      expect(btn).toBeEnabled();
    }
    // No forced-click-through-disabled leg: React suppresses onClick on
    // disabled buttons in jsdom (probe-verified), so such a test would pin
    // only this disabled attribute — the short-pool handler guard is
    // unreachable-by-click defense-in-depth.
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
    expect(poolUpdate).toHaveBeenCalledTimes(1);
    expect(poolUpdate).toHaveBeenCalledWith(7);
    expect(poolStore.current).toBe(7);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, conditionLog('Orc Warrior', 'Blinded'));
    expect(logRows()).toEqual([['Cure Blinded', 'Orc Warrior', '3', '7']]);
  });

  // ── Batch cure: selection lifecycle ──

  it('toggles selection state and re-labels the batch button with count and total cost', async () => {
    store.Paladin1.activeConditions = ['blinded', 'charmed'];

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['Blinded', 'Charmed'] },
      { current: 20, max: 20 },
    );

    const blindedBtn = cureBtn('Blinded');
    expect(blindedBtn).not.toHaveClass('cure-btn-active');
    expect(batchBtn()).toHaveTextContent('Cure Selected (0 for 0 HP)');
    expect(batchBtn()).toBeDisabled(); // nothing-selected gate

    fireEvent.click(blindedBtn);
    expect(blindedBtn).toHaveClass('cure-btn-active');
    expect(cureBtn('Cure Selected (1 for 3 HP)')).toBeInTheDocument();

    fireEvent.click(blindedBtn); // toggle off
    expect(blindedBtn).not.toHaveClass('cure-btn-active');
    expect(cureBtn('Cure Selected (0 for 0 HP)')).toBeInTheDocument();
    // Pool-gated notes ('Pool after'/'Not enough pool!') belong to the gating
    // matrix below — asserted here once, there, only.
  });

  // ── Batch cure: HEADLINE merged single write + audit census ──

  it('batch cure writes the merged filtered conditions ONCE — survivors ordered, other keys intact, one pool write, ordered per-cure rows with running pool, selection/section cleared', async () => {
    // Backlog 2026-11-13 GZ batch-cure-single-write: the old loop POSTed the
    // whole bucket once PER cured condition. The merged write must be exactly
    // ONE setRuntimeValue carrying the all-selections-removed result. Cost 5 ×
    // 2 off pool 100 keeps every channel byte-distinct (write payload vs 95/90
    // running rows vs final 90 — a mutant showing the final pool in every row
    // cannot pass silently).
    store.Paladin1.activeConditions = ['blinded', 'frightened', 'charmed', 'poisoned'];

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['Blinded', 'Charmed'], cureCost: 5 },
      { current: 100, max: 100 },
    );
    selectConditions(['Blinded', 'Charmed']);
    fireEvent.click(cureBtn('Cure Selected (2 for 10 HP)'));

    // Exactly ONE merged target write: survivors keep order, cured keys gone.
    expect(cureWrites()).toEqual([
      ['Paladin1', 'activeConditions', ['frightened', 'poisoned'], CAMPAIGN],
    ]);
    expect(store.Paladin1.activeConditions).toEqual(['frightened', 'poisoned']);
    // Every other bucket key byte-intact.
    expect(store.Paladin1.currentHitPoints).toBe(15);
    expect(store.Paladin1.hitPoints).toBe(40);
    // One pool write for the total.
    expect(poolUpdate).toHaveBeenCalledTimes(1);
    expect(poolUpdate).toHaveBeenCalledWith(90);
    expect(poolStore.current).toBe(90);
    // Ordered exact audit census (backlog 2026-11-13 FX: rows show the pool
    // after each condition's OWN cost — display layer only, the store stayed
    // the single full-batch write above).
    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, conditionLog('Paladin1', 'Blinded')],
      [CAMPAIGN, conditionLog('Paladin1', 'Charmed')],
    ]);
    expect(logRows()).toEqual([
      ['Cure Blinded', 'Paladin1', '5', '95'],
      ['Cure Charmed', 'Paladin1', '5', '90'],
    ]);
    // Both cured entries left the live store — the whole section (and its
    // stale selection) must unmount.
    expect(screen.queryByRole('button', { name: /^Cure Selected/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Select conditions affecting/)).not.toBeInTheDocument();
  });

  // ── Unified display-label audit casing (backlog 2026-11-13 FX cure-casing split) ──
  // Both LoH cure tiers write the REAL CONDITIONS-catalog display label in the
  // audit row's condition field — same convention as the Physician's Touch
  // reference lane (HandOfHealingModal.test.jsx).

  it('single cure from raw-key alsoCures against a label-cased store renders and logs the catalog label "Blinded" and removes the entry key-insensitively', async () => {
    store.Paladin1.activeConditions = ['Blinded'];

    await renderModal({ alsoCures: ['blinded'], cureCost: 5 }, { current: 100, max: 100 });
    // The button renders the catalog label, not the raw lowercase key.
    fireEvent.click(cureBtn('Blinded'));

    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, conditionLog('Paladin1', 'Blinded'));
    expect(logRows()).toEqual([['Cure Blinded', 'Paladin1', '5', '95']]);
    // Commit semantics untouched: conditionMatches stays key-insensitive and
    // removes the label-cased store entry with one write.
    expect(cureWrites()).toEqual([['Paladin1', 'activeConditions', [], CAMPAIGN]]);
  });

  it('batch cure from raw-key restoringTouchConditions against a mixed-casing store logs catalog labels in selection order', async () => {
    store.Paladin1.activeConditions = ['Poisoned', 'blinded'];

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['poisoned', 'blinded'], cureCost: 5 },
      { current: 100, max: 100 },
    );
    selectConditions(['Poisoned', 'Blinded']);
    fireEvent.click(cureBtn('Cure Selected (2 for 10 HP)'));

    expect(logService.addEntry.mock.calls).toEqual([
      [CAMPAIGN, conditionLog('Paladin1', 'Poisoned')],
      [CAMPAIGN, conditionLog('Paladin1', 'Blinded')],
    ]);
    expect(store.Paladin1.activeConditions).toEqual([]);
    // Pool/write-count mechanics belong to the merged-write census above.
  });

  // ── Single-tier commit honesty (bug-single-cure-tier-unfiltered-costs-pool-and-fakes-audit-row) ──
  // applyCure charges cureCost + logs `condition broken` even for a condition
  // the target never had. Rendering is now target-filtered (pinned above);
  // this pins the commit-time guard covering the stale-render face (bucket
  // drifts while the modal dwells): zero pool, zero write, zero row, inline
  // .healing-restriction-note refusal (same seam as the HoH pre-spend gate,
  // f3950317c).

  it('pressing a cure the target no longer has is inert — inline refusal, zero pool, zero writes, zero log', async () => {
    await renderModal({ alsoCures: ['Blinded'], cureCost: 5 }, { current: 100, max: 100 });
    // The button rendered while the target had the condition; another writer
    // (tab/AI referee) clears the bucket while the modal dwells open.
    store.Paladin1.activeConditions = [];

    fireEvent.click(cureBtn('Blinded'));

    expect(screen.getByText('Paladin1 is not affected by Blinded. No pool spent.')).toHaveClass('healing-restriction-note');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(store.Paladin1.activeConditions).toEqual([]);
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(100);
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('refusal is not sticky: after an external re-apply, the re-rendered button cures honestly from the commit-time re-read', async () => {
    // The live-echo subscription that re-renders on external writes is owned
    // by live-conditions-echo.test.jsx; here a benign input change forces the
    // re-render so the refiltered button reaches the commit-time re-read.
    await renderModal({ alsoCures: ['Blinded'], cureCost: 5 }, { current: 100, max: 100 });
    store.Paladin1.activeConditions = [];
    fireEvent.click(cureBtn('Blinded'));
    expect(screen.getByText('Paladin1 is not affected by Blinded. No pool spent.')).toBeInTheDocument();

    store.Paladin1.activeConditions = ['blinded'];
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });

    fireEvent.click(cureBtn('Blinded'));

    expect(screen.queryByText(/No pool spent/)).not.toBeInTheDocument();
    expect(poolUpdate).toHaveBeenCalledTimes(1);
    expect(poolUpdate).toHaveBeenCalledWith(95);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, conditionLog('Paladin1', 'Blinded'));
    expect(cureWrites()).toEqual([['Paladin1', 'activeConditions', [], CAMPAIGN]]);
  });

  // ── Batch pool gating ──

  it.each([
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
    expect(screen.getByText(note)).toBeInTheDocument();
    // The nothing-selected disabled gate is pinned in the selection-lifecycle
    // test; a forced click cannot reach a handler through a disabled button.
  });

  // ── Pending selection never leaks through close ──

  it('closing with a pending selection cures nothing — Escape closes without touching conditions, pool, or log', async () => {
    // Generic close plumbing (overlay click never closes, Done/Escape onClose
    // once with NO pending state) is base .test.jsx's; this lane's distinct
    // face: a STAGED batch selection must not commit on close.
    store.Paladin1.activeConditions = ['blinded', 'charmed'];
    const onClose = vi.fn();

    await renderModal(
      { alsoCures: [], restoringTouchConditions: ['Blinded', 'Charmed'], onClose },
      { current: 20, max: 20 },
    );
    selectConditions(['Blinded', 'Charmed']);
    expect(batchBtn()).toBeEnabled(); // the cure WOULD happen if closed committed

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    expect(cureWrites()).toEqual([]);
    expect(store.Paladin1.activeConditions).toEqual(['blinded', 'charmed']);
    expect(poolUpdate).not.toHaveBeenCalled();
    expect(poolStore.current).toBe(20);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
