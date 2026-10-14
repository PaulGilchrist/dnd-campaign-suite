import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NPCs from './NPCs';

const mockUseNPCsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (...args) => mockUseNPCsManagement(...args),
}));

vi.mock('./NPCListItem.jsx', () => ({
  default: vi.fn(({ npc, onEdit, onAddToInitiative }) => (
    <li data-testid={`npc-list-item-${npc.name}`}>
      <span>{npc.name}</span>
      <button data-testid={`edit-btn-${npc.name}`} onClick={() => onEdit(npc)}>Edit</button>
      <button data-testid={`init-btn-${npc.name}`} onClick={() => onAddToInitiative(npc)}>Add to Initiative</button>
    </li>
  )),
}));

vi.mock('./NPCFormModal.jsx', () => ({
  default: ({ formData, setFormData, onClose, onSave, onDelete, onSaveAndAddToInitiative, disabled, editingNPC, saving }) => (
    <div data-testid="npc-form-modal">
      <div data-testid="modal-editing-npc">{editingNPC?.name || 'none'}</div>
      <div data-testid="modal-saving">{String(!!saving)}</div>
      <input
        data-testid="npc-name-input"
        value={formData?.name || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
      />
      <button onClick={onClose}>Cancel</button>
      <button onClick={onSave} disabled={disabled}>Save</button>
      {editingNPC && <button onClick={onDelete}>Delete</button>}
      {onSaveAndAddToInitiative && (
        <button
          data-testid="save-add-init-btn"
          onClick={onSaveAndAddToInitiative}
          disabled={disabled}
        >
          Save &amp; Add to Initiative
        </button>
      )}
    </div>
  ),
}));

const mockGetDefaultFormData = vi.fn();
const mockCleanNPCData = vi.fn();

vi.mock('../../services/npcs/npcFormUtils.js', () => ({
  getDefaultFormData: (...args) => mockGetDefaultFormData(...args),
  cleanNPCData: (...args) => mockCleanNPCData(...args),
}));

const mockAddNPCToInitiative = vi.fn();
vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: (...args) => mockAddNPCToInitiative(...args),
}));

const mockGenerateNPC = vi.fn();
vi.mock('../../services/npcs/npcGenerator.js', () => ({
  generateNPC: (...args) => mockGenerateNPC(...args),
}));

const mockSaveNPC = vi.fn();
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
  saveNPC: (...args) => mockSaveNPC(...args),
  saveNPCs: vi.fn(),
  deleteNPC: vi.fn(),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  onBack: vi.fn(),
  onViewInitiative: vi.fn(),
};

const defaultNPCs = [
  { name: 'Goblin', race: 'Humanoid', classRole: 'Scout', tags: 'enemy' },
  { name: 'Wizard', race: 'Humanoid', classRole: 'Caster', tags: 'boss' },
];

function createManagementReturn(items = defaultNPCs, overrides = {}) {
  return {
    items,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn(),
    deleteItem: vi.fn(),
    ...overrides,
  };
}

function renderNPCs(npcs = defaultNPCs, managementOverrides = {}, propsOverride = {}) {
  mockUseNPCsManagement.mockReturnValue(createManagementReturn(npcs, managementOverrides));
  return {
    ...render(<NPCs {...defaultProps} {...propsOverride} />),
  };
}

