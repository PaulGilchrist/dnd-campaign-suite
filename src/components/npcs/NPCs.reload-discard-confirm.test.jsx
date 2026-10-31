// @maintained-by-ai: 2026-10-28
// Regression lock for improve 2026-10-28 (NPCs 409 recovery silently discards
// the open draft): "Reload list" must NAME the discard before it acts. With
// unsaved edits (deep-compare against the seed snapshot) it fires the house
// NAMED-confirm; Cancel is fully inert (banner, editor, draft survive — zero
// network) and Accept completes the existing recovery ladder. A clean editor
// keeps the old one-click behavior — no extra prompt. Harness mirrors
// NPCs.stale-list-recovery.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NPCs from './NPCs';

const mockSubscribe = vi.fn(() => () => {});

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (...args) => mockSubscribe(...args),
}));

let loadCallCount = 0;
let saveCallCount = 0;
let saveNPCImpl = async () => ({ success: true });
let npcsFixture = [{ name: 'Marta Copperkettle', notes: 'old notes', updatedAt: 1 }];

const CONFLICT_MESSAGE =
  'NPC "Marta Copperkettle" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
const DISCARD_CONFIRM = 'Reload the NPC list and discard your unsaved edits?';

vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(async () => {
    loadCallCount += 1;
    return { npcs: npcsFixture };
  }),
  saveNPC: vi.fn(async (...args) => {
    saveCallCount += 1;
    return saveNPCImpl(...args);
  }),
  saveNPCs: vi.fn(async () => ({ success: true })),
  deleteNPC: vi.fn(async () => ({ success: true })),
}));

// Row + modal mocks mirror NPCs.stale-list-recovery.test.jsx: the list row
// shows notes (refreshes observable) and the modal exposes the draft, the
// conflict banner with its "Reload list" action, and Save/Cancel.
vi.mock('./NPCListItem.jsx', () => ({
  default: ({ npc, onEdit }) => (
    <li aria-label={`Edit NPC: ${npc.name}`}>
      <span>{npc.name} {npc.notes}</span>
      <button onClick={() => onEdit(npc)}>Edit</button>
    </li>
  ),
}));

vi.mock('./NPCFormModal.jsx', () => ({
  default: ({ formData, setFormData, error, errorConflict, onReloadList, onClose, onSave }) => (
    <div data-testid="npc-form-modal">
      {error ? (
        <div className="npcs-form-error">
          {error}
          {errorConflict && onReloadList ? (
            <button onClick={onReloadList}>Reload list</button>
          ) : null}
        </div>
      ) : null}
      <input
        data-testid="npc-notes-input"
        value={formData?.notes ?? ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
      />
      <button onClick={onSave}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  ),
}));

vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: vi.fn(),
}));

vi.mock('../../services/npcs/npcGenerator.js', () => ({
  generateNPC: vi.fn(async () => ({})),
}));

const renderNPCs = () =>
  render(<NPCs campaignName="test-campaign" onViewInitiative={vi.fn()} />);

// Open the editor, dirty the draft, attempt a save → 409 banner showing.
const openConflictWithDraft = async (draftNotes) => {
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.change(screen.getByTestId('npc-notes-input'), { target: { value: draftNotes } });
  fireEvent.click(screen.getByText('Save'));
  await screen.findByText(/NOT saved/);
};

describe('NPCs 409 recovery: Reload list names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    mockSubscribe.mockClear();
    loadCallCount = 0;
    saveCallCount = 0;
    saveNPCImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    npcsFixture = [{ name: 'Marta Copperkettle', notes: 'old notes', updatedAt: 1 }];
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty editor: Reload list asks to discard, Cancel is inert (banner + draft survive, zero network)', async () => {
    renderNPCs();
    await screen.findByText(/old notes/);
    expect(loadCallCount).toBe(1);

    await openConflictWithDraft('my unsaved draft');

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);

    // Cancel = nothing happened: banner verbatim, editor open, draft intact,
    // no extra fetch.
    expect(screen.getByText(/NOT saved/)).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('npc-notes-input').value).toBe('my unsaved draft');
    expect(loadCallCount).toBe(1);
  });

  it('dirty editor: Accept completes the recovery ladder — reload, reopen seeds fresh, re-apply saves 200', async () => {
    renderNPCs();
    await screen.findByText(/old notes/);

    await openConflictWithDraft('my unsaved draft');

    // What the other tab persisted — the accept-leg refetch surfaces it.
    npcsFixture = [{ name: 'Marta Copperkettle', notes: 'other-tab notes', updatedAt: 2 }];
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    // Named confirm fired, then the existing one-click recovery ran: editor
    // closed AND the stale list refresh consumed.
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);
    await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    await screen.findByText(/other-tab notes/);
    expect(loadCallCount).toBe(2);

    // Reopen re-seeds the fresh row/stamp and re-applying the edit saves
    // clean — no 409 loop.
    saveNPCImpl = async () => ({ success: true });
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('npc-notes-input').value).toBe('other-tab notes');
    expect(loadCallCount).toBe(2);
    fireEvent.change(screen.getByTestId('npc-notes-input'), { target: { value: 're-applied' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    expect(saveCallCount).toBe(2);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean editor: Reload list stays one click — no confirm, closes + refetches', async () => {
    renderNPCs();
    await screen.findByText(/old notes/);

    // Conflict with an untouched draft (stale stamp, no local edits).
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText(/NOT saved/);

    npcsFixture = [{ name: 'Marta Copperkettle', notes: 'other-tab notes', updatedAt: 2 }];
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    await screen.findByText(/other-tab notes/);
    expect(loadCallCount).toBe(2);
  });

  it('draft reverted to the seed counts as clean — no confirm', async () => {
    renderNPCs();
    await screen.findByText(/old notes/);

    // Type an edit, then undo it before saving: deep-equal to the seed again.
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('npc-notes-input'), { target: { value: 'wip' } });
    fireEvent.change(screen.getByTestId('npc-notes-input'), { target: { value: 'old notes' } });
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText(/NOT saved/);

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    expect(loadCallCount).toBe(2);
  });
});
