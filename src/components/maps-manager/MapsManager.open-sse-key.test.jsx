// @maintained-by-ai: 2026-10-24
// Lane: manager-open SSE key contract (regression for
// bug-map-editor-sse-key-mismatch-json-suffix).
//
// The Maps manager "Open" button must hand the editor a suffix-FREE mapName:
// the server publishes map-data-<campaign>-<name> suffix-free
// (server/routes/maps.js:169) and useSSESync compares event.key against
// `map-data-${campaignName}-${mapName}` byte-exactly. Open used to pass the
// raw fileName 'test-map.json', so every live walls/players/revealed/
// placedItems/gridSize update from another tab was silently dropped in the
// manager-opened editor.
//
// Pinned here is the full broken chain: mount the manager → click Open → feed
// the emitted mapName into the editor's useSSESync exactly as Map.jsx wires
// it (Map.jsx:205) → fire a server-shaped snapshot event → walls LAND.
//
// Not owned here: key-filter/merge semantics (../map/hooks/useSSESync.test.js),
// navigation stack (src/App.map-navigation.test.jsx), shared connection
// lifecycle (subscriber/sseClient lanes).

import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';
import useSSESync from '../map/hooks/useSSESync.js';

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
    default: ({ value }) => <textarea data-testid="preview-toggle-textarea" value={value} readOnly />,
}));

vi.mock('../common/Subscriber.jsx', () => ({
    default: () => null,
}));

vi.mock('./GenerateDungeonModal.jsx', () => ({ default: () => null }));
vi.mock('./GenerateTerrainModal.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

const TEST_MAP_ROW = { fileName: 'test-map.json', name: 'Test Map', type: 'indoor', isActive: false };
// Suffix-free publish key, byte-identical to server/routes/maps.js:169-170.
const SSE_KEY = 'map-data-test-campaign-test-map';

describe('MapsManager open → editor SSE key (json-suffix regression)', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: [TEST_MAP_ROW] });
        props = { campaignName: 'test-campaign', onOpenMap: vi.fn(), onBack: vi.fn() };
    });

    it('Open emits the suffix-free mapName that matches the server publish key', async () => {
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Test Map')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Open "Test Map"' }));
        expect(props.onOpenMap).toHaveBeenCalledTimes(1);

        // The exact bug byte: 'test-map', never 'test-map.json'.
        const [mapName, displayName] = props.onOpenMap.mock.calls[0];
        expect(mapName).toBe('test-map');
        expect(mapName.endsWith('.json')).toBe(false);
        // Backlog map-load-notice-slug-naming: the row's DISPLAY name rides as
        // the 2nd arg so a rejected document load names the map the way the
        // user just saw it (the slug stays the storage/SSE key).
        expect(displayName).toBe('Test Map');
    });

    it('manager-open mount + server map-data event updates the editor walls state', async () => {
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Test Map')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Open "Test Map"' }));
        const [mapName] = props.onOpenMap.mock.calls[0];

        // Wire the editor sync exactly as Map.jsx:205-207 does, using the
        // mapName the manager-open emitted.
        const setGridSize = vi.fn();
        const setMapData = vi.fn();
        const setPlacedItems = vi.fn();
        const { result } = renderHook(() =>
            useSSESync({ campaignName: props.campaignName, mapName, setGridSize, setMapData, setPlacedItems })
        );

        // A second tab paints two wall cells; the server broadcasts the full
        // suffix-free snapshot. Live sync must land, not sit deaf.
        act(() => {
            result.current.handleSSEEvent({
                key: SSE_KEY,
                data: { walls: ['15,4', '15,5'], players: [], revealed: [] },
            });
        });

        expect(setMapData).toHaveBeenCalledTimes(1);
        const merged = setMapData.mock.calls[0][0]({ players: [], walls: new Set(), revealed: [] });
        expect(merged.walls).toEqual(new Set(['15,4', '15,5']));

        // Belt: a suffixed key (which the server never publishes) is still
        // never accepted — byte-exact matching stays byte-exact.
        act(() => {
            result.current.handleSSEEvent({
                key: `${SSE_KEY}.json`,
                data: { walls: ['9,9'], players: [], revealed: [] },
            });
        });
        expect(setMapData).toHaveBeenCalledTimes(1);
    });
});
