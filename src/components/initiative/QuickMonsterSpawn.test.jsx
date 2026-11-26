// @maintained-by-ai 2026-11-19
// Quick-monster-spawn picker (roadmap Item 4). Component lane only: the
// bestiary comes through useMonstersData (mocked — the loader lane is owned
// by its own tests), filtering is asserted at the PICKER face to prove the
// component actually drives the shared monsterBestiarySearch helpers (unit
// bytes of those helpers: monsterBestiarySearch.test.js). What the Spawn
// press dispatches (monster row + count) is pinned here; the board bytes it
// produces are owned by quickMonsterSpawn.test.js and the join-lane suite.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({ useMonstersData: vi.fn() }));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMaps: vi.fn() }));

import QuickMonsterSpawn from './QuickMonsterSpawn.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import * as mapsService from '../../services/maps/mapsService.js';

const MONSTERS = [
  { index: 'goblin', name: 'Goblin', type: 'humanoid', subtype: 'tribe', challenge_rating: 0.25, xp: 50 },
  { index: 'kobold', name: 'Kobold', type: 'humanoid', challenge_rating: 0.25, xp: 250 },
  { index: 'ogre', name: 'Ogre', type: 'giant', challenge_rating: 2, xp: 450 },
  { index: 'rat', name: 'Giant Rat', type: 'beast', challenge_rating: 0.125, xp: 25 },
];

function mount(onSpawn = vi.fn(async () => true), mapName = undefined) {
  useMonstersData.mockReturnValue({ monsters: MONSTERS, loading: false });
  render(<QuickMonsterSpawn onSpawn={onSpawn} mapName={mapName} campaignName='test-campaign' />);
  return onSpawn;
}

// Active-map face list the picker's type probe reads (maps LIST lane — never
// a whole-document GET). `awaitActiveMapProbe` flushes the resolved fetch AND
// the .then settle inside act, so absence assertions after it are honest: the
// type state has landed before we query the DOM.
function mockActiveMapFace(type) {
  mapsService.loadMaps.mockResolvedValue({
    maps: [{ name: 'qa-sandbox', slug: 'qa-sandbox', type, isActive: true }],
  });
}

async function awaitActiveMapProbe() {
  await waitFor(() => expect(mapsService.loadMaps).toHaveBeenCalledWith('test-campaign'));
  await act(async () => {
    await mapsService.loadMaps.mock.results[0].value;
    await Promise.resolve();
  });
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: '+ Monster' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuickMonsterSpawn button + modal', () => {
  it('renders only the trigger until pressed, then a searchable bestiary dialog', () => {
    mount();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openPicker();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Search monsters')).toBeInTheDocument();
    MONSTERS.forEach(m => expect(screen.getByText(m.name)).toBeInTheDocument());
  });

  it('search narrows by name, by type and by subtype (the shared EB helper lane)', () => {
    mount();
    openPicker();
    const search = screen.getByLabelText('Search monsters');

    fireEvent.change(search, { target: { value: 'gob' } });
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.queryByText('Kobold')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'giant' } }); // matches a TYPE, not a name
    expect(screen.getByText('Ogre')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'tribe' } }); // matches a SUBTYPE
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.queryByText('Ogre')).not.toBeInTheDocument();
  });

  it('caps the un-narrowed bestiary list with a visible "type to narrow" affordance', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ index: `m${i}`, name: `Monster ${i}`, type: 'beast', challenge_rating: 1, xp: 0 }));
    useMonstersData.mockReturnValue({ monsters: many, loading: false });
    render(<QuickMonsterSpawn onSpawn={vi.fn()} />);
    openPicker();
    expect(document.querySelectorAll('.qms-row')).toHaveLength(50);
    expect(screen.getByTestId('qms-cap-notice')).toHaveTextContent('type to narrow');
  });

  it('closes on Escape and on Cancel with zero spawn calls', () => {
    const onSpawn = mount();
    openPicker();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSpawn).not.toHaveBeenCalled();
  });
});

