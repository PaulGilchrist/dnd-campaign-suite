// @maintained-by-ai
// First-session checklist: visibility keyed on the starter seed document,
// steps name the GENERATED entities and deep-link real views, dismiss and
// completion write NOTHING (pure onboarding).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FirstSessionChecklist from './FirstSessionChecklist.jsx';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';
import { loadQuestBoard } from '../../services/campaign/questsService.js';

vi.mock('../../services/campaign/starterSeedService.js', () => ({
  loadStarterSeed: vi.fn(),
}));

// Quest step counts the LIVE board rows (backlog 2026-11-20 VN) — mocked at
// the service boundary so no fetch reaches a server; the SSE re-fetch leg is
// pinned in FirstSessionChecklist.sse-sync.test.jsx.
vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuestBoard: vi.fn(),
}));

// Shared SSE client is exercised in FirstSessionChecklist.sse-sync.test.jsx;
// here it just needs to be inert (no EventSource in jsdom).
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn(() => () => {}),
}));

const SEED = {
  version: 1,
  seed: 42,
  entities: {
    settlement: 'Thornhollow',
    hexMap: { name: 'Thornhollow Countryside', slug: 'thornhollow-countryside' },
    dungeonMap: { name: 'Crypt of X', slug: 'crypt-of-x' },
    dungeonTitle: 'Crypt of X',
    quests: ['Starter — Into the Ruins', 'Starter — Trouble in Town', 'Starter — The Spoils'],
    encounters: ['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3'],
  },
};

// Three whitelisted board rows — the honest live face on a fresh seed.
const BOARD_ROWS = [
  { id: 'q1', name: 'Starter — Into the Ruins', status: 'active' },
  { id: 'q2', name: 'Starter — Trouble in Town', status: 'active' },
  { id: 'q3', name: 'Starter — The Spoils', status: 'active' },
];

beforeEach(() => {
  vi.clearAllMocks();
  loadQuestBoard.mockResolvedValue(BOARD_ROWS);
});

async function renderChecklist(props = {}) {
  render(<FirstSessionChecklist campaignName="qa-starter" {...props} />);
  return null;
}

