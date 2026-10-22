// @maintained-by-ai
// DeathSaveEntry lane: owned contract = death_save entry RENDER bytes only —
// enum-cover presentation map (#877): title/class/die-string per producer
// `result` value (absent|'stable'|'dead'|'removed') + neutral UNKNOWN arm,
// polarity per explicit success tri-state (never truthiness-red), roll-less
// rows render no die node (no '()' ghost), stable/dead/removed finality bytes
// + icon, single-die and advantage selected/discarded bytes, ✓/✗ totals bytes,
// actor + fixed-timestamp header.
// CUT (owners cited): container type-dispatch → LogEntryRendering.test.jsx (#876);
// producer payloads (what fields get sent) → DeathSavingThrows.test.jsx /
// DeathSavePromptModal.test.jsx / initiative-callbacks.test.jsx (#837/#863);
// other entry types → their own lane files.
// Family-standard setup (useLog fake, zero network) from log-test-utils.jsx;
// #876 lesson: fixed timestamps, never assert against Date.now() output.
// Old→new map: core-text(5)+css-class(2)+icons(2)+roll-display(3)+nat-badges(3)
// → polarityMatrix; stable/dead(2) → finalityMatrix (+nat20-precedence, +removed pins);
// advantage(4) → advantageMatrix; totals(2) → totalsMatrix (absent-totals leg folded
// into polarityMatrix); name+time(2) → header.
// #877 fixes: 'removed' revive row mislabel flipped ('Death Save Failure' →
// 'Dying Condition Removed'), '()' ghost die suppressed, stable/dead/omitted-success
// polarity moved off truthiness onto explicit tri-state (mirrors LogConditionEntry
// #876 presentation-map + UNKNOWN + console.error pattern).
import { screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { ds, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const FIXED_TS = 1700000000000;

describe('Log > DeathSaveEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // Normal (live-roll) entries: title byte + polarity class + die byte +
  // nat badge + icon, for every polarity in one oracle matrix.
  it.each([
    ['success', { roll: 14 }, 'Death Save Success', 'log-death-save-success', '(14)', true, null],
    ['failure', { success: false, roll: 8 }, 'Death Save Failure', 'log-death-save-failure', '(8)', false, null],
    ['natural 20', { roll: 20, isNatural20: true }, 'Natural 20 — Stabilized!', 'log-death-save-success', '(20)', true, 'NAT 20'],
    ['natural 1', { success: false, roll: 1, isNatural1: true }, 'Natural 1 — Double Failure', 'log-death-save-failure', '(1)', false, 'NAT 1'],
  ])('renders %s entry bytes', (_label, overrides, title, polarityCls, dieText, dieSelected, natBadge) => {
    setup(Log, [ds(overrides)]);
    expect(q('.log-entry')).toHaveClass('log-death-save', polarityCls);
    expect(q('.log-name').textContent).toBe(title);
    expect(q('.log-death-save .log-icon i')).toHaveClass('fa-skull-crossbones');
    expect(q('.log-death-save .log-die').textContent).toBe(dieText);
    if (dieSelected) {
      expect(q('.log-death-save .log-die')).toHaveClass('log-die-selected');
    } else {
      expect(q('.log-death-save .log-die')).not.toHaveClass('log-die-selected');
    }
    if (natBadge) {
      expect(screen.getByText(natBadge)).toBeInTheDocument();
    } else {
      expect(screen.queryByText('NAT 20')).not.toBeInTheDocument();
      expect(screen.queryByText('NAT 1')).not.toBeInTheDocument();
    }
    expect(screen.queryByText('ADVANTAGE')).not.toBeInTheDocument();
    expect(q('.log-death-save-totals')).toBeNull();
  });

  // Finality entries mirror real producer payloads (DeathSavingThrows.jsx):
  // #877: stable/dead/removed carry explicit honest tones from the presentation
  // map — stable and removed (revive) render green, dead red; none inherit a
  // class from truthiness on the absent `success` field. 'removed'
  // (DeathSavingThrows.jsx:61, GM clears the dying track via the
  // "Resurrect character" button) is a rescue, so it labels honestly and
  // renders NO die node (pre-fix pins 'Death Save Failure' + '()' — flipped).
  it.each([
    ['stable', { result: 'stable', success: undefined, totalSuccesses: 3, totalFailures: 1 }, 'Stabilized!', 'log-death-save-success', 'fa-skull-crossbones', null, ['✓ 3', '✗ 1'], []],
    ['dead', { result: 'dead', success: undefined, totalSuccesses: 1, totalFailures: 3 }, 'Has Perished!', 'log-death-save-failure', 'fa-skull', null, ['✓ 1', '✗ 3'], []],
    ['stable beats nat20 title', { result: 'stable', success: undefined, isNatural20: true, totalSuccesses: 3, totalFailures: 0 }, 'Stabilized!', 'log-death-save-success', 'fa-skull-crossbones', 'NAT 20', ['✓ 3', '✗ 0'], []],
    ['removed (revive reset)', { result: 'removed', success: undefined, roll: undefined, totalSuccesses: 0, totalFailures: 0 }, 'Dying Condition Removed', 'log-death-save-success', 'fa-skull-crossbones', null, ['✓ 0', '✗ 0'], []],
  ])('renders %s finality bytes', (_label, overrides, title, polarityCls, iconCls, natBadge, totals, dieTexts) => {
    setup(Log, [ds(overrides)]);
    expect(q('.log-entry')).toHaveClass('log-death-save', polarityCls);
    expect(q('.log-name').textContent).toBe(title);
    expect(q('.log-death-save .log-icon i')).toHaveClass(iconCls);
    // Every finality payload is roll-less: the renderer emits no die node
    // at all — never an empty '()' ghost die (#877).
    expect([...document.querySelectorAll('.log-death-save .log-die')].map((n) => n.textContent)).toEqual(dieTexts);
    expect(q('.log-death-save').textContent).not.toContain('()');
    const [succText, failText] = totals;
    expect(q('.log-death-save-total-successes').textContent).toBe(succText);
    expect(q('.log-death-save-total-failures').textContent).toBe(failText);
    if (natBadge) {
      expect(screen.getByText(natBadge)).toBeInTheDocument();
    }
  });

  // #877 enum-cover (#1348): every death_save row shape the producers can
  // emit (plus the defensive UNKNOWN arm) renders a mutually distinguishable
  // label/class/die-string triple — no two rows share all three bytes.
  it.each([
    // [case, overrides, label, cls, dieTexts]
    ['roll row, explicit success', { roll: 14 }, 'Death Save Success', 'log-death-save-success', ['(14)']],
    ['roll row, explicit failure', { success: false, roll: 8 }, 'Death Save Failure', 'log-death-save-failure', ['(8)']],
    ['roll row, omitted success (neutral, not red)', { success: undefined, roll: 12 }, 'Death Save', 'log-death-save-neutral', ['(12)']],
    ['roll row, success, no die data', { success: true, roll: undefined }, 'Death Save Success', 'log-death-save-success', []],
    ['stable finality', { result: 'stable', success: undefined, totalSuccesses: 3, totalFailures: 1 }, 'Stabilized!', 'log-death-save-success', []],
    ['dead finality', { result: 'dead', success: undefined, totalSuccesses: 1, totalFailures: 3 }, 'Has Perished!', 'log-death-save-failure', []],
    ['removed revive', { result: 'removed', success: undefined, roll: undefined, totalSuccesses: 0, totalFailures: 0 }, 'Dying Condition Removed', 'log-death-save-success', []],
    ['unknown result fallback', { result: 'stabilized', success: undefined, roll: undefined }, 'Death Save Update', 'log-death-save-neutral', []],
  ])('enum-cover: %s', (_label, overrides, title, cls, dieTexts) => {
    setup(Log, [ds(overrides)]);
    expect(q('.log-entry')).toHaveClass('log-death-save', cls);
    expect(q('.log-name').textContent).toBe(title);
    expect([...document.querySelectorAll('.log-death-save .log-die')].map((n) => n.textContent)).toEqual(dieTexts);
    expect(q('.log-death-save').textContent).not.toContain('()');
  });

  // Mirrors the #876 house pattern (LogConditionEntry.jsx:32-35): an unknown
  // `result` logs loudly and renders the neutral fallback — never silently a
  // red 'Death Save Failure'.
  it('unknown result logs console.error and renders the neutral fallback', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setup(Log, [ds({ result: 'stabilized', success: undefined, roll: undefined })]);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('stabilized'), expect.anything());
    expect(q('.log-entry')).toHaveClass('log-death-save', 'log-death-save-neutral');
    expect(q('.log-name').textContent).toBe('Death Save Update');
    expect(q('.log-death-save .log-icon i')).toHaveClass('fa-circle-info');
    expect([...document.querySelectorAll('.log-death-save .log-die')].map((n) => n.textContent)).toEqual([]);
    errSpy.mockRestore();
  });

  it.each([
    ['both totals', { roll: 13, totalSuccesses: 2, totalFailures: 1 }, ['✓ 2', '✗ 1']],
    ['failures only', { roll: 13, totalFailures: 2 }, [null, '✗ 2']],
  ])('renders totals container for %s', (_label, overrides, [succText, failText]) => {
    setup(Log, [ds(overrides)]);
    expect(q('.log-death-save-totals')).toBeInTheDocument();
    if (succText) {
      expect(q('.log-death-save-total-successes').textContent).toBe(succText);
    } else {
      expect(q('.log-death-save-total-successes')).toBeNull();
    }
    expect(q('.log-death-save-total-failures').textContent).toBe(failText);
  });

  // selected/discarded bytes pin both the labels and which die carries them.
  it.each([
    ['advantage keeping high die', { roll: 17, rolls: [17, 9] }, ['(17 selected)', '(9 discarded)'], '(17 selected)'],
    ['advantage keeping low die', { roll: 17, rolls: [9, 17] }, ['(9 discarded)', '(17 selected)'], '(17 selected)'],
    ['single-element rolls array renders one die', { roll: 15, rolls: [15] }, ['(15)'], '(15)'],
  ])('%s', (_label, overrides, dieTexts, selectedText) => {
    setup(Log, [ds(overrides)]);
    const dies = [...document.querySelectorAll('.log-death-save .log-die')].map((n) => n.textContent);
    expect(dies).toEqual(dieTexts);
    expect(q('.log-death-save .log-die-selected').textContent).toBe(selectedText);
    const badge = screen.queryByText('ADVANTAGE');
    expect(Boolean(badge)).toBe(dieTexts.length === 2);
  });

  it('renders actor name and locale-formatted timestamp from a fixed epoch', () => {
    setup(Log, [ds({ timestamp: FIXED_TS })]);
    expect(q('.log-character').textContent).toBe('Gimli');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
