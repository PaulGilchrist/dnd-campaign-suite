// @maintained-by-ai: 2026-11-16
// Client-side bestiary-name gate for the NPCs manager (2026-11-16 WK backlog):
// a published-monster name DISABLES Save live while typing (same disabled
// family as the empty-name gate) and shows the server guard's copy VERBATIM
// inline beside the name field, so the doomed PUT → 400 round-trip is never
// paid (dup-quest block pattern in Quests.jsx). While the name-set is still
// loading or the load failed, the gate is INERT — the server 400 stays the
// authoritative backstop and its verbatim inline refusal works exactly as
// before. The gate module is mocked here only for its LOADER (controlled
// name-set); the predicate + error copy are the real ones.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCs from './NPCs';

// The authoritative wording lives in server/routes/npcs.js bestiaryNameError().
const goblinCopy = (name) =>
  `"${name}" is a published monster — monsters join through the Encounter Builder with their real stat block. NPCs are for custom characters with their own name.`;
const SERVER_COPY = goblinCopy('Goblin');

const mockGate = vi.hoisted(() => ({ promise: null }));
vi.mock('../../services/npcs/bestiaryNameGuard.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadBestiaryMonsterNames: () => mockGate.promise };
});

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
  { name: 'Marta Copperkettle', race: 'Tiefling' },
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
// Let the mount effect's name-set promise land (keeps act honest).
const settle = async () => { await act(async () => {}); };
const setName = (value) =>
  fireEvent.change(screen.getByTestId('npc-name-input'), { target: { value } });
const saveButton = () => screen.getByRole('button', { name: 'Save' });

describe('NPCs — bestiary-name client gate (2026-11-16 WK backlog)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultFormData.mockReturnValue({ name: '' });
    mockCleanNPCData.mockImplementation((data) => ({ ...data, cleaned: true }));
    mockSaveNPC.mockResolvedValue({ success: true });
    // Loaded name-set proves the match (server-semantics lowercase set).
    mockGate.promise = Promise.resolve(new Set(['goblin', 'ogre']));
  });

  it('typed bestiary name disables Save + shows the server copy verbatim, zero service calls', async () => {
    renderNPCs();
    openNewForm();
    setName('Goblin');

    expect(await screen.findByTestId('npc-form-error')).toHaveTextContent(SERVER_COPY);
    expect(saveButton()).toBeDisabled();

    // A stray click on the disabled button pays NOTHING (no PUT round-trip).
    fireEvent.click(saveButton());
    expect(mockSaveNPC).not.toHaveBeenCalled();
    expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
  });

  it('mirrors the server guard semantics: case-insensitive, trimmed, exact match only', async () => {
    renderNPCs();
    openNewForm();

    // Trim + case fold the same way the server PUT lane does (newName.trim(),
    // lowercase compare) — the hint quotes the TRIMMED name like the server.
    setName('  goblin  ');
    expect(await screen.findByTestId('npc-form-error')).toHaveTextContent(goblinCopy('goblin'));
    expect(saveButton()).toBeDisabled();

    // 'Goblins' merely CONTAINS a bestiary name — never a false positive.
    setName('Goblins');
    await waitFor(() => expect(screen.queryByTestId('npc-form-error')).not.toBeInTheDocument());
    expect(saveButton()).toBeEnabled();
  });

  it('a normal name keeps Save enabled and saves through the untouched service lane', async () => {
    renderNPCs();
    await settle();
    openNewForm();
    // Distinct from the list fixtures — the dup-name guard owns collisions.
    setName('Nula Thornwood');
    expect(saveButton()).toBeEnabled();

    fireEvent.click(saveButton());
    await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
  });

  it('opening an existing custom NPC leaves Save enabled (no gate on fixture rows)', async () => {
    renderNPCs();
    await settle();
    fireEvent.click(screen.getByTestId('edit-btn-Marta Copperkettle'));
    setName('Marta Copperkettle');
    expect(screen.queryByTestId('npc-form-error')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('renaming a custom NPC onto a bestiary name disables Save + shows the hint with zero saves', async () => {
    renderNPCs();
    fireEvent.click(screen.getByTestId('edit-btn-QA Test NPC'));
    setName('Goblin');

    expect(await screen.findByTestId('npc-form-error')).toHaveTextContent(SERVER_COPY);
    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(mockSaveNPC).not.toHaveBeenCalled();
  });

  it('load failure (null name-set) leaves the gate inert: Save stays enabled, service lane + verbatim server refusal unchanged', async () => {
    mockGate.promise = Promise.resolve(null); // monsters.json unreadable — fail open
    mockSaveNPC.mockRejectedValueOnce(new Error(SERVER_COPY)); // the live 400 copy

    renderNPCs();
    openNewForm();
    setName('Goblin');
    await settle(); // the failed load lands a null name-set — gate stays inert

    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
    // The server-backstop inline refusal still renders verbatim.
    expect(await screen.findByTestId('npc-form-error')).toHaveTextContent(SERVER_COPY);
  });

  it('while the name-set is still loading, Save is never permanently disabled by this gate', async () => {
    mockGate.promise = new Promise(() => {}); // never resolves

    renderNPCs();
    openNewForm();
    setName('Goblin');
    await settle(); // the never-resolving loader lands nothing — gate stays inert

    expect(screen.queryByTestId('npc-form-error')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockSaveNPC).toHaveBeenCalledTimes(1));
  });
});
