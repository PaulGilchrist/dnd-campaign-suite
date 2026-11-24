// @maintained-by-ai
/* QA backlog 2026-11-24 (session-terminating log rows): the server stamps every
 * campaign log row from its LIVE sessionState at write time
 * (server/routes/log.js addEntry — pinned there by server/routes/log.test.js),
 * so Mark-as-Played must post its bookend rows BEFORE the active-session clear
 * lands, or the rows that NAME the session arrive stamped session:null and the
 * session-filter facet can never find them. This file pins the PRODUCER ORDER
 * in handleConfirmMarkPlayed: save played → session-played row → clear. The
 * clear's own audit-row-before-write ordering lives in
 * src/services/combat/sessionService.test.js. */
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sessions from './Sessions.jsx';
import { emptyLinks } from '../../services/campaign/sessionPlannerUtils.js';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

const sessionMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  deleteItem: vi.fn(),
};
vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => sessionMockStore,
}));

// Shared call-order recorder: save played → session-played row → clear must
// be observable as a sequence (this Vitest build exposes no invocationCallOrder).
const laneCalls = [];
vi.mock('../../services/campaign/sessionsService.js', () => ({
  loadSessions: vi.fn(async () => ({ sessions: [] })),
  saveSession: vi.fn(async () => { laneCalls.push('save'); return { success: true }; }),
  saveSessions: vi.fn(async () => ({ success: true })),
  deleteSession: vi.fn(async () => ({ success: true })),
  requestSessionRecap: vi.fn(async () => ({ success: true })),
}));

// Picker batch (loadResourceOptions) — inert empty pickers.
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
  addNPCToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async (campaign, entry) => {
    laneCalls.push('played-row');
    return { ...entry, id: 'row-1' };
  }),
}));
vi.mock('../../services/combat/sessionService.js', () => ({
  setActiveSession: vi.fn(async () => {
    laneCalls.push('clear');
    return { set: true, name: null };
  }),
}));

// The change-data mirror behind useRuntimeValue('campaign','sessionState'):
// mutable per-test state (read only inside callbacks, never at factory time).
const runtime = { sessionState: null };
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => runtime.sessionState),
  getRuntimeValue: vi.fn(() => runtime.sessionState),
  setRuntimeValue: vi.fn(async () => {}),
}));

// RecapButton's pre-gate probe — AI on so the planner renders its faces.
vi.mock('../../services/ai/aiClient.js', () => ({
  getAiStatus: vi.fn(async () => ({ configured: true, mode: 'suggest' })),
  refineEntity: vi.fn(),
}));

import { saveSession } from '../../services/campaign/sessionsService.js';
import { addEntry } from '../../services/ui/logService.js';
import { setActiveSession } from '../../services/combat/sessionService.js';

const makeSession = (name, overrides = {}) => ({
  name,
  date: '',
  status: 'planned',
  summary: '',
  links: emptyLinks(),
  contingencies: [],
  checklist: [],
  ...overrides,
});

function renderSessions() {
  return render(
    <Sessions
      campaignName="test-campaign"
      characters={[]}
      isLocalhost={true}
      onViewInitiative={vi.fn()}
    />
  );
}

// Open the planner on Session 7, arm the in-app recap dialog, Confirm it.
async function confirmMarkPlayed() {
  fireEvent.click(await screen.findByRole('button', { name: /edit session: session 7/i }));
  fireEvent.click(screen.getByRole('button', { name: /mark as played/i }));
  const dialog = screen.getByRole('dialog', { name: 'Mark Session as Played' });
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Great session recap' } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm', exact: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  laneCalls.length = 0;
  runtime.sessionState = null;
  sessionMockStore.items = [makeSession('Session 7')];
  sessionMockStore.loading = false;
});

describe('Sessions — Mark-as-Played bookend stamp ordering (2026-11-24)', () => {
  it('with an ACTIVE session, the session-played row is posted BEFORE the clear lands', async () => {
    runtime.sessionState = { phase: 'exploration', name: 'Session 7' };
    renderSessions();
    await confirmMarkPlayed();

    // The recap row rides the live session (still "Session 7" server-side),
    // and the clear runs only AFTER it — the producer writes both bookend rows
    // while the stamp source is still tracked.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'session-played',
      text: 'Session “Session 7” marked as played — Great session recap',
    }));
    expect(setActiveSession).toHaveBeenCalledWith({ campaignName: 'test-campaign', name: null });
    // The producer sequence itself: archive the row, THEN clear.
    expect(laneCalls).toEqual(['save', 'played-row', 'clear']);

    // Played archive itself unregressed.
    const saved = saveSession.mock.calls.at(-1)[1];
    expect(saved.status).toBe('played');
    expect(saved.summary).toBe('Great session recap');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('with NO active session, the row still posts and nothing is cleared (server stamps it null honestly)', async () => {
    renderSessions();
    await confirmMarkPlayed();

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][1].type).toBe('session-played');
    expect(setActiveSession).not.toHaveBeenCalled();
    expect(saveSession.mock.calls.at(-1)[1].status).toBe('played');
  });

  it('marking a DIFFERENT session played leaves the active session untouched', async () => {
    runtime.sessionState = { phase: 'exploration', name: 'Session 8' };
    renderSessions();
    await confirmMarkPlayed();

    // The row is still posted (stamped live with whatever session the table
    // is playing); only a played session that WAS the active one gets cleared.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(setActiveSession).not.toHaveBeenCalled();
  });
});
