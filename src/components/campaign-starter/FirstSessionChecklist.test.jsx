// @maintained-by-ai
// First-session checklist: visibility keyed on the starter seed document,
// steps name the GENERATED entities and deep-link real views, dismiss and
// completion write NOTHING (pure onboarding).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FirstSessionChecklist from './FirstSessionChecklist.jsx';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';

vi.mock('../../services/campaign/starterSeedService.js', () => ({
  loadStarterSeed: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
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
