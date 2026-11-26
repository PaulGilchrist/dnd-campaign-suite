import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { clearRuntimeState, seedTrackedResources, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { GM_COPILOT_KEY } from '../../hooks/management/useGmCopilot.js';
import TryNextSection from './TryNextSection.jsx';

// URL-routed fetch mock: encounters / maps / change-data lanes only.
function mockLanes({ encounters = [], maps = [], changeData = {} }) {
  vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    const body = u.includes('/encounters') ? { encounters }
      : u.includes('/maps') ? { maps }
      : u.includes('/change-data') ? changeData
      : {};
    return { ok: true, json: async () => body };
  });
}

describe('TryNextSection', () => {
  beforeEach(() => {
    cleanup();
    clearRuntimeState('campaign');
    vi.restoreAllMocks();
    mockLanes({});
  });

  const renderSection = (props = {}) =>
    render(
      <TryNextSection
        campaignName="Test Camp"
        characters={[{ name: 'Hero' }]}
        onNavigate={() => {}}
        {...props}
      />
    );

  it('invites combat when encounters exist and the board is empty', async () => {
    mockLanes({ encounters: [{ name: 'Ambush' }, { name: 'Waves' }] });
    renderSection();
    const card = await screen.findByRole('note', { name: /Try next: Try running combat/ });
    expect(card).toHaveTextContent('2 encounters');
    expect(screen.queryByText(/1 encounters/)).not.toBeInTheDocument();
  });

  it('hides the combat invite once a live board exists, and invites TV instead', async () => {
    mockLanes({
      encounters: [{ name: 'Ambush' }],
      changeData: { combatSummary: { creatures: [{ name: 'Goblin' }, { name: 'Hero' }] } },
    });
    renderSection();
    await waitFor(() => expect(screen.queryByRole('note', { name: /Try next: Try running combat/ })).not.toBeInTheDocument());
    expect(screen.getByRole('note', { name: /Try next: Dress the board/ })).toBeInTheDocument();
  });

  it('invites maps when one exists with none active; hides when one is active', async () => {
    mockLanes({ maps: [{ fileName: 'arena.json', name: 'Arena', isActive: false }] });
    renderSection();
    expect(await screen.findByRole('note', { name: /Try next: Put a battlefield/ })).toBeInTheDocument();
    // Per-mount cold read (no polling): the next visit re-evaluates conditions.
    cleanup();
    mockLanes({ maps: [{ fileName: 'arena.json', name: 'Arena', isActive: true }] });
    renderSection();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('note', { name: /Try next: Put a battlefield/ })).not.toBeInTheDocument();
  });

  it('taking the action navigates but settles NOTHING (the invitation returns)', async () => {
    mockLanes({ encounters: [{ name: 'Ambush' }] });
    const onNavigate = vi.fn();
    renderSection({ onNavigate });
    fireEvent.click(await screen.findByRole('button', { name: 'Open Encounter Builder' }));
    expect(onNavigate).toHaveBeenCalledWith('encounter');
    // No tip settled: the synced default (null) is all the key ever held.
    expect(getRuntimeValue('campaign', GM_COPILOT_KEY) ?? null).toBeNull();
    expect(screen.getByRole('note', { name: /Try next: Try running combat/ })).toBeInTheDocument();
  });

  it('× dismisses an invitation forever, server-first', async () => {
    mockLanes({ encounters: [{ name: 'Ambush' }] });
    renderSection();
    const card = await screen.findByRole('note', { name: /Try next: Try running combat/ });
    fireEvent.click(card.querySelector('.gm-copilot-dismiss'));
    expect(screen.queryByRole('note', { name: /Try next: Try running combat/ })).not.toBeInTheDocument();
    expect(getRuntimeValue('campaign', GM_COPILOT_KEY)).toEqual({ dismissed: { 'try-combat': true } });
  });

  it('a previously dismissed invitation never resurfaces', async () => {
    seedTrackedResources('campaign', { [GM_COPILOT_KEY]: { dismissed: { 'try-combat': true } } });
    mockLanes({ encounters: [{ name: 'Ambush' }] });
    renderSection();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('note', { name: /Try next: Try running combat/ })).not.toBeInTheDocument();
  });

  it('renders nothing without a navigation lane', async () => {
    mockLanes({ encounters: [{ name: 'Ambush' }] });
    const { container } = render(<TryNextSection campaignName="Test Camp" characters={[{ name: 'Hero' }]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('toolbelt respect: an invitation never invites into a hidden view', async () => {
    // Every precondition genuinely holds (encounters + empty board, maps
    // with none active) — ONLY the hidden set may kill the cards.
    mockLanes({
      encounters: [{ name: 'Ambush' }],
      maps: [{ fileName: 'arena.json', name: 'Arena', isActive: false }],
    });
    renderSection({ hiddenViews: ['encounter', 'mapsManager'] });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('note', { name: /Try next: Try running combat/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('note', { name: /Try next: Put a battlefield/ })).not.toBeInTheDocument();
  });

  it('toolbelt respect: the TV invite folds when Initiative is hidden — and stands when it is not', async () => {
    mockLanes({
      changeData: { combatSummary: { creatures: [{ name: 'Goblin' }, { name: 'Hero' }] } },
    });
    renderSection({ hiddenViews: [] });
    expect(await screen.findByRole('note', { name: /Try next: Dress the board/ })).toBeInTheDocument();
    cleanup();
    mockLanes({
      changeData: { combatSummary: { creatures: [{ name: 'Goblin' }, { name: 'Hero' }] } },
    });
    renderSection({ hiddenViews: ['initiative'] });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('note', { name: /Try next: Dress the board/ })).not.toBeInTheDocument();
  });
});
