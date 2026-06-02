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

  it('should not show environment column when showEnvironment is false', () => {
    render(<EncounterMonsterTable {...props} showEnvironment={false} />);
    const cells = document.querySelectorAll('.monster-row .col-env');
    expect(cells.length).toBe(0);
     });

  it('should not show environment column when showEnvironment is false', () => {
    render(<EncounterMonsterTable {...props} showEnvironment={false} />);
    const rows = document.querySelectorAll('.monster-row .col-env');
    expect(rows.length).toBe(0);
     });

  it('should not show environment column when showEnvironment is false', () => {
    render(<EncounterMonsterTable {...props} showEnvironment={false} />);
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
    expect(props.onToggleMonster).toHaveBeenCalledWith(sampleMonsters[1]);
  });

  it('should call onToggleMonster on checkbox click', () => {
    render(<EncounterMonsterTable {...props} />);
    const checkboxes = document.querySelectorAll('.monster-checkbox');
    fireEvent.click(checkboxes[1]);
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

  it('should call onSort when sort headers clicked', () => {
    render(<EncounterMonsterTable {...props} />);
    fireEvent.click(screen.getByText('Monster').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('name');
    fireEvent.click(screen.getByText('CR').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('cr');
    fireEvent.click(screen.getByText('XP').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('xp');
    fireEvent.click(screen.getByText('Sel').closest('th'));
    expect(props.onSort).toHaveBeenCalledWith('sel');
    const envHeader = document.querySelector('th.col-env');
    if (envHeader) {
      fireEvent.click(envHeader);
      expect(props.onSort).toHaveBeenCalledWith('env');
    }
    });

  it('should show sort indicator for active sort field', () => {
    render(<EncounterMonsterTable {...props} />);
    const nameHeader = screen.getByText('Monster').closest('th');
    expect(nameHeader.textContent).toContain('\u25B2');
  });

  it('should not show sort indicator for inactive columns', () => {
    render(<EncounterMonsterTable {...props} />);
    const crHeader = screen.getByText('CR').closest('th');
    expect(crHeader.textContent).not.toContain('\u25B2');
    expect(crHeader.textContent).not.toContain('\u25BC');
  });

  it('should show desc sort indicator', () => {
    render(<EncounterMonsterTable {...props} sortDirection="description" />);
    const nameHeader = screen.getByText('Monster').closest('th');
    expect(nameHeader.textContent).toContain('\u25BC');
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

  it('should add selected class to selected monster rows', () => {
    render(<EncounterMonsterTable {...props} />);
    const rows = document.querySelectorAll('.monster-row');
    expect(rows[0].classList.contains('monster-row-selected')).toBe(true);
    expect(rows[1].classList.contains('monster-row-selected')).toBe(false);
  });
});
