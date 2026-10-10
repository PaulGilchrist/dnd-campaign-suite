// @improved-by-ai
// @cleaned-by-ai
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
  describe('search', () => {
    it('renders a search input bound to the searchQuery prop', () => {
      renderTable({ searchQuery: 'gob' });
      const input = screen.getByPlaceholderText('Search by name, type, or subtype...');
      expect(input).toHaveValue('gob');
      expect(input).toHaveAttribute('aria-label', 'Search monsters');
    });

    it('calls onSearchQueryChange with the typed value', () => {
      const { props } = renderTable();
      fireEvent.change(screen.getByPlaceholderText('Search by name, type, or subtype...'), {
        target: { value: 'gob' },
      });
      expect(props.onSearchQueryChange).toHaveBeenCalledWith('gob');
    });
  });

  describe('filter row', () => {
    it('renders the type filter with options and the selected type', () => {
      renderTable({ typeFilter: 'dragon' });
      const select = screen.getByLabelText('Type');
      expect(select).toHaveValue('dragon');
      expect(screen.getByRole('option', { name: 'All Types' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Dragon' })).toBeInTheDocument();
    });

    it('calls onTypeChange when the type filter changes', () => {
      const { props } = renderTable();
      fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'dragon' } });
      expect(props.onTypeChange).toHaveBeenCalledWith('dragon');
    });

    it('renders the size filter with options and the selected size', () => {
      renderTable({ sizeFilter: 'large' });
      const select = screen.getByLabelText('Size');
      expect(select).toHaveValue('large');
      expect(screen.getByRole('option', { name: 'All Sizes' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Large' })).toBeInTheDocument();
    });

    it('calls onSizeChange when the size filter changes', () => {
      const { props } = renderTable();
      fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'huge' } });
      expect(props.onSizeChange).toHaveBeenCalledWith('huge');
    });

    it('binds the CR min/max inputs to their props', () => {
      renderTable({ crMin: 2, crMax: 4 });
      expect(screen.getByLabelText('Minimum challenge rating')).toHaveValue(2);
      expect(screen.getByLabelText('Maximum challenge rating')).toHaveValue(4);
    });

    it('leaves the CR inputs empty when crMin/crMax are undefined', () => {
      renderTable();
      expect(screen.getByLabelText('Minimum challenge rating')).toHaveValue(null);
      expect(screen.getByLabelText('Maximum challenge rating')).toHaveValue(null);
    });

    it('calls onCRMinChange when the minimum CR input changes', () => {
      const { props } = renderTable();
      fireEvent.change(screen.getByLabelText('Minimum challenge rating'), { target: { value: '1' } });
      expect(props.onCRMinChange).toHaveBeenCalledWith('1');
    });

    it('calls onCRMaxChange when the maximum CR input changes', () => {
      const { props } = renderTable();
      fireEvent.change(screen.getByLabelText('Maximum challenge rating'), { target: { value: '5' } });
      expect(props.onCRMaxChange).toHaveBeenCalledWith('5');
    });
  });

  describe('table headers', () => {
    it('renders all column headers', () => {
      renderTable();
      for (const header of ['Sel', 'Monster', 'CR', 'XP', 'Env', 'Qty', 'Details', 'Remove']) {
        expect(screen.getByText(header)).toBeInTheDocument();
      }
    });

    it('hides the environment column when showEnvironment is false', () => {
      renderTable({ showEnvironment: false });
      expect(screen.queryByText('Env')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sort by environment' })).not.toBeInTheDocument();
      expect(screen.queryByText('Forest, Underdark')).not.toBeInTheDocument();
    });
  });

  describe('monster rows', () => {
    it('renders each monster with name, CR, and localized XP', () => {
      renderTable();
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(sampleMonsters.length + 1);
      expect(rows[1]).toHaveTextContent('Goblin');
      expect(rows[1]).toHaveTextContent('0.25');
      expect(rows[1]).toHaveTextContent('50');
      expect(rows[2]).toHaveTextContent('Orc');
      expect(rows[2]).toHaveTextContent('0.5');
      expect(rows[2]).toHaveTextContent('100');
      expect(rows[3]).toHaveTextContent('Young Dragon');
      expect(rows[3]).toHaveTextContent('10');
      expect(rows[3]).toHaveTextContent('5,900');
    });

    it('capitalizes and joins environment values in the environment column', () => {
      renderTable();
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Forest, Underdark');
      expect(rows[2]).toHaveTextContent('Hill, Mountain');
    });

    it('renders an empty environment cell for monsters without environments', () => {
      const monsterWithoutEnvs = {
        index: 'shoggoth',
        name: 'Shoggoth',
        challenge_rating: 1,
        xp: 200,
        type: 'aberration',
      };
      renderTable({ filteredMonsters: [monsterWithoutEnvs], selectedMonsters: [] });
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(2);
      expect(rows[1]).toHaveTextContent('Shoggoth');
      expect(rows[1].querySelector('.col-env').textContent).toBe('');
    });

    it('checks the checkbox and marks the row for selected monsters', () => {
      renderTable();
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(sampleMonsters.length);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveClass('monster-row-selected');
      expect(rows[2]).not.toHaveClass('monster-row-selected');
    });

    it('treats a selected monster with qty 0 as checked but without qty controls', () => {
      renderTable({ selectedMonsters: [{ index: 'goblin', qty: 0 }] });
      expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).toBeChecked();
      expect(screen.queryByLabelText('Remove Goblin')).not.toBeInTheDocument();
      expect(screen.getAllByText('\u2014')).toHaveLength(3);
    });
  });

  describe('quantity and remove controls', () => {
    it('shows qty controls and remove button only for selected monsters', () => {
      renderTable();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease quantity of Goblin')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase quantity of Goblin')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove Goblin')).toBeInTheDocument();
      expect(screen.queryByLabelText('Decrease quantity of Orc')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Remove Orc')).not.toBeInTheDocument();
    });

    it('hides qty controls and remove buttons when no monsters are selected', () => {
      renderTable({ selectedMonsters: [] });
      expect(screen.queryByLabelText('Decrease quantity of Goblin')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Increase quantity of Goblin')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Remove Goblin')).not.toBeInTheDocument();
      expect(screen.getAllByText('\u2014')).toHaveLength(3);
    });

    it('calls onDecreaseQty with the monster index', () => {
      const { props } = renderTable();
      fireEvent.click(screen.getByLabelText('Decrease quantity of Goblin'));
      expect(props.onDecreaseQty).toHaveBeenCalledWith('goblin');
    });

    it('calls onIncreaseQty with the monster index', () => {
      const { props } = renderTable();
      fireEvent.click(screen.getByLabelText('Increase quantity of Goblin'));
      expect(props.onIncreaseQty).toHaveBeenCalledWith('goblin');
    });

    it('calls onRemoveMonster with the monster index', () => {
      const { props } = renderTable();
      fireEvent.click(screen.getByLabelText('Remove Goblin'));
      expect(props.onRemoveMonster).toHaveBeenCalledWith('goblin');
    });
  });

  describe('per-row qty testids', () => {
    it('stamps every rendered monster row qty cell with a unique qty-<rowIndex> testid', () => {
      renderTable();
      const cells = document.querySelectorAll('[data-testid^="qty-"]');
      expect(cells).toHaveLength(sampleMonsters.length);
      sampleMonsters.forEach((_monster, rowIndex) => {
        const cell = document.querySelectorAll(`[data-testid="qty-${rowIndex}"]`);
        expect(cell).toHaveLength(1);
        expect(cell[0]).toHaveClass('col-qty');
      });
    });

    it('does not collide with the CR min/max numeric filter inputs', () => {
      renderTable({ crMin: 1, crMax: 5 });
      expect(document.querySelectorAll('[data-testid^="qty-"] input[type="number"]')).toHaveLength(0);
      const crInputs = document.querySelectorAll('input[type="number"]');
      for (const input of crInputs) {
        expect(input.closest('[data-testid^="qty-"]')).toBeNull();
      }
      expect(document.querySelector('[data-testid="qty-0"]')).toBe(
        document.querySelectorAll('td.col-qty')[0]
      );
    });

    it('exposes the row qty and its controls scoped to the qty-<rowIndex> cell', () => {
      renderTable();
      const goblinCell = document.querySelector('[data-testid="qty-0"]');
      expect(goblinCell).toHaveTextContent('2');
      fireEvent.click(goblinCell.querySelector('[aria-label="Increase quantity of Goblin"]'));
      fireEvent.click(goblinCell.querySelector('[aria-label="Decrease quantity of Goblin"]'));
    });

    it('keeps qty testids unique when the filtered list changes', () => {
      renderTable({ filteredMonsters: [sampleMonsters[2]] });
      expect(document.querySelectorAll('[data-testid^="qty-"]')).toHaveLength(1);
      expect(document.querySelector('[data-testid="qty-0"]')).toHaveTextContent('\u2014');
      expect(document.querySelector('[data-testid="qty-1"]')).toBeNull();
    });
  });

  describe('selection toggling', () => {
    it('calls onToggleMonster exactly once when the checkbox is clicked', () => {
      const { props } = renderTable();
      fireEvent.click(screen.getAllByRole('checkbox')[1]);
      expect(props.onToggleMonster).toHaveBeenCalledTimes(1);
      expect(props.onToggleMonster).toHaveBeenCalledWith(sampleMonsters[1]);
    });

    it('calls onToggleMonster with the monster when its row is clicked', () => {
      const { props } = renderTable();
      fireEvent.click(screen.getAllByRole('row')[2]);
      expect(props.onToggleMonster).toHaveBeenCalledTimes(1);
      expect(props.onToggleMonster).toHaveBeenCalledWith(sampleMonsters[1]);
    });

    it('does not toggle selection when qty, remove, or details controls are clicked', () => {
      const { props } = renderTable();
      fireEvent.click(screen.getByLabelText('Decrease quantity of Goblin'));
      fireEvent.click(screen.getByLabelText('Increase quantity of Goblin'));
      fireEvent.click(screen.getByLabelText('Remove Goblin'));
      fireEvent.click(screen.getByLabelText('View details for Goblin'));
      expect(props.onToggleMonster).not.toHaveBeenCalled();
    });
  });

  describe('details button', () => {
    it('renders a details button for every monster even without onViewDetails', () => {
      renderTable();
      for (const monster of sampleMonsters) {
        expect(screen.getByLabelText(`View details for ${monster.name}`)).toBeInTheDocument();
      }
    });

    it('calls onViewDetails with the monster when the details button is clicked', () => {
      const onViewDetails = vi.fn();
      renderTable({ onViewDetails });
      fireEvent.click(screen.getByLabelText('View details for Goblin'));
      expect(onViewDetails).toHaveBeenCalledWith(sampleMonsters[0]);
    });
  });

  describe('sorting', () => {
    it('calls onSort with the column key when sortable headers are clicked', () => {
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

    it('shows sort indicators matching the active sort field and direction', () => {
      const { props, rerender } = renderTable();
      const nameHeader = () => screen.getByRole('button', { name: 'Sort by monster name' });
      expect(nameHeader()).toHaveTextContent('\u25B2');

      rerender(<EncounterMonsterTable {...props} sortDirection="desc" />);
      expect(nameHeader()).toHaveTextContent('\u25BC');

      rerender(<EncounterMonsterTable {...props} sortField="cr" />);
      expect(nameHeader()).not.toHaveTextContent('\u25B2');
      expect(nameHeader()).not.toHaveTextContent('\u25BC');
      expect(screen.getByRole('button', { name: 'Sort by challenge rating' })).toHaveTextContent('\u25B2');

      rerender(<EncounterMonsterTable {...props} sortField="env" />);
      expect(screen.getByRole('button', { name: 'Sort by environment' })).toHaveTextContent('\u25B2');
    });
  });

  describe('empty state', () => {
    it('shows an empty state instead of the table when there are no monsters', () => {
      renderTable({ filteredMonsters: [] });
      expect(screen.getByText('No monsters found')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search by name, type, or subtype...')).toBeInTheDocument();
    });
  });
});
