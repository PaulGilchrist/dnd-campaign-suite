/* @cleaned-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterMonsterTable from './EncounterMonsterTable.jsx';

const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, type: 'humanoid', environments: ['forest', 'underdark'] },
  { index: 'orc', name: 'Orc', challenge_rating: 0.5, xp: 100, type: 'humanoid', environments: ['hill', 'mountain'] },
  { index: 'dragon', name: 'Young Dragon', challenge_rating: 10, xp: 5900, type: 'dragon', environments: ['underground'] },
];

describe('EncounterMonsterTable', () => {
  let props;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
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
    };
  });

  it('should render search input with placeholder', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByPlaceholderText('Search by name, type, or subtype...')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByText('Sel')).toBeInTheDocument();
    expect(screen.getByText('Monster')).toBeInTheDocument();
    expect(screen.getByText('CR')).toBeInTheDocument();
    expect(screen.getByText('XP')).toBeInTheDocument();
    expect(screen.getByText('Env')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
  });

  it('should not show environment column or header when showEnvironment is false', () => {
    render(<EncounterMonsterTable {...props} showEnvironment={false} />);
    expect(screen.queryByText('Env')).not.toBeInTheDocument();
    const cells = document.querySelectorAll('.monster-row .col-env');
    expect(cells.length).toBe(0);
  });

  it('should render correct number of monster rows with data', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Young Dragon')).toBeInTheDocument();
    expect(screen.getByText('0.25')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5,900')).toBeInTheDocument();
  });

  it('should show environment column with capitalized values', () => {
    render(<EncounterMonsterTable {...props} />);
    const envCell = document.querySelector('.monster-row .col-env');
    expect(envCell.textContent).toContain('Forest');
    expect(envCell.textContent).toContain('Underdark');
  });

  it('should check checkbox and apply selected class for selected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    const checkboxes = document.querySelectorAll('.monster-checkbox');
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    const rows = document.querySelectorAll('.monster-row');
    expect(rows[0].classList.contains('monster-row-selected')).toBe(true);
    expect(rows[1].classList.contains('monster-row-selected')).toBe(false);
  });

  it('should show qty controls and remove button for selected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrease quantity of Goblin')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase quantity of Goblin')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Goblin')).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove Orc')).not.toBeInTheDocument();
  });

  it('should show em-dash for unselected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    const qtyValues = document.querySelectorAll('.qty-value');
    const unselectedDashes = Array.from(qtyValues).filter(el => el.textContent === '\u2014');
    expect(unselectedDashes.length).toBe(2);
  });

  it('should not show qty or remove controls when no monsters are selected', () => {
    render(<EncounterMonsterTable {...props} selectedMonsters={[]} />);
    expect(screen.queryByLabelText('Decrease quantity of Goblin')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Increase quantity of Goblin')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove Goblin')).not.toBeInTheDocument();
  });

  it('should render details button for each monster', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByLabelText('View details for Goblin')).toBeInTheDocument();
    expect(screen.getByLabelText('View details for Orc')).toBeInTheDocument();
    expect(screen.getByLabelText('View details for Young Dragon')).toBeInTheDocument();
  });

  it('should pass monster to onViewDetails when details button clicked', () => {
    const onViewDetails = vi.fn();
    render(<EncounterMonsterTable {...props} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByLabelText('View details for Goblin'));
    expect(onViewDetails).toHaveBeenCalledWith(sampleMonsters[0]);
  });

  it('should call onToggleMonster when row or checkbox is clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    const checkboxes = document.querySelectorAll('.monster-checkbox');
    fireEvent.click(checkboxes[1]);
    expect(props.onToggleMonster).toHaveBeenCalledWith(sampleMonsters[1]);

    props.onToggleMonster.mockClear();
    fireEvent.click(screen.getByText('Orc').closest('tr'));
    expect(props.onToggleMonster).toHaveBeenCalledWith(sampleMonsters[1]);
  });

  it('should call onDecreaseQty when minus button clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByLabelText('Decrease quantity of Goblin'));
    expect(props.onDecreaseQty).toHaveBeenCalledWith('goblin');
  });

  it('should call onIncreaseQty when plus button clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByLabelText('Increase quantity of Goblin'));
    expect(props.onIncreaseQty).toHaveBeenCalledWith('goblin');
  });

  it('should call onRemoveMonster when remove button clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByLabelText('Remove Goblin'));
    expect(props.onRemoveMonster).toHaveBeenCalledWith('goblin');
  });

  it('should call onSort with correct key when sort headers clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByText('Sel').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('sel');
    props.onSort.mockClear();

    fireEvent.click(screen.getByText('Monster').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('name');
    props.onSort.mockClear();

    fireEvent.click(screen.getByText('CR').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('cr');
    props.onSort.mockClear();

    fireEvent.click(screen.getByText('XP').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('xp');
    props.onSort.mockClear();

    const envHeader = document.querySelector('th.col-env');
    if (envHeader) {
      fireEvent.click(envHeader);
      expect(props.onSort).toHaveBeenCalledWith('env');
    }
  });

  it('should show sort indicators based on active sort field and direction', () => {
    const { rerender } = render(<EncounterMonsterTable {...props} />);
    const nameHeader = screen.getByText('Monster').closest('th');
    expect(nameHeader.textContent).toContain('\u25B2');

    rerender(<EncounterMonsterTable {...props} sortDirection="desc" />);
    expect(nameHeader.textContent).toContain('\u25BC');

    rerender(<EncounterMonsterTable {...props} sortField="cr" />);
    expect(nameHeader.textContent).not.toContain('\u25B2');
    expect(nameHeader.textContent).not.toContain('\u25BC');
  });

  it('should call onSearchQueryChange on search input change', () => {
    render(<EncounterMonsterTable {...props} />);
    const input = screen.getByPlaceholderText('Search by name, type, or subtype...');
    fireEvent.change(input, { target: { value: 'gob' } });
    expect(props.onSearchQueryChange).toHaveBeenCalledWith('gob');
  });

  it('should show empty state when no monsters', () => {
    render(<EncounterMonsterTable {...props} filteredMonsters={[]} />);
    expect(screen.getByText('No monsters found')).toBeInTheDocument();
  });
});
