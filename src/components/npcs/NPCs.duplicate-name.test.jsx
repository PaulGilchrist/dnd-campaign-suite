// @maintained-by-ai: 2026-10-14
// Duplicate-name contract for the NPCs manager: saving a new NPC (or renaming
// onto another NPC's name, any case) must show an inline error without
// persisting, mirroring the server guard in server/routes/npcs.js — which
// also 400s the same message plus the bestiary-name refusal (npcs.json is
// for CUSTOM NPCs only, pre-made monsters join via the Encounter Builder).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCs from './NPCs';

const mockUseNPCsManagement = vi.fn();
vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (...args) => mockUseNPCsManagement(...args),
}));

vi.mock('./NPCListItem.jsx', () => ({
  default: ({ npc, onEdit }) => (
    <li data-testid={`npc-list-item-${npc.name}`}>
      <button data-testid={`edit-btn-${npc.name}`} onClick={() => onEdit(npc)}>Edit</button>
    </li>
  ),
}));

vi.mock('./NPCFormModal.jsx', () => ({
  default: ({ formData, setFormData, onClose, onSave, onSaveAndAddToInitiative, disabled, error }) => (
    <div data-testid="npc-form-modal">
      {error && <div data-testid="npc-form-error">{error}</div>}
      <input
        data-testid="npc-name-input"
        value={formData?.name || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
      />
      <button onClick={onClose}>Cancel</button>
      <button onClick={onSave} disabled={disabled}>Save</button>
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

vi.mock('../../services/npcs/npcGenerator.js', () => ({
  generateNPC: vi.fn(async () => ({})),
}));

const mockSaveNPC = vi.fn();
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(async () => ({ npcs: [] })),
  saveNPC: (...args) => mockSaveNPC(...args),
  saveNPCs: vi.fn(),
  deleteNPC: vi.fn(),
}));

const npcs = [
  { name: 'QA Test NPC', race: 'Human' },
  { name: 'Goblin', race: 'Humanoid' },
];

function renderNPCs() {
  mockUseNPCsManagement.mockReturnValue({
    items: npcs,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn(),
    deleteItem: vi.fn(),
  });
  return render(
    <NPCs campaignName="test-campaign" onViewInitiative={vi.fn()} />
  );
}

const openNewForm = () => fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
const setName = (value) =>
  fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value } });
const clickSave = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('NPCs duplicate-name guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultFormData.mockReturnValue({ name: '' });
    mockCleanNPCData.mockImplementation((data) => ({ ...data, cleaned: true }));
    mockSaveNPC.mockResolvedValue({ success: true });
  });

  it.each(['QA Test NPC', 'qa test npc'])(
    'blocks saving a new NPC named "%s" as a duplicate, without persisting',
    (name) => {
      renderNPCs();
      openNewForm();
      setName(name);
      clickSave();

      expect(screen.getByTestId('npc-form-error')).toHaveTextContent(
        'An NPC with that name already exists'
      );
      expect(mockSaveNPC).not.toHaveBeenCalled();
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    }
  );

  it('blocks renaming an existing NPC onto another NPC name but allows saving its own name', async () => {
    renderNPCs();
    fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
    setName('QA Test NPC');
    clickSave();

    expect(screen.getByTestId('npc-form-error')).toBeInTheDocument();
    expect(mockSaveNPC).not.toHaveBeenCalled();

    setName('Goblin');
    clickSave();
    await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('npc-form-error')).not.toBeInTheDocument();
  });

  it('blocks Save & Add to Initiative on a duplicate name', () => {
    renderNPCs();
    fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
    setName('QA Test NPC');
    fireEvent.click(screen.getByTestId('save-add-init-btn'));

    expect(screen.getByTestId('npc-form-error')).toBeInTheDocument();
    expect(mockSaveNPC).not.toHaveBeenCalled();
    expect(mockAddNPCToInitiative).not.toHaveBeenCalled();
  });

  it('clears the error when reopening the form and saves a uniquely-named NPC', async () => {
    renderNPCs();
    openNewForm();
    setName('QA Test NPC');
    clickSave();
    expect(screen.getByTestId('npc-form-error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    openNewForm();
    expect(screen.queryByTestId('npc-form-error')).not.toBeInTheDocument();

    setName('Unique NPC');
    clickSave();
    await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
  });

  it('shows the server error message inline when the server rejects a save', async () => {
    mockSaveNPC.mockRejectedValueOnce(new Error('An NPC with that name already exists'));
    renderNPCs();
    openNewForm();
    setName('Other NPC');
    clickSave();

    await waitFor(() => expect(screen.getByTestId('npc-form-error')).toBeInTheDocument());
    expect(screen.getByTestId('npc-form-error')).toHaveTextContent(
      'An NPC with that name already exists'
    );
    expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
  });
});
