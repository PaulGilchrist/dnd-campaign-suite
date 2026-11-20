// @improved-by-ai
// Zero-character empty-state card (backlog UM 2026-11-20): always offers the
// wizard-opening affordance; the starter-checklist affordance rides ONLY when
// the campaign carries a starter seed with entities (the exact gate
// FirstSessionChecklist keys its own visibility off). Both buttons are pure
// wiring — the component writes NOTHING itself. On a visitor origin the GM-only
// add door is honestly absent, so a static hint line explains the gate
// (backlog WW 2026-11-20); it never shows on localhost.
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
  it('renders the empty-state card with the add-character affordance and no checklist button without a seed', async () => {
    loadStarterSeed.mockResolvedValue(null);
    const { container } = await renderEmptyState();

    expect(container.querySelector('.empty-campaign-state .ct-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no characters yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /starter checklist/ })).not.toBeInTheDocument();
  });

  it('pressing "Add your first character" opens the creation wizard lane (onAddCharacter)', async () => {
    loadStarterSeed.mockResolvedValue(null);
    const onAddCharacter = vi.fn();
    await renderEmptyState({ onAddCharacter });

    fireEvent.click(screen.getByRole('button', { name: /Add your first character/ }));
    expect(onAddCharacter).toHaveBeenCalledTimes(1);
  });

  it('a seeded starter campaign also offers the checklist affordance and activates onOpenChecklist', async () => {
    loadStarterSeed.mockResolvedValue(SEED);
    const onOpenChecklist = vi.fn();
    await renderEmptyState({ campaignName: 'qa-starter', onOpenChecklist });
    await waitFor(() => expect(loadStarterSeed).toHaveBeenCalledWith('qa-starter'));

    const btn = screen.getByRole('button', { name: /Open the starter checklist/ });
    fireEvent.click(btn);
    expect(onOpenChecklist).toHaveBeenCalledTimes(1);
  });

  it('a visitor (non-localhost) gets the message without the GM-only add-character door (sidebar parity), plus the static GM hint', async () => {
    loadStarterSeed.mockResolvedValue(null);
    const { container } = await renderEmptyState({ isLocalhost: false });

    expect(screen.getByText(/no characters yet/)).toBeInTheDocument();
    expect(screen.getByText(/Ask the GM to add the first character/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add your first character/ })).not.toBeInTheDocument();
    // The hint is plain text — the seedless visitor card keeps zero affordances.
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('the GM hint is absent on localhost (the add-character door is the affordance there)', async () => {
    loadStarterSeed.mockResolvedValue(null);
    await renderEmptyState();

    expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
    expect(screen.queryByText(/Ask the GM to add the first character/)).not.toBeInTheDocument();
  });

  it('a seeded starter campaign as visitor shows the hint alongside the checklist button (checklist lane unchanged)', async () => {
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
    render(<EmptyCampaignState campaignName="qa-arena" onAddCharacter={vi.fn()} onOpenChecklist={vi.fn()} isLocalhost />);
    await waitFor(() => expect(loadStarterSeed).toHaveBeenCalledWith('qa-arena'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /starter checklist/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
  });
});