describe('QuickMonsterSpawn selection + spawn', () => {
  it('keeps Spawn disabled until a row is picked, then names the exact count and monster', () => {
    const onSpawn = mount();
    openPicker();
    expect(screen.getByRole('button', { name: /^Spawn$/ })).toBeDisabled();

    fireEvent.click(screen.getByText('Goblin'));
    expect(screen.getByRole('button', { name: 'Spawn 1× Goblin' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '5' } });
    expect(screen.getByRole('button', { name: 'Spawn 5× Goblin' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Spawn 5× Goblin' }));
    expect(onSpawn).toHaveBeenCalledWith(expect.objectContaining({ index: 'goblin', name: 'Goblin' }), 5, { placeToken: false });
  });

  it('closes only on an accepted spawn; a rejected spawn stays open with visible inline copy', async () => {
    const rejected = vi.fn(async () => false);
    mount(rejected);
    openPicker();
    fireEvent.click(screen.getByText('Kobold'));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn 1× Kobold' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Kobold never reached the board/));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('accepting a spawn closes the modal (board work belongs to the handler lane)', async () => {
    const onSpawn = mount();
    openPicker();
    fireEvent.click(screen.getByText('Ogre'));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn 1× Ogre' }));

    expect(onSpawn).toHaveBeenCalledWith(expect.objectContaining({ index: 'ogre' }), 1, { placeToken: false });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a loading note and no list while the bestiary is still arriving', () => {
    useMonstersData.mockReturnValue({ monsters: [], loading: true });
    render(<QuickMonsterSpawn onSpawn={vi.fn()} />);
    openPicker();
    expect(screen.getByText(/Loading bestiary/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Search monsters')).not.toBeInTheDocument();
  });
});

describe('QuickMonsterSpawn map-token opt-in (2026-11-20 CCC backlog; outdoor hide 2026-11-21 DDD backlog)', () => {
  it('renders no token affordance with NO active map — the flow stays byte-identical to the mapless law', () => {
    const onSpawn = mount(vi.fn(async () => true), null);
    openPicker();
    expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Goblin'));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn 1× Goblin' }));
    expect(onSpawn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Goblin' }), 1, { placeToken: false });
    // The mapless face never even probes for a map type.
    expect(mapsService.loadMaps).not.toHaveBeenCalled();
  });

  it('with an ACTIVE INDOOR map the opt-in renders UNCHECKED (default OFF), and ticking it stamps the spawn option', async () => {
    mockActiveMapFace('indoor');
    const onSpawn = mount(vi.fn(async () => true), 'qa-sandbox');
    openPicker();
    await awaitActiveMapProbe();
    const box = screen.getByLabelText('Place a token near the party on the map');
    expect(box).not.toBeChecked();

    fireEvent.click(screen.getByText('Goblin'));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn 1× Goblin' }));
    expect(onSpawn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Goblin' }), 1, { placeToken: false });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    openPicker();
    await awaitActiveMapProbe();
    // Resets per picker mount (local state): the reopened box is OFF again.
    expect(screen.getByLabelText('Place a token near the party on the map')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Place a token near the party on the map'));
    expect(screen.getByLabelText('Place a token near the party on the map')).toBeChecked();
    fireEvent.click(screen.getByText('Goblin'));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn 1× Goblin' }));
    expect(onSpawn).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Goblin' }), 1, { placeToken: true });
  });

  it('with an ACTIVE OUTDOOR map the checkbox is ABSENT (DDD: a stamp that silently no-ops is a lie)', async () => {
    mockActiveMapFace('outdoor');
    const onSpawn = mount(vi.fn(async () => true), 'qa-sandbox');
    openPicker();
    await awaitActiveMapProbe();
    expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Goblin'));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn 1× Goblin' }));
    expect(onSpawn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Goblin' }), 1, { placeToken: false });
  });

  it('an untyped map entry fails CLOSED to absent (only an explicit indoor type renders the opt-in)', async () => {
    mockActiveMapFace(undefined);
    mount(vi.fn(async () => true), 'qa-sandbox');
    openPicker();
    await awaitActiveMapProbe();
    expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();
  });

  it('a failed map-type probe fails CLOSED to absent (the producer-side outdoor guard stays the backstop)', async () => {
    mapsService.loadMaps.mockRejectedValue(new Error('maps list unavailable'));
    mount(vi.fn(async () => true), 'qa-sandbox');
    openPicker();
    await waitFor(() => expect(mapsService.loadMaps).toHaveBeenCalled());
    await act(async () => {
      await mapsService.loadMaps.mock.results[0].value.catch(() => {});
      await Promise.resolve();
    });
    expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();
  });
});

// Pending face (2026-11-21 EEE backlog): while the maps LIST lane is in
// flight, the picker paints a labelled spinner placeholder (delayed paint, so
// a warm fast fetch NEVER flickers one) — telling "still loading" apart from
// the outdoor/hidden face. The placeholder dies the instant the lane settles:
// indoor swaps in the real checkbox; outdoor and reject leave NOTHING
// (fail-CLOSED — a pending placeholder must never become a permissive face,
// nor linger as residue on any resolved face).
describe('QuickMonsterSpawn map-type pending placeholder (2026-11-21 EEE backlog)', () => {
  const PAINT_WINDOW_MS = 300; // matches PENDING_PLACEHOLDER_PAINT_MS
  const PAST_WINDOW_MS = PAINT_WINDOW_MS + 100;

  // A list-lane fetch that stays unresolved until the test settles it.
  function mountWithUnsettledProbe() {
    let settle;
    mapsService.loadMaps.mockReturnValue(new Promise((resolve, reject) => { settle = { resolve, reject }; }));
    mount(vi.fn(async () => true), 'qa-sandbox');
    openPicker();
    return settle;
  }

  it('paints a labelled spinner placeholder only after the pending window (fast networks never flicker one)', async () => {
    vi.useFakeTimers();
    try {
      mountWithUnsettledProbe();
      // Inside the paint window nothing extra renders — the fast-network face
      // stays exactly as EEE lived it (no chrome before the paint delay).
      await act(async () => { await vi.advanceTimersByTimeAsync(PAINT_WINDOW_MS - 50); });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
      // Past the window, still pending: the distinguishable "still loading" face.
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      const pending = screen.getByTestId('qms-token-pending');
      expect(pending).toBeInTheDocument();
      expect(pending).toHaveTextContent(/checking the active map for token placement/i);
      expect(pending.querySelector('i.fa-spinner.fa-spin')).not.toBeNull();
      // ...and it is a NOTE, not a permissive control: no checkbox while pending.
      expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolving INDOOR removes the placeholder and swaps in the verbatim checkbox, no residue', async () => {
    vi.useFakeTimers();
    try {
      const settle = mountWithUnsettledProbe();
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_WINDOW_MS); });
      expect(screen.getByTestId('qms-token-pending')).toBeInTheDocument();
      await act(async () => {
        settle.resolve({ maps: [{ name: 'qa-sandbox', slug: 'qa-sandbox', type: 'indoor', isActive: true }] });
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
      const box = screen.getByLabelText('Place a token near the party on the map');
      expect(box).toBeInTheDocument();
      expect(box).not.toBeChecked(); // default OFF law preserved on the swap-in
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolving OUTDOOR removes the placeholder and leaves NOTHING in its slot (absent-face law, no residue)', async () => {
    vi.useFakeTimers();
    try {
      const settle = mountWithUnsettledProbe();
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_WINDOW_MS); });
      expect(screen.getByTestId('qms-token-pending')).toBeInTheDocument();
      await act(async () => {
        settle.resolve({ maps: [{ name: 'qa-sandbox', slug: 'qa-sandbox', type: 'outdoor', isActive: true }] });
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejecting the fetch removes the placeholder and stays fail-CLOSED (no checkbox, no residue)', async () => {
    vi.useFakeTimers();
    try {
      const settle = mountWithUnsettledProbe();
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_WINDOW_MS); });
      expect(screen.getByTestId('qms-token-pending')).toBeInTheDocument();
      await act(async () => {
        settle.reject(new Error('maps list unavailable'));
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();
      // And the placeholder never paints afterwards either.
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_WINDOW_MS); });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a fetch that resolves inside the paint window never renders a placeholder at all', async () => {
    vi.useFakeTimers();
    try {
      mockActiveMapFace('indoor');
      mount(vi.fn(async () => true), 'qa-sandbox');
      openPicker();
      // Settle promptly (warm local network), then sit well past the window.
      await act(async () => { await vi.advanceTimersByTimeAsync(5); });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Place a token near the party on the map')).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the NO-active-map face never paints the placeholder (there is no fetch to await)', async () => {
    vi.useFakeTimers();
    try {
      mount(vi.fn(async () => true), null);
      openPicker();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(screen.queryByTestId('qms-token-pending')).not.toBeInTheDocument();
      expect(mapsService.loadMaps).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
