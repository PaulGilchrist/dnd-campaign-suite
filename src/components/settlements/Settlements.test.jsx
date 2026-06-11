import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Settlements from './Settlements.jsx';

let mockSettlementsFactory = () => ({
  settlements: [],
  loading: false,
  saveSettlementAction: vi.fn(),
  deleteSettlementAction: vi.fn(),
});

vi.mock('../../hooks/useSettlementsManagement.js', () => ({
  __esModule: true,
  default: (...args) => mockSettlementsFactory(...args),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      {label && <label>{label}</label>}
      <textarea
        data-testid={`settlement-field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

vi.mock('../../services/campaign/settlementGenerator.js', () => ({
  generateSettlement: vi.fn(),
}));

describe('Settlements', () => {
  const defaultProps = {
    campaignName: 'test-campaign',
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    // Suppress the unhandled fetch rejection from the component's useEffect
    // that loads /data/settlement-descriptions.json (not relevant to tests).
    window.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({}) })
    );
    mockSettlementsFactory = () => ({
      settlements: [],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });
  });

  // ── Header and navigation ──

  it('should render header with back button and title', () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByText(/Back/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settlements' })).toBeInTheDocument();
  });

  it('should call onBack when back button clicked', () => {
    render(<Settlements {...defaultProps} />);
    fireEvent.click(screen.getByText(/Back/));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  // ── New Settlement button and modal ──

  it('should render New Settlement button', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    expect(buttons[0].tagName).toBe('BUTTON');
  });

  it('should open modal when New Settlement clicked', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
  });

  it('should close modal when Cancel clicked', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(
      screen.queryByRole('heading', { name: 'New Settlement' })
    ).not.toBeInTheDocument();
  });

  it('should close modal when X button clicked', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(
      screen.queryByRole('heading', { name: 'New Settlement' })
    ).not.toBeInTheDocument();
  });

  it('should disable save button when name is empty', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton.disabled).toBe(true);
  });

  it('should enable save button when name has text', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const nameInput = screen.getByLabelText('Name *');
    fireEvent.change(nameInput, { target: { value: 'Whiteridge' } });
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton.disabled).toBe(false);
  });

  it('should render required asterisk for name field', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  // ── Generate Settlement button ──

  it('should render Generate Settlement button', () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByText(/Generate Settlement/)).toBeInTheDocument();
  });

  it('should open modal with generated data when Generate Settlement clicked', async () => {
    const settlementGenerator = await import('../../services/campaign/settlementGenerator.js');

    vi.mocked(settlementGenerator.generateSettlement).mockResolvedValue({
      name: 'Generated Town',
      size: 'town',
      description: 'A generated town.',
      atmosphere: '',
      government: '',
      population: '',
      services: [],
      notableNPCs: [],
      rumors: [],
      tags: '',
      notes: '',
      threat: '',
    });

    render(<Settlements {...defaultProps} />);
    fireEvent.click(screen.getByText(/Generate Settlement/));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    });

    expect(settlementGenerator.generateSettlement).toHaveBeenCalled();
  });

  it('should show generating state on button while generating', async () => {
    const settlementGenerator = await import('../../services/campaign/settlementGenerator.js');

    let resolvePromise;
    vi.mocked(settlementGenerator.generateSettlement).mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<Settlements {...defaultProps} />);
    fireEvent.click(screen.getByText(/Generate Settlement/));

    expect(screen.getByText(/Generating…/)).toBeInTheDocument();
    resolvePromise({ name: 'Test', size: 'village' });
  });

  // ── Empty states ──

  it('should show empty state when no settlements', () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByText(/No settlements yet/)).toBeInTheDocument();
  });

  it('should show loading state', async () => {
    mockSettlementsFactory = () => ({
      settlements: [],
      loading: true,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Loading settlements/)).toBeInTheDocument();
    });
  });

  // ── Search functionality ──

  it('should render search input', () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Search settlements/)).toBeInTheDocument();
  });

  it('should show clear search button when search has text', () => {
    render(<Settlements {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search settlements/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('should clear search when clear button clicked', () => {
    render(<Settlements {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search settlements/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(searchInput.value).toBe('');
  });

  // ── Size filter buttons ──

  it('should render size filter buttons', () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByTitle('Filter: Village')).toBeInTheDocument();
    expect(screen.getByTitle('Filter: Town')).toBeInTheDocument();
    expect(screen.getByTitle('Filter: City')).toBeInTheDocument();
    expect(screen.getByTitle('Filter: Metropolis')).toBeInTheDocument();
  });

  it('should apply size filter when button clicked', () => {
    render(<Settlements {...defaultProps} />);
    const villageBtn = screen.getByTitle('Filter: Village');
    fireEvent.click(villageBtn);
    expect(villageBtn.className).toContain('settlements-size-btn-active');
  });

  it('should remove size filter when active button clicked again', () => {
    render(<Settlements {...defaultProps} />);
    const villageBtn = screen.getByTitle('Filter: Village');
    fireEvent.click(villageBtn);
    expect(villageBtn.className).toContain('settlements-size-btn-active');
    fireEvent.click(villageBtn);
    expect(villageBtn.className).not.toContain('settlements-size-btn-active');
  });

  // ── Settlement list rendering ──

  it('should render settlement name in list', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });
  });

  it('should render size badge for settlement', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'city',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('city')).toBeInTheDocument();
    });
  });

  it('should render population in list', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '2,500 souls',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('2,500 souls')).toBeInTheDocument();
    });
  });

  it('should render tags in list', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: 'coastal, trade-hub',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('coastal, trade-hub')).toBeInTheDocument();
    });
  });

  it('should render service count in list', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [
          { type: 'inn', name: 'The Golden Stag' },
          { type: 'tavern', name: 'The Rusty Anchor' },
        ],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('2 services')).toBeInTheDocument();
    });
  });

  it('should render singular service count in list', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [{ type: 'inn', name: 'The Golden Stag' }],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('1 service')).toBeInTheDocument();
    });
  });

  it('should truncate long descriptions in list', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: 'A very long description that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      const preview = screen.getByText(/A very long description/);
      expect(preview.textContent.length).toBeLessThan(130);
    });
  });

  it('should not show description when empty', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const previewElements = document.querySelectorAll('.settlements-list-preview');
    expect(previewElements.length).toBe(0);
  });

  it('should not show tags when empty', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const tagElements = document.querySelectorAll('.settlements-list-tags');
    expect(tagElements.length).toBe(0);
  });

  it('should not show services count when empty', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const serviceElements = document.querySelectorAll('.settlements-list-services');
    expect(serviceElements.length).toBe(0);
  });

  // ── Filtering settlements ──

  it('should filter settlements by size', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Village A', size: 'village', description: '', population: '', tags: '', services: [] },
        { name: 'Town B', size: 'town', description: '', population: '', tags: '', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Village A')).toBeInTheDocument();
      expect(screen.getByText('Town B')).toBeInTheDocument();
    });

    const villageBtn = screen.getByTitle('Filter: Village');
    fireEvent.click(villageBtn);

    expect(screen.queryByText('Town B')).not.toBeInTheDocument();
  });

  it('should filter settlements by search query', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Whiteridge', size: 'town', description: '', population: '', tags: '', services: [] },
        { name: 'Blackwater', size: 'city', description: '', population: '', tags: '', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search settlements/);
    fireEvent.change(searchInput, { target: { value: 'white' } });

    expect(screen.queryByText('Blackwater')).not.toBeInTheDocument();
  });

  it('should show no results message when filter has no matches', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Whiteridge', size: 'town', description: '', population: '', tags: '', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const cityBtn = screen.getByTitle('Filter: City');
    fireEvent.click(cityBtn);

    expect(screen.getByText(/No settlements found matching/)).toBeInTheDocument();
  });

  it('should show no results message when search has no matches', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Whiteridge', size: 'town', description: '', population: '', tags: '', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search settlements/);
    fireEvent.change(searchInput, { target: { value: 'dragons' } });

    expect(screen.getByText(/No settlements found matching/)).toBeInTheDocument();
  });

  // ── Edit settlement ──

  it('should open edit modal when settlement clicked', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: 'A peaceful town.',
        population: '2,500 souls',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Whiteridge'));

    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('should open edit modal on keyboard Enter key', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const listItem = screen.getByRole('button', { name: 'Edit settlement: Whiteridge' });
    fireEvent.keyDown(listItem, { key: 'Enter' });

    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  it('should open edit modal on keyboard Space key', async () => {
    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const listItem = screen.getByRole('button', { name: 'Edit settlement: Whiteridge' });
    fireEvent.keyDown(listItem, { key: ' ' });

    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  // ── Modal form fields ──

  it('should render settlement name input in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
  });

  it('should render size select in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
  });

  it('should render population input in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByLabelText('Population')).toBeInTheDocument();
  });

  it('should render government field in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('preview-toggle-settlement-government')).toBeInTheDocument();
  });

  it('should render description field in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('preview-toggle-settlement-description')).toBeInTheDocument();
  });

  it('should render atmosphere field in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('preview-toggle-settlement-atmosphere')).toBeInTheDocument();
  });

  it('should render tags input in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByLabelText('Tags (comma separated)')).toBeInTheDocument();
  });

  it('should render notes field in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('preview-toggle-settlement-notes')).toBeInTheDocument();
  });

  it('should render services section title in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Services')).toBeInTheDocument();
  });

  it('should render NPCs section title in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Notable NPCs')).toBeInTheDocument();
  });

  it('should render Rumors section title in modal', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Rumors & News')).toBeInTheDocument();
  });

  // ── Add/Remove services, NPCs, rumors ──

  it('should add a service when Add Service clicked', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const addServiceBtn = screen.getAllByText(/Add Service/)[0];
    fireEvent.click(addServiceBtn);
    expect(screen.getByText('Add Service')).toBeInTheDocument();
  });

  it('should add an NPC when Add NPC clicked', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const addNpcBtn = screen.getAllByText(/Add NPC/)[0];
    fireEvent.click(addNpcBtn);
    expect(screen.getByText('Add NPC')).toBeInTheDocument();
  });

  it('should add a rumor when Add Rumor clicked', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const addRumorBtn = screen.getAllByText(/Add Rumor/)[0];
    fireEvent.click(addRumorBtn);
    expect(screen.getByText('Add Rumor')).toBeInTheDocument();
  });

  // ── Modal does not show threat field when threat is empty ──

  it('should not show threat field when threat is empty', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.queryByTestId('preview-toggle-settlement-threat')).not.toBeInTheDocument();
  });

  // ── Delete button only visible in edit mode ──

  it('should not show delete button when creating new settlement', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });

  // ── Size change in form triggers auto-population ──

  it('should default size to village', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const sizeSelect = screen.getByLabelText('Size');
    expect(sizeSelect.value).toBe('village');
  });

  // ── Modal footer buttons ──

  it('should have Cancel and Save buttons in modal footer', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  // ── Save action ──

  it('should call saveSettlementAction when save clicked with valid data', async () => {
    const mockSave = vi.fn();

    mockSettlementsFactory = () => ({
      settlements: [],
      loading: false,
      saveSettlementAction: mockSave,
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);

    const nameInput = screen.getByLabelText('Name *');
    fireEvent.change(nameInput, { target: { value: 'Whiteridge' } });

    const saveButton = screen.getByText('Save').closest('button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
  });

  // ── Delete action ──

  it('should call deleteSettlementAction when delete confirmed', async () => {
    const mockDelete = vi.fn();

    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: mockDelete,
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Whiteridge'));

    const deleteButton = screen.getByText(/Delete/);
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Delete this settlement?');
    expect(mockDelete).toHaveBeenCalledWith('Whiteridge');
  });

  it('should not call deleteSettlementAction when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);

    const mockDelete = vi.fn();

    mockSettlementsFactory = () => ({
      settlements: [{
        name: 'Whiteridge',
        size: 'town',
        description: '',
        population: '',
        tags: '',
        services: [],
      }],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: mockDelete,
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Whiteridge'));

    const deleteButton = screen.getByText(/Delete/);
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Delete this settlement?');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  // ── Multiple settlements ──

  it('should render multiple settlements in the list', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Whiteridge', size: 'town', description: '', population: '', tags: '', services: [] },
        { name: 'Blackwater', size: 'city', description: '', population: '', tags: '', services: [] },
        { name: 'Dawn\'s Rest', size: 'village', description: '', population: '', tags: '', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
      expect(screen.getByText('Blackwater')).toBeInTheDocument();
    });
  });

  // ── Size options in select ──

  it('should render all size options in select', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);

    const sizeSelect = screen.getByLabelText('Size');
    const options = sizeSelect.querySelectorAll('option');
    expect(options.length).toBe(4);
    expect(options[0].textContent).toBe('Village');
    expect(options[1].textContent).toBe('Town');
    expect(options[2].textContent).toBe('City');
    expect(options[3].textContent).toBe('Metropolis');
  });

  // ── Service type options in modal ──

  it('should not render service type select when no services added', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const svcTypeSelects = document.querySelectorAll('.settlements-svc-type');
    expect(svcTypeSelects.length).toBe(0);
  });

  // ── Form field changes ──

  it('should handle name field changes', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const nameInput = screen.getByLabelText('Name *');
    fireEvent.change(nameInput, { target: { value: 'Whiteridge' } });
    expect(nameInput.value).toBe('Whiteridge');
  });

  it('should handle population field changes', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const popInput = screen.getByLabelText('Population');
    fireEvent.change(popInput, { target: { value: '5,000 souls' } });
    expect(popInput.value).toBe('5,000 souls');
  });

  it('should handle tags field changes', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const tagsInput = screen.getByLabelText('Tags (comma separated)');
    fireEvent.change(tagsInput, { target: { value: 'coastal, trade-hub' } });
    expect(tagsInput.value).toBe('coastal, trade-hub');
  });

  it('should handle PreviewToggle field changes', () => {
    render(<Settlements {...defaultProps} />);
    const buttons = screen.getAllByText(/New Settlement/);
    fireEvent.click(buttons[0]);
    const govField = screen.getByTestId('settlement-field-settlement-government');
    fireEvent.change(govField, { target: { value: 'Monarchy' } });
    expect(govField.value).toBe('Monarchy');
  });

  // ── Size filter with settlements present ──

  it('should show filtered results when size filter applied', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Village A', size: 'village', description: '', population: '', tags: '', services: [] },
        { name: 'Town B', size: 'town', description: '', population: '', tags: '', services: [] },
        { name: 'City C', size: 'city', description: '', population: '', tags: '', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Village A')).toBeInTheDocument();
      expect(screen.getByText('Town B')).toBeInTheDocument();
      expect(screen.getByText('City C')).toBeInTheDocument();
    });

    const townBtn = screen.getByTitle('Filter: Town');
    fireEvent.click(townBtn);

    expect(screen.queryByText('Village A')).not.toBeInTheDocument();
    expect(screen.getByText('Town B')).toBeInTheDocument();
    expect(screen.queryByText('City C')).not.toBeInTheDocument();
  });

  // ── Search by tags and description ──

  it('should filter settlements by tags', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Whiteridge', size: 'town', description: '', population: '', tags: 'coastal, trade-hub', services: [] },
        { name: 'Blackwater', size: 'city', description: '', population: '', tags: 'mountain, mining', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search settlements/);
    fireEvent.change(searchInput, { target: { value: 'coastal' } });

    expect(screen.queryByText('Blackwater')).not.toBeInTheDocument();
  });

  it('should filter settlements by description', async () => {
    mockSettlementsFactory = () => ({
      settlements: [
        { name: 'Whiteridge', size: 'town', description: 'A peaceful coastal town.', population: '', tags: '', services: [] },
        { name: 'Blackwater', size: 'city', description: 'A bustling mountain city.', population: '', tags: '', services: [] },
      ],
      loading: false,
      saveSettlementAction: vi.fn(),
      deleteSettlementAction: vi.fn(),
    });

    render(<Settlements {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Whiteridge')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search settlements/);
    fireEvent.change(searchInput, { target: { value: 'coastal' } });

    expect(screen.queryByText('Blackwater')).not.toBeInTheDocument();
  });
});
