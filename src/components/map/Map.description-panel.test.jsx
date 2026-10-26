// @maintained-by-ai: 2026-10-26
// Lane: read-only description panel in the indoor map editor header
// (backlog 2026-10-26: descriptions surfaced nowhere read-only). The panel
// mounts under MapToolbar and self-gates: non-empty description renders
// (sanitized markdown), empty/missing description omits the panel entirely.
// Outdoor twin mounted in HexMap.jsx — pinned by HexMap.test.jsx.
// Panel/sanitization internals: ../common/MapDescriptionPanel.test.jsx.
//
// Rig: the REAL indoor useMapLoader loads through the mocked mapsService
// (Map.outdoor-switch.test.jsx pattern) so the panel asserts against the
// exact document bytes GET /maps/:slug would deliver.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Stored indoor document shape (walls array on disk; loader Set-ifies it).
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

function renderEditor() {
    return render(
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
}

describe('indoor map editor header description panel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
    });

    it('renders the description as sanitized markdown under the toolbar', async () => {
        mockLoadedMap({ description: '## The Ruins\n\n**misty** over *the sea*' });
        const { container } = renderEditor();
        await waitFor(() => expect(screen.getByTestId('map-description-panel')).toBeInTheDocument());

        const panel = screen.getByTestId('map-description-panel');
        // Sanitized markdown path: headings/bold/italic become elements.
        expect(panel.querySelector('h2')?.textContent).toBe('The Ruins');
        expect(panel.querySelector('strong')?.textContent).toBe('misty');
        expect(panel.querySelector('em')?.textContent).toBe('the sea');
        // Editor fully mounted; panel sits below the toolbar header row,
        // before the grid canvas.
        expect(screen.getByTestId('map-editor')).toBeInTheDocument();
        const toolbarRow = container.querySelector('.toolbar-row');
        expect(toolbarRow.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(panel.compareDocumentPosition(container.querySelector('svg.grid-svg')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('omits the panel when the description is empty', async () => {
        mockLoadedMap({ description: '' });
        renderEditor();
        await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());

        expect(screen.queryByTestId('map-description-panel')).toBeNull();
    });

    it('omits the panel when the map document carries no description key', async () => {
        mockLoadedMap();
        renderEditor();
        await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());

        expect(screen.queryByTestId('map-description-panel')).toBeNull();
    });
});
