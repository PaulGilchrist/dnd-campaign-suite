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

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => ({
    items: factionsReturnValue.factions,
    loading: factionsReturnValue.loading,
    loadItems: factionsReturnValue.loadFactionsList,
    saveItems: factionsReturnValue.saveFactionsList,
    deleteItem: factionsReturnValue.deleteFactionAction,
  }),
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

  it('should have influence slider defaulting to 1', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const slider = screen.getByRole('slider');
    expect(slider.value).toBe('1');
  });

  it('should show influence slider value display when changed', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    const slider = screen.getByRole('slider', { name: 'Influence Level' });
    expect(screen.getByText(/^1$/)).toBeInTheDocument();
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

  it('should show modal fields (description, goals, notes) in new faction modal', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Influence Level')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Faction name')).toBeInTheDocument();
  });

  it('should update fields via PreviewToggle onChange', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));

    const descriptionField = screen.getByTestId('faction-field-faction-description');
    fireEvent.change(descriptionField, { target: { value: 'A new description' } });
    expect(screen.getByTestId('preview-toggle-faction-description')).toHaveTextContent('A new description');

    const goalsField = screen.getByTestId('faction-field-faction-goals');
    fireEvent.change(goalsField, { target: { value: 'Conquer the realm' } });
    expect(screen.getByTestId('preview-toggle-faction-goals')).toHaveTextContent('Conquer the realm');

    const notesField = screen.getByTestId('faction-field-faction-notes');
    fireEvent.change(notesField, { target: { value: 'Secret notes' } });
    expect(screen.getByTestId('preview-toggle-faction-notes')).toHaveTextContent('Secret notes');
  });

  it('should save faction with all fields populated', async () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));

    const nameInput = screen.getByRole('textbox', { name: 'Faction Name *' });
    fireEvent.change(nameInput, { target: { value: 'The Silver Hand' } });

    const descriptionField = screen.getByTestId('faction-field-faction-description');
    fireEvent.change(descriptionField, { target: { value: 'A noble order' } });

    const goalsField = screen.getByTestId('faction-field-faction-goals');
    fireEvent.change(goalsField, { target: { value: 'Protect the innocent' } });

    const notesField = screen.getByTestId('faction-field-faction-notes');
    fireEvent.change(notesField, { target: { value: 'Important info' } });

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '7' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(factionsReturnValue.saveFactionsList).toHaveBeenCalledTimes(1);
    });

    const savedData = factionsReturnValue.saveFactionsList.mock.calls[0][0];
    expect(savedData[0].name).toBe('The Silver Hand');
    expect(savedData[0].description).toBe('A noble order');
    expect(savedData[0].goals).toBe('Protect the innocent');
    expect(savedData[0].notes).toBe('Important info');
    expect(savedData[0].influence).toBe(7);
  });

  it('should not save when name is empty string', async () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(factionsReturnValue.saveFactionsList).not.toHaveBeenCalled();
    });
    expect(screen.queryByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
  });

  it('should show delete button only in edit mode, not new mode', () => {
    render(<Factions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('should not show delete button when no editing faction', () => {
    render(<Factions {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('should handle faction without influence field gracefully', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'Mysterious Group',
        description: 'Unknown origins',
        goals: '',
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Mysterious Group')).toBeInTheDocument();
    });

    expect(screen.queryByTitle(/Influence:/)).not.toBeInTheDocument();
  });

  it('should render cancel button disabled when saving', async () => {
    let resolveSave;
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: '',
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
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton.disabled).toBe(true);
    });

    resolveSave();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Faction' })).not.toBeInTheDocument();
    });
  });

  it('should open edit modal when faction list item is activated with Enter key', async () => {
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

    const listItem = screen.getByRole('button', { name: /Edit faction: The Silver Hand/ });
    fireEvent.keyDown(listItem, { key: 'Enter' });

    expect(screen.getByText('Edit Faction')).toBeInTheDocument();
  });

  it('should open edit modal when faction list item is activated with Space key', async () => {
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

    const listItem = screen.getByRole('button', { name: /Edit faction: The Silver Hand/ });
    fireEvent.keyDown(listItem, { key: ' ' });

    expect(screen.getByText('Edit Faction')).toBeInTheDocument();
  });

  it('should not load factions when campaignName is empty', () => {
    render(<Factions campaignName="" onBack={vi.fn()} />);
    expect(factionsReturnValue.loadFactionsList).not.toHaveBeenCalled();
  });

  it('should truncate description longer than 60 characters', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Long Description',
        description: 'This is a very long description that exceeds sixty characters',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Long Description')).toBeInTheDocument();
    });

    const preview = screen.getByText(/This is a very long description that exceeds sixty character…/);
    expect(preview.textContent).toContain('…');
  });

  it('should not truncate description shorter than 60 characters', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'Short Description',
        description: 'Short',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Short Description')).toBeInTheDocument();
    });

    expect(screen.getByText('Short')).toBeInTheDocument();
  });

  it('should not show description preview when description is empty', async () => {
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'No Description',
        description: '',
        goals: '',
        influence: 5,
        notes: '',
      }],
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Description')).toBeInTheDocument();
    });

    const listDetails = document.querySelector('.ct-list-details');
    expect(listDetails.children.length).toBe(0);
  });

  it('should handle save error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: '',
        goals: '',
        influence: 5,
        notes: '',
      }],
      saveFactionsList: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));
    const nameInput = screen.getByRole('textbox', { name: 'Faction Name *' });
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save faction:', expect.any(Error));
    });

    expect(screen.queryByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('should handle delete error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    factionsReturnValue = {
      ...factionsReturnValue,
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: '',
        goals: '',
        influence: 5,
        notes: '',
      }],
      deleteFactionAction: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));
    const deleteButton = screen.getByRole('button', { name: /Delete/ });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete faction:', expect.any(Error));
    });

    expect(screen.queryByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
