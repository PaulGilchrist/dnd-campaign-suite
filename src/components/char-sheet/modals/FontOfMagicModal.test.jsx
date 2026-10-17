/**
 * FontOfMagicModal — conversion-flow lane (modal UI ⇄ LIVE runtime store ledger).
 *
 * Ownership map (siblings — do not duplicate here):
 * - CharActionModals.jsx:117-123 — the open/close host (mergedModalState.fontOfMagicModal
 *   gate, onClose unmount). Mocked stubs live in CharActionModals.async-confirm-handlers
 *   .test.jsx and CharActionModals.charger-resume.test.jsx; hosting/dismissal is theirs.
 * - fontOfMagicHandler.js — the trivial {type:'modal', modalName:'fontOfMagic'} routing;
 *   registry/handler lane, never loads under this mock.
 * - useMetamagic / useTrackedResource — consumers of 'sorcery-points-updated' that
 *   re-read the pool; this lane only proves the event fires (count + shape), not its effects.
 * - classFeatures.js internals — maxSorceryPoints derivation; mocked here, owned there.
 * - restRules / ShortRestModal — pool refill semantics ('sorceryPoints' rest keys).
 * This lane owns: mount purity (exact 6-key read sequence, zero writes/events/close),
 * byte-exact stage copy (header, subtitle, both hints, both totals), the exact cell
 * matrix of both tables under RAW 5e costs, live-store seeds (pool + slot ledger, max
 * clamp, negative lower-bound), per-level SP-gain and slot-cost arithmetic for both
 * rulesets, the full canApply gate suite (net-zero, negative pool, slot-max at the
 * level), apply-through-the-store ledger (exact batch object + cells read back),
 * Cancel/Escape/unmount close semantics, overlay/modal inertness, and missing-data
 * graceful degradation.
 *
 * Anti-vacuity: LIVE store mock (unwritten cell = missing cell, never a call-echo);
 * the ledger is inspected THROUGH the store after every apply. Frozen fixtures consumed
 * by identity (getClassFeatures receives the exact props object). Exact full-line text
 * everywhere; role-scoped queries; fresh vi.fn onClose per makeProps; afterEach
 * mockReset + re-arm (never clearAllMocks/resetAllMocks); deterministic dice — none on
 * this seam; no timers of any kind; no log/timestamp seam exists on this component
 * (apply writes the batch and dispatches a bare CustomEvent).
 *
 * NOTE — flagged product defects (FontOfMagicModal audit), pinned to actual, NOT fixed:
 * 1. No double-apply guard (:63-72): handleApply never disables the CTA or claims a
 *    pending flag, and onClose is a caller mock at the modal seam — two clicks in one
 *    flush fire setRuntimeBatch twice and dispatch TWO 'sorcery-points-updated'
 *    events (state is absolute, so the ledger settles once, but every SSE re-reader
 *    refreshes twice). Pinned below.
 * 2. Fire-and-forget await gap (:69): setRuntimeBatch's Promise is unawaited; a
 *    rejection is unhandled and onClose has already run. Flag only — a genuine
 *    rejection cannot be pinned without tripping Vitest's unhandled-rejection
 *    collector (same realm-split caveat as FeyReinforcementsModal.test.jsx:26-30).
 * 3. No pool-cap gate (:59): canApply checks finalSP >= 0 but never finalSP <=
 *    maxSP — converting down writes sorceryPoints ABOVE maxSorceryPoints (10 → 14
 *    pinned). useMetamagic then happily spends them.
 * 4. Missing-cost economy (:12-15): with empty/partial creating_spell_slots every
 *    absent level costs 0 SP — convert a slot down and create it back for net +level
 *    FREE SP, ledger unchanged (pinned with the level-6/7 filter, flags :14).
 * 5. Negative runtime cells are not lower-clamped (:42): Math.min caps at max but
 *    floors at nothing — 'spell_slots_level_3': -2 renders '-2 / 3', the input gains
 *    max="-2", and the gate then compares 0 <= -2, permanently wedging Apply even at
 *    zero conversion (pinned, with store-heal recovery).
 * 6. a11y quirk (:127): the creation table labels columns 2 AND 4 'SP Cost', so
 *    getByRole(columnheader, {name:'SP Cost'}) is ambiguous by design (pinned).
 * 7. Hardcoded feature copy (:83-84, :124): 'Font of Magic' and hints are literals —
 *    the component takes no action/name prop, so there is no featureName to ride and
 *    any renamed feature or automation.options drifts silently (structural note; the
 *    props contract at :28 is playerStats/campaignName/onClose only).
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FontOfMagicModal from './FontOfMagicModal.jsx';

// ── LIVE runtime store (anti-vacuous): apply writes cells here; read back directly ──
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const cells = new Map();
  const liveRead = (name, key) => cells.get(`${name}|${key}`) ?? null;
  const liveBatch = (name, updates, campaignName) => {
    void campaignName;
    Object.entries(updates).forEach(([key, value]) => cells.set(`${name}|${key}`, value));
    return Promise.resolve();
  };
  return {
    cells,
    getRuntimeValue: vi.fn(liveRead),
    setRuntimeBatch: vi.fn(liveBatch),
  };
});

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import { getClassFeatures } from '../../../services/character/classFeatures.js';

const { cells, getRuntimeValue, setRuntimeBatch } = runtime;

// ── Fixtures (frozen; consumed by identity — the ledger proves THESE values shipped) ──
const PLAYER = 'Throg';
const CAMPAIGN = 'test-campaign';
const MAX_SP = 10;

// Slot maxima mirror the fixture's spellAbilities; one derivation for rows + ledgers.
const SLOTS = Object.freeze({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
const SPELL_ABILITIES = Object.freeze(
  Object.fromEntries(Object.entries(SLOTS).map(([lvl, n]) => [`spell_slots_level_${lvl}`, n]))
);

// RAW sorcerer creation costs (slot level + 1); shipped class data shape.
const RAW_ROWS = Object.freeze([1, 2, 3, 4, 5].map(lvl =>
  Object.freeze({ spell_slot_level: lvl, sorcery_point_cost: lvl + 1 })
));
// Component constant FontOfMagicModal.jsx:7 — levels 1-5 give the same 2..6 column,
// but 2024 rides this table regardless of class data (pinned below).
const COSTS_2024 = Object.freeze([0, 2, 3, 4, 5, 6]);

const classWith = (rows) => Object.freeze({
  name: 'Sorcerer',
  class_levels: Object.freeze([
    Object.freeze({ level: 15, class_specific: Object.freeze({ creating_spell_slots: rows }) }),
  ]),
});

const STATS_5E = Object.freeze({
  name: PLAYER, level: 15, rules: '5e', class: classWith(RAW_ROWS), spellAbilities: SPELL_ABILITIES,
});
const STATS_2024 = Object.freeze({
  name: PLAYER, level: 15, rules: '2024',
  // even with custom costs on board, the 2024 branch ignores them (:10)
  class: classWith(Object.freeze([
    Object.freeze({ spell_slot_level: 1, sorcery_point_cost: 9 }),
    Object.freeze({ spell_slot_level: 4, sorcery_point_cost: 9 }),
  ])),
  spellAbilities: SPELL_ABILITIES,
});
// Partial cost map: level 1 defined; 2-5 absent; 6-7 must be filtered (:14) — flag 4.
const STATS_PARTIAL_COSTS = Object.freeze({
  ...STATS_5E,
  class: classWith(Object.freeze([
    Object.freeze({ spell_slot_level: 1, sorcery_point_cost: 2 }),
    Object.freeze({ spell_slot_level: 6, sorcery_point_cost: 100 }),
    Object.freeze({ spell_slot_level: 7, sorcery_point_cost: 100 }),
  ])),
});

const FEATURES = Object.freeze({ maxSorceryPoints: MAX_SP });

// Fresh vi.fn onClose per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
  return { playerStats: STATS_5E, campaignName: CAMPAIGN, onClose: vi.fn(), ...overrides };
}

// ── Query helpers ──
const tables = () => document.querySelectorAll('.font-of-magic-table');
const bodyRows = (i) => [...tables()[i].querySelectorAll('tbody tr')];
// Input tds expose their live value; every other td its exact text.
const rowCells = (row) => [...row.querySelectorAll('td')].map(td => {
  const input = td.querySelector('input');
  return input ? input.value : td.textContent;
});
const inputAt = (tableIdx, lvl) => bodyRows(tableIdx)[lvl - 1].querySelector('input');
const setInput = (tableIdx, lvl, value) =>
  fireEvent.change(inputAt(tableIdx, lvl), { target: { value: String(value) } });
const summaryText = () => document.querySelector('.font-of-magic-summary').textContent;
const totalTexts = () => [...document.querySelectorAll('.font-of-magic-total')].map(d => d.textContent);
const applyBtn = () => screen.getByRole('button', { name: 'Apply Conversion' });
const seed = (key, value) => cells.set(`${PLAYER}|${key}`, value);
const fullSlotLedger = (over = {}) => Object.fromEntries(
  [1, 2, 3, 4, 5].map(lvl => [`spell_slots_level_${lvl}`, over[lvl] ?? SLOTS[lvl]])
);

// ── Setup / teardown ──
let sorceryEvents = [];
let sorceryListener = null;

beforeEach(() => {
  sorceryEvents = [];
  sorceryListener = (e) => sorceryEvents.push(e);
  window.addEventListener('sorcery-points-updated', sorceryListener);
  getClassFeatures.mockImplementation(() => FEATURES);
});

// House rule: mockReset (not clearAllMocks/resetAllMocks) + re-arm; live cells wiped.
afterEach(() => {
  cleanup();
  window.removeEventListener('sorcery-points-updated', sorceryListener);
  cells.clear();
  getRuntimeValue.mockReset().mockImplementation((name, key) => cells.get(`${name}|${key}`) ?? null);
  setRuntimeBatch.mockReset().mockImplementation((name, updates, campaignName) => {
    void campaignName;
    Object.entries(updates).forEach(([key, value]) => cells.set(`${name}|${key}`, value));
    return Promise.resolve();
  });
  getClassFeatures.mockReset().mockImplementation(() => FEATURES);
});

describe('FontOfMagicModal', () => {
  // ── Mount purity / exact stage copy ──

  it('mounts exact copy and reads the six ledger keys in order — zero writes, events, or close on mount', () => {
    const props = makeProps();
    const { container } = render(<FontOfMagicModal {...props} />);

    expect(container.querySelector('.font-of-magic-overlay.no-print .font-of-magic-modal')).toBeInTheDocument();
    expect(container.querySelector('.font-of-magic-modal h3 i.fa-fire')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Font of Magic' })).toBeInTheDocument();
    expect(screen.getByText('Bonus Action \u2014 Convert between spell slots and sorcery points')).toBeInTheDocument();
    expect(summaryText()).toBe(`Sorcery Points: ${MAX_SP} \u2192 ${MAX_SP}`);
    expect(screen.getByRole('heading', { level: 4, name: 'Convert Spell Slots to Sorcery Points' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Convert Sorcery Points to Spell Slots' })).toBeInTheDocument();
    expect(screen.getByText('Gain SP equal to the slot\u2019s level per slot expended.')).toBeInTheDocument();
    expect(screen.getByText('Cost per slot shown. Created slots vanish after a Long Rest.')).toBeInTheDocument();
    expect(totalTexts()).toEqual(['Total SP gained: +0', 'Total SP cost: -0']);
    expect(applyBtn()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getAllByRole('button')).toHaveLength(2);

    // Mount purity: the exact read ledger, nothing written, nothing dispatched.
    expect(getRuntimeValue.mock.calls).toEqual([
      [PLAYER, 'sorceryPoints'],
      [PLAYER, 'spell_slots_level_1'],
      [PLAYER, 'spell_slots_level_2'],
      [PLAYER, 'spell_slots_level_3'],
      [PLAYER, 'spell_slots_level_4'],
      [PLAYER, 'spell_slots_level_5'],
    ]);
    expect(setRuntimeBatch.mock.calls).toEqual([]);
    expect(cells.size).toBe(0);
    expect(sorceryEvents).toEqual([]);
    expect(props.onClose).not.toHaveBeenCalled();
    // Identity pin: the exact frozen props object reaches the features seam.
    expect(getClassFeatures).toHaveBeenCalledTimes(1);
    expect(getClassFeatures.mock.calls[0][0]).toBe(STATS_5E);
  });

  it('renders the exact cell matrix: RAW 5e slot rows, creation costs 2-6 SP, zero inputs, disabled Apply', () => {
    render(<FontOfMagicModal {...makeProps()} />);
    expect([...tables()[0].querySelectorAll('th')].map(th => th.textContent))
      .toEqual(['Level', 'Available', 'Convert', 'SP Gained']);
    expect(bodyRows(0).map(rowCells)).toEqual([
      ['1', '4 / 4', '0', '+0'],
      ['2', '3 / 3', '0', '+0'],
      ['3', '3 / 3', '0', '+0'],
      ['4', '3 / 3', '0', '+0'],
      ['5', '1 / 1', '0', '+0'],
    ]);
    // FLAG 6: creation table reuses 'SP Cost' for columns 2 and 4.
    expect([...tables()[1].querySelectorAll('th')].map(th => th.textContent))
      .toEqual(['Level', 'SP Cost', 'Create', 'SP Cost']);
    expect(bodyRows(1).map(rowCells)).toEqual([
      ['1', '2 SP', '0', '-0'],
      ['2', '3 SP', '0', '-0'],
      ['3', '4 SP', '0', '-0'],
      ['4', '5 SP', '0', '-0'],
      ['5', '6 SP', '0', '-0'],
    ]);
    expect(applyBtn()).toBeDisabled();
  });

  // ── Pool seed / fallback ──

  it.each([7, '7'])('live pool seed %s: summary reads the store, string coerced to number', (stored) => {
    seed('sorceryPoints', stored);
    render(<FontOfMagicModal {...makeProps()} />);
    expect(summaryText()).toBe('Sorcery Points: 7 \u2192 7');
    expect(cells.get(`${PLAYER}|sorceryPoints`)).toBe(stored); // seed untouched pre-apply
  });

  it('falls back to 0 when maxSorceryPoints is unavailable and the pool cell is empty', () => {
    getClassFeatures.mockReturnValueOnce(null);
    render(<FontOfMagicModal {...makeProps()} />);
    expect(summaryText()).toBe('Sorcery Points: 0 \u2192 0');
    expect(document.querySelector('.font-of-magic-summary .stat--buffed')).toHaveTextContent('0');
  });

  // ── Slot ledger seeds: override, max clamp, negative lower bound (flag 5) ──

  it('reads live slot cells: overrides shown, stored > max clamped down, negative stored NOT floored (flag 5), input max follows current', () => {
    seed('spell_slots_level_1', 2);
    seed('spell_slots_level_2', 10);
    seed('spell_slots_level_3', -2);
    render(<FontOfMagicModal {...makeProps()} />);

    expect(bodyRows(0).map(row => rowCells(row)[1]))
      .toEqual(['2 / 4', '3 / 3', '-2 / 3', '3 / 3', '1 / 1']);

    setInput(0, 1, 5); // clamps to CURRENT slots (2), not max (4) — slot-level gating
    expect(inputAt(0, 1).value).toBe('2');
    setInput(0, 3, 3);
    expect(inputAt(0, 3).value).toBe('0'); // Math.max(0, min(-2, 3))
    expect(inputAt(0, 3)).toHaveAttribute('max', '-2'); // flag 5 evidence
    expect(totalTexts()[0]).toBe('Total SP gained: +2'); // the lv1=2 conversion stands
    expect(summaryText()).toBe('Sorcery Points: 10 \u2192 12');
    // flag 5 consequence: the gate compares toSP[3]=0 <= currentSlots[3]=-2 — FALSE,
    // so a poisoned cell permanently wedges Apply even at zero conversion.
    expect(applyBtn()).toBeDisabled();

    seed('spell_slots_level_3', 0); // heal the cell in the live store
    setInput(1, 1, 5); // creation clamps to maxSlots (4), ignoring the lv1 seed of 2
    expect(inputAt(1, 1).value).toBe('4');
    expect(totalTexts()[1]).toBe('Total SP cost: -8');
    expect(summaryText()).toBe('Sorcery Points: 10 \u2192 4');
    // lv1 finalSlots 2-2+4 = 4 = max — legal at the boundary despite the seed of 2.
    expect(applyBtn()).toBeEnabled();
  });

  // ── Slot-to-SP conversion arithmetic (per level) ──

  it.each([1, 2, 3, 4, 5])('convert 1 level-%i slot: +%i cell, +total, summary %i\u2192%i, Apply live', (lvl) => {
    render(<FontOfMagicModal {...makeProps()} />);
    setInput(0, lvl, 1);
    expect(rowCells(bodyRows(0)[lvl - 1])[3]).toBe(`+${lvl}`);
    expect(totalTexts()[0]).toBe(`Total SP gained: +${lvl}`);
    expect(summaryText()).toBe(`Sorcery Points: ${MAX_SP} \u2192 ${MAX_SP + lvl}`);
    expect(applyBtn()).toBeEnabled();
  });

  it('accumulates across levels and applies through the live store — finalSP sails past maxSorceryPoints with no cap gate (flag 3)', () => {
    const props = makeProps();
    render(<FontOfMagicModal {...props} />);
    setInput(0, 1, 1);
    setInput(0, 3, 1);

    expect(totalTexts()[0]).toBe('Total SP gained: +4');
    expect(summaryText()).toBe('Sorcery Points: 10 \u2192 14'); // > MAX_SP, ungated
    fireEvent.click(applyBtn());

    const batch = { sorceryPoints: 14, ...fullSlotLedger({ 1: 3, 3: 2 }) };
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch.mock.calls[0]).toEqual([PLAYER, batch, CAMPAIGN]);
    // Ledger read THROUGH the store:
    expect(cells.get(`${PLAYER}|sorceryPoints`)).toBe(14);
    expect(cells.get(`${PLAYER}|spell_slots_level_1`)).toBe(3);
    expect(cells.get(`${PLAYER}|spell_slots_level_3`)).toBe(2);
    expect(sorceryEvents).toHaveLength(1);
    expect(sorceryEvents[0].type).toBe('sorcery-points-updated');
    expect(sorceryEvents[0]).toBeInstanceOf(CustomEvent);
    expect(sorceryEvents[0].detail).toBeNull(); // bare CustomEvent (spec default)
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  // ── SP-to-slot creation arithmetic (per level, live store) ──

  it.each([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]])('create 1 level-%i slot at %i SP: cost cell, total, summary, live ledger after apply', (lvl, cost) => {
    seed('sorceryPoints', 20);
    seed(`spell_slots_level_${lvl}`, SLOTS[lvl] - 1); // room to create under max
    const props = makeProps();
    render(<FontOfMagicModal {...props} />);

    setInput(1, lvl, 1);
    expect(rowCells(bodyRows(1)[lvl - 1])).toEqual([`${lvl}`, `${cost} SP`, '1', `-${cost}`]);
    expect(totalTexts()[1]).toBe(`Total SP cost: -${cost}`);
    expect(summaryText()).toBe(`Sorcery Points: 20 \u2192 ${20 - cost}`);
    expect(applyBtn()).toBeEnabled();

    fireEvent.click(applyBtn());
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch.mock.calls[0]).toEqual([PLAYER, { sorceryPoints: 20 - cost, ...fullSlotLedger() }, CAMPAIGN]);
    expect(cells.get(`${PLAYER}|sorceryPoints`)).toBe(20 - cost);
    expect(cells.get(`${PLAYER}|spell_slots_level_${lvl}`)).toBe(SLOTS[lvl]); // restored to max
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('2024 ruleset rides COSTS_2024 [0,2,3,4,5,6] and ignores custom class costs entirely, applying through the store', () => {
    seed('sorceryPoints', 10);
    seed('spell_slots_level_4', 2);
    const props = makeProps({ playerStats: STATS_2024 });
    render(<FontOfMagicModal {...props} />);

    // STATS_2024 carries cost-9 rows the :2024 branch never reads (:10).
    expect(bodyRows(1).map(row => rowCells(row)[1]))
      .toEqual([1, 2, 3, 4, 5].map(lvl => `${COSTS_2024[lvl]} SP`));
    setInput(1, 4, 1);
    expect(totalTexts()[1]).toBe('Total SP cost: -5');
    expect(summaryText()).toBe('Sorcery Points: 10 \u2192 5');
    fireEvent.click(applyBtn());

    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch.mock.calls[0]).toEqual([PLAYER, { sorceryPoints: 5, ...fullSlotLedger({ 4: 3 }) }, CAMPAIGN]);
    expect(cells.get(`${PLAYER}|spell_slots_level_4`)).toBe(3);
  });

  // ── Missing/partial cost data: free round-trip economy (flag 4) ──

  it('partial cost map filters levels >5 and turns absent levels into 0 SP — a convert-down/create-back round trip mints free SP past the cap (flag 4)', () => {
    const props = makeProps({ playerStats: STATS_PARTIAL_COSTS });
    render(<FontOfMagicModal {...props} />);

    expect(bodyRows(1).map(row => rowCells(row)[1])).toEqual(['2 SP', '0 SP', '0 SP', '0 SP', '0 SP']);

    setInput(0, 3, 1); // expend a level-3 slot: +3 SP
    setInput(1, 3, 1); // recreate it for 0 SP (cost absent from the map)
    expect(totalTexts()).toEqual(['Total SP gained: +3', 'Total SP cost: -0']);
    expect(summaryText()).toBe('Sorcery Points: 10 \u2192 13');
    fireEvent.click(applyBtn());

    // Slot ledger unchanged, pool up 3 — pure mint from missing cost data.
    expect(setRuntimeBatch.mock.calls[0]).toEqual([PLAYER, { sorceryPoints: 13, ...fullSlotLedger() }, CAMPAIGN]);
    expect(cells.get(`${PLAYER}|sorceryPoints`)).toBe(13);
    expect(cells.get(`${PLAYER}|spell_slots_level_3`)).toBe(3);
  });

  // ── Input clamp matrix ──

  it.each([
    ['slot\u2192SP', 0, '10', '4'],
    ['slot\u2192SP', 0, '-5', '0'],
    ['slot\u2192SP', 0, '', '0'],
    ['slot\u2192SP', 0, 'abc', '0'],
    ['SP\u2192slot', 1, '10', '4'],
    ['SP\u2192slot', 1, '-5', '0'],
    ['SP\u2192slot', 1, '', '0'],
    ['SP\u2192slot', 1, 'abc', '0'],
  ])('%s level-1 input "%s" clamps to "%s"', (_dir, tableIdx, raw, expected) => {
    render(<FontOfMagicModal {...makeProps()} />);
    setInput(tableIdx, 1, raw);
    expect(inputAt(tableIdx, 1).value).toBe(expected);
    const val = Number(expected);
    expect(totalTexts()[tableIdx]).toBe(
      tableIdx === 0 ? `Total SP gained: +${val}` : `Total SP cost: -${val * 2}`
    );
    // slot→SP with gain>0 enables; SP→slot never applies here (0 net, or lv1
    // overflow of the full 4-slot max — gate pinned separately).
    expect(applyBtn().disabled).toBe(tableIdx === 1 || val === 0);
  });

  // ── canApply gates ──

  it.each([
    {
      label: 'net-zero round trip (convert 2 lv1, create 1 lv1)',
      seed: () => {},
      turn: () => { setInput(0, 1, 2); setInput(1, 1, 1); },
      summary: 'Sorcery Points: 10 \u2192 10',
    },
    {
      label: 'negative pool (seed sp=0, create 1 lv2 in seeded room)',
      seed: () => { seed('sorceryPoints', 0); seed('spell_slots_level_2', 2); },
      turn: () => setInput(1, 2, 1),
      summary: 'Sorcery Points: 0 \u2192 -3',
    },
    {
      label: 'slot-max overflow (create 4 lv1 on top of full 4)',
      seed: () => {},
      turn: () => setInput(1, 1, 4),
      summary: 'Sorcery Points: 10 \u2192 2',
    },
  ])('gate refused — $label: $summary, Apply stays disabled', ({ seed: preSeed, turn, summary }) => {
    preSeed();
    render(<FontOfMagicModal {...makeProps()} />);
    turn();
    expect(summaryText()).toBe(summary);
    expect(applyBtn()).toBeDisabled();
    expect(setRuntimeBatch).not.toHaveBeenCalled();
  });

  it('renders the penalized badge on a negative preview while the CTA blocks the write', () => {
    seed('sorceryPoints', 0);
    seed('spell_slots_level_2', 2);
    render(<FontOfMagicModal {...makeProps()} />);
    setInput(1, 2, 1);
    expect(document.querySelector('.font-of-magic-summary .stat--penalized')).toHaveTextContent('-3');
    expect(document.querySelector('.font-of-magic-summary .stat--buffed')).not.toBeInTheDocument();
  });

  it('both directions live simultaneously: gates pass, exact batch lands in the ledger, event and close once each', () => {
    seed('sorceryPoints', 5);
    seed('spell_slots_level_2', 1);
    const props = makeProps();
    render(<FontOfMagicModal {...props} />);

    setInput(0, 3, 2); // two lv3 slots \u2192 +6 SP
    setInput(1, 2, 1); // recreate one lv2 slot \u2192 -3 SP
    expect(summaryText()).toBe('Sorcery Points: 5 \u2192 8');
    expect(applyBtn()).toBeEnabled();

    fireEvent.click(applyBtn());
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch.mock.calls[0]).toEqual([
      PLAYER,
      { sorceryPoints: 8, ...fullSlotLedger({ 2: 2, 3: 1 }) },
      CAMPAIGN,
    ]);
    expect(cells.get(`${PLAYER}|sorceryPoints`)).toBe(8);
    expect(cells.get(`${PLAYER}|spell_slots_level_2`)).toBe(2);
    expect(cells.get(`${PLAYER}|spell_slots_level_3`)).toBe(1);
    expect(sorceryEvents).toHaveLength(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('a disabled Apply click is fully inert: no batch, no event, no close, empty ledger', () => {
    const props = makeProps();
    render(<FontOfMagicModal {...props} />);
    fireEvent.click(applyBtn());
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(sorceryEvents).toEqual([]);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(cells.size).toBe(0);
  });

  it('double-click Apply fires twice — two byte-identical batches, two events, two closes (flag 1); absolute writes settle the ledger once', () => {
    const props = makeProps();
    render(<FontOfMagicModal {...props} />);
    setInput(0, 1, 1);

    // CTA never disables (handleApply is sync + onClose is a mock): both click 1's
    // twin lands — no in-flight/disposed guard exists.
    fireEvent.click(applyBtn());
    fireEvent.click(applyBtn());

    const batch = { sorceryPoints: 11, ...fullSlotLedger({ 1: 3 }) };
    expect(setRuntimeBatch.mock.calls).toEqual([
      [PLAYER, batch, CAMPAIGN],
      [PLAYER, batch, CAMPAIGN],
    ]);
    expect(sorceryEvents).toHaveLength(2);
    expect(props.onClose).toHaveBeenCalledTimes(2);
    // State is absolute, so the ledger still settles exactly once.
    expect(cells.get(`${PLAYER}|sorceryPoints`)).toBe(11);
    expect(cells.get(`${PLAYER}|spell_slots_level_1`)).toBe(3);
  });

  // ── Close semantics ──

  it('Cancel closes exactly once and touches neither store nor events', () => {
    const props = makeProps();
    render(<FontOfMagicModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(sorceryEvents).toEqual([]);
    expect(cells.size).toBe(0);
  });

  it('Escape closes exactly once, unrelated keys are ignored, and the listener detaches on unmount', () => {
    const props = makeProps();
    const { unmount } = render(<FontOfMagicModal {...props} />);

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['.font-of-magic-overlay', '.font-of-magic-modal'])('click on %s is inert: no close path, inputs untouched', (selector) => {
    const props = makeProps();
    render(<FontOfMagicModal {...props} />);
    setInput(0, 2, 1);

    fireEvent.click(document.querySelector(selector));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(inputAt(0, 2).value).toBe('1');
    expect(applyBtn()).toBeEnabled();
  });

  // ── Missing-data graceful degradation ──

  it.each([
    {
      label: 'missing spellAbilities',
      stats: Object.freeze({ name: PLAYER, level: 15, rules: '5e', class: classWith(RAW_ROWS) }),
      available: ['0 / 0', '0 / 0', '0 / 0', '0 / 0', '0 / 0'],
      costs: ['2 SP', '3 SP', '4 SP', '5 SP', '6 SP'],
      lv1Input: '0', // no slots to convert — clamps to 0
    },
    {
      label: 'missing class_levels',
      stats: Object.freeze({ name: PLAYER, level: 15, rules: '5e', class: Object.freeze({ name: 'Sorcerer' }), spellAbilities: SPELL_ABILITIES }),
      available: ['4 / 4', '3 / 3', '3 / 3', '3 / 3', '1 / 1'],
      costs: ['0 SP', '0 SP', '0 SP', '0 SP', '0 SP'],
      lv1Input: '3', // slots survive; only costs vanish (flag 4 shape)
    },
    {
      label: 'undefined class',
      stats: Object.freeze({ name: PLAYER, level: 15, rules: '5e', spellAbilities: SPELL_ABILITIES }),
      available: ['4 / 4', '3 / 3', '3 / 3', '3 / 3', '1 / 1'],
      costs: ['0 SP', '0 SP', '0 SP', '0 SP', '0 SP'],
      lv1Input: '3',
    },
  ])('degrades gracefully with $label: exact tables render, initial Apply inert, inputs clamp to $lv1Input', ({ stats, available, costs, lv1Input }) => {
    const props = makeProps({ playerStats: stats });
    render(<FontOfMagicModal {...props} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Font of Magic' })).toBeInTheDocument();
    expect(bodyRows(0).map(row => rowCells(row)[1])).toEqual(available);
    expect(bodyRows(1).map(row => rowCells(row)[1])).toEqual(costs);

    fireEvent.click(applyBtn()); // initial state: disabled and inert
    expect(applyBtn()).toBeDisabled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(cells.size).toBe(0);

    setInput(0, 1, 3);
    expect(inputAt(0, 1).value).toBe(lv1Input);
  });
});