describe('NPCs', () => {
  const defaultFormData = {
    name: '', race: '', classRole: '', appearance: '', personality: '',
    goals: '', secrets: '', notes: '', tags: '', attitude: 'neutral',
    image: '', imageName: '', imagePath: '', armorClass: 10, hitPoints: '',
    hitDice: '', initiativeBonus: '', speed: { walk: '30 ft.' },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrowBonuses: {}, skillBonuses: {}, damageResistances: [],
    damageImmunities: [], conditionImmunities: [], actions: [], traits: '', reactions: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultFormData.mockReturnValue({ ...defaultFormData });
    mockCleanNPCData.mockImplementation((data) => ({ ...data, cleaned: true }));
    mockAddNPCToInitiative.mockResolvedValue(undefined);
    mockGenerateNPC.mockResolvedValue({ name: 'Generated NPC', race: 'Humanoid' });
    mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'Test NPC' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial Render ────────────────────────────────────────────────

  describe('Initial render', () => {
    it('renders the back button and calls onBack when clicked', () => {
      renderNPCs();
      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });

    it('renders the New NPC and Generate NPC buttons', () => {
      renderNPCs();
      expect(screen.getByRole('button', { name: /New NPC/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate NPC/i })).toBeInTheDocument();
    });

    it('renders the search input', () => {
      renderNPCs();
      expect(screen.getByLabelText('Search NPCs')).toBeInTheDocument();
    });

    it('loads NPCs on mount when a campaignName is provided', () => {
      const management = createManagementReturn(defaultNPCs);
      mockUseNPCsManagement.mockReturnValue(management);
      render(<NPCs {...defaultProps} />);
      expect(management.loadItems).toHaveBeenCalledTimes(1);
    });

    it('does not load NPCs when no campaignName is provided', () => {
      const management = createManagementReturn(defaultNPCs);
      mockUseNPCsManagement.mockReturnValue(management);
      render(<NPCs {...defaultProps} campaignName="" />);
      expect(management.loadItems).not.toHaveBeenCalled();
    });

    it('reloads NPCs when campaignName changes', () => {
      const management = createManagementReturn(defaultNPCs);
      mockUseNPCsManagement.mockReturnValue(management);
      render(<NPCs {...defaultProps} campaignName="first-campaign" />);
      expect(management.loadItems).toHaveBeenCalledTimes(1);

      management.loadItems.mockClear();
      render(<NPCs {...defaultProps} campaignName="second-campaign" />);
      expect(management.loadItems).toHaveBeenCalledTimes(1);
    });

    it('renders a list item for each loaded NPC', () => {
      renderNPCs();
      expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
      expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
    });

    it('renders the empty state when there are no NPCs', () => {
      renderNPCs([]);
      expect(screen.getByText(/No NPCs yet/i)).toBeInTheDocument();
    });

    it('renders the loading state while loading is true', () => {
      mockUseNPCsManagement.mockReturnValue(createManagementReturn(defaultNPCs, { loading: true }));
      render(<NPCs {...defaultProps} />);
      expect(screen.getByText(/Loading NPCs/i)).toBeInTheDocument();
    });
  });

  // ── Search / Filter ───────────────────────────────────────────────

  describe('Search filtering', () => {
    it('shows a clear button only while a query is set and clearing it restores all NPCs', () => {
      renderNPCs();
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Goblin' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
      expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
    });

    it('shows a no-results message when search matches no NPCs', () => {
      renderNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Nonexistent' } });
      expect(screen.getByText(/No NPCs found/i)).toBeInTheDocument();
      expect(screen.queryByTestId('npc-list-item-Goblin')).not.toBeInTheDocument();
    });
  });

  // ── New NPC Flow ──────────────────────────────────────────────────

  describe('New NPC flow', () => {
    it('opens the modal with empty editing state and default form data', () => {
      renderNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      expect(mockGetDefaultFormData).toHaveBeenCalled();
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  // ── Generate NPC Flow ─────────────────────────────────────────────

  describe('Generate NPC flow', () => {
    it('generates from the existing NPC list and opens the modal with the generated data', async () => {
      renderNPCs();
      fireEvent.click(screen.getByRole('button', { name: /Generate NPC/i }));
      await waitFor(() => expect(mockGenerateNPC).toHaveBeenCalledWith(defaultNPCs));
      expect(mockGetDefaultFormData).toHaveBeenCalledWith({ name: 'Generated NPC', race: 'Humanoid' });
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  // ── Edit NPC Flow ─────────────────────────────────────────────────

  describe('Edit NPC flow', () => {
    it('opens the modal with the clicked NPC set as the item being edited', () => {
      renderNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  // ── Save Flow ─────────────────────────────────────────────────────

  describe('Save flow', () => {
    it('saves the cleaned form data with the campaign name', async () => {
      renderNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
      expect(mockSaveNPC.mock.calls[0][0]).toBe('test-campaign');
      expect(mockSaveNPC.mock.calls[0][1]).toMatchObject({ name: 'Test NPC', cleaned: true });
      expect(mockSaveNPC.mock.calls[0][2]).toBeUndefined();
    });

    it('reloads the NPC list and closes the modal after a successful save', async () => {
      const management = createManagementReturn(defaultNPCs);
      mockUseNPCsManagement.mockReturnValue(management);
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(management.loadItems).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    });

    it('passes the original NPC name so edits rename instead of duplicating', async () => {
      renderNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
      expect(mockSaveNPC.mock.calls[0][2]).toBe('Goblin');
    });

  });

  // ── Save Failure ──────────────────────────────────────────────────

  describe('Save failure', () => {
    it('keeps the modal open and does not reload the list when save fails', async () => {
      mockSaveNPC.mockRejectedValueOnce(new Error('Save failed'));
      const management = createManagementReturn(defaultNPCs);
      mockUseNPCsManagement.mockReturnValue(management);
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      expect(management.loadItems).toHaveBeenCalledTimes(1);
    });
  });

  // ── Delete Flow ───────────────────────────────────────────────────

  describe('Delete flow', () => {
    it('deletes the NPC and closes the modal when the confirmation is accepted', async () => {
      const deleteItem = vi.fn().mockResolvedValue(undefined);
      mockUseNPCsManagement.mockReturnValue(createManagementReturn(defaultNPCs, { deleteItem }));
      render(<NPCs {...defaultProps} />);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('Goblin'));
      await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    });

    it('does not delete the NPC when the confirmation is cancelled', async () => {
      const deleteItem = vi.fn().mockResolvedValue(undefined);
      mockUseNPCsManagement.mockReturnValue(createManagementReturn(defaultNPCs, { deleteItem }));
      render(<NPCs {...defaultProps} />);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(deleteItem).not.toHaveBeenCalled();
    });

    it('keeps the modal open when the delete fails', async () => {
      const deleteItem = vi.fn().mockRejectedValue(new Error('Delete failed'));
      mockUseNPCsManagement.mockReturnValue(createManagementReturn(defaultNPCs, { deleteItem }));
      render(<NPCs {...defaultProps} />);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('Goblin'));
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  // ── Save and Add to Initiative ────────────────────────────────────

  describe('Save and add to initiative', () => {
    it('saves the NPC and adds the saved result to initiative', async () => {
      mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'Goblin', armorClass: 15 } });
      renderNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockAddNPCToInitiative).toHaveBeenCalledTimes(1));
      expect(mockAddNPCToInitiative).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({ name: 'Goblin', armorClass: 15 }),
        defaultProps.onViewInitiative
      );
      await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    });
  });

  // ── Add to Initiative from List ───────────────────────────────────

  describe('Add to initiative from the list', () => {
    it('adds the clicked NPC to initiative with the campaign and navigation callback', async () => {
      renderNPCs();
      fireEvent.click(screen.getByTestId('init-btn-Goblin'));
      await waitFor(() => expect(mockAddNPCToInitiative).toHaveBeenCalledTimes(1));
      expect(mockAddNPCToInitiative).toHaveBeenCalledWith(
        'test-campaign',
        defaultNPCs[0],
        defaultProps.onViewInitiative
      );
    });

    it('shows an inline error when the NPC is blocked for missing combat stats', async () => {
      mockAddNPCToInitiative.mockRejectedValue(new Error('"Goblin" needs AC and HP filled in (Stats tab) before joining initiative.'));
      renderNPCs();
      fireEvent.click(screen.getByTestId('init-btn-Goblin'));
      await waitFor(() => expect(screen.getByText(/needs AC and HP/)).toBeInTheDocument());
      expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
    });

    it('opens the NPC editor when the GM opts to provide a weapon', async () => {
      mockAddNPCToInitiative.mockResolvedValue('needs-weapon');
      renderNPCs();
      fireEvent.click(screen.getByTestId('init-btn-Goblin'));
      await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
      expect(screen.getByTestId('modal-editing-npc')).toHaveTextContent('Goblin');
    });
  });
});
