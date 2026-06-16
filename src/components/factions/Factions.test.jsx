import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Factions from './Factions.jsx';

vi.mock('../../hooks/management/useFactionsManagement.js', () => ({
  default: () => ({
    factions: [],
    loading: false,
    loadFactionsList: vi.fn(),
    saveFactionsList: vi.fn(),
    deleteFactionAction: vi.fn(),
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
    window.confirm = vi.fn(() => true);
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
    const buttons = screen.getAllByText(/New Faction/);
    expect(buttons[0].tagName).toBe('BUTTON');
  });

  it('should open modal when New Faction clicked', () => {
    render(<Factions {...defaultProps} />);
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
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
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
    expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
  });

  it('should close modal when X button clicked', () => {
    render(<Factions {...defaultProps} />);
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
  });

  it('should close modal when overlay clicked', () => {
    render(<Factions {...defaultProps} />);
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
    const overlay = document.querySelector('.ct-modal-overlay');
    fireEvent.click(overlay);
    expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
  });

  it('should not close modal when modal content clicked', () => {
    render(<Factions {...defaultProps} />);
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
    const modal = document.querySelector('.ct-modal');
    fireEvent.click(modal);
    expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
  });

  it('should disable save button when name is empty', () => {
    render(<Factions {...defaultProps} />);
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton.disabled).toBe(true);
  });

  it('should render faction name in list', async () => {
    const factionsManagement = await import('../../hooks/management/useFactionsManagement.js');

    vi.mocked(factionsManagement).default = () => ({
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: 'Protect the realm',
        influence: 7,
        notes: '',
      }],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    });

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });
  });

  it('should show influence badge', async () => {
    const factionsManagement = await import('../../hooks/management/useFactionsManagement.js');

    vi.mocked(factionsManagement).default = () => ({
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: '',
        influence: 7,
        notes: '',
      }],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    });

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Influence: 7')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    const factionsManagement = await import('../../hooks/management/useFactionsManagement.js');

    vi.mocked(factionsManagement).default = () => ({
      factions: [],
      loading: true,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    });

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Loading factions/)).toBeInTheDocument();
    });
  });

  it('should show edit modal when faction clicked', async () => {
    const factionsManagement = await import('../../hooks/management/useFactionsManagement.js');

    vi.mocked(factionsManagement).default = () => ({
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: 'Protect the realm',
        influence: 7,
        notes: '',
      }],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    });

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Silver Hand'));

    expect(screen.getByText('Edit Faction')).toBeInTheDocument();
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('should show description preview in faction list', async () => {
    const factionsManagement = await import('../../hooks/management/useFactionsManagement.js');

    vi.mocked(factionsManagement).default = () => ({
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction that protects the realm from evil forces',
        goals: '',
        influence: 5,
        notes: '',
      }],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    });

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/A noble faction that protects the realm/)).toBeInTheDocument();
    });
  });

  it('should show search no results message', async () => {
    const factionsManagement = await import('../../hooks/management/useFactionsManagement.js');

    vi.mocked(factionsManagement).default = () => ({
      factions: [{
        id: 'faction-1',
        name: 'The Silver Hand',
        description: 'A noble faction',
        goals: '',
        influence: 5,
        notes: '',
      }],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    });

    render(<Factions {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search factions/);
    fireEvent.change(searchInput, { target: { value: 'dragons' } });

    expect(screen.getByText(/No factions found matching/)).toBeInTheDocument();
  });

  it('should render influence slider in modal', () => {
    render(<Factions {...defaultProps} />);
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('10');
  });

  it('should render required asterisk for name field', () => {
    render(<Factions {...defaultProps} />);
    const buttons = screen.getAllByText(/New Faction/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
