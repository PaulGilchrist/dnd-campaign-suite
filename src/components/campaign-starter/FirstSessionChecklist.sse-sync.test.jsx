// @maintained-by-ai: 2026-11-20
// Live-sync contract for the first-session checklist (improve starter-seed-
// no-list-sse): every successful PUT /starter-seed (Regenerate in ANY tab,
// create-time seed write) publishes `starter-seed-<campaign>` carrying the
// updated document (server/routes/campaigns-starter-seed.js). The checklist
// applies that payload directly — no reload, and NO re-GET/re-POST of the
// echo (skipSync doctrine) — while events for other keys/campaigns and
// malformed payloads are ignored. Quest add/delete/status flips broadcast
// `quests-list-<campaign>` (server/routes/quests.js publish()) and re-fetch
// ONLY the live board count via loadQuestBoard (the QuestBoard twin's
// read-only refresh lane — a GET after a server-side mutation is not an
// echo re-POST). Connects through the ONE shared SSE client (subscribeToSSE),
// never a raw EventSource. Mirrors Settlements.sse-sync.test.jsx.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FirstSessionChecklist from './FirstSessionChecklist.jsx';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';
import { loadQuestBoard } from '../../services/campaign/questsService.js';

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

const SEED = {
  version: 1,
  seed: 42,
  entities: {
    settlement: 'Thornhollow',
    hexMap: { name: 'Thornhollow Countryside', slug: 'thornhollow-countryside' },
    dungeonMap: { name: 'Crypt of X', slug: 'crypt-of-x' },
    dungeonTitle: 'Crypt of X',
    quests: ['Starter — Into the Ruins'],
    encounters: ['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3'],
  },
};

vi.mock('../../services/campaign/starterSeedService.js', () => ({
  loadStarterSeed: vi.fn(async () => SEED),
}));

const BOARD_ROWS = [
  { id: 'q1', name: 'Starter — Into the Ruins', status: 'active' },
];

vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuestBoard: vi.fn(),
}));

const REGENERATED = {
  ...SEED,
  seed: 99,
  entities: { ...SEED.entities, settlement: 'BRIDGEHAM', dungeonTitle: 'New Tomb' },
};

describe('FirstSessionChecklist live SSE sync', () => {
  beforeEach(() => {
    mockSubscribe.mockClear();
    capturedHandler = null;
    unsubscribeCalls = 0;
    vi.mocked(loadStarterSeed).mockClear();
    vi.mocked(loadStarterSeed).mockResolvedValue(SEED);
    vi.mocked(loadQuestBoard).mockClear();
    vi.mocked(loadQuestBoard).mockResolvedValue(BOARD_ROWS);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes through the shared SSE client on mount and unsubscribes on unmount', async () => {
    const { unmount } = render(<FirstSessionChecklist campaignName="qa-starter" />);
    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('qa-starter', expect.any(Function));

    unmount();
    expect(unsubscribeCalls).toBe(1);
    expect(capturedHandler).toBeNull();
  });

  it('applies a regenerated seed straight from the SSE payload — no reload, no re-fetch', async () => {
    render(<FirstSessionChecklist campaignName="qa-starter" />);
    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());
    expect(loadStarterSeed).toHaveBeenCalledTimes(1);

    capturedHandler({ key: 'starter-seed-qa-starter', data: { action: 'updated', seed: REGENERATED } });

    await waitFor(() => expect(screen.getByText(/Meet the folk of BRIDGEHAM/)).toBeInTheDocument());
    expect(screen.getByText(/portal of New Tomb/)).toBeInTheDocument();
    // The echo carries the whole document — applying it must never re-GET
    // (or re-POST) the seed lane.
    expect(loadStarterSeed).toHaveBeenCalledTimes(1);
  });

  // Backlog 2026-11-20 VN: quest add/delete/status flip publish
  // `quests-list-<campaign>` (server/routes/quests.js). A mounted checklist
  // re-reads ONLY the board count on that key — no reload, no seed re-GET.
  it('re-reads the live quest count straight from the quests-list SSE broadcast — no reload', async () => {
    const board = vi.mocked(loadQuestBoard);
    board.mockResolvedValue([
      { id: 'q1', name: 'Starter — Into the Ruins', status: 'active' },
      { id: 'q2', name: 'Starter — Trouble in Town', status: 'active' },
      { id: 'q3', name: 'Starter — The Spoils', status: 'active' },
    ]);
    render(<FirstSessionChecklist campaignName="qa-starter" />);
    await waitFor(() => expect(screen.getByText('Review the starter quests (3 on the board)')).toBeInTheDocument());
    expect(board).toHaveBeenCalledTimes(1);

    // Every quest deleted server-side: the broadcast lands, the mount re-GETs
    // the board and the step stops claiming the seed-time count.
    board.mockResolvedValue([]);
    capturedHandler({ key: 'quests-list-qa-starter', data: { action: 'deleted' } });

    await waitFor(() => expect(board).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Review the starter quests (0 on the board)')).toBeInTheDocument());
    // The seed lane is never re-fetched as an echo.
    expect(loadStarterSeed).toHaveBeenCalledTimes(1);
  });

  it('ignores events from other campaigns/keys and payloads without a seed', async () => {
    render(<FirstSessionChecklist campaignName="qa-starter" />);
    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());
    const boardCalls = vi.mocked(loadQuestBoard).mock.calls.length;

    capturedHandler({ key: 'starter-seed-other-campaign', data: { action: 'updated', seed: REGENERATED } });
    capturedHandler({ key: 'settlements-list-qa-starter', data: { action: 'updated' } });
    capturedHandler({ key: 'starter-seed-qa-starter', data: { action: 'updated' } });
    capturedHandler({ key: 'quests-list-other-campaign', data: { action: 'deleted' } });
    capturedHandler(null);
    await new Promise(r => setTimeout(r, 20));

    expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument();
    expect(screen.queryByText(/BRIDGEHAM/)).not.toBeInTheDocument();
    expect(loadStarterSeed).toHaveBeenCalledTimes(1);
    // Foreign quests-list campaigns must not trigger a board re-GET either.
    expect(vi.mocked(loadQuestBoard)).toHaveBeenCalledTimes(boardCalls);
  });
});
