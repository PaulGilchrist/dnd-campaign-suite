// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-sessions-settlements-409-recovery-loop-and-no-reload-button:
// the 9cee7bfa2 close-consumes-stale machinery and the ee4f9f177 one-click
// "Reload list" banner button were never ported to the Sessions lane, so a 409
// dead-ended: closing and reopening in-view re-seeded the STALE row (old
// updatedAt) and the re-applied edit repeated the SAME 409 forever. Now a
// rejected save marks the list stale, closing consumes the refresh, and the
// conflict banner offers the one-click recovery. Mirrors the mocked
// service/modal rig of NPCs.stale-list-recovery.test.jsx. NOTE: the sessions
// route publishes no `sessions-list-*` SSE broadcast, so there is no
// skipped-while-editing leg here — the rejected save is the staleness signal.
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
  default: ({ formData, setFormData, error, errorConflict, onReloadList, onClose, onSave }) => (
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
        onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
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

describe('Sessions 409-recovery: close refreshes the stale list + Reload list banner', () => {
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveSessionImpl = async () => ({ success: true });
    sessionsFixture = [{ name: 'Session 7', date: '2026-10-27', summary: '', links: {}, updatedAt: 1 }];
  });
  afterEach(() => {
    // Console warn/error spies are per-test: restore so flagged-409 (warn)
    // and non-conflict (error) lanes never bleed across boundaries.
    vi.restoreAllMocks();
  });

  it('re-fetches on close after a rejected (409) save, so a reopen re-seeds the FRESH row', async () => {
    saveSessionImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    const { findByText } = renderSessions();
    await findByText(/2026-10-27/);
    expect(loadCallCount).toBe(1);

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('session-date-input').value).toBe('2026-10-27');
    fireEvent.click(screen.getByText('Save'));

    // Draft + banner preserved, nothing re-fetched while the modal is open.
    const banner = await screen.findByText(/NOT saved/);
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('session-planner-modal')).toBeInTheDocument();
    expect(loadCallCount).toBe(1);

    // What the other tab persisted — the close refresh will surface it.
    sessionsFixture = [{ name: 'Session 7', date: '2026-11-09', summary: '', links: {}, updatedAt: 2 }];

    // The prescribed recovery: CLOSE — this re-fetches the list…
    fireEvent.click(screen.getByText('Cancel'));
    await findByText(/2026-11-09/);
    expect(loadCallCount).toBe(2);

    // …so the REOPEN seeds the fresh row (pre-fix it re-seeded '2026-10-27'
    // and the next save repeated the same 409 forever). No fetch on reopen.
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('session-date-input').value).toBe('2026-11-09');
    expect(loadCallCount).toBe(2);
  });

  it('conflict banner carries a Reload list action — one click closes + refetches so the reopen seeds the fresh row', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Service errors from a 409 carry { conflict: true } (server conflict body).
    saveSessionImpl = async () => {
      throw Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });
    };
    renderSessions();
    await screen.findByText(/2026-10-27/);
    expect(loadCallCount).toBe(1);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    // Banner copy is unchanged and now offers the one-click recovery.
    const banner = await screen.findByText(/NOT saved/);
    expect(banner).toHaveTextContent(CONFLICT_MESSAGE);
    const reloadButton = screen.getByRole('button', { name: 'Reload list' });
    // Nothing re-fetched while the editor stays open on the refusal.
    expect(loadCallCount).toBe(1);
    // improve 2026-10-27-H: rejected edit stays amber — no red console ERROR.
    expect(warnSpy).toHaveBeenCalledWith(
      'Concurrent-edit conflict saving session:',
      CONFLICT_MESSAGE
    );
    expect(errorSpy).not.toHaveBeenCalled();

    // What the other tab persisted — the refetch below will surface it.
    sessionsFixture = [{ name: 'Session 7', date: '2026-11-09', summary: '', links: {}, updatedAt: 2 }];
    fireEvent.click(reloadButton);

    // ONE click = the full sanctioned recovery: editor closed AND the stale
    // list refresh consumed (the 9cee7bfa2 close path, no extra steps).
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    await screen.findByText(/2026-11-09/);
    expect(loadCallCount).toBe(2);

    // Reopen seeds the FRESH row/stamp — re-applying the edit now saves 200.
    saveSessionImpl = async () => ({ success: true });
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('session-date-input').value).toBe('2026-11-09');
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    expect(saveCallCount).toBe(2);
  });

  it('non-conflict save errors render the old copy-only banner (no Reload list)', async () => {
    saveSessionImpl = async () => {
      throw new Error('An error saving session');
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderSessions();
    await screen.findByText(/2026-10-27/);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText(/An error saving session/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
    // Genuine failures still log red; warn channel untouched.
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to save session:',
      expect.objectContaining({ message: 'An error saving session' })
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT add redundant fetches on a clean close or after a successful save', async () => {
    const { findByText } = renderSessions();
    await findByText(/2026-10-27/);
    expect(loadCallCount).toBe(1);

    // Clean close with nothing missed: still just the mount load.
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    expect(loadCallCount).toBe(1);

    // Successful save reloads exactly once (save path) and close adds nothing.
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByTestId('session-planner-modal')).not.toBeInTheDocument());
    expect(saveCallCount).toBe(1);
    expect(loadCallCount).toBe(2);
  });
});
