// @maintained-by-ai: 2026-10-14
// NPCs container contracts: list load/empty/loading, search, create/generate/
// edit/delete flows, saveNPC rename args, and the add-to-initiative seam
// (args, blocked-stats error, needs-weapon editor). SSE sync, duplicate-name
// guard, form shell, row rendering, and stat-block forms live in the
// sibling test files.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NPCs from './NPCs';

const mockUseNPCsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (...args) => mockUseNPCsManagement(...args),
}));

vi.mock('./NPCListItem.jsx', () => ({
  default: ({ npc, onEdit, onAddToInitiative }) => (
    <li data-testid={`npc-list-item-${npc.name}`}>
      <span>{npc.name}</span>
      <button data-testid={`edit-btn-${npc.name}`} onClick={() => onEdit(npc)}>Edit</button>
      <button data-testid={`init-btn-${npc.name}`} onClick={() => onAddToInitiative(npc)}>Add to Initiative</button>
    </li>
  ),
}));

vi.mock('./NPCFormModal.jsx', () => ({
  default: ({ formData, setFormData, onClose, onSave, onDelete, onSaveAndAddToInitiative, disabled, editingNPC }) => (
    <div data-testid="npc-form-modal">
      <div data-testid="modal-editing-npc">{editingNPC?.name || 'none'}</div>
      <input
        data-testid="npc-name-input"
        value={formData?.name || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
      />
      <button onClick={onClose}>Cancel</button>
      <button onClick={onSave} disabled={disabled}>Save</button>
      {editingNPC && <button onClick={onDelete}>Delete</button>}
      {onSaveAndAddToInitiative && (
        <button data-testid="save-add-init-btn" onClick={onSaveAndAddToInitiative} disabled={disabled}>
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
// loadNPCs/saveNPCs/deleteNPC only need to exist so NPCs.jsx's imports
// resolve — the list hook and delete action they feed are fully mocked.
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

// The container only consumes formData.name (disabled-guard, and passthrough
// into cleanNPCData); the real getDefaultFormData merges overrides over an
// empty draft, which the mock mirrors.
const emptyForm = { name: '' };

function renderNPCs(npcs = defaultNPCs, managementOverrides = {}, propsOverride = {}) {
  const management = {
    items: npcs,
    loading: false,
    loadItems: vi.fn(),
    deleteItem: vi.fn(),
    ...managementOverrides,
  };
  mockUseNPCsManagement.mockReturnValue(management);
  return { ...render(<NPCs {...defaultProps} {...propsOverride} />), management };
}

function clickNewNPC() {
  fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
}

async function clickSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
}

function clickDeleteOn(name = 'Goblin') {
  fireEvent.click(screen.getByTestId(`edit-btn-${name}`));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
}

describe('NPCs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultFormData.mockImplementation((overrides = {}) => ({ ...emptyForm, ...overrides }));
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
    it('renders Back, New NPC, Generate NPC, and the search input; Back fires onBack', () => {
      renderNPCs();
      expect(screen.getByRole('button', { name: /New NPC/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate NPC/i })).toBeInTheDocument();
      expect(screen.getByLabelText('Search NPCs')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });

    it('loads NPCs on mount and again when campaignName changes', () => {
      const { management, rerender } = renderNPCs(defaultNPCs, {}, { campaignName: 'first-campaign' });
      expect(management.loadItems).toHaveBeenCalledTimes(1);

      management.loadItems.mockClear();
      rerender(<NPCs {...defaultProps} campaignName="second-campaign" />);
      expect(management.loadItems).toHaveBeenCalledTimes(1);
    });

    it('does not load NPCs when no campaignName is provided', () => {
      const { management } = renderNPCs(defaultNPCs, {}, { campaignName: '' });
      expect(management.loadItems).not.toHaveBeenCalled();
    });

    it('renders one row per loaded NPC', () => {
      renderNPCs();
      expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
      expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
    });

    it('renders the empty state when there are no NPCs', () => {
      renderNPCs([]);
      expect(screen.getByText(/No NPCs yet/i)).toBeInTheDocument();
    });

    it('renders the loading state while loading is true', () => {
      renderNPCs(defaultNPCs, { loading: true });
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

  // ── New / Generate NPC Flow ───────────────────────────────────────

  describe('New NPC flow', () => {
    it('opens the modal with default form data and no NPC being edited', () => {
      renderNPCs();
      clickNewNPC();
      expect(mockGetDefaultFormData).toHaveBeenCalledWith();
      expect(screen.getByTestId('modal-editing-npc')).toHaveTextContent('none');
      expect(screen.getByTestId('npc-name-input')).toHaveValue('');
    });
  });

  describe('Generate NPC flow', () => {
    it('generates from the existing NPC list and opens the modal with the generated data', async () => {
      renderNPCs();
      fireEvent.click(screen.getByRole('button', { name: /Generate NPC/i }));
      await waitFor(() => expect(mockGenerateNPC).toHaveBeenCalledWith(defaultNPCs));
      expect(mockGetDefaultFormData).toHaveBeenCalledWith({ name: 'Generated NPC', race: 'Humanoid' });
      expect(screen.getByTestId('npc-name-input')).toHaveValue('Generated NPC');
    });
  });

  // ── Save Flow ─────────────────────────────────────────────────────

  describe('Save flow', () => {
    it('saves cleaned form data with the campaign name, reloads the list, and closes the modal', async () => {
      const { management } = renderNPCs();
      clickNewNPC();
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      await clickSave();
      expect(mockSaveNPC.mock.calls[0][0]).toBe('test-campaign');
      expect(mockSaveNPC.mock.calls[0][1]).toMatchObject({ name: 'Test NPC', cleaned: true });
      expect(mockSaveNPC.mock.calls[0][2]).toBeUndefined();
      await waitFor(() => expect(management.loadItems).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    });

    it('binds the clicked NPC to the modal and passes its original name so edits rename instead of duplicating', async () => {
      renderNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      expect(screen.getByTestId('modal-editing-npc')).toHaveTextContent('Goblin');
      // getDefaultFormData(npc) prefills the draft with the edited NPC's name.
      expect(screen.getByTestId('npc-name-input')).toHaveValue('Goblin');
      await clickSave();
      expect(mockSaveNPC.mock.calls[0][2]).toBe('Goblin');
    });

    it('keeps the modal open and does not reload the list when save fails', async () => {
      mockSaveNPC.mockRejectedValueOnce(new Error('Save failed'));
      const { management } = renderNPCs();
      clickNewNPC();
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      await clickSave();
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      expect(management.loadItems).toHaveBeenCalledTimes(1);
    });
  });

  // ── Delete Flow ───────────────────────────────────────────────────

  describe('Delete flow', () => {
    it('deletes the NPC and closes the modal when the confirmation is accepted', async () => {
      const { management } = renderNPCs();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      clickDeleteOn();
      await waitFor(() => expect(management.deleteItem).toHaveBeenCalledWith('Goblin'));
      await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    });

    it('does not delete the NPC when the confirmation is cancelled', async () => {
      const { management } = renderNPCs();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      clickDeleteOn();
      expect(management.deleteItem).not.toHaveBeenCalled();
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });

    it('keeps the modal open when the delete fails', async () => {
      const deleteItem = vi.fn().mockRejectedValue(new Error('Delete failed'));
      const { management } = renderNPCs(defaultNPCs, { deleteItem });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      clickDeleteOn();
      await waitFor(() => expect(management.deleteItem).toHaveBeenCalledWith('Goblin'));
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  // ── Add to Initiative ─────────────────────────────────────────────

  describe('Save and add to initiative', () => {
    it('saves the NPC and adds the saved result to initiative', async () => {
      mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'Goblin', armorClass: 15 } });
      renderNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
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
