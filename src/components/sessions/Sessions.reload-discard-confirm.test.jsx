// @maintained-by-ai: 2026-10-29
// Regression lock for improve 2026-10-29-V (Sessions dirty-Reload silently
// discards the open draft): the 409 banner's one-click "Reload list" must
// NAME the discard via the shared useReloadGuard like the five .ct-* sibling
// lanes. With unsaved edits (deep-compare against the seed snapshot taken at
// open) it fires the house NAMED-confirm; Cancel is fully inert (banner,
// editor, draft survive — zero network) and Accept completes the existing
// recovery ladder. A clean editor keeps the old one-click behavior — no extra
// prompt. Harness mirrors NPCs.reload-discard-confirm.test.jsx and reuses the
// mocked service/modal rig of Sessions.conflict-reload.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sessions from './Sessions';

let loadCallCount = 0;
let saveCallCount = 0;
let saveSessionImpl = async () => ({ success: true });
let sessionsFixture = [{ name: 'Session 7', date: '2026-10-27', summary: '', links: {}, updatedAt: 1 }];

const CONFLICT_MESSAGE =
  'Session "Session 7" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
const DISCARD_CONFIRM = 'Reload the session list and discard your unsaved edits?';

vi.mock('../../services/campaign/sessionsService.js', () => ({
  loadSessions: vi.fn(async () => {
    loadCallCount += 1;
    return { sessions: sessionsFixture };
  }),
  saveSession: vi.fn(async (...args) => {
    saveCallCount += 1;
    return saveSessionImpl(...args);
  }),
  saveSessions: vi.fn(async () => ({ success: true })),
  deleteSession: vi.fn(async () => ({ success: true })),
}));

// Picker loaders (loadResourceOptions) — inert empty pickers for these tests.
vi.mock('../../services/maps/mapsService.js', () => ({
  loadMaps: vi.fn(async () => ({ maps: [] })),
  activateMap: vi.fn(async () => ({ success: true })),
}));
vi.mock('../../services/encounters/encountersService.js', () => ({
  loadEncounters: vi.fn(async () => ({ encounters: [] })),
}));
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(async () => ({ npcs: [] })),
}));
vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuests: vi.fn(async () => ({ quests: [] })),
}));
vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(async () => ({ settlements: [] })),
}));
vi.mock('../../services/campaign/notesService.js', () => ({
  loadNotes: vi.fn(async () => ({ notes: [] })),
}));
vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

// Row mock renders the date so "stale list" is observable.
vi.mock('./SessionListItem.jsx', () => ({
  default: ({ session, onEdit }) => (
    <li aria-label={`Edit session: ${session.name}`}>
      <span>{session.name} {session.date}</span>
      <button onClick={() => onEdit(session)}>Edit</button>
    </li>
  ),
}));

// Modal mock exposes the seeded draft (date), the inline error banner, the
// conflict "Reload list" action contract, and Save/Cancel wired to the real
// handlers. (The real modal's own rendering lives in SessionPlannerModal.test.jsx.)
vi.mock('./SessionPlannerModal.jsx', () => ({
  default: ({ formData, onFormChange, error, errorConflict, onReloadList, onClose, onSave }) => (
    <div data-testid="session-planner-modal">
      {error ? (
        <div className="sessions-form-error">
          {error}
          {errorConflict && onReloadList ? (
            <button onClick={onReloadList}>Reload list</button>
          ) : null}
        </div>
      ) : null}
      <input
        data-testid="session-date-input"
        value={formData?.date ?? ''}
        onChange={(e) => onFormChange('date', e.target.value)}
      />
      <button onClick={onSave}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  ),
}));

const renderSessions = () =>
  render(
    <Sessions
      campaignName="test-campaign"
      characters={[]}
      isLocalhost={true}
      onBack={vi.fn()}
      onViewInitiative={vi.fn()}
    />
  );

// Open the planner, dirty the draft, attempt a save → 409 banner showing.
const openConflictWithDraft = async (draftDate) => {
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.change(screen.getByTestId('session-date-input'), { target: { value: draftDate } });
  fireEvent.click(screen.getByText('Save'));
  await screen.findByText(/NOT saved/);
};

describe('Sessions 409 recovery: Reload list names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveSessionImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    sessionsFixture = [{ name: 'Session 7', date: '2026-10-27', summary: '', links: {}, updatedAt: 1 }];
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty editor: Reload list fires exactly ONE named confirm with verbatim copy', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);
    expect(loadCallCount).toBe(1);

    await openConflictWithDraft('2026-12-25');

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);
  });

  it('cancel leg: fully inert — banner, editor, and draft survive, zero network', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    await openConflictWithDraft('2026-12-25');

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    // confirmSpy answers false (beforeEach default).

    // Nothing happened: banner verbatim, editor open, draft intact, no fetch.
    expect(screen.getByText(/NOT saved/)).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByTestId('session-planner-modal')).toBeInTheDocument();
    expect(screen.getByTestId('session-date-input').value).toBe('2026-12-25');
    expect(loadCallCount).toBe(1);
  });

  it('accept leg: closes the editor + refetches, reopen seeds fresh, re-apply saves clean', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    await openConflictWithDraft('2026-12-25');

    // What the other tab persisted — the accept-leg refetch surfaces it.
    sessionsFixture = [{ name: 'Session 7', date: '2026-11-09', summary: '', links: {}, updatedAt: 2 }];
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    // Named confirm fired, then the existing one-click recovery ran: editor
    // closed, banner cleared AND the stale list refresh consumed.
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
    await screen.findByText(/2026-11-09/);
    expect(loadCallCount).toBe(2);

    // Reopen re-seeds the fresh row/stamp and re-applying the edit saves
    // clean — no 409 loop.
    saveSessionImpl = async () => ({ success: true });
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('session-date-input').value).toBe('2026-11-09');
    expect(loadCallCount).toBe(2);
    fireEvent.change(screen.getByTestId('session-date-input'), { target: { value: '2026-11-30' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    expect(saveCallCount).toBe(2);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean editor: Reload list stays one click — no confirm, closes + refetches', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    // Conflict with an untouched draft (stale stamp, no local edits).
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText(/NOT saved/);

    sessionsFixture = [{ name: 'Session 7', date: '2026-11-09', summary: '', links: {}, updatedAt: 2 }];
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    await screen.findByText(/2026-11-09/);
    expect(loadCallCount).toBe(2);
  });

  it('draft reverted to the seed counts as clean — no confirm', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    // Type an edit, then undo it before saving: deep-equal to the seed again.
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('session-date-input'), { target: { value: '2026-12-25' } });
    fireEvent.change(screen.getByTestId('session-date-input'), { target: { value: '2026-10-27' } });
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText(/NOT saved/);

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    expect(loadCallCount).toBe(2);
  });
});
