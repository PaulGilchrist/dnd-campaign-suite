// Regression tests for duplicate-name overwrite: saving a new NPC (or renaming
// to an existing name) must show an inline error without calling saveNPC,
// mirroring the Maps manager duplicate guard.
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
  default: ({ formData, setFormData, onClose, onSave, onDelete, onSaveAndAddToInitiative, disabled, editingNPC, error }) => (
    <div data-testid="npc-form-modal">
      <div data-testid="modal-editing-npc">{editingNPC?.name || 'none'}</div>
      {error && <div data-testid="npc-form-error">{error}</div>}
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
  { name: 'QA Test NPC', race: 'Human' },
  { name: 'Goblin', race: 'Humanoid' },
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

function renderNPCs(npcs = defaultNPCs, managementOverrides = {}) {
  mockUseNPCsManagement.mockReturnValue(createManagementReturn(npcs, managementOverrides));
  return render(<NPCs {...defaultProps} />);
}

const defaultFormData = {
  name: '', race: '', classRole: '', appearance: '', personality: '',
  goals: '', secrets: '', notes: '', tags: '', attitude: 'neutral',
  image: '', imageName: '', imagePath: '', armorClass: 10, hitPoints: '',
  hitDice: '', initiativeBonus: '', speed: { walk: '30 ft.' },
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrowBonuses: {}, skillBonuses: {}, damageResistances: [],
  damageImmunities: [], conditionImmunities: [], actions: [], traits: '', reactions: '',
};

describe('NPCs duplicate-name guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultFormData.mockReturnValue({ ...defaultFormData });
    mockCleanNPCData.mockImplementation((data) => ({ ...data, cleaned: true }));
    mockAddNPCToInitiative.mockResolvedValue(undefined);
    mockGenerateNPC.mockResolvedValue({ name: 'Generated NPC', race: 'Humanoid' });
    mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'QA Test NPC' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks saving a new NPC with a duplicate name, shows the error, and does not persist', async () => {
    renderNPCs();
    fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
    await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'QA Test NPC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('npc-form-error')).toBeInTheDocument());
    expect(screen.getByTestId('npc-form-error')).toHaveTextContent('An NPC with that name already exists');
    expect(mockSaveNPC).not.toHaveBeenCalled();
    expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
  });

  it('blocks duplicate names case-insensitively', async () => {
    renderNPCs();
    fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
    await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'qa test npc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('npc-form-error')).toBeInTheDocument());
    expect(mockSaveNPC).not.toHaveBeenCalled();
  });

  it('blocks renaming an existing NPC onto another NPC name but allows saving its own name', async () => {
    renderNPCs();
    fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
    await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'QA Test NPC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('npc-form-error')).toBeInTheDocument());
    expect(mockSaveNPC).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('npc-form-error')).not.toBeInTheDocument();
    expect(mockSaveNPC.mock.calls[0][2]).toBe('Goblin');
  });

  it('blocks Save & Add to Initiative on a duplicate name', async () => {
    renderNPCs();
    fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
    await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'QA Test NPC' } });
    fireEvent.click(screen.getByTestId('save-add-init-btn'));

    await waitFor(() => expect(screen.getByTestId('npc-form-error')).toBeInTheDocument());
    expect(mockSaveNPC).not.toHaveBeenCalled();
    expect(mockAddNPCToInitiative).not.toHaveBeenCalled();
  });

  it('clears the error when opening a new form and saves a uniquely-named NPC', async () => {
    renderNPCs();
    fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
    await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'QA Test NPC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('npc-form-error')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
    await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
    expect(screen.queryByTestId('npc-form-error')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Unique NPC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
  });

  it('shows the server error message inline when the server rejects a save', async () => {
    mockSaveNPC.mockRejectedValueOnce(new Error('An NPC with that name already exists'));
    renderNPCs();
    fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
    await waitFor(() => expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Other NPC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('npc-form-error')).toBeInTheDocument());
    expect(screen.getByTestId('npc-form-error')).toHaveTextContent('An NPC with that name already exists');
    expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
  });
});
