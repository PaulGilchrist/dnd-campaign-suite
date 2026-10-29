// @maintained-by-ai: 2026-10-29
// Regression lock for improve 2026-10-29-V (ct-lanes-close-x-unguarded): the
// Sessions lane's ×/Cancel close path must NAME the discard through the
// shared useReloadGuard when the draft is dirty — wizard precedent
// `Discard changes to "X"?` (CharacterCreationWizard.jsx) — naming the
// session the editor shows (typed name, else the row's original; unnamed new
// draft → the wizard's generic new-draft copy). A clean draft keeps closing
// silently, and clean-Cancel-after-a-rejected-save still performs the stale
// refresh side effect. Dismiss is fully inert (editor, draft — zero network);
// accept closes via the same handleCloseModal path; save success stays
// confirm-free. Harness mirrors Sessions.reload-discard-confirm.test.jsx
// (drafts driven via onFormChange(field, value) — no setFormData prop).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sessions from './Sessions';

let loadCallCount = 0;
let saveCallCount = 0;
let saveSessionImpl = async () => ({ success: true });
let sessionsFixture = [{ name: 'Session 7', date: '2026-10-27', summary: '', links: {}, updatedAt: 1 }];

const CONFLICT_MESSAGE =
  'Session "Session 7" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

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

vi.mock('./SessionListItem.jsx', () => ({
  default: ({ session, onEdit }) => (
    <li aria-label={`Edit session: ${session.name}`}>
      <span>{session.name} {session.date}</span>
      <button onClick={() => onEdit(session)}>Edit</button>
    </li>
  ),
}));

// Modal mock: both × and Cancel flow through the lane's onClose prop in the
// real SessionPlannerModal, so one Cancel button exercises the guard copy;
// name/date inputs dirty the draft via onFormChange(field, value).
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
        data-testid="session-name-input"
        aria-label="Session name"
        value={formData?.name ?? ''}
        onChange={(e) => onFormChange('name', e.target.value)}
      />
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

const editor = () => screen.queryByTestId('session-planner-modal');
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' });

describe('Sessions ×/Cancel close: dirty draft names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveSessionImpl = async () => ({ success: true });
    sessionsFixture = [{ name: 'Session 7', date: '2026-10-27', summary: '', links: {}, updatedAt: 1 }];
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty draft + Cancel: exactly ONE named confirm; dismiss is fully inert (zero network)', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('session-date-input'), { target: { value: '2026-12-25' } });

    fireEvent.click(cancelButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Session 7"?');
    // Nothing happened: editor open, draft intact, no fetch.
    expect(editor()).toBeInTheDocument();
    expect(screen.getByTestId('session-date-input').value).toBe('2026-12-25');
    expect(loadCallCount).toBe(1);
    expect(saveCallCount).toBe(0);
  });

  it('accept leg: closes via the same path — no reload, no residue', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('session-name-input'), { target: { value: 'Session 7b' } });
    confirmSpy.mockReturnValue(true);

    fireEvent.click(cancelButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // The typed name is what the editor shows → it names the confirm.
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Session 7b"?');
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(loadCallCount).toBe(1);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean draft: Cancel closes silently, and clean-Cancel after a 409 still refreshes', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    // Untouched draft → silent close, no fetch.
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(cancelButton());
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(loadCallCount).toBe(1);

    // Rejected save with a clean draft → Cancel pays no toll but keeps the
    // stale-list refresh side effect of handleCloseModal.
    saveSessionImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText(/NOT saved/);
    loadCallCount = 0;

    fireEvent.click(cancelButton());
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(loadCallCount).toBe(1);
  });

  it('unnamed new draft: wizard generic new-draft copy', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    fireEvent.change(screen.getByTestId('session-date-input'), { target: { value: '2026-12-25' } });

    fireEvent.click(cancelButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard this new session draft?');
    expect(editor()).toBeInTheDocument();
  });

  it('save success still closes without double-confirm', async () => {
    renderSessions();
    await screen.findByText(/2026-10-27/);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('session-date-input'), { target: { value: '2026-12-25' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(saveCallCount).toBe(1);
  });
});
