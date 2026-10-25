// @maintained-by-ai: 2026-10-25
// Lane: mount-proof testid for the maps list → editor navigation.
//
// Backlog (2026-10-25 day run): clicking "Open" in the maps list can silently
// no-op in automation — the previous view stays mounted, .grid-svg is absent,
// and a poll on g.creature-group tokens masks the stale view. The editor root
// now carries data-testid="map-editor" (Map.jsx indoor root; HexMap.jsx
// outdoor twin) so a test asserts successful navigation the moment the editor
// mounts, without waiting for tokens.
//
// Pinned here (real MapsManager + real Map on the shared map.test-utils hook
// rig — mirrors the MapsManager.open-sse-key.test.jsx seam):
//   • testid ABSENT on the manager list view
//   • after Open it appears EXACTLY ONCE, on the root that WRAPS svg.grid-svg
//   • every live round-trip (editor-Back → list, list-Back → sheet, sidebar
//     re-entry, re-Open) shows it only while the editor is mounted; no other
//     view ever carries it
//
// Not owned here: App navigation-stack semantics (src/App.map-navigation.test.jsx),
// Open-button SSE key (../maps-manager/MapsManager.open-sse-key.test.jsx),
// editor internals (Map.test.jsx + hook lanes).

import { useState } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from '../maps-manager/MapsManager.jsx';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';
import {
    setupMapMocks,
    createDefaultMocks,
} from './map.test-utils.js';

// Real useMapLoader is mocked to a loaded indoor map, so the editor root
// (and its testid) lands the moment Map mounts — tokens are irrelevant here.
setupMapMocks({ mapLoader: createDefaultMocks() });

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(() => Promise.resolve(null)),
    saveMapData: vi.fn(() => Promise.resolve()),
    updateMapDescription: vi.fn(),
    formatMapName: vi.fn((name) => name),
}));

// Manager-side leaves — stubbed exactly as the sibling open-sse-key rig does.
vi.mock('../common/PreviewToggle.jsx', () => ({
    default: ({ value }) => <textarea data-testid="preview-toggle-textarea" value={value} readOnly />,
}));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => null }));
vi.mock('../maps-manager/GenerateDungeonModal.jsx', () => ({ default: () => null }));
vi.mock('../maps-manager/GenerateTerrainModal.jsx', () => ({ default: () => null }));

// Heavy editor children never reached on this lane (props-driven — those
// seams are owned by Map.test.jsx); stubbed to keep imports light.
vi.mock('../hex-map/HexMap.jsx', () => ({ default: () => <div data-testid="hex-map" /> }));
vi.mock('./Map3D/Map3D.jsx', () => ({ default: () => <div data-testid="map3d" /> }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));

import * as mapsService from '../../services/maps/mapsService.js';

const MAP_ROW = { fileName: 'battle-arena.json', name: 'Battle Arena', type: 'indoor', isActive: true };

// Single-live-instance harness mirroring App.jsx MapsAreaView + sidebar:
// list → map on Open, map → list on editor Back, list → sheet on manager
// Back, sheet → list on the Maps sidebar button. The sheet view must NEVER
// carry the editor testid.
function NavHarness() {
    const [view, setView] = useState('list'); // 'list' | 'map' | 'sheet'
    const [activeMap, setActiveMap] = useState(null);
    if (view === 'list') {
        return (
            <MapsManager
                campaignName="test-campaign"
                onOpenMap={(name) => { setActiveMap(name); setView('map'); }}
                onBack={() => setView('sheet')}
            />
        );
    }
    if (view === 'map') {
        return (
            <Map
                campaignName="test-campaign"
                characters={[]}
                isLocalhost
                mapName={activeMap}
                onBack={() => setView('list')}
                onEncounterCreated={vi.fn()}
                onPoiEntered={vi.fn()}
            />
        );
    }
    return (
        <div data-testid="char-sheet">
            Sheet view
            <button onClick={() => setView('list')}>Maps</button>
        </div>
    );
}

const openButton = () => screen.getByRole('button', { name: 'Open' });
const editorTestids = () => screen.queryAllByTestId('map-editor');

describe('map editor mount-proof testid (list → Open navigation)', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: [MAP_ROW] });
        clearRuntimeState('test-campaign');
    });

    it('list view never carries the testid; Open mounts it exactly once on the grid root', async () => {
        render(<NavHarness />);
        await waitFor(() => expect(openButton()).toBeInTheDocument());

        // Manager list: zero editor testids (no stale-mount false positive).
        expect(editorTestids()).toHaveLength(0);

        fireEvent.click(openButton());
        await waitFor(() => expect(editorTestids()).toHaveLength(1));

        // One node anchors both assertions: the testid root WRAPS the grid.
        const editor = editorTestids()[0];
        expect(editor.querySelector('svg.grid-svg')).toBeTruthy();
        // The list really unmounted — its row is gone.
        expect(screen.queryByText('Battle Arena')).not.toBeInTheDocument();
    });

    it('survives the live round-trip: editor-Back clears it, sheet never has it, re-open restores it', async () => {
        render(<NavHarness />);
        await waitFor(() => expect(openButton()).toBeInTheDocument());

        // Open → editor mounted.
        fireEvent.click(openButton());
        await waitFor(() => expect(editorTestids()).toHaveLength(1));

        // Editor toolbar Back → manager list: testid gone, list rows return.
        fireEvent.click(screen.getByTitle('Back'));
        await waitFor(() => expect(editorTestids()).toHaveLength(0));
        expect(openButton()).toBeInTheDocument();

        // Manager Back → sheet stand-in: still zero.
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        await waitFor(() => expect(screen.getByTestId('char-sheet')).toBeInTheDocument());
        expect(editorTestids()).toHaveLength(0);

        // Sidebar "Maps" → list, re-Open → testid back exactly once, grid inside.
        fireEvent.click(screen.getByRole('button', { name: 'Maps' }));
        await waitFor(() => expect(openButton()).toBeInTheDocument());
        expect(editorTestids()).toHaveLength(0);
        fireEvent.click(openButton());
        await waitFor(() => expect(editorTestids()).toHaveLength(1));
        expect(editorTestids()[0].querySelector('svg.grid-svg')).toBeTruthy();
    });
});
