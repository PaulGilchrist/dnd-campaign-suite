// @maintained-by-ai
// EncounterSelectedMonsters component-contract lane: renders the REAL panel directly
// (never a replica). Uniquely owns (per lane map): exact per-row callback payloads +
// call counts (onRemoveMonster index, onViewDetails full selected-entry bytes),
// handler-omitted details-button gating (Source L21 — builder ALWAYS passes a handler,
// so #406 can never exercise the omit branch), exact per-row text set (name + qty
// suffix rule + XP via toLocaleString separators + CR), header total across multi-row
// qty multipliers, and empty/null/undefined unmount (builder never passes undefined/null).
// Owned elsewhere — do NOT duplicate: row-chrome lifecycle, panel remove/view seams
// through the builder state machine, and Clear All (#406 panel-interactions — this
// component renders NO Clear All button; that seam lives in EncounterSummaryPanel),
// table-side qty controls dispatch (#414 EncounterMonsterTable).
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EncounterSelectedMonsters from './EncounterSelectedMonsters.jsx';

// Fresh props + fresh mock handlers per render so nothing bleeds between tests (#362).
function createProps(monsters = [], overrides = {}) {
  return {
    selectedMonsters: monsters,
    onRemoveMonster: vi.fn(),
    ...overrides,
  };
}

const makeMonster = (index, name, xp, challenge_rating, qty) => ({
  index,
  name,
  xp,
  challenge_rating,
  ...(qty === undefined ? {} : { qty }),
});

describe('EncounterSelectedMonsters', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty array', []],
  ])('renders nothing when selectedMonsters is %s', (_label, value) => {
    const props = createProps();
    props.selectedMonsters = value;
    const { container } = render(<EncounterSelectedMonsters {...props} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByText(/Selected Monsters/)).not.toBeInTheDocument();
  });

  it('renders the header total and one exact row per monster (name + qty suffix, XP with separators, CR)', () => {
    const monsters = [
      makeMonster('goblin', 'Goblin', 50, 0.25, 3),
      makeMonster('ancient-red-dragon', 'Ancient Red Dragon', 25000, 24, 2),
      makeMonster('orc', 'Orc', 100, 0.5, 1),
      makeMonster('bandit', 'Bandit', 25, 0.125),
    ];
    const { container } = render(<EncounterSelectedMonsters {...createProps(monsters)} />);

    // Qty multiplies across rows: 3 + 2 + 1 + (missing qty -> 1).
    expect(screen.getByText('Selected Monsters (7)')).toBeInTheDocument();

    const rows = Array.from(container.querySelectorAll('.selected-item'));
    expect(rows).toHaveLength(4);
    const textsIn = (row) => Array.from(row.querySelectorAll('span')).map((s) => s.textContent);
    expect(textsIn(rows[0])).toEqual(['150 XP', 'CR 0.25', 'Goblin (3)']);
    expect(textsIn(rows[1])).toEqual(['50,000 XP', 'CR 24', 'Ancient Red Dragon (2)']);

    // Qty suffix appears only when qty > 1; qty 1 and missing qty show the bare name.
    expect(textsIn(rows[2])).toEqual(['100 XP', 'CR 0.5', 'Orc']);
    expect(textsIn(rows[3])).toEqual(['25 XP', 'CR 0.125', 'Bandit']);
    expect(screen.queryByText('Orc (1)')).not.toBeInTheDocument();
    expect(screen.queryByText('Bandit (1)')).not.toBeInTheDocument();
  });

  it('calls onRemoveMonster once per click with the exact monster index of the clicked row', () => {
    const monsters = [
      makeMonster('goblin', 'Goblin', 50, 0.25, 1),
      makeMonster('orc', 'Orc', 100, 0.5, 2),
    ];
    const props = createProps(monsters);
    const { container } = render(<EncounterSelectedMonsters {...props} />);
    const panel = within(container.querySelector('.encounter-selected'));

    fireEvent.click(panel.getByRole('button', { name: 'Remove Orc' }));
    expect(props.onRemoveMonster).toHaveBeenCalledTimes(1);
    expect(props.onRemoveMonster).toHaveBeenCalledWith('orc');

    fireEvent.click(panel.getByRole('button', { name: 'Remove Goblin' }));
    expect(props.onRemoveMonster).toHaveBeenCalledTimes(2);
    expect(props.onRemoveMonster).toHaveBeenCalledWith('goblin');
  });

  it('omits the details button for every row when onViewDetails is not provided, keeping remove intact', () => {
    const monsters = [
      makeMonster('goblin', 'Goblin', 50, 0.25, 1),
      makeMonster('orc', 'Orc', 100, 0.5, 1),
    ];
    const { container } = render(<EncounterSelectedMonsters {...createProps(monsters)} />);
    expect(container.querySelectorAll('.details-btn')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /View details for/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remove /})).toHaveLength(2);
  });

  it('calls onViewDetails once with the exact selected-entry bytes of the clicked row', () => {
    const orc = makeMonster('orc', 'Orc', 100, 0.5, 2);
    const monsters = [makeMonster('goblin', 'Goblin', 50, 0.25, 1), orc];
    const onViewDetails = vi.fn();
    const props = createProps(monsters, { onViewDetails });
    const { container } = render(<EncounterSelectedMonsters {...props} />);

    fireEvent.click(within(container).getByRole('button', { name: 'View details for Orc' }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
    // Full selected entry — every field, including live qty, passed untouched.
    expect(onViewDetails).toHaveBeenCalledWith({
      index: 'orc',
      name: 'Orc',
      xp: 100,
      challenge_rating: 0.5,
      qty: 2,
    });
  });
});
