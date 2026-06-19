// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Factions from './Factions.jsx';

let factionsReturnValue = {
  factions: [],
  loading: false,
  loadFactionsList: vi.fn(),
  saveFactionsList: vi.fn(),
  deleteFactionAction: vi.fn(),
};

vi.mock('../../hooks/management/useFactionsManagement.js', () => ({
  default: () => factionsReturnValue,
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`faction-field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

describe('Factions', () => {
  const defaultProps = {
    campaignName: 'test-campaign',
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    factionsReturnValue = {
      factions: [],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    };
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    delete window.confirm;
  });

  it('should render header with back button and title', () => {
    render(<Factions {...defaultProps} />);
    expect(screen.getByText(/Back/)).toBeInTheDocument();
    expect(screen.getByText(/Factions/)).toBeInTheDocument();
  });

  it('should call onBack when back button clicked', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByText(/Back/));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('should render New Faction button', () => {
    render(<Factions {...defaultProps} />);
    expect(screen.getByRole('button', { name: /New Faction/ })).toBeInTheDocument();
  });

  it('should open modal when New Faction clicked', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
  });

  it('should show empty state when no factions', () => {
    render(<Factions {...defaultProps} />);
    expect(screen.getByText(/No factions yet/)).toBeInTheDocument();
  });

  it('should render search input', () => {
    render(<Factions {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Search factions/)).toBeInTheDocument();
  });

  it('should show clear search button when search has text', () => {
    render(<Factions {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search factions/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('should clear search when clear button clicked', () => {
    render(<Factions {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search factions/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(searchInput.value).toBe('');
  });

  it('should close modal when Cancel clicked', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
  });

  it('should close modal when X button clicked', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
  });

  it('should close modal when overlay clicked', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const overlay = document.querySelector('.ct-modal-overlay');
    fireEvent.click(overlay);
    expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
  });

  it('should not close modal when modal content clicked', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const modal = document.querySelector('.ct-modal');
    fireEvent.click(modal);
    expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
  });

  it('should disable save button when name is empty', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton.disabled).toBe(true);
  });

  it('should enable save button when name is filled', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const nameInput = screen.getByRole('textbox', { name: 'Faction Name *' });
    fireEvent.change(nameInput, { target: { value: 'Test Faction' } });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton.disabled).toBe(false);
  });

  it('should save a new faction when save button clicked with name', async () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const nameInput = screen.getByRole('textbox', { name: 'Faction Name *' });
    fireEvent.change(nameInput, { target: { value: 'The Silver Hand' } });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(factionsReturnValue.saveFactionsList).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
  });

  it('should update an existing faction when save button clicked in edit mode', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'Old Name',
        description: 'A noble faction',
        goals: 'Protect the realm',
        influence: 7,
        notes: '',
      }],
      saveFactionsList: vi.fn(),
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Old Name')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Old Name'));
    expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();

    const nameInput = screen.getByRole('textbox', { name: 'Faction Name *' });
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(factionsReturnValue.saveFactionsList).toHaveBeenCalledTimes(1);
    });
  });

  it('should delete a faction when delete button clicked and confirmed', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: 'Protect the realm',
        influence: 7,
        notes: '',
      }],
      deleteFactionAction: vi.fn().mockResolvedValue(undefined),
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));
    expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();

    const deleteButton = screen.getByRole('button', { name: /Delete/ });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(factionsReturnValue.deleteFactionAction).toHaveBeenCalledWith('faction-1');
    });
    expect(window.confirm).toHaveBeenCalledWith('Delete this faction?');
  });

  it('should not delete when user cancels confirmation dialog', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: 'Protect the realm',
        influence: 7,
        notes: '',
      }],
      deleteFactionAction: vi.fn(),
    };

    window.confirm = vi.fn(() => false);

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));
    const deleteButton = screen.getByRole('button', { name: /Delete/ });
    fireEvent.click(deleteButton);

    expect(factionsReturnValue.deleteFactionAction).not.toHaveBeenCalled();
  });

  it('should show influence badge', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: '',
        influence: 7,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Influence: 7')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      loading: true,
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Loading factions/)).toBeInTheDocument();
    });
  });

  it('should show edit modal when faction clicked', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: 'Protect the realm',
        influence: 7,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));

    expect(screen.getByText('Edit Faction')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
  });

  it('should show description preview in faction list', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction that protects the realm from evil forces',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/A noble faction that protects the realm/)).toBeInTheDocument();
    });
  });

  it('should filter factions by search query case-insensitively', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [
        {
          id: 'faction-1',
          name: 'The Silver Hand',
          description: 'A noble faction',
          goals: '',
          influence: 5,
          notes: '',
        },
      ],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search factions/);
    fireEvent.change(searchInput, { target: { value: 'silver' } });

    expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    expect(screen.queryByText(/No factions found matching/)).not.toBeInTheDocument();
  });

  it('should show no results message when search matches nothing', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search factions/);
    fireEvent.change(searchInput, { target: { value: 'dragons' } });

    expect(screen.getByText(/No factions found matching/)).toBeInTheDocument();
  });

  it('should render multiple factions in the list', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [
        {
          id: 'faction-1',
          name: 'The Silver Hand',
          description: 'A noble faction',
          goals: '',
          influence: 5,
          notes: '',
        },
        {
          id: 'faction-2',
          name: 'The Black Lotus',
          description: 'A shadowy organization',
          goals: '',
          influence: 8,
          notes: '',
        },
        {
          id: 'faction-3',
          name: 'Merchant Guild',
          description: 'Traders and merchants',
          goals: '',
          influence: 3,
          notes: '',
        },
      ],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    expect(screen.getByText('The Black Lotus')).toBeInTheDocument();
    expect(screen.getByText('Merchant Guild')).toBeInTheDocument();
  });

  it('should render influence slider in modal', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('10');
  });

  it('should render required asterisk for name field', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should show goals field in modal', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.getByText('Goals')).toBeInTheDocument();
  });

  it('should show notes field in modal', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('should show description field in modal', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('should show influence slider value display when changed', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const slider = screen.getByRole('slider', { name: 'Influence Level' });
    const valueSpan = screen.getByText(/^1$/);
    expect(valueSpan.textContent).toBe('1');
    fireEvent.change(slider, { target: { value: '5' } });
    expect(screen.getByText(/^5$/)).toBeInTheDocument();
  });

  it('should handle faction name with special characters', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: "The Order of the & Co.",
        description: 'A faction with special chars',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("The Order of the & Co.")).toBeInTheDocument();
    });
  });

  it('should handle very long faction names', async () => {
    const longName = 'A'.repeat(200);
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: longName,
        description: 'A faction with a very long name',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(longName)).toBeInTheDocument();
    });
  });

  it('should set influence to boundary value 1 for low influence', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'Weak Faction',
        description: '',
        goals: '',
        influence: 1,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Influence: 1')).toBeInTheDocument();
    });
  });

  it('should set influence to boundary value 10 for extreme influence', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'Powerful Faction',
        description: '',
        goals: '',
        influence: 10,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Influence: 10')).toBeInTheDocument();
    });
  });

  it('should show edit modal with existing faction data pre-filled', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: 'Protect the realm',
        influence: 7,
        notes: 'Important notes',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));
    expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();

    const nameInput = screen.getByRole('textbox', { name: 'Faction Name *' });
    expect(nameInput.value).toBe('The Silver Hand');
  });

  it('should show save button text as Saving when saving', async () => {
    let resolveSave;
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: '',
        influence: 5,
        notes: '',
      }],
      saveFactionsList: vi.fn(() => new Promise((resolve) => { resolveSave = resolve; })),
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));
    const nameInput = screen.getByRole('textbox', { name: 'Faction Name *' });
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    const saveButton = screen.getByRole('button', { name: /Save|Saving/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });

    resolveSave();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Faction' })).not.toBeInTheDocument();
    });
  });

  it('should show deleting state on delete button', async () => {
    let resolveDelete;
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: '',
        influence: 5,
        notes: '',
      }],
      deleteFactionAction: vi.fn(() => new Promise((resolve) => { resolveDelete = resolve; })),
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));
    const deleteButton = screen.getByRole('button', { name: /Delete/ });
    fireEvent.click(deleteButton);

    expect(screen.getByRole('button', { name: /Deleting/ })).toBeInTheDocument();

    resolveDelete();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Faction' })).not.toBeInTheDocument();
    });
  });

  it('should render New Faction button with plus icon', () => {
    render(<Factions {...defaultProps} />);
    const button = screen.getByRole('button', { name: /New Faction/ });
    expect(button.querySelector('i.fa-solid.fa-plus')).toBeInTheDocument();
  });

  it('should render back button with arrow icon', () => {
    render(<Factions {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Back/ });
    expect(button.querySelector('i.fa-solid.fa-arrow-left')).toBeInTheDocument();
  });

  it('should render handshake icon in title', () => {
    render(<Factions {...defaultProps} />);
    const title = screen.getByRole('heading', { name: /Factions/ });
    expect(title.querySelector('i.fa-solid.fa-handshake')).toBeInTheDocument();
  });

  it('should filter factions with partial match on first part of name', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [
        {
          id: 'faction-1',
          name: 'The Silver Hand',
          description: 'A noble faction',
          goals: '',
          influence: 5,
          notes: '',
        },
        {
          id: 'faction-2',
          name: 'The Silver Brotherhood',
          description: 'Another silver faction',
          goals: '',
          influence: 3,
          notes: '',
        },
      ],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search factions/);
    fireEvent.change(searchInput, { target: { value: 'sil' } });

    expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    expect(screen.getByText('The Silver Brotherhood')).toBeInTheDocument();
  });

  it('should show no factions found message with the search query text', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search factions/);
    fireEvent.change(searchInput, { target: { value: 'dragons' } });

    expect(screen.getByText(/No factions found matching.*dragons/)).toBeInTheDocument();
  });
});
