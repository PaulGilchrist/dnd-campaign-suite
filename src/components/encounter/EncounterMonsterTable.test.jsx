// @maintained-by-ai
// EncounterMonsterTable component lane: rendering contracts and per-row callback payloads
// for the standalone table only. Builder-level state machines live elsewhere and are NOT re-tested here:
//   - EncounterBuilder.additional-interactions.test.jsx — handleSort state machine via observable row order
//   - EncounterBuilder.panel-interactions.test.jsx        — live toggle / qty / remove / modal state end-to-end
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EncounterMonsterTable from './EncounterMonsterTable.jsx';

const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, type: 'humanoid', environments: ['forest', 'underdark'] },
  { index: 'orc', name: 'Orc', challenge_rating: 0.5, xp: 100, type: 'humanoid', environments: ['hill', 'mountain'] },
  { index: 'dragon', name: 'Young Dragon', challenge_rating: 10, xp: 5900, type: 'dragon', environments: ['underground'] },
];

function renderTable(overrides = {}) {
  const props = {
    filteredMonsters: sampleMonsters,
    selectedMonsters: [{ index: 'goblin', qty: 2 }],
    onToggleMonster: vi.fn(),
    onIncreaseQty: vi.fn(),
    onDecreaseQty: vi.fn(),
    onRemoveMonster: vi.fn(),
    searchQuery: '',
    onSearchQueryChange: vi.fn(),
    onSort: vi.fn(),
    sortField: 'name',
    sortDirection: 'asc',
    showEnvironment: true,
    typeFilter: '',
    onTypeChange: vi.fn(),
    sizeFilter: '',
    onSizeChange: vi.fn(),
    crMin: undefined,
    crMax: undefined,
    onCRMinChange: vi.fn(),
    onCRMaxChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<EncounterMonsterTable {...props} />);
  return { props, ...utils };
}

