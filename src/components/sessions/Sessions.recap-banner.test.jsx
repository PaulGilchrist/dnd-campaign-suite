// @maintained-by-ai
/* Backlog 2026-11-21 GGG (recap success feedback asymmetric): a successful
 * Write recap left only the transient toast — once it faded, the OPEN planner
 * modal held zero witness that the recap landed. Success now rides the SAME
 * persistent banner region as the refusal copy, success-toned
 * (.sessions-form-success vs .sessions-form-error), and the lifecycle mirrors
 * the refusal discipline: a new attempt clears the prior banner, closing the
 * modal discards it. The write lane (POST /ai/recap, session_recap row) is
 * untouched — this file pins the client feedback UI only. */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sessions from './Sessions.jsx';
import { emptyLinks } from '../../services/campaign/sessionPlannerUtils.js';

// Shared SSE client (Subscriber) — inert, as in Sessions.test.jsx.
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

vi.mock('../../services/campaign/sessionsService.js', () => ({
  loadSessions: vi.fn(async () => ({ sessions: [] })),
  saveSession: vi.fn(async () => ({ success: true })),
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
  addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../services/combat/sessionService.js', () => ({
  setActiveSession: vi.fn(async () => ({})),
}));

// The modal's RecapButton pre-gate probes GET /ai/status — AI on, so the
// button is its enabled face throughout.
vi.mock('../../services/ai/aiClient.js', () => ({
  getAiStatus: vi.fn(async () => ({ configured: true, mode: 'suggest' })),
  refineEntity: vi.fn(),
}));

import { requestSessionRecap } from '../../services/campaign/sessionsService.js';

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

const SUCCESS_COPY = 'Recap of “Session 7” posted to the campaign log — open the Log to read it';
const NO_ROWS_COPY =
  'The campaign log holds no rows for session “Session 7” — set it as the active session while you play, or check its name';

const successBanner = () => document.querySelector('.sessions-form-success');
const errorBanner = () => document.querySelector('.sessions-form-error');

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

async function openRecapFace(recapImpl) {
  sessionMockStore.items = [makeSession('Session 7')];
  requestSessionRecap.mockImplementation(recapImpl);
  renderSessions();
  fireEvent.click(await screen.findByRole('button', { name: /edit session: session 7/i }));
  fireEvent.click(screen.getByRole('button', { name: /write recap/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMockStore.items = [];
  sessionMockStore.loading = false;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sessions planner banner — recap success face (2026-11-21 GGG)', () => {
  it('posts success as a persistent inline banner in the refusal region, no toast witness needed', async () => {
    await openRecapFace(async () => ({ success: true }));

    await waitFor(() => expect(requestSessionRecap).toHaveBeenCalledWith('test-campaign', 'Session 7'));
    await waitFor(() => expect(successBanner()).not.toBeNull());
    expect(successBanner().textContent).toBe(SUCCESS_COPY);
    // One region, one tone at a time — and the banner never depends on the
    // (now-removed) toast to be believed.
    expect(errorBanner()).toBeNull();
    expect(document.querySelector('.sessions-toast')).toBeNull();
  });

  it('refusal face unregressed: the no-rows 400 copy renders verbatim as the error banner', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openRecapFace(async () => {
      throw new Error(NO_ROWS_COPY);
    });

    await waitFor(() => expect(errorBanner()).not.toBeNull());
    expect(errorBanner().textContent).toBe(NO_ROWS_COPY);
    expect(successBanner()).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(
      'Failed to write the session recap:',
      expect.objectContaining({ message: NO_ROWS_COPY })
    );
  });

  it('lifecycle: a new Write recap attempt clears the prior banner before it starts', async () => {
    await openRecapFace(async () => ({ success: true }));
    await waitFor(() => expect(successBanner()).not.toBeNull());

    // Second attempt never resolves — the reset must be visible immediately,
    // no stale success banner glowing while a new recap generates.
    openRecapFacePending();
    await waitFor(() => expect(requestSessionRecap).toHaveBeenCalledTimes(2));
    expect(successBanner()).toBeNull();
    expect(errorBanner()).toBeNull();
  });

  it('lifecycle: closing the planner discards the banner — reopen shows no residue', async () => {
    await openRecapFace(async () => ({ success: true }));
    await waitFor(() => expect(successBanner()).not.toBeNull());

    // Clean draft closes with no confirm (existing discipline).
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /write recap/i })).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /edit session: session 7/i }));
    expect(successBanner()).toBeNull();
    expect(errorBanner()).toBeNull();
  });
});

// Helper for the reset leg: swap in a never-resolving recap with the button
// still enabled (recapBusy already back to false after the first success).
function openRecapFacePending() {
  requestSessionRecap.mockReturnValue(new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: /write recap/i }));
}
