import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { ds, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  describe('DeathSaveEntry', () => {
    // ── Core text rendering ──────────────────────────────────────

    it.each([
      ['Death Save Success', 'success', true],
      ['Death Save Failure', 'failure', false],
    ])('renders "%s" for normal %s', (expectedText, _label, success) => {
      setup(Log, [ds({ success })]);
      expect(screen.getByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();
    });

    it('renders "Stabilized!" when result is stable', () => {
      setup(Log, [ds({ result: 'stable' })]);
      expect(screen.getByText(/Stabilized!/i)).toBeInTheDocument();
      expect(screen.queryByText(/Death Save Success/i)).not.toBeInTheDocument();
    });

    it('renders "Has Perished!" when result is dead', () => {
      setup(Log, [ds({ result: 'dead' })]);
      expect(screen.getByText(/Has Perished!/i)).toBeInTheDocument();
    });

    it('renders "Natural 20 — Stabilized!" for nat20 without pre-existing stable result', () => {
      setup(Log, [ds({ success: true, isNatural20: true })]);
      expect(q('.log-name')).toHaveTextContent(/^Natural 20 — Stabilized!$/i);
    });

    it('renders "Natural 1 — Double Failure" for nat1', () => {
      setup(Log, [ds({ success: false, isNatural1: true })]);
      expect(screen.getByText(/Natural 1 — Double Failure/i)).toBeInTheDocument();
      expect(screen.queryByText(/Death Save Failure/i)).not.toBeInTheDocument();
    });

    // ── CSS classes ──────────────────────────────────────────────

    it.each([
      ['success', true],
      ['failure', false],
    ])('applies "%s" CSS class based on success value', (cls, success) => {
      setup(Log, [ds({ success })]);
      expect(q(`.log-entry.log-death-save.log-death-save-${cls}`)).toBeInTheDocument();
    });

    // ── Icon rendering ───────────────────────────────────────────

    it('renders skull-crossbones icon for non-dead entries', () => {
      setup(Log, [ds({ success: true })]);
      expect(q('.log-death-save i.fa-skull-crossbones')).toBeInTheDocument();
    });

    it('renders skull icon (not skull-crossbones) when result is dead', () => {
      setup(Log, [ds({ result: 'dead' })]);
      expect(q('.log-death-save i.fa-skull')).toBeInTheDocument();
      expect(q('.log-death-save i.fa-skull-crossbones')).not.toBeInTheDocument();
    });

    // ── Roll display ─────────────────────────────────────────────

    it.each([
      ['non-stable/non-dead', 12, true, undefined],
      ['stable', 15, false, 'stable'],
      ['dead', 8, false, 'dead'],
    ])('renders roll value in parens for %s entries', (_label, roll, shouldShow, result) => {
      const entry = result ? ds({ roll, result }) : ds({ roll });
      setup(Log, [entry]);
      if (shouldShow) {
        expect(screen.getByText(new RegExp(`\\(${roll}\\)`))).toBeInTheDocument();
      } else {
        expect(screen.queryByText(new RegExp(`\\(${roll}\\)`))).not.toBeInTheDocument();
      }
    });

    // ── NAT badges ───────────────────────────────────────────────

    it('shows NAT 20 badge for isNatural20', () => {
      setup(Log, [ds({ isNatural20: true })]);
      expect(screen.getByText(/NAT 20/i)).toBeInTheDocument();
    });

    it('shows NAT 1 badge for isNatural1', () => {
      setup(Log, [ds({ isNatural1: true })]);
      expect(screen.getByText(/NAT 1/i)).toBeInTheDocument();
    });

    it('hides NAT badges for non-natural rolls', () => {
      setup(Log, [ds({ roll: 15 })]);
      expect(screen.queryByText(/NAT 20/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/NAT 1/i)).not.toBeInTheDocument();
    });

    // ── Advantage / dual dice ────────────────────────────────────

    it.each([
      ['present', { roll: 17, rolls: [17, 9], hasAdvantage: true }, true],
      ['single roll', { roll: 15, rolls: [15] }, false],
      ['no rolls', { roll: 15 }, false],
    ])('shows ADVANTAGE badge when %s', (_label, overrides, show) => {
      setup(Log, [ds(overrides)]);
      if (show) {
        expect(screen.getByText(/ADVANTAGE/i)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/ADVANTAGE/i)).not.toBeInTheDocument();
      }
    });

    it('shows both dice with selected/discarded labels for advantage', () => {
      setup(Log, [ds({ roll: 17, rolls: [17, 9], hasAdvantage: true })]);
      expect(screen.getByText(/selected/i)).toBeInTheDocument();
      expect(screen.getByText(/discarded/i)).toBeInTheDocument();
      expect(screen.getByText(/\(17/)).toBeInTheDocument();
      expect(screen.getByText(/\(9/)).toBeInTheDocument();
    });

    it('marks first die as selected when rolls[0] >= rolls[1]', () => {
      setup(Log, [ds({ roll: 17, rolls: [17, 9], hasAdvantage: true })]);
      expect(q('.log-die-selected')).toBeInTheDocument();
    });

    it('marks second die as selected when rolls[1] > rolls[0]', () => {
      setup(Log, [ds({ roll: 9, rolls: [9, 17], hasAdvantage: true })]);
      expect(q('.log-die-selected')).toBeInTheDocument();
    });

    it('hides dual dice display for stable and dead entries', () => {
      setup(Log, [ds({ rolls: [17, 9], result: 'stable' })]);
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/discarded/i)).not.toBeInTheDocument();
      setup(Log, [ds({ rolls: [8, 3], result: 'dead' })]);
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/discarded/i)).not.toBeInTheDocument();
    });

    // ── Total successes/failures ─────────────────────────────────

    it('renders total successes, failures, and both when present', () => {
      setup(Log, [ds({ totalSuccesses: 2 })]);
      expect(q('.log-death-save-total-successes')).toHaveTextContent(/^✓ 2$/);
      beforeEachSetup();
      setup(Log, [ds({ totalFailures: 1 })]);
      expect(q('.log-death-save-total-failures')).toHaveTextContent(/^✗ 1$/);
      beforeEachSetup();
      setup(Log, [ds({ totalSuccesses: 1, totalFailures: 2 })]);
      expect(q('.log-death-save-total-successes')).toHaveTextContent(/^✓ 1$/);
      expect(q('.log-death-save-total-failures')).toHaveTextContent(/^✗ 2$/);
    });

    it('hides totals container when neither total is present', () => {
      setup(Log, [ds({ roll: 15 })]);
      expect(q('.log-death-save-totals')).not.toBeInTheDocument();
    });

    // ── Character name and timestamp ─────────────────────────────

    it('renders character name from entry', () => {
      setup(Log, [ds({ characterName: 'Frodo' })]);
      expect(q('.log-character')).toHaveTextContent(/Frodo/i);
    });

    it('renders timestamp from entry', () => {
      setup(Log, [ds()]);
      expect(q('.log-time')).toBeInTheDocument();
    });
  });
});
