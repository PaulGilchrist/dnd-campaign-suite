// @maintained-by-ai 2026-11-19
// Lane: the viewMode-flip seam of last-known-position memory (SK 2026-11-19
// improve). useLastKnownPositions is HOISTED into Map.jsx above the 2D/3D
// conditional so the per-client ghost cache survives a 2D→3D→2D round-trip —
// Map stays mounted while the whole 2D tree (PlacedItems included) unmounts.
// Pinned here through the real composition (real loader state, real fog, real
// hook, real map-data SSE merge via a captured Subscriber handler):
//   • a fogged creature re-enters 2D ghosting at its last-seen cell
//     IMMEDIATELY after the flip — no live re-sighting;
//   • ghost move laws hold across the flip (frozen while fogged, truth on
//     re-reveal);
//   • the memory-drop doctrine HOLDS at genuine page boundaries: a remount
//     with the token still fogged paints NOTHING (cache is page-local, never
//     persisted);
//   • toggle OFF→ON across an SSE snapshot drops the cache (no stale
//     pre-toggle ghosts);
//   • the GM lane never shows ghost chrome, 2D or after a flip.
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';
import { CELL_SIZE } from '../../config/mapConfig';

const MAP_NAME = 'test-map';
const CENTER = (cell) => cell * CELL_SIZE + CELL_SIZE / 2;

// Whole-document snapshots, exactly the shape useSSESync consumes.
const SSE_KEY = `map-data-test-campaign-${MAP_NAME}`;

// vi.hoisted: the Subscriber mock runs during module import, before the
// plain-const TDZ window would allow closing over it.
const sse = vi.hoisted(() => ({ handle: null }));
// 3D seam capture (Item 7 parity): the Map3D mock records the props Map hands
// it, so the flip tests can prove the hoisted ghostCells memory is delivered
// to the 3D surface — the same value the 2D PlacedItems lane consumes.
const map3d = vi.hoisted(() => ({ props: null }));

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
    updateMapDescription: vi.fn(),
    formatMapName: vi.fn((name) => name),
}));

