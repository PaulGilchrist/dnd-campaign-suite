// @maintained-by-ai 2026-11-26
// Zero-character empty-state card component contract (backlog UM 2026-11-20):
// the .ct-empty-state markup always renders; the wizard-opening affordance
// rides only on localhost (mirrors the sidebar's GM-only add door); the
// starter-checklist affordance rides ONLY when the seed read carries
// `entities` (the exact gate FirstSessionChecklist keys its own visibility
// off); a visitor sees the static hint line instead of the add door (backlog
// WW 2026-11-20). Both buttons are pure wiring — the component writes NOTHING
// itself. App-gate seams (card-owns-stage, wizard open/yield/return, seeded
// checklist App wiring) live in src/App.empty-campaign-state.test.jsx and
// src/App.no-auto-wizard.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmptyCampaignState from './EmptyCampaignState.jsx';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';

vi.mock('../../services/campaign/starterSeedService.js', () => ({
  loadStarterSeed: vi.fn(),
}));

const SEED = {
  seed: 42,
  entities: {
    settlement: 'Thornhollow',
    dungeonTitle: 'Crypt of X',
    quests: ['Starter — Into the Ruins'],
    encounters: ['Dungeon Wave 1'],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderEmptyState(props = {}) {
  const result = render(
    <EmptyCampaignState
      campaignName="qa-arena"
      onAddCharacter={vi.fn()}
      onOpenChecklist={vi.fn()}
      isLocalhost
      {...props}
    />,
  );
  await waitFor(() => expect(loadStarterSeed).toHaveBeenCalled());
  return result;
}

describe('EmptyCampaignState', () => {
  it('on localhost with no seed: renders the .ct-empty-state card with the add-character affordance, no checklist button, no visitor hint', async () => {
    loadStarterSeed.mockResolvedValue(null);
    const { container } = await renderEmptyState();

    expect(container.querySelector('.empty-campaign-state .ct-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no characters yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /starter checklist/ })).not.toBeInTheDocument();
    // The add door IS the affordance on localhost — the hint never shows here.
    expect(screen.queryByText(/Ask the GM to add the first character/)).not.toBeInTheDocument();
  });

  it('pressing "Add your first character" opens the creation wizard lane (onAddCharacter)', async () => {
    loadStarterSeed.mockResolvedValue(null);
    const onAddCharacter = vi.fn();
    await renderEmptyState({ onAddCharacter });

    fireEvent.click(screen.getByRole('button', { name: /Add your first character/ }));
    expect(onAddCharacter).toHaveBeenCalledTimes(1);
  });

  it('a seeded starter campaign reads the seed by campaign name and the checklist button activates onOpenChecklist', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    const onOpenChecklist = vi.fn();
    await renderEmptyState({ campaignName: 'qa-starter', onOpenChecklist });
    await waitFor(() => expect(loadStarterSeed).toHaveBeenCalledWith('qa-starter'));

    fireEvent.click(screen.getByRole('button', { name: /Open the starter checklist/ }));
    expect(onOpenChecklist).toHaveBeenCalledTimes(1);
  });

  it('visitor lane: the seedless card is hint text with zero affordances; a seeded visitor keeps the checklist button but never the GM-only add door', async () => {
    loadStarterSeed.mockResolvedValue(null);
    const { unmount } = await renderEmptyState({ isLocalhost: false });

    expect(screen.getByText(/no characters yet/)).toBeInTheDocument();
    expect(screen.getByText(/Ask the GM to add the first character/)).toBeInTheDocument();
    // A seedless visitor card must never be a dead panel of buttons — the
    // hint is plain text (backlog WW 2026-11-20).
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    unmount();

    loadStarterSeed.mockResolvedValue(SEED);
    await renderEmptyState({ campaignName: 'qa-starter', isLocalhost: false });
    await waitFor(() => expect(loadStarterSeed).toHaveBeenCalledWith('qa-starter'));

    expect(screen.getByRole('button', { name: /Open the starter checklist/ })).toBeInTheDocument();
    expect(screen.getByText(/Ask the GM to add the first character/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add your first character/ })).not.toBeInTheDocument();
  });

  it('a seed document without entities (or a failed read) keeps the card plain', async () => {
    loadStarterSeed.mockResolvedValue({ seed: 7 });
    const { unmount } = await renderEmptyState();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /starter checklist/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
    unmount();

    loadStarterSeed.mockRejectedValue(new Error('network down'));
    await renderEmptyState();
    await waitFor(() => expect(loadStarterSeed).toHaveBeenCalledWith('qa-arena'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /starter checklist/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
  });
});
