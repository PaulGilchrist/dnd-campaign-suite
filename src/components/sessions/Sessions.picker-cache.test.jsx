// @maintained-by-ai: 2026-10-29
// Picker-list cache contract (improve 2026-10-29-W backlog): the six link-picker
// lists (maps/encounters/npcs/quests/settlements/notes) used to re-fetch on
// EVERY planner open. Now the first open per view mount fetches each exactly
// once, a reopen with nothing changed fetches NOTHING, and a fresh mount
// re-fetches (component-scope freshness contract — a view switch remounts
// Sessions). Stale-data safety: any `<entity>-list-<campaign>` SSE broadcast
// invalidates the cache so the NEXT open re-fetches fresh options; events for
// other lanes (sessions/factions), other campaigns, and the sessions list
// itself never touch the picker cache. A failed batch is never cached
// (dataLoader's "failure is a cache miss by law") and surfaces ONE inline
// hint in the modal — the batch wrapper itself logs NOTHING (1-service/
// 0-wrapper canon, 0a026c804), and campaign switches re-fetch.
// Mocks mirror Sessions.sse-sync.test.jsx; the REAL planner modal is
// rendered so option population is pinned, not just the call counts.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sessions from './Sessions';

let capturedHandler = null;

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (_campaignName, handler) => {
    capturedHandler = handler;
    return () => { capturedHandler = null; };
  },
}));

vi.mock('../../services/campaign/sessionsService.js', () => ({
  loadSessions: vi.fn(async () => ({ sessions: [] })),
  saveSession: vi.fn(async () => ({ success: true })),
  saveSessions: vi.fn(async () => ({ success: true })),
  deleteSession: vi.fn(async () => ({ success: true })),
}));

// The six picker loaders — real fixture data so the pickers visibly populate.
vi.mock('../../services/maps/mapsService.js', () => ({
  loadMaps: vi.fn(),
  activateMap: vi.fn(async () => ({ success: true })),
}));
vi.mock('../../services/encounters/encountersService.js', () => ({
  loadEncounters: vi.fn(),
}));
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
}));
vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuests: vi.fn(),
}));
vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(),
}));
vi.mock('../../services/campaign/notesService.js', () => ({
  loadNotes: vi.fn(),
}));
vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

import { loadMaps } from '../../services/maps/mapsService.js';
import { loadEncounters } from '../../services/encounters/encountersService.js';
import { loadNPCs } from '../../services/npcs/npcsService.js';
import { loadQuests } from '../../services/campaign/questsService.js';
import { loadSettlements } from '../../services/campaign/settlementsService.js';
import { loadNotes } from '../../services/campaign/notesService.js';

const PICKER_LOADERS = { maps: loadMaps, encounters: loadEncounters, npcs: loadNPCs, quests: loadQuests, settlements: loadSettlements, notes: loadNotes };

// aria-label of each picker select (LINK_TYPES labels) → expected option text.
const PICKER_EXPECTATIONS = [
  ['Link Maps', 'Test Map'],
  ['Link Encounters', 'Goblin Camp'],
  ['Link NPCs', 'Marta Copperkettle'],
  ['Link Quests', 'The Lost Artifact'],
  ['Link Settlements', 'Ironhaven'],
  ['Link Notes', 'Skull Creek Cave map'],
];

function seedPickerFixtures() {
  loadMaps.mockResolvedValue({ maps: [{ name: 'Test Map' }] });
  loadEncounters.mockResolvedValue({ encounters: [{ name: 'Goblin Camp' }] });
  loadNPCs.mockResolvedValue({ npcs: [{ name: 'Marta Copperkettle', armorClass: 12, hitPoints: 9 }] });
  loadQuests.mockResolvedValue({ quests: [{ name: 'The Lost Artifact' }] });
  loadSettlements.mockResolvedValue({ settlements: [{ name: 'Ironhaven' }] });
  loadNotes.mockResolvedValue({ notes: [{ id: 'note-1', description: 'Skull Creek Cave map' }] });
}

const renderSessions = (campaignName = 'test-campaign') =>
  render(
    <Sessions
      campaignName={campaignName}
      characters={[]}
      isLocalhost={true}
      onBack={vi.fn()}
      onViewInitiative={vi.fn()}
    />
  );

const openPlanner = () =>
  fireEvent.click(screen.getByRole('button', { name: /new session/i }));

// Clean new-draft Cancel closes silently (no named confirm).
const closePlanner = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

const totalPickerCalls = () =>
  Object.values(PICKER_LOADERS).reduce((sum, fn) => sum + fn.mock.calls.length, 0);

const expectAllPickersPopulated = async () => {
  for (const [label, option] of PICKER_EXPECTATIONS) {
    const select = await screen.findByLabelText(label);
    expect(within(select).getByText(option)).toBeInTheDocument();
  }
};