vi.mock('../common/Subscriber.jsx', () => ({
    default: ({ handleEvent }) => {
        sse.handle = handleEvent;
        return null;
    },
}));
vi.mock('../hex-map/HexMap.jsx', () => ({ default: () => <div data-testid="hex-map" /> }));
vi.mock('./Map3D/Map3D.jsx', () => ({
    default: (props) => {
        map3d.props = props;
        return (
            <div data-testid="map3d">
                <button onClick={props.onExit}>2D</button>
            </div>
        );
    },
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

// Fog model stays honest (real useFogOfWar): NO players → line of sight is
// empty, so fog = every cell except the `revealed` doc entries. (2,2) is the
// lit cell where the token gets genuinely seen; (4,4) is never-revealed fog.
const goblin = (over = {}) => ({
    id: 'gob-1', type: 'monster', name: 'Goblin 1',
    gridX: 2, gridY: 2, visible: true, ...over,
});
const docOf = (overrides = {}) => ({
    type: 'indoor',
    displayName: 'Ghost Flip Sandbox',
    gridSize: 5,
    players: [],
    walls: [],
    revealed: ['2,2'],
    lastKnownMode: true,
    placedItems: [goblin()],
    ...overrides,
});

async function renderVisitor(overrides = {}) {
    mapsService.loadMapData.mockResolvedValue(docOf(overrides));
    const view = render(
        <Map
            campaignName="test-campaign"
            characters={[]}
            isLocalhost={false}
            mapName={MAP_NAME}
            onBack={vi.fn()}
            onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()}
        />
    );
    await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());
    await waitFor(() => expect(sse.handle).toBeTruthy());
    return view;
}

function sendMapData(data) {
    act(() => { sse.handle({ key: SSE_KEY, data }); });
}

// Ghost state: seen live at (2,2), then an SSE snapshot hops it to fogged
// (4,4) — the visitor pass freezes it at the last-seen cell.
async function toGhostState(view) {
    const live = view.container.querySelector('g.npc-group circle.npc-circle');
    expect(live).toHaveAttribute('cx', String(CENTER(2))); // seen for real first
    sendMapData({ placedItems: [goblin({ gridX: 4, gridY: 4 })] });
    const ghost = await waitFor(() => {
        const g = view.container.querySelector('g.npc-group.token-ghost');
        expect(g).toBeTruthy();
        return g;
    });
    expect(ghost.getAttribute('title')).toContain('last seen here');
    expect(view.container.querySelectorAll('g.npc-group')).toHaveLength(1); // truth culled
    return ghost;
}

describe('Map — last-known memory survives the 2D↔3D view flip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        sse.handle = null;
        map3d.props = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('2D→3D→2D mid-fog re-paints the ghost IMMEDIATELY at the same last-seen cell, no live re-sighting', async () => {
        const view = await renderVisitor();
        const ghost = await toGhostState(view);
        const cx = ghost.querySelector('circle.npc-circle').getAttribute('cx');
        const cy = ghost.querySelector('circle.npc-circle').getAttribute('cy');

        // Flip to 3D: the whole 2D tree unmounts (the 3D scene repaints the
        // ghost from the hoisted memory — the prop handoff is pinned below;
        // the scene-side rendering is owned by map3dScene.last-known.test.js).
        fireEvent.click(screen.getByRole('button', { name: 'View map in 3D' }));
        expect(screen.getByTestId('map3d')).toBeInTheDocument();
        expect(view.container.querySelectorAll('g.npc-group')).toHaveLength(0);
        // Item 7 3D parity data law: Map3D receives the SAME hoisted ghostCells
        // value — no second position tracker reaches the scene.
        expect(map3d.props.ghostCells.has('gob-1')).toBe(true);
        expect(map3d.props.ghostCells.get('gob-1')).toEqual({ gridX: 2, gridY: 2 });

        // Back to 2D: the cache lived at Map level, so the ghost is instant —
        // zero SSE snapshots between the two paints.
        fireEvent.click(screen.getByRole('button', { name: '2D' }));
        const repainted = view.container.querySelector('g.npc-group.token-ghost');
        expect(repainted).toBeInTheDocument();
        expect(repainted.getAttribute('title')).toContain('last seen here');
        expect(repainted.querySelector('circle.npc-circle')).toHaveAttribute('cx', cx);
        expect(repainted.querySelector('circle.npc-circle')).toHaveAttribute('cy', cy);
        // Ghost chrome only: zero status-chip DOM survives on stale ground.
        expect(view.container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
    });

    it('ghost move laws hold across the flip: fogged hops keep it pinned, a revealed cell paints truth', async () => {
        const view = await renderVisitor();
        await toGhostState(view);

        // Still-fogged move: ghost stays frozen at (2,2) (never the new cell).
        sendMapData({ placedItems: [goblin({ gridX: 0, gridY: 4 })] });
        const pinned = view.container.querySelector('g.npc-group.token-ghost circle.npc-circle');
        expect(pinned).toHaveAttribute('cx', String(CENTER(2)));
        expect(pinned).toHaveAttribute('cy', String(CENTER(2)));

        // Flip to 3D and back mid-fog — still pinned at the same memory.
        fireEvent.click(screen.getByRole('button', { name: 'View map in 3D' }));
        fireEvent.click(screen.getByRole('button', { name: '2D' }));
        expect(view.container.querySelector('g.npc-group.token-ghost circle.npc-circle'))
            .toHaveAttribute('cx', String(CENTER(2)));

        // Re-reveal: the token steps onto the revealed (2,2) cell → live truth,
        // no ghost chrome.
        sendMapData({ placedItems: [goblin({ gridX: 2, gridY: 2 })] });
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        const live = view.container.querySelector('g.npc-group circle.npc-circle');
        expect(live).toHaveAttribute('cx', String(CENTER(2)));
        expect(view.container.querySelector('g.npc-group').getAttribute('title'))
            .not.toContain('last seen');
    });

    it('memory-drop doctrine holds at the page boundary: a remount with the token fogged paints NOTHING', async () => {
        const view = await renderVisitor();
        await toGhostState(view);
        view.unmount();

        // Fresh mount (reload / map-navigation analogue): the document ALREADY
        // shows the monster fogged at (4,4) — there is no pre-mount memory to
        // ghost from, so the lane stays culled until a genuine live sighting.
        const remount = await renderVisitor({ placedItems: [goblin({ gridX: 4, gridY: 4 })] });
        expect(remount.container.querySelectorAll('g.npc-group')).toHaveLength(0);

        // …and the ghost re-arms from the NEXT genuinely-seen position.
        sendMapData({ placedItems: [goblin({ gridX: 2, gridY: 2 })] });
        expect(remount.container.querySelector('g.npc-group.token-ghost')).toBeNull();
        expect(remount.container.querySelector('g.npc-group circle.npc-circle'))
            .toHaveAttribute('cx', String(CENTER(2)));
        sendMapData({ placedItems: [goblin({ gridX: 4, gridY: 4 })] });
        expect(remount.container.querySelector('g.npc-group.token-ghost'))
            .toBeInTheDocument();
    });

    it('toggle OFF→ON across SSE snapshots drops the cache: no stale pre-toggle ghosts', async () => {
        const view = await renderVisitor();
        await toGhostState(view);

        // GM flips the doc flag OFF: the pass returns null and DROPS memory;
        // rendering is byte-identical to the historic cull.
        sendMapData({ lastKnownMode: false });
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelectorAll('g.npc-group')).toHaveLength(0);

        // Re-arm ON: the (2,2) memory belonged to the pre-toggle ON stretch
        // and is gone — nothing stale ghosts the still-fogged token.
        sendMapData({ lastKnownMode: true });
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelectorAll('g.npc-group')).toHaveLength(0);

        // Ghosting re-arms only from newly-seen positions.
        sendMapData({ placedItems: [goblin({ gridX: 2, gridY: 2 })] });
        expect(view.container.querySelector('g.npc-group.token-ghost')).toBeNull();
        sendMapData({ placedItems: [goblin({ gridX: 4, gridY: 4 })] });
        expect(view.container.querySelector('g.npc-group.token-ghost')).toBeInTheDocument();
    });

    it('GM lane never shows ghost chrome: fogged monster paints truth, before AND after a view flip', async () => {
        mapsService.loadMapData.mockResolvedValue(docOf({
            revealed: [],
            placedItems: [goblin({ gridX: 4, gridY: 4 })],
        }));
        const view = render(
            <Map
                campaignName="test-campaign"
                characters={[]}
                isLocalhost
                mapName={MAP_NAME}
                onBack={vi.fn()}
                onEncounterCreated={vi.fn()}
                onPoiEntered={vi.fn()}
            />
        );
        await waitFor(() => expect(view.container.querySelector('g.npc-group')).toBeTruthy());
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelector('g.npc-group circle.npc-circle'))
            .toHaveAttribute('cx', String(CENTER(4))); // truth cell, fogged or not

        fireEvent.click(screen.getByRole('button', { name: 'View map in 3D' }));
        // GM lane never ghosts — the hoisted value is null, so the 3D scene
        // can only paint truth meshes (criterion 5, data side).
        expect(map3d.props.ghostCells).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '2D' }));
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelector('g.npc-group circle.npc-circle'))
            .toHaveAttribute('cx', String(CENTER(4)));
    });
});