describe('FirstSessionChecklist', () => {
  it('renders nothing when the campaign has no starter seed', async () => {
    loadStarterSeed.mockResolvedValue(null);
    const { container } = render(<FirstSessionChecklist campaignName="test-campaign" />);
    await waitFor(() => expect(loadStarterSeed).toHaveBeenCalled());
    expect(container.querySelector('.campaign-starter-checklist')).toBeNull();
  });

  it('names the generated entities and deep-links each step into a real view', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    const onNavigate = vi.fn();
    const onBuildHeroes = vi.fn();
    await renderChecklist({ onNavigate, onBuildHeroes, isLocalhost: true });

    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());
    expect(screen.getByText(/the portal of Crypt of X through the fog/)).toBeInTheDocument();
    expect(screen.getByText(/Join Dungeon Wave 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Build your heroes (+ Character)'));
    expect(onBuildHeroes).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Meet the folk of Thornhollow'));
    expect(onNavigate).toHaveBeenCalledWith('settlements');
    fireEvent.click(screen.getByText(/the portal of Crypt of X through the fog/));
    expect(onNavigate).toHaveBeenCalledWith('mapsManager');
    // backlog 2026-11-11 KW: the wave step carries the 'load' intent so App
    // auto-opens the builder's Load modal; sibling steps stay single-arg
    // (the exact-argument assertions above would fail on a (view, undefined)
    // call, pinning their byte-unchanged behavior).
    fireEvent.click(screen.getByText(/Join Dungeon Wave 1/));
    expect(onNavigate).toHaveBeenCalledWith('encounter', 'load');
    fireEvent.click(screen.getByText(/campaign log/));
    expect(onNavigate).toHaveBeenCalledWith('campaignLog');
  });

  // Backlog 2026-11-04 CU: the Admin deep-link step must NOT be findable via a
  // /Regenerate/i (or /Regenerate Adventure/i) accessible-name query — that
  // token belongs to the primary Admin ct-btn alone (see the disambiguation
  // pin in campaign-admin/CampaignAdmin.regenerate.test.jsx).
  it('the Admin regenerate step disambiguates its accessible name but keeps its visible label', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    const onNavigate = vi.fn();
    render(<FirstSessionChecklist campaignName="qa-starter" onNavigate={onNavigate} isLocalhost />);

    const step = await screen.findByTestId('starter-step-regenerate');
    expect(step).toHaveAccessibleName('Open Campaign Admin to re-roll the adventure (keeps Thornhollow)');
    expect(step.getAttribute('aria-label')).not.toMatch(/Regenerate/i);
    expect(screen.queryByRole('button', { name: /Regenerate Adventure/i })).not.toBeInTheDocument();
    // Sighted users still read the original copy.
    expect(step).toHaveTextContent('Re-roll the adventure anytime — Admin → Regenerate (keeps Thornhollow)');
    // And the deep link is untouched (criterion: still lands on Admin).
    fireEvent.click(step);
    expect(onNavigate).toHaveBeenCalledWith('campaignRepair');
  });

  it('shows the GM-only betrayal + regenerate rows only on localhost', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    render(<FirstSessionChecklist campaignName="qa-starter" isLocalhost={false} />);
    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());
    expect(screen.queryByText(/Regenerate/)).not.toBeInTheDocument();
    expect(screen.queryByText(/🤝 Allies/)).not.toBeInTheDocument();

    render(<FirstSessionChecklist campaignName="qa-starter" isLocalhost />);
    await waitFor(() => expect(screen.getAllByText(/Admin → Regenerate/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/🤝 Allies/).length).toBeGreaterThan(0);
  });

  // LAN-visitor dead-end bug 2026-11-20: the Build-heroes row opens the
  // creation wizard, but character creation is GM-only (sidebar door,
  // empty-state card, server POST refuseUnlessGm). A visitor must never get
  // this door, even though App always passes onBuildHeroes.
  it('hides the Build-heroes row from a visitor origin even when onBuildHeroes is provided', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    const onBuildHeroes = vi.fn();
    render(
      <FirstSessionChecklist
        campaignName="qa-starter"
        onNavigate={vi.fn()}
        onBuildHeroes={onBuildHeroes}
        isLocalhost={false}
      />
    );
    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());
    expect(screen.queryByText('Build your heroes (+ Character)')).not.toBeInTheDocument();
    // Shared steps still render for the visitor (only the dead-end door is gone).
    expect(screen.getByText(/Review the starter quests/)).toBeInTheDocument();

    render(
      <FirstSessionChecklist
        campaignName="qa-starter"
        onNavigate={vi.fn()}
        onBuildHeroes={onBuildHeroes}
        isLocalhost
      />
    );
    await waitFor(() => expect(screen.getAllByText('Build your heroes (+ Character)').length).toBeGreaterThan(0));
  });

  // Backlog 2026-11-20 VN: the quest step must count the LIVE board, never
  // seed.entities.quests.length — the seed doc is immutable, so a deleted or
  // drafted-away quest must not keep the panel advertising a stale number.
  it('counts the quest step from the live board GET, not the seed document', async () => {
    loadStarterSeed.mockResolvedValue(SEED); // 3 quests named in the seed…
    loadQuestBoard.mockResolvedValue(BOARD_ROWS.slice(0, 2)); // …but only 2 live on the board
    const onNavigate = vi.fn();
    render(<FirstSessionChecklist campaignName="qa-starter" onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByText('Review the starter quests (2 on the board)')).toBeInTheDocument());
    expect(screen.queryByText(/seeded/)).not.toBeInTheDocument();
    expect(loadQuestBoard).toHaveBeenCalledWith('qa-starter');
    // The deep link into the quests view is unchanged.
    fireEvent.click(screen.getByText('Review the starter quests (2 on the board)'));
    expect(onNavigate).toHaveBeenCalledWith('quests');
  });

  it('shows no number while the board GET is pending, then the honest live count', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    let resolveBoard;
    loadQuestBoard.mockReturnValue(new Promise(resolve => { resolveBoard = resolve; }));
    render(<FirstSessionChecklist campaignName="qa-starter" />);

    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());
    // Pending face: the step renders but fabricates no seed-time number.
    expect(screen.getByText('Review the starter quests')).toBeInTheDocument();
    expect(screen.queryByText(/\(\d/)).not.toBeInTheDocument();

    resolveBoard(BOARD_ROWS);
    await waitFor(() => expect(screen.getByText('Review the starter quests (3 on the board)')).toBeInTheDocument());
  });

  it('keeps the no-number face when the board GET fails, with nothing uncaught', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadQuestBoard.mockRejectedValue(new Error('board down'));
    render(<FirstSessionChecklist campaignName="qa-starter" />);

    await waitFor(() => expect(screen.getByText('Review the starter quests')).toBeInTheDocument());
    await new Promise(r => setTimeout(r, 20));
    // No fabricated count ever appears; the rejection is handled (logged once,
    // never left as an uncaught rejection) and siblings keep their copy.
    expect(screen.queryByText(/\(\d/)).not.toBeInTheDocument();
    expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('dismiss hides the panel and writes nothing', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    const { container } = render(<FirstSessionChecklist campaignName="qa-starter" />);
    await waitFor(() => expect(screen.getByText(/Meet the folk of Thornhollow/)).toBeInTheDocument());

    fireEvent.click(container.querySelector('.campaign-starter-checklist-dismiss'));
    expect(container.querySelector('.campaign-starter-checklist')).toBeNull();
    // Pure onboarding: the ONLY server traffic is the seed GET itself.
    expect(loadStarterSeed).toHaveBeenCalledTimes(1);
    expect(vi.mocked(loadStarterSeed).mock.calls.every(c => c[0] === 'qa-starter')).toBe(true);
  });
});

// Regenerate live-refresh moved to FirstSessionChecklist.sse-sync.test.jsx
// (2026-11-02): the same-tab starter-seed-changed window event was replaced
// by the server's starter-seed-<campaign> SSE broadcast so ALL open tabs
// refresh, not just the one that issued the PUT.