describe('Sessions link-picker list cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    seedPickerFixtures();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('first planner open fetches each of the six lists exactly once and populates every picker', async () => {
    renderSessions();
    openPlanner();
    await expectAllPickersPopulated();
    for (const fn of Object.values(PICKER_LOADERS)) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
    // A clean batch never shows the picker-failure hint.
    expect(screen.queryByText(/picker lists failed to load/)).not.toBeInTheDocument();
  });

  it('reopen with no intervening change fetches NOTHING and the pickers keep their options', async () => {
    renderSessions();
    openPlanner();
    await expectAllPickersPopulated();
    closePlanner();
    await waitFor(() => expect(screen.queryByLabelText('Link Maps')).not.toBeInTheDocument());

    openPlanner();
    await expectAllPickersPopulated();
    expect(totalPickerCalls()).toBe(6); // still exactly one fetch per list
    for (const fn of Object.values(PICKER_LOADERS)) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('a fresh mount (view switch) re-fetches all six — component-scope freshness contract', async () => {
    const { unmount } = renderSessions();
    openPlanner();
    await expectAllPickersPopulated();
    closePlanner();
    unmount();

    renderSessions();
    openPlanner();
    await expectAllPickersPopulated();
    for (const fn of Object.values(PICKER_LOADERS)) {
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  it('an entity-list SSE event invalidates the cache so the next open re-fetches', async () => {
    renderSessions();
    openPlanner();
    await expectAllPickersPopulated();
    closePlanner();

    capturedHandler({ key: 'quests-list-test-campaign', data: { action: 'created' } });

    openPlanner();
    await expectAllPickersPopulated();
    expect(totalPickerCalls()).toBe(12); // whole batch refreshed on next open
  });

  it('invalidation while the planner is open leaves the draft untouched and applies on the next open', async () => {
    renderSessions();
    openPlanner();
    await expectAllPickersPopulated();

    capturedHandler({ key: 'settlements-list-test-campaign', data: { action: 'created' } });
    // Open picker not disturbed.
    expect(screen.getByRole('button', { name: /new session/i })).toBeInTheDocument();
    expect(totalPickerCalls()).toBe(6);

    closePlanner();
    openPlanner();
    await expectAllPickersPopulated();
    expect(totalPickerCalls()).toBe(12);
  });

  it('sessions-list, factions-list, and other-campaign events never invalidate the picker cache', async () => {
    renderSessions();
    openPlanner();
    await expectAllPickersPopulated();
    closePlanner();

    capturedHandler({ key: 'sessions-list-test-campaign', data: { action: 'created' } });
    capturedHandler({ key: 'factions-list-test-campaign', data: { action: 'created' } });
    capturedHandler({ key: 'quests-list-other-campaign', data: { action: 'created' } });
    capturedHandler(null);

    openPlanner();
    await expectAllPickersPopulated();
    expect(totalPickerCalls()).toBe(6);
  });

  it('a picker batch with a failed list is not cached — the next open re-fetches, the batch wrapper logs NOTHING, and the modal shows ONE inline hint', async () => {
    // 1-service/0-wrapper console canon (0a026c804, improve sessions-picker-
    // failure-double-console): services log their own line at the fetch seam
    // (pinned by the service tests); mocked here, so a failed batch must
    // produce ZERO app console.error lines end-to-end through Sessions.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadQuests.mockRejectedValueOnce(new Error('boom'));
    renderSessions();
    openPlanner();
    // The whole batch gets exactly ONE hint line (not per-list) once the
    // batch settles, and the other five pickers still populate.
    const hints = await screen.findAllByText(/picker lists failed to load/);
    expect(hints).toHaveLength(1);
    expect(await screen.findByLabelText('Link Maps')).toBeInTheDocument();
    closePlanner();
    expect(consoleSpy).not.toHaveBeenCalled();

    // Close clears the hint; the failed batch never cached, so this reopen
    // re-fetches everything, succeeds, and the hint stays away.
    openPlanner();
    expect(screen.queryByText(/picker lists failed to load/)).not.toBeInTheDocument();
    await expectAllPickersPopulated();
    expect(totalPickerCalls()).toBe(12);
    expect(screen.queryByText(/picker lists failed to load/)).not.toBeInTheDocument();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('switching campaigns re-fetches the pickers for the new campaign', async () => {
    const { rerender } = renderSessions();
    openPlanner();
    await expectAllPickersPopulated();
    closePlanner();

    rerender(
      <Sessions
        campaignName="other-campaign"
        characters={[]}
        isLocalhost={true}
        onBack={vi.fn()}
        onViewInitiative={vi.fn()}
      />
    );
    openPlanner();
    await expectAllPickersPopulated();
    for (const fn of Object.values(PICKER_LOADERS)) {
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });
});
