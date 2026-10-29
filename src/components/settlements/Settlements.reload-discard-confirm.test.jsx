// @maintained-by-ai: 2026-10-28
// Regression lock for improve 2026-10-28-T: the Settlements lane must share
// the NPC reload-discard guard (ba51c25ee → shared useReloadGuard) — with
// the editor open and DIRTY under a 409 banner, "Reload list" NAMES the
// discard; Cancel is fully inert (banner, editor, draft survive — zero
// network) and Accept completes the existing one-GET recovery ladder. A
// clean editor keeps the old silent one-click behavior. Legs mirror
// NPCs.reload-discard-confirm.test.jsx; harness mirrors
// Settlements.conflict-reload.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Settlements from './Settlements';

let loadCallCount = 0;
let saveCallCount = 0;
let saveSettlementImpl = async () => ({ success: true });
let settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'old notes', updatedAt: 1 }];

const CONFLICT_MESSAGE =
  'Settlement "Ironhaven" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
const DISCARD_CONFIRM = 'Reload the settlement list and discard your unsaved edits?';

vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(async () => {
    loadCallCount += 1;
    return { settlements: settlementsFixture };
  }),
  saveSettlement: vi.fn(async (...args) => {
    saveCallCount += 1;
    return saveSettlementImpl(...args);
  }),
  saveSettlements: vi.fn(async () => ({ success: true })),
  deleteSettlement: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`preview-toggle-${id}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Import-satisfying mock — this lane never triggers generation here.
vi.mock('../../services/campaign/settlementGenerator.js', () => ({
  generateSettlement: vi.fn(),
}));

const renderSettlements = () =>
  render(<Settlements campaignName="test-campaign" onBack={vi.fn()} />);

const openEditor = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit settlement: Ironhaven' }));
};

// Open the editor, dirty the notes draft, attempt a save → banner up.
const openConflictWithDraft = async (draftNotes) => {
  await openEditor();
  fireEvent.change(screen.getByTestId('preview-toggle-settlement-notes'), {
    target: { value: draftNotes },
  });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await screen.findByText(/NOT saved/);
};

describe('Settlements 409 recovery: Reload list names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveSettlementImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'old notes', updatedAt: 1 }];
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty editor: Reload list asks to discard, Cancel is inert (banner + draft survive, zero network)', async () => {
    renderSettlements();
    await screen.findByText('Ironhaven');
    expect(loadCallCount).toBe(1);

    await openConflictWithDraft('my unsaved draft');

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);

    // Cancel = nothing happened: banner verbatim, editor open, draft intact,
    // no extra fetch.
    expect(screen.getByText(/NOT saved/)).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByTestId('preview-toggle-settlement-notes')).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-settlement-notes').value).toBe('my unsaved draft');
    expect(loadCallCount).toBe(1);
  });

  it('dirty editor: Accept completes the recovery ladder — reload, reopen seeds fresh, re-apply saves 200', async () => {
    renderSettlements();
    await screen.findByText('Ironhaven');

    await openConflictWithDraft('my unsaved draft');

    // What the other tab persisted — the accept-leg refetch surfaces it.
    settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'other-tab notes', updatedAt: 2 }];
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    // Named confirm fired, then the existing one-click recovery ran: editor
    // closed AND the stale list refresh consumed.
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    expect(loadCallCount).toBe(2);

    // Reopen re-seeds the fresh row/stamp and re-applying the edit saves
    // clean — no 409 loop.
    saveSettlementImpl = async () => ({ success: true });
    await openEditor();
    expect(screen.getByTestId('preview-toggle-settlement-notes').value).toBe('other-tab notes');
    expect(loadCallCount).toBe(2);
    fireEvent.change(screen.getByTestId('preview-toggle-settlement-notes'), {
      target: { value: 're-applied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    expect(saveCallCount).toBe(2);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean editor: Reload list stays one click — no confirm, closes + refetches', async () => {
    renderSettlements();
    await screen.findByText('Ironhaven');

    // Conflict with an untouched draft (stale stamp, no local edits).
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByText(/NOT saved/);

    settlementsFixture = [{ name: 'Ironhaven', size: 'town', notes: 'other-tab notes', updatedAt: 2 }];
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    expect(loadCallCount).toBe(2);
  });

  it('draft reverted to the seed counts as clean — no confirm', async () => {
    renderSettlements();
    await screen.findByText('Ironhaven');

    // Type an edit, then undo it before saving: deep-equal to the seed again.
    await openEditor();
    fireEvent.change(screen.getByTestId('preview-toggle-settlement-notes'), {
      target: { value: 'wip' },
    });
    fireEvent.change(screen.getByTestId('preview-toggle-settlement-notes'), {
      target: { value: 'old notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByText(/NOT saved/);

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-settlement-notes')).toBeNull()
    );
    expect(loadCallCount).toBe(2);
  });
});
