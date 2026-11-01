// @maintained-by-ai: 2026-11-01
// ─── Lane: indoor POI render + manage lane ────────────────────────────────────
// bug-ai-dress-poi-invisible-on-indoor-maps: AI Dress `add poi` ops on an
// INDOOR map persisted to the map document (server dressMap.js stores
// gridX/gridY rows) but the indoor board drew NOTHING for `pois` — no marker,
// no label, no delete affordance. Pinned here (the container seam):
//   • a loaded document's pois render marker + label on the grid,
//   • hidden POIs: invisible to LAN players, dimmed-but-present for the GM,
//   • GM right-click → Hide/Delete menu; confirmed Delete removes the row
//     from the board AND the debounced autosave PUT carries the new pois
//     array (persistence lane); Cancel is fully inert.
// Component internals (menu chrome, hit geometry) mirror sibling lanes:
// hex-map/POILayer.jsx + POIContextMenu.jsx (their own tests own hex bytes).

import { render, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';
import { HIDDEN_MARKER_OPACITY } from '../../config/mapConfig';

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

// Live-shape POI row exactly as server dressMap.js addPoi writes it indoors.
const POI = {
    id: 'ai-dress-poi-2-2-0',
    type: 'landmark',
    label: 'QA Fix Shrine',
    description: 'A cold little shrine.',
    visible: true,
    gridX: 2,
    gridY: 2,
};

function mockLoadedMap(overrides = {}) {
    mapsService.loadMapData.mockResolvedValue({
        type: 'indoor',
        displayName: 'Test Map',
        gridSize: 20,
        players: [],
        walls: [],
        placedItems: [],
        ...overrides,
    });
}

function renderEditor(props = {}) {
    return render(
        <Map
            campaignName="test-campaign"
            characters={[]}
            isLocalhost
            mapName="test-map"
            onBack={vi.fn()}
            onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()}
            {...props}
        />
    );
}

async function renderGmWithPoi(pois) {
    mockLoadedMap({ pois });
    const view = renderEditor();
    await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());
    return view;
}

describe('indoor map POI lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the persisted POI marker and label on the indoor board', async () => {
        const { container } = await renderGmWithPoi([POI]);

        const layer = container.querySelector('.indoor-poi-layer');
        expect(layer).toBeTruthy();
        expect(layer.querySelector('use')?.getAttribute('href')).toBe('#poi-landmark');
        expect(layer.querySelector('.poi-label')?.textContent).toBe('QA Fix Shrine');
        // The shared icon def the marker references is mounted in the svg defs.
        expect(container.querySelector('defs use, defs g#poi-landmark')).toBeTruthy();
        // GM gets the hit area that anchors the manage menu.
        expect(layer.querySelector('.poi-hit-area')).toBeTruthy();
    });

    it('hidden POIs are invisible to LAN players and dimmed for the GM', async () => {
        const hidden = { ...POI, visible: false };
        const gm = await renderGmWithPoi([hidden]);
        expect(gm.container.querySelector('.poi-label')?.textContent).toBe('QA Fix Shrine');
        expect(gm.container.querySelector('use')?.getAttribute('opacity')).toBe(String(HIDDEN_MARKER_OPACITY));
        gm.unmount();

        mockLoadedMap({ pois: [hidden] });
        const lan = renderEditor({ isLocalhost: false });
        await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());
        expect(lan.container.querySelector('.poi-item')).toBeNull();
        lan.unmount();
    });

    it('right-click opens the menu; confirmed Delete removes the row from board and PUT', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { container } = await renderGmWithPoi([POI]);

        fireEvent.contextMenu(container.querySelector('.poi-hit-area'));
        const menu = container.querySelector('.poi-context-menu');
        expect(menu).toBeTruthy();
        expect(menu.textContent).toContain('Delete');

        fireEvent.click([...menu.querySelectorAll('text')].find(t => t.textContent === 'Delete'));
        // Named-confirm ran, then the row is gone from the board...
        expect(confirmSpy).toHaveBeenCalledWith('Delete POI "QA Fix Shrine"?');
        expect(container.querySelector('.indoor-poi-layer .poi-item')).toBeNull();
        // ...and the debounced autosave persists the removal (pre-fix, no
        // indoor UI could ever produce this PUT).
        await waitFor(() => expect(mapsService.saveMapData).toHaveBeenCalled(), { timeout: 3000 });
        const saved = mapsService.saveMapData.mock.calls.at(-1)[2];
        expect(saved.pois).toEqual([]);
    });

    it('cancelling the Delete confirm keeps the row and writes nothing', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { container } = await renderGmWithPoi([POI]);

        fireEvent.contextMenu(container.querySelector('.poi-hit-area'));
        const menu = container.querySelector('.poi-context-menu');
        fireEvent.click([...menu.querySelectorAll('text')].find(t => t.textContent === 'Delete'));

        expect(container.querySelector('.poi-label')?.textContent).toBe('QA Fix Shrine');
        expect(container.querySelector('.poi-context-menu')).toBeNull();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('Hide dims the marker and persists visible:false through the autosave', async () => {
        const { container } = await renderGmWithPoi([POI]);

        fireEvent.contextMenu(container.querySelector('.poi-hit-area'));
        const menu = container.querySelector('.poi-context-menu');
        fireEvent.click([...menu.querySelectorAll('text')].find(t => t.textContent === 'Hide'));

        expect(container.querySelector('use')?.getAttribute('opacity')).toBe(String(HIDDEN_MARKER_OPACITY));
        await waitFor(() => expect(mapsService.saveMapData).toHaveBeenCalled(), { timeout: 3000 });
        const saved = mapsService.saveMapData.mock.calls.at(-1)[2];
        expect(saved.pois).toEqual([{ ...POI, visible: false }]);
    });
});
