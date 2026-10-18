// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';

// Component contract lane only: props → visible text/class output and the
// onClearMonsters dispatch. XP recomputation chains live in builder lanes
// (#400 gameplay-flows, #399 additional-interactions, #401 helpers); the
// Clear All builder click-flow through the real panel lives in
// EncounterBuilder.panel-interactions.test.jsx (#406). Props are fed
// verbatim here — no rules math is re-derived.

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

  it('maps difficultyIndex to the label and its CSS color/background classes', () => {
    // Highest valid index doubles as the upper-boundary case.
    render(<EncounterSummaryPanel {...createProps({ difficultyIndex: 3 })} />);
    const value = screen.getByText('Deadly');
    expect(value).toHaveClass('summary-value-deadly'); // EncounterBuilder.css:224
    expect(value.closest('.summary-item')).toHaveClass('summary-item-difficulty-deadly'); // EncounterBuilder.css:196
  });

  it.each([
    ['an out-of-range index', { difficultyIndex: 5 }, 'easy'],
    ['a negative index', { difficultyIndex: -1 }, 'easy'],
    ['undefined labels with a valid index', { difficultyLabels: undefined }, 'hard'],
  ])('falls back to Unknown label for %s, styling from a valid index', (_description, overrides, bgName) => {
    render(<EncounterSummaryPanel {...createProps(overrides)} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    // Invalid indexes keep the panel on the default easy background; valid
    // indexes still drive it (EncounterBuilder.css:181-196).
    expect(screen.getByText('Unknown').closest('.summary-item')).toHaveClass(`summary-item-difficulty-${bgName}`);
  });

  it('renders a danger-styled Clear All that dispatches onClearMonsters once per click', () => {
    const props = createProps();
    render(<EncounterSummaryPanel {...props} />);
    const button = screen.getByRole('button', { name: 'Clear All' });
    expect(button).toHaveClass('encounter-btn-danger'); // EncounterBuilder.css:78
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
