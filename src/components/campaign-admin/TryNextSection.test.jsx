// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { clearRuntimeState, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { GM_COPILOT_KEY } from '../../hooks/management/useGmCopilot.js';
import TryNextSection from './TryNextSection.jsx';

// Mount-site integration lane: which invitation fires for which lane data,
// and that acting on it never settles. The card contract itself (registry
// copy, dismiss/markSeen writes, guard branches) is pinned in
// src/components/GMCopilot/GMCopilot.test.jsx — not duplicated here.

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

const OPEN_BOARD = {
  encounters: [{ name: 'Ambush' }],
  maps: [{ fileName: 'arena.json', name: 'Arena', isActive: false }],
};
const LIVE_BOARD = {
  maps: [{ fileName: 'arena.json', name: 'Arena', isActive: false }],
  changeData: { combatSummary: { creatures: [{ name: 'Goblin' }, { name: 'Hero' }] } },
};

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

  it('× dismisses one invitation forever, server-first, without disturbing the others', async () => {
    mockLanes(OPEN_BOARD);
    renderSection();
    const combatCard = await screen.findByRole('note', { name: /Try next: Try running combat/ });
    // Sibling card fires on the same mount: the premise for independence.
    expect(screen.getByRole('note', { name: /Try next: Put a battlefield/ })).toBeInTheDocument();

    fireEvent.click(within(combatCard).getByRole('button', { name: 'Dismiss this tip for good' }));
    expect(screen.queryByRole('note', { name: /Try next: Try running combat/ })).not.toBeInTheDocument();
    expect(screen.getByRole('note', { name: /Try next: Put a battlefield/ })).toBeInTheDocument();
    expect(getRuntimeValue('campaign', GM_COPILOT_KEY)).toEqual({ dismissed: { 'try-combat': true } });

    // Cold re-visit: the dismissed invitation never resurfaces...
    cleanup();
    mockLanes(OPEN_BOARD);
    renderSection();
    // ...while the untouched invitation still fires.
    expect(await screen.findByRole('note', { name: /Try next: Put a battlefield/ })).toBeInTheDocument();
    expect(screen.queryByRole('note', { name: /Try next: Try running combat/ })).not.toBeInTheDocument();
  });

  it('renders nothing without a navigation lane', async () => {
    mockLanes({ encounters: [{ name: 'Ambush' }] });
    const { container } = render(<TryNextSection campaignName="Test Camp" characters={[{ name: 'Hero' }]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  // Every precondition genuinely holds in each row — ONLY the hidden view
  // may kill the card, and it kills exactly that card.
  it.each([
    { hidden: 'encounter', lanes: OPEN_BOARD, gone: /Try next: Try running combat/, kept: /Try next: Put a battlefield/ },
    { hidden: 'mapsManager', lanes: OPEN_BOARD, gone: /Try next: Put a battlefield/, kept: /Try next: Try running combat/ },
    { hidden: 'initiative', lanes: LIVE_BOARD, gone: /Try next: Dress the board/, kept: /Try next: Put a battlefield/ },
  ])('toolbelt respect: hiding "$hidden" folds exactly that invitation', async ({ hidden, lanes, gone, kept }) => {
    mockLanes(lanes);
    renderSection({ hiddenViews: [hidden] });
    expect(await screen.findByRole('note', { name: kept })).toBeInTheDocument();
    expect(screen.queryByRole('note', { name: gone })).not.toBeInTheDocument();
  });
});
