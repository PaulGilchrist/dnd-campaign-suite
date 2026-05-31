import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCs from './NPCs.jsx';

let mockNPCsFactory = () => ({
  npcs: [],
  loading: false,
  loadNPCsList: vi.fn(),
  saveNPCsList: vi.fn(),
  saveNPCAction: vi.fn(),
  deleteNPCAction: vi.fn(),
});

vi.mock('../../hooks/useNPCsManagement.js', () => ({
  __esModule: true,
  default: (...args) => mockNPCsFactory(...args),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

describe('NPCs', () => {
  const defaultProps = {
    campaignName: 'test-campaign',
    characters: [{ name: 'Aragorn', level: 5 }],
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    // Reset the hook mock to defaults so overrides from one test don't leak
    mockNPCsFactory = () => ({
      npcs: [],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      saveNPCAction: vi.fn(),
      deleteNPCAction: vi.fn(),
    });
  });

  // ── Header ────────────────────────────────────────────────────────

  it('should render header with back button, title, and New NPC button', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByText(/Back/)).toBeInTheDocument();
    // "NPCs" appears in the h2 title and also in empty-state text; use heading query
    expect(screen.getByRole('heading', { name: 'NPCs' })).toBeInTheDocument();
    expect(screen.getAllByText(/New NPC/).length).toBeGreaterThanOrEqual(1);
  });

  it('should call onBack when back button clicked', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.click(screen.getByText(/Back/));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  // ── Search ────────────────────────────────────────────────────────

  const clickNewNPC = () => {
    const btn = screen.getAllByText(/New NPC/).find(
      (el) => el.tagName === 'BUTTON'
    );
    fireEvent.click(btn);
  };

  it('should render search input', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Search NPCs/)).toBeInTheDocument();
  });

  it('should show clear search button when search has text', () => {
    render(<NPCs {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search NPCs/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('should clear search when clear button clicked', () => {
    render(<NPCs {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search NPCs/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(searchInput.value).toBe('');
  });

  // ── Loading & empty states ────────────────────────────────────────

  it('should show loading state', async () => {
    mockNPCsFactory = () => ({
      npcs: [],
      loading: true,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Loading NPCs/)).toBeInTheDocument();
    });
  });

  it('should show empty state when no NPCs', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument();
  });

  // ── Modal open / close ────────────────────────────────────────────

  it('should open modal when New NPC clicked', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    expect(
      screen.getByRole('heading', { name: 'New NPC' })
    ).toBeInTheDocument();
  });

  it('should show "New NPC" heading in modal', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    expect(screen.getByRole('heading', { name: 'New NPC' })).toBeInTheDocument();
  });

  it('should close modal when Cancel clicked', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    expect(
      screen.getByRole('heading', { name: 'New NPC' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(
      screen.queryByRole('heading', { name: 'New NPC' })
    ).not.toBeInTheDocument();
  });

  it('should close modal when X button clicked', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(
      screen.queryByRole('heading', { name: 'New NPC' })
    ).not.toBeInTheDocument();
  });

  it('should not close modal when overlay clicked', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const overlay = document.querySelector('.ct-modal-overlay');
    fireEvent.click(overlay);
    expect(
      screen.getByRole('heading', { name: 'New NPC' })
    ).toBeInTheDocument();
  });

  it('should not close modal when modal content clicked', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const modal = document.querySelector('.ct-modal');
    fireEvent.click(modal);
    expect(
      screen.getByRole('heading', { name: 'New NPC' })
    ).toBeInTheDocument();
  });

  // ── Modal form fields ─────────────────────────────────────────────

  it('should render all form fields in modal', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();

    // Standard inputs
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Race/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Class \/ Role/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Attitude/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tags/)).toBeInTheDocument();

    // PreviewToggle fields
    expect(screen.getByTestId('preview-toggle-npc-appearance')).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-npc-personality')).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-npc-goals')).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-npc-secrets')).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-npc-notes')).toBeInTheDocument();
  });

  it('should render required asterisk for name field', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should render all attitude options in select', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();

    const attitudeSelect = screen.getByLabelText(/Attitude/);
    const options = attitudeSelect.querySelectorAll('option');
    expect(options.length).toBe(5);
    expect(options[0].textContent).toBe('Deep Bonds');
    expect(options[1].textContent).toBe('Positive');
    expect(options[2].textContent).toBe('Neutral');
    expect(options[3].textContent).toBe('Negative');
    expect(options[4].textContent).toBe('Extreme Opposition');
  });

  // ── Form field changes ────────────────────────────────────────────

  it('should handle name field changes', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: 'Gandalf' } });
    expect(nameInput.value).toBe('Gandalf');
  });

  it('should handle race field changes', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const raceInput = screen.getByLabelText(/Race/);
    fireEvent.change(raceInput, { target: { value: 'Human' } });
    expect(raceInput.value).toBe('Human');
  });

  it('should handle classRole field changes', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const classInput = screen.getByLabelText(/Class \/ Role/);
    fireEvent.change(classInput, { target: { value: 'Wizard' } });
    expect(classInput.value).toBe('Wizard');
  });

  it('should handle attitude select changes', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const attitudeSelect = screen.getByLabelText(/Attitude/);
    fireEvent.change(attitudeSelect, { target: { value: 'positive' } });
    expect(attitudeSelect.value).toBe('positive');
  });

  it('should handle tags field changes', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const tagsInput = screen.getByLabelText(/Tags/);
    fireEvent.change(tagsInput, { target: { value: 'ally, quest-giver' } });
    expect(tagsInput.value).toBe('ally, quest-giver');
  });

  it('should handle PreviewToggle field changes', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const appearanceField = screen.getByTestId('field-npc-appearance');
    fireEvent.change(appearanceField, {
      target: { value: 'Tall with a long beard' },
    });
    expect(appearanceField.value).toBe('Tall with a long beard');
  });

  // ── Save button disabled ──────────────────────────────────────────

  it('should disable save button when name is empty', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton.disabled).toBe(true);
  });

  it('should enable save button when name has text', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: 'Gandalf' } });
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton.disabled).toBe(false);
  });

  // ── NPC list rendering ────────────────────────────────────────────

  it('should render NPC list when NPCs provided', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: 'Tall with a long beard',
          personality: 'Wise and mysterious',
          goals: 'Defeat Sauron',
          secrets: 'He is a Maia',
          notes: 'Carries a staff',
          tags: 'ally, quest-giver',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });
  });

  it('should render race and class in NPC list item', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Legolas',
          race: 'Elf',
          classRole: 'Archer',
          attitude: 'neutral',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Elf/)).toBeInTheDocument();
      expect(screen.getByText(/Archer/)).toBeInTheDocument();
    });
  });

  it('should render tags in NPC list item', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gimli',
          race: 'Dwarf',
          classRole: 'Fighter',
          attitude: 'neutral',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: 'ally, warrior',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/ally, warrior/)).toBeInTheDocument();
    });
  });

  // ── Edit modal ────────────────────────────────────────────────────

  it('should open edit modal with "Edit NPC" heading when NPC clicked', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Gandalf'));

    expect(
      screen.getByRole('heading', { name: 'Edit NPC' })
    ).toBeInTheDocument();
  });

  it('should show delete button in edit modal', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Gandalf'));

    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('should not show delete button in new NPC modal', () => {
    render(<NPCs {...defaultProps} />);
    clickNewNPC();
    expect(screen.queryByText(/^Delete$/)).not.toBeInTheDocument();
  });

  it('should populate form fields when editing an NPC', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: 'Tall with a long beard',
          personality: 'Wise',
          goals: 'Defeat Sauron',
          secrets: 'Is a Maia',
          notes: 'Carries staff',
          tags: 'ally',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Gandalf'));

    const nameInput = screen.getByLabelText(/Name/);
    expect(nameInput.value).toBe('Gandalf');

    const raceInput = screen.getByLabelText(/Race/);
    expect(raceInput.value).toBe('Human');

    const classInput = screen.getByLabelText(/Class \/ Role/);
    expect(classInput.value).toBe('Wizard');

    const attitudeSelect = screen.getByLabelText(/Attitude/);
    expect(attitudeSelect.value).toBe('positive');

    const tagsInput = screen.getByLabelText(/Tags/);
    expect(tagsInput.value).toBe('ally');
  });

  // ── Search filtering ──────────────────────────────────────────────

  it('should filter NPCs by name', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
        {
          id: 'npc-2',
          name: 'Legolas',
          race: 'Elf',
          classRole: 'Archer',
          attitude: 'neutral',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
      expect(screen.getByText('Legolas')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search NPCs/);
    fireEvent.change(searchInput, { target: { value: 'gandalf' } });

    expect(screen.getByText('Gandalf')).toBeInTheDocument();
    expect(screen.queryByText('Legolas')).not.toBeInTheDocument();
  });

  it('should filter NPCs by race', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
        {
          id: 'npc-2',
          name: 'Legolas',
          race: 'Elf',
          classRole: 'Archer',
          attitude: 'neutral',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search NPCs/);
    fireEvent.change(searchInput, { target: { value: 'elf' } });

    expect(screen.getByText('Legolas')).toBeInTheDocument();
    expect(screen.queryByText('Gandalf')).not.toBeInTheDocument();
  });

  it('should filter NPCs by classRole', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
        {
          id: 'npc-2',
          name: 'Aragorn',
          race: 'Human',
          classRole: 'Fighter',
          attitude: 'neutral',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search NPCs/);
    fireEvent.change(searchInput, { target: { value: 'fighter' } });

    expect(screen.getByText('Aragorn')).toBeInTheDocument();
    expect(screen.queryByText('Gandalf')).not.toBeInTheDocument();
  });

  it('should filter NPCs by tags', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: 'ally, quest-giver',
        },
        {
          id: 'npc-2',
          name: 'Sauron',
          race: 'Maia',
          classRole: 'Dark Lord',
          attitude: 'extreme opposition',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: 'enemy, villain',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search NPCs/);
    fireEvent.change(searchInput, { target: { value: 'villain' } });

    expect(screen.getByText('Sauron')).toBeInTheDocument();
    expect(screen.queryByText('Gandalf')).not.toBeInTheDocument();
  });

  it('should show search no results message', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search NPCs/);
    fireEvent.change(searchInput, { target: { value: 'dragons' } });

    expect(
      screen.getByText(/No NPCs found matching/)
    ).toBeInTheDocument();
  });

  // ── Attitude badge ────────────────────────────────────────────────

  it('should render attitude badge with correct styles', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    const badge = screen.getByTitle('positive');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('positive');
    expect(badge.style.backgroundColor).toBe('rgb(27, 67, 50)');
    expect(badge.style.color).toBe('rgb(183, 228, 199)');
    expect(badge.style.borderColor).toBe('rgb(64, 145, 108)');
  });

  it('should render extreme opposition badge with correct styles', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Sauron',
          race: 'Maia',
          classRole: 'Dark Lord',
          attitude: 'extreme opposition',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Sauron')).toBeInTheDocument();
    });

    const badge = screen.getByTitle('extreme opposition');
    expect(badge).toBeInTheDocument();
    expect(badge.style.backgroundColor).toBe('rgb(92, 3, 14)');
    expect(badge.style.color).toBe('rgb(255, 107, 107)');
    expect(badge.style.borderColor).toBe('rgb(139, 0, 0)');
  });

  it('should render deep bonds badge with correct styles', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Sam',
          race: 'Hobbit',
          classRole: 'Gardener',
          attitude: 'deep bonds',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Sam')).toBeInTheDocument();
    });

    const badge = screen.getByTitle('deep bonds');
    expect(badge).toBeInTheDocument();
    expect(badge.style.backgroundColor).toBe('rgb(26, 71, 42)');
    expect(badge.style.color).toBe('rgb(144, 238, 144)');
    expect(badge.style.borderColor).toBe('rgb(45, 106, 79)');
  });

  it('should render negative badge with correct styles', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Saruman',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'negative',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Saruman')).toBeInTheDocument();
    });

    const badge = screen.getByTitle('negative');
    expect(badge).toBeInTheDocument();
    expect(badge.style.backgroundColor).toBe('rgb(123, 36, 28)');
    expect(badge.style.color).toBe('rgb(244, 160, 160)');
    expect(badge.style.borderColor).toBe('rgb(164, 51, 48)');
  });

  it('should not render attitude badge when attitude is empty', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Mystery NPC',
          race: 'Unknown',
          classRole: '',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Mystery NPC')).toBeInTheDocument();
    });

    expect(
      document.querySelector('.ct-list-attitude')
    ).not.toBeInTheDocument();
  });

  // ── Delete action ─────────────────────────────────────────────────

  it('should call deleteNPCAction when delete confirmed', async () => {
    const mockDelete = vi.fn();

    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: mockDelete,
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Gandalf'));

    const deleteButton = screen.getByText(/Delete/);
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Delete this NPC?');
    expect(mockDelete).toHaveBeenCalledWith('Gandalf');
  });

  it('should not call deleteNPCAction when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);

    const mockDelete = vi.fn();

    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: mockDelete,
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Gandalf'));

    const deleteButton = screen.getByText(/Delete/);
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Delete this NPC?');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  // ── Save action ───────────────────────────────────────────────────

  it('should call saveNPCAction when save clicked with valid data', async () => {
    const mockSave = vi.fn();

    mockNPCsFactory = () => ({
      npcs: [],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      saveNPCAction: mockSave,
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    // "New NPC" appears in button and empty-state text; target the button specifically
    const newBtn = screen.getAllByText(/New NPC/).find(
      (el) => el.tagName === 'BUTTON'
    );
    fireEvent.click(newBtn);

    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: 'Gandalf' } });

    const saveButton = screen.getByText('Save').closest('button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
  });

  // ── Multiple NPCs ─────────────────────────────────────────────────

  it('should render multiple NPCs in the list', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
        {
          id: 'npc-2',
          name: 'Legolas',
          race: 'Elf',
          classRole: 'Archer',
          attitude: 'neutral',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
        {
          id: 'npc-3',
          name: 'Gimli',
          race: 'Dwarf',
          classRole: 'Fighter',
          attitude: 'neutral',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
      expect(screen.getByText('Legolas')).toBeInTheDocument();
      expect(screen.getByText('Gimli')).toBeInTheDocument();
    });
  });

  // ── Keyboard accessibility ────────────────────────────────────────

  it('should open edit modal on Enter key press on NPC item', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    const npcItem = screen.getByText('Gandalf').closest('.ct-list-item');
    fireEvent.keyDown(npcItem, { key: 'Enter' });

    expect(
      screen.getByRole('heading', { name: 'Edit NPC' })
    ).toBeInTheDocument();
  });

  it('should open edit modal on Space key press on NPC item', async () => {
    mockNPCsFactory = () => ({
      npcs: [
        {
          id: 'npc-1',
          name: 'Gandalf',
          race: 'Human',
          classRole: 'Wizard',
          attitude: 'positive',
          appearance: '',
          personality: '',
          goals: '',
          secrets: '',
          notes: '',
          tags: '',
        },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCsList: vi.fn(),
      deleteNPCAction: vi.fn(),
    });

    render(<NPCs {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    const npcItem = screen.getByText('Gandalf').closest('.ct-list-item');
    fireEvent.keyDown(npcItem, { key: ' ' });

    expect(
      screen.getByRole('heading', { name: 'Edit NPC' })
    ).toBeInTheDocument();
  });
});
