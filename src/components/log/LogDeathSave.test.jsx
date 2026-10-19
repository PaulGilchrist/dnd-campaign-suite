// @maintained-by-ai
// DeathSaveEntry lane: owned contract = death_save entry RENDER bytes only —
// title per polarity (success / failure / nat20 / nat1), stable/dead/removed
// finality bytes + icon, single-die and advantage selected/discarded bytes,
// ✓/✗ totals bytes, actor + fixed-timestamp header.
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
import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
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
  // no `success` field, so they get the failure polarity class — pinned
  // honestly (see SOURCE BUG report for 'removed' title and stable class).
  it.each([
    ['stable', { result: 'stable', success: undefined, totalSuccesses: 3, totalFailures: 1 }, 'Stabilized!', 'fa-skull-crossbones', null, ['✓ 3', '✗ 1'], []],
    ['dead', { result: 'dead', success: undefined, totalSuccesses: 1, totalFailures: 3 }, 'Has Perished!', 'fa-skull', null, ['✓ 1', '✗ 3'], []],
    ['stable beats nat20 title', { result: 'stable', success: undefined, isNatural20: true, totalSuccesses: 3, totalFailures: 0 }, 'Stabilized!', 'fa-skull-crossbones', 'NAT 20', ['✓ 3', '✗ 0'], []],
    ['removed (revive reset)', { result: 'removed', success: undefined, roll: undefined, totalSuccesses: 0, totalFailures: 0 }, 'Death Save Failure', 'fa-skull-crossbones', null, ['✓ 0', '✗ 0'], ['()']],
  ])('renders %s finality bytes', (_label, overrides, title, iconCls, natBadge, totals, dieTexts) => {
    setup(Log, [ds(overrides)]);
    expect(q('.log-name').textContent).toBe(title);
    expect(q('.log-death-save .log-icon i')).toHaveClass(iconCls);
    // Only 'stable'/'dead' suppress dice; 'removed' is not finality to the
    // renderer, so the roll-less revive-reset payload renders an empty '()'
    // ghost die (both pinned honestly — SOURCE BUGS).
    expect([...document.querySelectorAll('.log-death-save .log-die')].map((n) => n.textContent)).toEqual(dieTexts);
    const [succText, failText] = totals;
    expect(q('.log-death-save-total-successes').textContent).toBe(succText);
    expect(q('.log-death-save-total-failures').textContent).toBe(failText);
    if (natBadge) {
      expect(screen.getByText(natBadge)).toBeInTheDocument();
    }
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
