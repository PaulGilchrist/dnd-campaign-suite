// @maintained-by-ai: 2026-11-05
// ─── Lane: unregistered-type ghost row on the mounted board ──────────────────
// bug-unregistered-placeditem-type-invisible-ghost: the map POST/PUT and the
// AI-Dress `add item` lane persist ANY non-empty item.type, but the
// PlacedItems dispatcher was a fixed 24-type whitelist — an unknown row (e.g.
// a cauldron invented by AI Dress) got ZERO DOM: no sprite, no hit area, so
// every context-menu action (Hide/Delete/Rotate) was unreachable and the row
// was UI-undeletable. Pinned here at the container seam (mirrors the
// Map.indoor-pois.test.jsx scaffolding):
//   • a loaded document's ghost row renders the #generic-prop placeholder,
//     and that def is actually mounted in the svg <defs>,
//   • GM right-click → Delete arms the role=dialog tier and the confirmed
//     delete PUTs the filtered placedItems (a ghost is recoverable end-to-end).

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    createMap: vi.fn(() => Promise.resolve({ name: 'test', alreadyExists: false })),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
    updateMapDescription: vi.fn(),
    formatMapName: vi.fn((name) => name),
}));

vi.mock('../common/Subscriber.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/HexMap.jsx', () => ({ default: () => <div data-testid="hex-map" /> }));
vi.mock('./Map3D/Map3D.jsx', () => ({ default: () => <div data-testid="map3d" /> }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));

import * as mapsService from '../../services/maps/mapsService.js';

// Live-shape ghost row exactly as POST /maps (and dressMap addPlacedItem)
// persists an invented type: non-empty string, no name, no rotation.
const GHOST = { id: 'cv-legacy', type: 'cauldron', gridX: 3, gridY: 3, visible: true };
const TABLE = { id: 'cv-table', type: 'table', gridX: 9, gridY: 3, visible: true };

function mockLoadedMap(overrides = {}) {
    mapsService.loadMapData.mockResolvedValue({
        type: 'indoor',
        displayName: 'Test Map',
        gridSize: 20,
        players: [],
        walls: [],
        placedItems: [GHOST, TABLE],
        ...overrides,
    });
}

async function renderGmWithItems(placedItems) {
    mockLoadedMap({ placedItems });
    const view = render(
        <Map
            campaignName="test-campaign"
            characters={[]}
            isLocalhost
            mapName="test-map"
            onBack={vi.fn()}
            onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()}
        />
    );
    await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());
    return view;
}

describe('indoor map ghost-item lane (unregistered type)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the ghost row via the shared placeholder and mounts the def in <defs>', async () => {
        const { container } = await renderGmWithItems([GHOST, TABLE]);

        // Both rows are on the board now: the ghost as #generic-prop, the
        // registered table keeping its sprite lane.
        const ghostUse = container.querySelector('g.placed-item[title="cauldron (3,3)"] use');
        expect(ghostUse).toBeTruthy();
        expect(ghostUse.getAttribute('href')).toBe('#generic-prop');
        expect(container.querySelector('image[href="/images/items/table.png"]')).toBeTruthy();
        // The referenced def actually exists on this svg (a dangling href would
        // re-create the invisible-ghost defect).
        expect(container.querySelector('defs g#generic-prop')).toBeTruthy();
        // Ghost gets its own GM hit area (was 1 for the table only, pre-fix).
        expect(container.querySelectorAll('.item-hit-area')).toHaveLength(2);
    });

    it('GM right-click → Delete arms the role=dialog tier; Yes, Delete removes the row and the PUT carries it', async () => {
        const { container } = await renderGmWithItems([GHOST, TABLE]);

        const ghostHit = [...container.querySelectorAll('g.placed-item')]
            .find(g => g.getAttribute('title') === 'cauldron (3,3)')
            .querySelector('.item-hit-area');
        fireEvent.contextMenu(ghostHit);
        const menu = container.querySelector('.item-context-menu');
        expect(menu).toBeTruthy();
        expect(menu.textContent).toContain('Delete');

        fireEvent.click([...menu.querySelectorAll('text')].find(t => t.textContent === 'Delete'));
        const dialog = screen.getByRole('dialog', { name: 'Delete from Map' });
        expect(dialog).toHaveTextContent('Delete "cauldron (3,3)" from the map?');

        fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(container.querySelector('g.placed-item[title="cauldron (3,3)"]')).toBeNull();
        // Registered table survives, and the debounced autosave persists the
        // removal — an AI-invented ghost is finally deletable from the UI.
        expect(container.querySelector('image[href="/images/items/table.png"]')).toBeTruthy();
        await waitFor(() => expect(mapsService.saveMapData).toHaveBeenCalled(), { timeout: 3000 });
        const saved = mapsService.saveMapData.mock.calls.at(-1)[2];
        expect(saved.placedItems.map(i => i.id)).toEqual(['cv-table']);
    });
});
