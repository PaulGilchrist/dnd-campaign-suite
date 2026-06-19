/* @improved-by-ai */
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

  it('should render correct number of monster rows', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Young Dragon')).toBeInTheDocument();
  });

  it('should show environment column with capitalized values', () => {
    render(<EncounterMonsterTable {...props} />);
    const cells = document.querySelectorAll('.monster-row .col-env');
    expect(cells.length).toBe(3);
    expect(cells[0].textContent).toContain('Forest');
    expect(cells[1].textContent).toContain('Hill');
  });

  it('should not show environment column or header when showEnvironment is false', () => {
    render(<EncounterMonsterTable {...props} showEnvironment={false} />);
    expect(screen.queryByText('Env')).not.toBeInTheDocument();
    const cells = document.querySelectorAll('.monster-row .col-env');
    expect(cells.length).toBe(0);
  });

  it('should show monster CR values', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByText('0.25')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should format XP with toLocaleString', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByText('5,900')).toBeInTheDocument();
  });

  it('should check checkbox for selected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    const checkboxes = document.querySelectorAll('.monster-checkbox');
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
  });

  it('should show qty controls for selected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrease quantity of Goblin')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase quantity of Goblin')).toBeInTheDocument();
  });

  it('should show em-dash for unselected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    const dashes = document.querySelectorAll('.qty-value');
    expect(dashes[1].textContent).toBe('\u2014');
  });

  it('should show remove button for selected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.getByLabelText('Remove Goblin')).toBeInTheDocument();
  });

  it('should not show remove button for unselected monsters', () => {
    render(<EncounterMonsterTable {...props} />);
    expect(screen.queryByLabelText('Remove Orc')).not.toBeInTheDocument();
  });

  it('should call onToggleMonster on row click', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByText('Orc').closest('tr'));
    expect(props.onToggleMonster).toHaveBeenCalledWith({ index: 'orc', name: 'Orc', challenge_rating: 0.5, xp: 100, type: 'humanoid', environments: ['hill', 'mountain'] });
  });

  it('should call onToggleMonster on checkbox click', () => {
    render(<EncounterMonsterTable {...props} />);
    const checkboxes = document.querySelectorAll('.monster-checkbox');
    fireEvent.click(checkboxes[1]);
    expect(props.onToggleMonster).toHaveBeenCalledWith({ index: 'orc', name: 'Orc', challenge_rating: 0.5, xp: 100, type: 'humanoid', environments: ['hill', 'mountain'] });
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

  it('should call onSort when sort headers clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByText('Monster').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('name');
  });

  it('should call onSort when CR sort header clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByText('CR').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('cr');
  });

  it('should call onSort when XP sort header clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByText('XP').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('xp');
  });

  it('should call onSort when Sel sort header clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByText('Sel').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('sel');
  });

  it('should call onSort when Env sort header clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    const envHeader = document.querySelector('th.col-env');
    expect(envHeader).toBeTruthy();
    fireEvent.click(envHeader);
    expect(props.onSort).toHaveBeenCalledWith('env');
  });

  it('should show asc sort indicator for active sort field', () => {
    render(<EncounterMonsterTable {...props} />);
    const nameHeader = screen.getByText('Monster').closest('th');
    expect(nameHeader.textContent).toContain('\u25B2');
  });

  it('should show desc sort indicator for active sort field', () => {
    render(<EncounterMonsterTable {...props} sortDirection="desc" />);
    const nameHeader = screen.getByText('Monster').closest('th');
    expect(nameHeader.textContent).toContain('\u25BC');
  });

  it('should not show sort indicator for inactive columns', () => {
    render(<EncounterMonsterTable {...props} />);
    const crHeader = screen.getByText('CR').closest('th');
    expect(crHeader.textContent).not.toContain('\u25B2');
    expect(crHeader.textContent).not.toContain('\u25BC');
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

  it('should handle empty string search query without errors', () => {
    render(<EncounterMonsterTable {...props} searchQuery="" />);
    expect(screen.getByPlaceholderText('Search by name, type, or subtype...')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('should add selected class to selected monster rows', () => {
    render(<EncounterMonsterTable {...props} />);
    const rows = document.querySelectorAll('.monster-row');
    expect(rows[0].classList.contains('monster-row-selected')).toBe(true);
    expect(rows[1].classList.contains('monster-row-selected')).toBe(false);
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
    expect(onViewDetails).toHaveBeenCalledWith({ index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, type: 'humanoid', environments: ['forest', 'underdark'] });
  });

  it('should not show details or remove buttons when monster is not selected', () => {
    render(<EncounterMonsterTable {...props} selectedMonsters={[]} />);
    expect(screen.queryByLabelText('Decrease quantity of Goblin')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Increase quantity of Goblin')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove Goblin')).not.toBeInTheDocument();
  });

  it('should capitalize environment entries with multiple values', () => {
    render(<EncounterMonsterTable {...props} />);
    const goblinEnvCell = document.querySelectorAll('.monster-row .col-env')[0];
    expect(goblinEnvCell.textContent).toContain('Forest');
    expect(goblinEnvCell.textContent).toContain('Underdark');
  });
});
