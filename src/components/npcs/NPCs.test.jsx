// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCs from './NPCs';

const mockUseNPCsManagement = vi.fn();

vi.mock('../../hooks/management/useNPCsManagement.js', () => ({
  default: (...args) => mockUseNPCsManagement(...args),
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
      <button onClick={onDelete}>Delete</button>
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
  const mockSave = vi.fn().mockResolvedValue({ npc: { name: 'New NPC' } });
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  mockUseNPCsManagement.mockReturnValue({
    npcs,
    loading: false,
    loadNPCsList: vi.fn(),
    saveNPCAction: mockSave,
    deleteNPCAction: mockDelete,
  });
  return {
    ...render(<NPCs {...defaultProps} />),
    mockSave,
    mockDelete,
  };
}

describe('NPCs', () => {
  beforeEach(() => {
    mockAddNPCToInitiative.mockResolvedValue(undefined);
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
    it('does not save when form data name is empty', async () => {
      const { mockSave } = renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(mockSave).not.toHaveBeenCalled();
      });
    });

    it('does not save when form data name is whitespace only', async () => {
      const { mockSave } = renderWithNPCs();
      mockGetDefaultFormData.mockReturnValueOnce({
        name: '   ', race: '', classRole: '', appearance: '', personality: '',
        goals: '', secrets: '', notes: '', tags: '', attitude: 'neutral',
        image: '', imageName: '', imagePath: '', armorClass: 10, hitPoints: '',
        hitDice: '', initiativeBonus: '', speed: { walk: '30 ft.' },
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        savingThrowBonuses: {}, skillBonuses: {}, damageResistances: [],
        damageImmunities: [], conditionImmunities: [], actions: [], traits: '', reactions: '',
      });
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(mockSave).not.toHaveBeenCalled();
      });
    });
  });

  describe('save success', () => {
    it('calls saveNPCAction with cleaned data when save succeeds', async () => {
      const { mockSave } = renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      // Set a valid name so save is allowed
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });
      const cleanedData = mockSave.mock.calls[0][0];
      expect(cleanedData).toBeDefined();
      expect(cleanedData.name).toBe('Test NPC');
      expect(mockSave.mock.calls[0][1]).toBeUndefined();
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

  describe('delete error handling', () => {
    it('logs error when delete throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));
      mockUseNPCsManagement.mockReturnValue({
        npcs: defaultNPCs,
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: vi.fn(),
        deleteNPCAction: mockDelete,
      });
      render(<NPCs {...defaultProps} />);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to delete NPC:', expect.any(Error));
      });
      consoleSpy.mockRestore();
    });
  });

  describe('save error handling', () => {
    it('does not close modal when save throws error', async () => {
      mockUseNPCsManagement.mockReturnValue({
        npcs: [],
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: vi.fn().mockRejectedValue(new Error('Save failed')),
        deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Test NPC' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
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

    it('does not delete when there is no editingNPC', async () => {
      const { mockDelete } = renderWithNPCs();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      // Delete button exists in mock modal, but handleDelete checks editingNPC
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(mockDelete).not.toHaveBeenCalled();
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

    it('does not close modal when delete throws error', async () => {
      mockUseNPCsManagement.mockReturnValue({
        npcs: defaultNPCs,
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: vi.fn(),
        deleteNPCAction: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });
      renderWithNPCs();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
    });
  });

  describe('save and add to initiative', () => {
    it('does not save-and-add when form data name is empty', async () => {
      const mockSave = vi.fn().mockResolvedValue({ npc: { name: 'New NPC' } });
      mockUseNPCsManagement.mockReturnValue({
        npcs: [],
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: mockSave,
        deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => {
        expect(mockSave).not.toHaveBeenCalled();
        expect(mockAddNPCToInitiative).not.toHaveBeenCalled();
      });
    });

    it('saves NPC and adds to initiative when save-and-add clicked', async () => {
      const mockSave = vi.fn().mockResolvedValue({ npc: { name: 'Goblin', armorClass: 15 } });
      mockUseNPCsManagement.mockReturnValue({
        npcs: defaultNPCs,
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: mockSave,
        deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByTestId('save-add-init-btn'));
      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mockAddNPCToInitiative).toHaveBeenCalled();
      });
    });

    it('closes modal after save-and-add to initiative', async () => {
      const mockSave = vi.fn().mockResolvedValue({ npc: { name: 'Goblin' } });
      mockUseNPCsManagement.mockReturnValue({
        npcs: defaultNPCs,
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: mockSave,
        deleteNPCAction: vi.fn(),
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
      const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      mockUseNPCsManagement.mockReturnValue({
        npcs: defaultNPCs,
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: mockSave,
        deleteNPCAction: vi.fn(),
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
      const mockSave = vi.fn().mockResolvedValue({ npc: { name: 'Goblin', armorClass: 15 } });
      mockUseNPCsManagement.mockReturnValue({
        npcs: defaultNPCs,
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: mockSave,
        deleteNPCAction: vi.fn(),
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

    it('passes disabled=true when saving', async () => {
      mockUseNPCsManagement.mockReturnValue({
        npcs: defaultNPCs,
        loading: false,
        loadNPCsList: vi.fn(),
        saveNPCAction: vi.fn().mockImplementation(() => new Promise(() => {})),
        deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value: 'Goblin' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(screen.getByTestId('modal-disabled')).toHaveTextContent('true');
      });
    });

    it('calls getDefaultFormData with overrides when editing', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      expect(mockGetDefaultFormData).toHaveBeenCalledWith(defaultNPCs[0]);
    });

    it('calls getDefaultFormData with generated data when generating', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /Generate NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      expect(mockGetDefaultFormData).toHaveBeenCalledWith({ name: 'Generated NPC', race: 'Humanoid' });
    });

    it('calls getDefaultFormData with no args when creating new', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      expect(mockGetDefaultFormData).toHaveBeenCalledWith();
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

  describe('loadNPCsList', () => {
    it('calls loadNPCsList on mount with campaignName', () => {
      const mockLoad = vi.fn();
      mockUseNPCsManagement.mockReturnValue({
        npcs: [],
        loading: false,
        loadNPCsList: mockLoad,
        saveNPCAction: vi.fn(),
        deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      expect(mockLoad).toHaveBeenCalled();
    });

    it('does not call loadNPCsList when campaignName is null', () => {
      const mockLoad = vi.fn();
      mockUseNPCsManagement.mockReturnValue({
        npcs: [],
        loading: false,
        loadNPCsList: mockLoad,
        saveNPCAction: vi.fn(),
        deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...{ ...defaultProps, campaignName: null }} />);
      expect(mockLoad).not.toHaveBeenCalled();
    });
  });
});
