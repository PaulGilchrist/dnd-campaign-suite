// @maintained-by-ai: 2026-10-29
// Live-sync contract for the Sessions planner (improve settlements-sessions-
// no-list-sse): every sessions-list-<campaign> SSE event (per server/routes/
// sessions.js broadcastSessionsList: created/updated/deleted/replaced) must
// re-fetch and re-render the list, events for other keys are ignored, and
// re-fetches are skipped while the planner modal is open so a draft in
// progress is never disturbed — but the missed broadcast is applied on close
// so a reopened planner never re-seeds a stale row. Mirrors
// Notes.sse-sync.test.jsx / NPCs.sse-sync.test.jsx. Connects through the ONE
// shared SSE client (subscribeToSSE), never a raw EventSource.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sessions from './Sessions';

let capturedHandler = null;
let unsubscribeCalls = 0;
const mockSubscribe = vi.fn((_campaignName, handler) => {
  capturedHandler = handler;
  return () => {
    capturedHandler = null;
    unsubscribeCalls += 1;
  };
});

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (...args) => mockSubscribe(...args),
}));

let loadCallCount = 0;
let sessionsFixture = [{ name: 'Session 7', date: '2026-10-27', summary: '', links: {}, updatedAt: 1 }];

vi.mock('../../services/campaign/sessionsService.js', () => ({
  loadSessions: vi.fn(async () => {
    loadCallCount += 1;
    return { sessions: sessionsFixture };
  }),
  saveSession: vi.fn(async () => ({ success: true })),
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

vi.mock('./SessionPlannerModal.jsx', () => ({
  default: ({ formData, onFormChange, onClose }) => (
    <div data-testid="session-planner-modal">
      <input
        data-testid="session-name-input"
        aria-label="Session name"
        value={formData?.name ?? ''}
        onChange={(e) => onFormChange('name', e.target.value)}
      />
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
     
      onViewInitiative={vi.fn()}
    />
  );

describe('Sessions live SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    loadCallCount = 0;
    sessionsFixture = [{ name: 'Session 7', date: '2026-10-27', summary: '', links: {}, updatedAt: 1 }];
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', () => {
    const { unmount } = renderSessions();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('re-fetches on sessions-list events for this campaign, surfacing created and deleted sessions', async () => {
    const { findByText } = renderSessions();
    await findByText('Session 7');
    expect(loadCallCount).toBe(1);

    sessionsFixture = [...sessionsFixture, {
      name: 'Session 8', date: '2026-11-03', summary: '', links: {}, updatedAt: 2,
    }];
    capturedHandler({ key: 'sessions-list-test-campaign', data: { action: 'created', name: 'Session 8' } });
    await findByText('Session 8');
    expect(loadCallCount).toBe(2);

    sessionsFixture = sessionsFixture.filter(s => s.name !== 'Session 7');
    capturedHandler({ key: 'sessions-list-test-campaign', data: { action: 'deleted', name: 'Session 7' } });
    await findByText('Session 8');
    expect(screen.queryByText('Session 7')).not.toBeInTheDocument();
    expect(loadCallCount).toBe(3);
  });

  it('ignores SSE events from other keys/campaigns', async () => {
    const { findByText } = renderSessions();
    await findByText('Session 7');

    capturedHandler({ key: 'sessions-list-other-campaign', data: { action: 'replaced' } });
    capturedHandler({ key: 'settlements-list-test-campaign', data: { action: 'replaced' } });
    capturedHandler(null);

    expect(loadCallCount).toBe(1);
  });

  it('skips re-fetches while the planner is open, then applies the missed event on close', async () => {
    const { findByText } = renderSessions();
    await findByText('Session 7');

    fireEvent.click(screen.getByRole('button', { name: /New Session/i }));
    const nameInput = screen.getByTestId('session-name-input');
    fireEvent.change(nameInput, { target: { value: 'Draft session' } });

    sessionsFixture = [{ name: 'Session 7', date: '2026-12-25', summary: '', links: {}, updatedAt: 2 }];
    capturedHandler({ key: 'sessions-list-test-campaign', data: { action: 'updated', name: 'Session 7' } });

    // Open planner untouched (draft intact) and NO background re-fetch.
    expect(nameInput.value).toBe('Draft session');
    expect(loadCallCount).toBe(1);

    // Closing consumes the skipped broadcast immediately — the list must never
    // stay stale so a reopened planner re-seeds a fresh row (409 recovery).
    // The draft is dirty, so Cancel now NAMES the discard (improve
    // 2026-10-29-V): accept it to exercise the close path.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Draft session"?');
    confirmSpy.mockRestore();
    await findByText('2026-12-25');
    expect(loadCallCount).toBe(2);

    // Events arriving with the modal closed keep refreshing live.
    sessionsFixture = [...sessionsFixture, {
      name: 'Session 8', date: '2026-11-03', summary: '', links: {}, updatedAt: 3,
    }];
    capturedHandler({ key: 'sessions-list-test-campaign', data: { action: 'created', name: 'Session 8' } });
    await findByText('Session 8');
    expect(loadCallCount).toBe(3);
  });
});
