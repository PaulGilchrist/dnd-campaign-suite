// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
  default: ({ formData, setFormData, onClose, onSave, onDelete, onSaveAndAddToInitiative, disabled, editingNPC }) => (
    <div data-testid="npc-form-modal">
      <div data-testid="modal-editing-npc">{editingNPC?.name || 'none'}</div>
      <div data-testid="modal-disabled">{String(disabled)}</div>
      <input
        data-testid="npc-name-input"
        value={formData?.name || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
      />
      <button onClick={onClose}>Close</button>
      <button onClick={onSave}>Save</button>
      {editingNPC && <button onClick={onDelete}>Delete</button>}
      {onSaveAndAddToInitiative && (
        <button
          data-testid="save-add-init-btn"
          onClick={onSaveAndAddToInitiative}
          disabled={disabled}
        >
          Save & Add to Initiative
        </button>
      )}
    </div>
  ),
}));

const mockGetDefaultFormData = vi.fn(() => ({
  name: '', race: '', classRole: '', appearance: '', personality: '',
  goals: '', secrets: '', notes: '', tags: '', attitude: 'neutral',
  image: '', imageName: '', imagePath: '', armorClass: 10, hitPoints: '',
  hitDice: '', initiativeBonus: '', speed: { walk: '30 ft.' },
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrowBonuses: {}, skillBonuses: {}, damageResistances: [],
  damageImmunities: [], conditionImmunities: [], actions: [], traits: '', reactions: '',
}));

vi.mock('../../services/npcs/npcFormUtils.js', () => ({
  getDefaultFormData: (...args) => mockGetDefaultFormData(...args),
  cleanNPCData: vi.fn((data) => data),
}));

const mockAddNPCToInitiative = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: (...args) => mockAddNPCToInitiative(...args),
}));

vi.mock('../../services/npcs/npcGenerator.js', () => ({
  generateNPC: vi.fn().mockResolvedValue({ name: 'Generated NPC', race: 'Humanoid' }),
}));

const mockSaveNPC = vi.fn().mockResolvedValue({ success: true, npc: {} });
const mockLoadNPCs = vi.fn().mockResolvedValue({ npcs: [] });
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: (...args) => mockLoadNPCs(...args),
  saveNPC: (...args) => mockSaveNPC(...args),
  saveNPCs: vi.fn(),
  deleteNPC: vi.fn(),
  loadNPC: vi.fn(),
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

function renderWithNPCs(npcs = defaultNPCs) {
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  mockUseNPCsManagement.mockReturnValue({
    items: npcs,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn(),
    deleteItem: mockDelete,
  });
  return {
    ...render(<NPCs {...defaultProps} />),
    mockDelete,
  };
}

describe('NPCs', () => {
  beforeEach(() => {
    mockAddNPCToInitiative.mockResolvedValue(undefined);
    mockSaveNPC.mockReset();
    mockSaveNPC.mockResolvedValue({ success: true, npc: {} });
    mockLoadNPCs.mockReset();
    mockLoadNPCs.mockResolvedValue({ npcs: [] });
    mockGetDefaultFormData.mockReturnValue({
      name: '', race: '', classRole: '', appearance: '', personality: '',
      goals: '', secrets: '', notes: '', tags: '', attitude: 'neutral',
      image: '', imageName: '', imagePath: '', armorClass: 10, hitPoints: '',
      hitDice: '', initiativeBonus: '', speed: { walk: '30 ft.' },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      savingThrowBonuses: {}, skillBonuses: {}, damageResistances: [],
      damageImmunities: [], conditionImmunities: [], actions: [], traits: '', reactions: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('save validation', () => {
    it('does not save when form data name is empty or whitespace', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(mockSaveNPC).not.toHaveBeenCalled();
      });
    });
  });

  describe('save success', () => {
    it('calls saveNPC with cleaned data when save succeeds', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(mockSaveNPC).toHaveBeenCalled();
      });
      expect(mockSaveNPC.mock.calls[0][1].name).toBe('Test NPC');
    });

    it('closes modal after successful save', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('delete flow', () => {
    it('does not delete when window confirm is cancelled', async () => {
      const { mockDelete } = renderWithNPCs();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('deletes when window confirm is accepted', async () => {
      const { mockDelete } = renderWithNPCs();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('Goblin');
      });
    });

    it('closes modal after successful delete', async () => {
      const { mockDelete } = renderWithNPCs();
      mockDelete.mockResolvedValue(undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('save and add to initiative', () => {
    it('does not save-and-add when form data name is empty', async () => {
      mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'New NPC' } });
      mockUseNPCsManagement.mockReturnValue({
        items: [],
        loading: false,
        loadItems: vi.fn(),
        saveItems: vi.fn(),
        deleteItem: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => {
        expect(mockSaveNPC).not.toHaveBeenCalled();
        expect(mockAddNPCToInitiative).not.toHaveBeenCalled();
      });
    });

    it('saves NPC and adds to initiative when save-and-add clicked', async () => {
      mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'Goblin', armorClass: 15 } });
      mockUseNPCsManagement.mockReturnValue({
        items: defaultNPCs,
        loading: false,
        loadItems: vi.fn(),
        saveItems: vi.fn(),
        deleteItem: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => {
        expect(mockSaveNPC).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mockAddNPCToInitiative).toHaveBeenCalled();
      });
    });

    it('closes modal after save-and-add to initiative', async () => {
      mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'Goblin' } });
      mockUseNPCsManagement.mockReturnValue({
        items: defaultNPCs,
        loading: false,
        loadItems: vi.fn(),
        saveItems: vi.fn(),
        deleteItem: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
      });
    });

    it('does not close modal when save-and-add throws error', async () => {
      mockSaveNPC.mockRejectedValue(new Error('Save failed'));
      mockUseNPCsManagement.mockReturnValue({
        items: defaultNPCs,
        loading: false,
        loadItems: vi.fn(),
        saveItems: vi.fn(),
        deleteItem: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
    });

    it('passes campaignName to addNPCToInitiative', async () => {
      mockSaveNPC.mockResolvedValue({ success: true, npc: { name: 'Goblin', armorClass: 15 } });
      mockUseNPCsManagement.mockReturnValue({
        items: defaultNPCs,
        loading: false,
        loadItems: vi.fn(),
        saveItems: vi.fn(),
        deleteItem: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => {
        expect(mockAddNPCToInitiative).toHaveBeenCalledWith(
          'test-campaign',
          expect.any(Object),
          defaultProps.onViewInitiative
        );
      });
    });
  });

  describe('modal props', () => {
    it('passes editingNPC to modal for edit flow', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      expect(screen.getByTestId('modal-editing-npc')).toHaveTextContent('Goblin');
    });

    it('passes null editingNPC to modal for new NPC flow', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      expect(screen.getByTestId('modal-editing-npc')).toHaveTextContent('none');
    });
  });

  describe('initiative', () => {
    it('calls addNPCToInitiative when Add to Initiative clicked', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByTestId('init-btn-Goblin'));
      await waitFor(() => {
        expect(mockAddNPCToInitiative).toHaveBeenCalledWith(
          'test-campaign',
          defaultNPCs[0],
          defaultProps.onViewInitiative
        );
      });
    });
  });
});