describe('EncounterMonsterTable', () => {
  describe('search and filter controls', () => {
    it('binds the search input to searchQuery and dispatches the exact typed value', () => {
      const { props } = renderTable({ searchQuery: 'gob' });
      const input = screen.getByPlaceholderText('Search by name, type, or subtype...');
      expect(input).toHaveValue('gob');
      expect(input).toHaveAttribute('aria-label', 'Search monsters');
      fireEvent.change(input, { target: { value: 'goblin' } });
      expect(props.onSearchQueryChange).toHaveBeenCalledWith('goblin');
    });

    it.each([
      {
        label: 'type',
        get: () => screen.getByLabelText('Type'),
        props: { typeFilter: 'dragon' },
        bound: 'dragon',
        next: 'aberration',
        allOption: 'All Types',
        option: 'Dragon',
        cb: (p) => p.onTypeChange,
      },
      {
        label: 'size',
        get: () => screen.getByLabelText('Size'),
        props: { sizeFilter: 'large' },
        bound: 'large',
        next: 'tiny',
        allOption: 'All Sizes',
        option: 'Tiny',
        cb: (p) => p.onSizeChange,
      },
      {
        label: 'CR min',
        get: () => screen.getByLabelText('Minimum challenge rating'),
        props: { crMin: 2 },
        bound: 2,
        next: '1',
        cb: (p) => p.onCRMinChange,
      },
      {
        label: 'CR max',
        get: () => screen.getByLabelText('Maximum challenge rating'),
        props: { crMax: 4 },
        bound: 4,
        next: '5',
        cb: (p) => p.onCRMaxChange,
      },
    ])('binds the $label filter to its prop and dispatches changes exactly', ({ get, props: overrides, bound, next, allOption, option, cb }) => {
      const { props } = renderTable(overrides);
      const control = get();
      expect(control).toHaveValue(bound);
      if (allOption) {
        expect(screen.getByRole('option', { name: allOption })).toBeInTheDocument();
      }
      if (option) {
        expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
      }
      fireEvent.change(control, { target: { value: next } });
      expect(cb(props)).toHaveBeenCalledWith(next);
    });

    it('falls back to empty CR inputs when crMin/crMax are undefined', () => {
      renderTable();
      expect(screen.getByLabelText('Minimum challenge rating')).toHaveValue(null);
      expect(screen.getByLabelText('Maximum challenge rating')).toHaveValue(null);
    });
  });

  describe('columns and rows', () => {
    it('renders every column and cell text when showEnvironment is true', () => {
      const { container } = renderTable();
      for (const header of ['Sel', 'Monster', 'CR', 'XP', 'Env', 'Qty', 'Details', 'Remove']) {
        expect(screen.getByText(header)).toBeInTheDocument();
      }
      const rows = screen.getAllByRole('row');
      // Row order mirrors filteredMonsters input order — the table never re-sorts itself.
      expect(rows).toHaveLength(sampleMonsters.length + 1);
      // CR renders raw from challenge_rating; XP via toLocaleString (source: monster.xp.toLocaleString()).
      expect(rows[1]).toHaveTextContent('Goblin');
      expect(rows[1]).toHaveTextContent('0.25');
      expect(rows[1]).toHaveTextContent('50');
      expect(rows[2]).toHaveTextContent('Orc');
      expect(rows[2]).toHaveTextContent('0.5');
      expect(rows[2]).toHaveTextContent('100');
      expect(rows[3]).toHaveTextContent('Young Dragon');
      expect(rows[3]).toHaveTextContent('10');
      expect(rows[3]).toHaveTextContent('5,900');
      expect(container.querySelectorAll('td.col-env')).toHaveLength(sampleMonsters.length);
    });

    it('hides the Env header, sort button, and cells when showEnvironment is false', () => {
      renderTable({ showEnvironment: false });
      expect(screen.queryByText('Env')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sort by environment' })).not.toBeInTheDocument();
      expect(screen.queryByText('Forest, Underdark')).not.toBeInTheDocument();
    });

    it.each([
      { name: 'capitalized joined labels', monster: sampleMonsters[0], expected: 'Forest, Underdark' },
      { name: 'an empty cell for missing environments', monster: { index: 'shoggoth', name: 'Shoggoth', challenge_rating: 1, xp: 200, type: 'aberration' }, expected: '' },
    ])('renders the environment column as $name', ({ monster, expected }) => {
      const { container } = renderTable({ filteredMonsters: [monster], selectedMonsters: [] });
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(2);
      expect(rows[1]).toHaveTextContent(monster.name);
      expect(container.querySelector('td.col-env').textContent).toBe(expected);
    });

    it('marks the selected row and shows qty/remove controls only there', () => {
      renderTable();
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(sampleMonsters.length);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveClass('monster-row-selected');
      expect(rows[2]).not.toHaveClass('monster-row-selected');
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease quantity of Goblin')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase quantity of Goblin')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove Goblin')).toBeInTheDocument();
      expect(screen.queryByLabelText('Decrease quantity of Orc')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Increase quantity of Orc')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Remove Orc')).not.toBeInTheDocument();
    });

    it.each([
      {
        name: 'selected with qty 0',
        selected: [{ index: 'goblin', qty: 0 }],
        goblinChecked: true,
      },
      {
        name: 'nothing selected',
        selected: [],
        goblinChecked: false,
      },
    ])('shows em-dash qty and no controls in every row when $name', ({ selected, goblinChecked }) => {
      renderTable({ selectedMonsters: selected });
      const goblinCheckbox = screen.getByRole('checkbox', { name: 'Select Goblin' });
      if (goblinChecked) {
        expect(goblinCheckbox).toBeChecked();
      } else {
        expect(goblinCheckbox).not.toBeChecked();
      }
      expect(screen.queryByLabelText(/quantity of/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Remove Goblin')).not.toBeInTheDocument();
      // One em-dash per row, from the qty>0 fallback (source: qty > 0 ? controls : &mdash;).
      expect(screen.getAllByText('\u2014')).toHaveLength(sampleMonsters.length);
    });
  });

  describe('row callbacks', () => {
    it.each([
      ['Decrease quantity of Goblin', 'onDecreaseQty'],
      ['Increase quantity of Goblin', 'onIncreaseQty'],
      ['Remove Goblin', 'onRemoveMonster'],
    ])('dispatches the monster index through %s', (control, callbackKey) => {
      const { props } = renderTable();
      fireEvent.click(screen.getByLabelText(control));
      expect(props[callbackKey]).toHaveBeenCalledTimes(1);
      expect(props[callbackKey]).toHaveBeenCalledWith('goblin');
    });

    it('toggles selection exactly once with the full monster object from checkbox or row click, never from row controls', () => {
      const { props } = renderTable();
      // Checkbox click must not double-dispatch through the row onClick (stopPropagation).
      fireEvent.click(screen.getAllByRole('checkbox')[1]);
      expect(props.onToggleMonster).toHaveBeenCalledTimes(1);
      expect(props.onToggleMonster).toHaveBeenCalledWith(sampleMonsters[1]);

      props.onToggleMonster.mockClear();
      fireEvent.click(screen.getAllByRole('row')[2]);
      expect(props.onToggleMonster).toHaveBeenCalledTimes(1);
      expect(props.onToggleMonster).toHaveBeenCalledWith(sampleMonsters[1]);

      props.onToggleMonster.mockClear();
      fireEvent.click(screen.getByLabelText('Decrease quantity of Goblin'));
      fireEvent.click(screen.getByLabelText('Increase quantity of Goblin'));
      fireEvent.click(screen.getByLabelText('Remove Goblin'));
      fireEvent.click(screen.getByLabelText('View details for Goblin'));
      expect(props.onToggleMonster).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'dispatches the exact monster object', onViewDetails: true },
      { name: 'still renders without onViewDetails', onViewDetails: false },
    ])('details button $name', ({ onViewDetails }) => {
      const handler = onViewDetails ? vi.fn() : undefined;
      renderTable({ onViewDetails: handler });
      for (const monster of sampleMonsters) {
        expect(screen.getByLabelText(`View details for ${monster.name}`)).toBeInTheDocument();
      }
      const detailsBtn = screen.getByLabelText('View details for Goblin');
      if (handler) {
        fireEvent.click(detailsBtn);
        expect(handler).toHaveBeenCalledWith(sampleMonsters[0]);
      } else {
        expect(() => fireEvent.click(detailsBtn)).not.toThrow();
      }
    });
  });

  describe('sorting headers', () => {
    it('dispatches the exact column key for every sortable header', () => {
      const { props } = renderTable();
      const sortableHeaders = [
        ['Sort by selection status', 'sel'],
        ['Sort by monster name', 'name'],
        ['Sort by challenge rating', 'cr'],
        ['Sort by XP', 'xp'],
        ['Sort by environment', 'env'],
      ];
      for (const [label, columnKey] of sortableHeaders) {
        fireEvent.click(screen.getByRole('button', { name: label }));
        expect(props.onSort).toHaveBeenLastCalledWith(columnKey);
      }
      expect(props.onSort).toHaveBeenCalledTimes(sortableHeaders.length);
    });

    it('shows the sort indicator only on the active field and flips with direction', () => {
      const { props, rerender } = renderTable();
      const nameHeader = () => screen.getByRole('button', { name: 'Sort by monster name' });
      expect(nameHeader()).toHaveTextContent('\u25B2');

      rerender(<EncounterMonsterTable {...props} sortDirection="desc" />);
      expect(nameHeader()).toHaveTextContent('\u25BC');

      rerender(<EncounterMonsterTable {...props} sortField="cr" />);
      expect(nameHeader()).not.toHaveTextContent('\u25B2');
      expect(nameHeader()).not.toHaveTextContent('\u25BC');
      expect(screen.getByRole('button', { name: 'Sort by challenge rating' })).toHaveTextContent('\u25B2');
    });
  });

  describe('empty state', () => {
    it('replaces the table with "No monsters found" while keeping the search input', () => {
      renderTable({ filteredMonsters: [] });
      expect(screen.getByText('No monsters found')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search by name, type, or subtype...')).toBeInTheDocument();
    });
  });
});
