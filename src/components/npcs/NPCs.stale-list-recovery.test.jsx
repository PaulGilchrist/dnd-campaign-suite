// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-409-reopen-reseeds-stale-list-recovery-loop:
// after a concurrent-save 409 the guided recovery ("close, reopen, re-apply")
// used to dead-end — closing the editor never re-fetched the list (the SSE
// refresh was skipped while the modal was open), so the reopen re-seeded the
// stale row (old updatedAt) and saving again repeated the SAME 409 forever.
// Now the missed broadcast (and any rejected save) is consumed on close: the
// list re-fetches and the next reopen seeds a fresh row. Mirrors the mocked
// service/SSE harness of NPCs.sse-sync.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCs from './NPCs';

let capturedHandler = null;
const mockSubscribe = vi.fn((_campaignName, handler) => {
  capturedHandler = handler;
  return () => { capturedHandler = null; };
});

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (...args) => mockSubscribe(...args),
}));

let loadCallCount = 0;
let saveCallCount = 0;
let saveNPCImpl = async () => ({ success: true });
let npcsFixture = [{ name: 'Marta Copperkettle', notes: 'old notes', updatedAt: 1 }];

const CONFLICT_MESSAGE =
  'NPC "Marta Copperkettle" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

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

// Row mock mirrors the list refresh (shows notes) so "stale list" is observable.
vi.mock('./NPCListItem.jsx', () => ({
  default: ({ npc, onEdit }) => (
    <li aria-label={`Edit NPC: ${npc.name}`}>
      <span>{npc.name} {npc.notes}</span>
      <button onClick={() => onEdit(npc)}>Edit</button>
    </li>
  ),
}));

// Modal mock exposes the seeded draft (notes), the inline error banner, the
// conflict "Reload list" action contract, and Save/Cancel wired to the real
// handlers. (The real modal's own rendering is pinned in NPCFormModal.test.jsx.)
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
  render(<NPCs campaignName="test-campaign" onBack={vi.fn()} onViewInitiative={vi.fn()} />);

describe('NPCs 409-recovery: close refreshes the stale list', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    loadCallCount = 0;
    saveCallCount = 0;
    saveNPCImpl = async () => ({ success: true });
    npcsFixture = [{ name: 'Marta Copperkettle', notes: 'old notes', updatedAt: 1 }];
  });

  it('re-fetches on close after a broadcast was skipped while editing, so a reopen re-seeds the FRESH row', async () => {
    const { findByText } = renderNPCs();
    await findByText(/old notes/);
    expect(loadCallCount).toBe(1);

    // Tab A opens the editor on the stale row.
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('npc-notes-input').value).toBe('old notes');

    // Tab B saves → server broadcasts; the refresh is skipped (draft protected)
    // but the miss is now recorded.
    npcsFixture = [{ name: 'Marta Copperkettle', notes: 'other-tab notes', updatedAt: 2 }];
    capturedHandler({ key: 'npcs-list-test-campaign', data: { action: 'updated', name: 'Marta Copperkettle' } });
    expect(screen.getByTestId('npc-notes-input').value).toBe('old notes');
    expect(loadCallCount).toBe(1);

    // The prescribed recovery: CLOSE — this re-fetches the list…
    fireEvent.click(screen.getByText('Cancel'));
    await findByText(/other-tab notes/);
    expect(loadCallCount).toBe(2);

    // …so the REOPEN seeds the fresh row (pre-fix it re-seeded 'old notes'
    // and the next save repeated the same 409 forever). No fetch on reopen.
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('npc-notes-input').value).toBe('other-tab notes');
    expect(loadCallCount).toBe(2);
  });

  it('re-fetches on close after a rejected (409) save even with no visible SSE echo', async () => {
    saveNPCImpl = async () => { throw new Error(CONFLICT_MESSAGE); };
    renderNPCs();
    await screen.findByText(/old notes/);
    expect(loadCallCount).toBe(1);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    // Draft + banner preserved, nothing re-fetched while the modal is open.
    const banner = await screen.findByText(/NOT saved/);
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    expect(loadCallCount).toBe(1);

    // A rejected save proves the server row moved on — closing refreshes.
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(loadCallCount).toBe(2));
  });

  it('does NOT add redundant fetches on a clean close or after a successful save', async () => {
    const { findByText } = renderNPCs();
    await findByText(/old notes/);
    expect(loadCallCount).toBe(1);

    // Clean close with nothing missed: still just the mount load.
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    expect(loadCallCount).toBe(1);

    // Successful save reloads exactly once (save path) and close adds nothing.
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    expect(saveCallCount).toBe(1);
    expect(loadCallCount).toBe(2);
  });

  it('conflict banner carries a Reload list action — one click closes + refetches so the reopen seeds the fresh row', async () => {
    // Service errors from a 409 carry { conflict: true } (server conflict body).
    saveNPCImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    renderNPCs();
    await screen.findByText(/old notes/);
    expect(loadCallCount).toBe(1);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    // Banner copy is unchanged and now offers the one-click recovery.
    const banner = await screen.findByText(/NOT saved/);
    expect(banner).toHaveTextContent(CONFLICT_MESSAGE);
    const reloadButton = screen.getByRole('button', { name: 'Reload list' });
    // Nothing re-fetched while the editor stays open on the refusal.
    expect(loadCallCount).toBe(1);

    // What the other tab persisted — the refetch below will surface it.
    npcsFixture = [{ name: 'Marta Copperkettle', notes: 'other-tab notes', updatedAt: 2 }];
    fireEvent.click(reloadButton);

    // ONE click = the full sanctioned recovery: editor closed AND the stale
    // list refresh consumed (the 9cee7bfa2 close path, no extra steps).
    await waitFor(() => expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument());
    await screen.findByText(/other-tab notes/);
    expect(loadCallCount).toBe(2);

    // Reopen seeds the FRESH row/stamp — re-applying the edit now saves 200.
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('npc-notes-input').value).toBe('other-tab notes');
    expect(loadCallCount).toBe(2);
  });

  it('non-conflict save errors render the old copy-only banner (no Reload list)', async () => {
    saveNPCImpl = async () => {
      throw new Error('An NPC with that name already exists');
    };
    renderNPCs();
    await screen.findByText(/old notes/);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
  });
});
