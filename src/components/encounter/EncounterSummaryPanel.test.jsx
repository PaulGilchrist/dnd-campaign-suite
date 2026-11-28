// @maintained-by-ai 2026-11-28
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';

// Component contract lane only: props → visible text/class output and the
// onClearMonsters dispatch. XP recomputation chains live in builder lanes
// (gameplay-flows, additional-interactions, helpers); the end-to-end Clear
// All click that empties the selection lives in
// EncounterBuilder.panel-interactions.test.jsx. Unique value kept here:
// double-dispatch on the panel's own button (the builder lane's clear-all is
// idempotent, so it cannot catch it) and the null selectedMonsters branch,
// which the builder never passes. Props are fed verbatim — no rules math is
// re-derived.

const LABELS = ['Easy', 'Medium', 'Hard', 'Deadly'];

const createProps = (overrides = {}) => ({
  totalMonsterXP: 10000,
  monsterCount: 7,
  difficultyMultiplier: 3,
  effectiveXP: 15000,
  difficultyIndex: 2,
  difficultyLabels: LABELS,
  selectedMonsters: [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 2 }],
  onClearMonsters: vi.fn(),
  ...overrides,
});

describe('EncounterSummaryPanel', () => {
  it('renders every counter label with its prop value, XP via toLocaleString', () => {
    render(<EncounterSummaryPanel {...createProps()} />);
    expect(screen.getByText('Total XP')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
    expect(screen.getByText('Monster Count')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Multiplier')).toBeInTheDocument();
    expect(screen.getByText('\u00D73')).toBeInTheDocument();
    expect(screen.getByText('Effective XP')).toBeInTheDocument();
    expect(screen.getByText('15,000')).toBeInTheDocument();
  });

  it.each([
    ['a valid index (Hard)', 2, LABELS, 'Hard', 'summary-value-hard', 'hard'],
    ['the upper-boundary index (Deadly)', 3, LABELS, 'Deadly', 'summary-value-deadly', 'deadly'],
    ['an out-of-range index (Unknown, easy background)', 5, LABELS, 'Unknown', '', 'easy'],
    ['a negative index (Unknown, easy background)', -1, LABELS, 'Unknown', '', 'easy'],
    // The value class is driven by difficultyIndex alone, so a valid index
    // still styles the Unknown fallback label.
    ['undefined labels with a valid index (Unknown keeps index styling)', 2, undefined, 'Unknown', 'summary-value-hard', 'hard'],
  ])('maps %s to matching value and background classes', (
    _description,
    difficultyIndex,
    difficultyLabels,
    expectedLabel,
    expectedValueClass,
    expectedBgName,
  ) => {
    render(<EncounterSummaryPanel {...createProps({ difficultyIndex, difficultyLabels })} />);
    const value = screen.getByText(expectedLabel);
    expect(value).toHaveClass('summary-value');
    if (expectedValueClass) {
      expect(value).toHaveClass(expectedValueClass);
    } else {
      expect(value.className.trim()).toBe('summary-value');
    }
    // Invalid indexes keep the panel on the default easy background; valid
    // indexes still drive it.
    expect(value.closest('.summary-item')).toHaveClass(`summary-item-difficulty-${expectedBgName}`);
  });

  it('renders a kit danger-tier Clear All that dispatches onClearMonsters once per click', () => {
    const props = createProps();
    render(<EncounterSummaryPanel {...props} />);
    const button = screen.getByRole('button', { name: 'Clear All' });
    expect(button).toHaveClass('ct-btn-danger'); // .ct-* kit convergence (tranche 1)
    fireEvent.click(button);
    expect(props.onClearMonsters).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['null', null],
    ['an empty array', []],
  ])('omits Clear All when selectedMonsters is %s', (_description, selectedMonsters) => {
    render(<EncounterSummaryPanel {...createProps({ selectedMonsters })} />);
    expect(screen.queryByRole('button', { name: 'Clear All' })).not.toBeInTheDocument();
  });
});
