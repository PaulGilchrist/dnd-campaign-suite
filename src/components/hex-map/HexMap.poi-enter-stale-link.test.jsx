// @maintained-by-ai
// Regression lock for bug-hex-poi-enter-deleted-map-phantom-resurrect: the golden
// Enter chip rendered next to a POI whose linked indoor map was deleted under the
// mounted editor stayed live (validLinkedMaps is a mount-time probe snapshot and
// nothing invalidated it), and real-clicking it navigated into a blank editor
// whose open-time create-save PUT the deleted file back as a nameless ghost.
// Locked here: (1) the click-seam re-check refuses a confirmed-missing target
// with a NAMED toast, self-heals the POI via handleUnlinkMap, retires the chip,
// and logs a travel/enter_refused row — navigation never fires; (2) an
// unreachable maps list is UNVERIFIED, not gone: refuse loudly but keep the
// link; (3) a live target still enters; (4) a maps-list SSE event re-probes the
// validity set so the chip retires proactively (no click needed).
// Container-harness twin of HexMap.additional.test.jsx (same mock surface).
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// JSDOM PointerEvent polyfill (needed for React 19 onPointerLeave handlers)
if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.pointerId = init.pointerId || 0;
            this.pointerType = init.pointerType || 'mouse';
        }
    };
}

// Capture POI layer + Subscriber props so tests can invoke the container's own
// handlers (onPoiEnter) and deliver SSE events exactly as the live stream does.
const { poiLayerProps, subscriberProps } = vi.hoisted(() => ({
    poiLayerProps: { current: null },
    subscriberProps: { current: null },
}));

// ── Mock child components ──
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./HexMapToolbar.jsx', () => ({ default: () => <div data-testid="toolbar" /> }));
vi.mock('./POILayer.jsx', () => ({
    default: (props) => {
        poiLayerProps.current = props;
        return <g data-testid="poi-layer" />;
    },
}));
vi.mock('./POIPanel.jsx', () => ({ default: () => <div data-testid="poi-panel" /> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: ({ selectedPoi }) => selectedPoi ? <g data-testid="poi-context-menu" /> : null }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => <div data-testid="marching-panel" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: ({ position }) => position ? <g data-testid="party-marker" /> : null }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: () => <g data-testid="travel-path-layer" /> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: ({ weather }) => weather ? <div data-testid="weather-overlay" /> : null }));
vi.mock('./EventDialog.jsx', () => ({ default: () => null }));
vi.mock('./TravelPanel.jsx', () => ({ default: () => <div data-testid="travel-panel" /> }));

vi.mock('./svg/CampSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/CitySVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/DungeonSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/HazardSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/LandmarkSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/LoreSiteSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/NaturalWonderSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/SettlementSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/TowerSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../common/Subscriber.jsx', () => ({
    default: (props) => {
        subscriberProps.current = props;
        return <div data-testid="subscriber" />;
    },
}));

// ── Mock hooks and services ──
vi.mock('./hooks/useMapLoader.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useZoomPan.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useHexHover.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useTerrainPainting.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/usePoiManagement.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useTravelToolSync.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useEncounterGeneration.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useHexMapSSESync.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/management/useTravelManagement.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/ui/useMonstersData.js', () => ({ useMonstersData: vi.fn() }));
vi.mock('../../hooks/runtime/useLog.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: vi.fn((setter) => setter) }));
vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    loadMapData: vi.fn(() => Promise.resolve({})),
    saveMapData: vi.fn(() => Promise.resolve({})),
    createMap: vi.fn(() => Promise.resolve({ name: 'test', alreadyExists: false })),
    formatMapName: vi.fn((name) => name || ''),
    // Real kebab rules (mirrors the service) — the click-seam existence check
    // resolves displayName → slug.
    toKebabCase: vi.fn((name) => (name || '').toLowerCase().replace(/\.json$/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')),
}));
vi.mock('../../services/campaign/weatherService.js', () => ({
    generateWeather: vi.fn(() => ({ condition: 'clear', label: 'Clear', icon: 'sun', moveCostMod: 1, budgetMod: 1, encounterMod: 0, description: 'Clear skies' })),
}));
vi.mock('../../services/encounters/autoEncounterService.js', () => ({
    autoStartEncounterFromEvent: vi.fn(async () => ({ started: false })),
}));

import useMapLoader from './hooks/useMapLoader.js';
import useZoomPan from './hooks/useZoomPan.js';
import useHexHover from './hooks/useHexHover.js';
import useTerrainPainting from './hooks/useTerrainPainting.js';
import usePoiManagement from './hooks/usePoiManagement.js';
import useEncounterGeneration from './hooks/useEncounterGeneration.js';
import useHexMapSSESync from './hooks/useHexMapSSESync.js';
import useTravelManagement from '../../hooks/management/useTravelManagement.js';
import useLog from '../../hooks/runtime/useLog.js';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import * as mapsService from '../../services/maps/mapsService.js';
import HexMap from './HexMap.jsx';

const POI = { id: 'poi-qa', q: 19, r: 10, type: 'city', label: 'QA Door', linkedMap: 'QA Room', visible: true };
const LINKED_ROW = { name: 'QA Room', slug: 'qa-room', type: 'indoor' };

function makeMapLoader(overrides = {}) {
    return {
        loading: false, setMapData: vi.fn(),
        gridSize: 20, setGridSize: vi.fn(),
        terrain: {}, setTerrain: vi.fn(),
        rivers: [], setRivers: vi.fn(),
        roads: [], setRoads: vi.fn(),
        pois: [POI], setPois: vi.fn(),
        marchingOrder: [], setMarchingOrder: vi.fn(),
        partyPosition: { q: 20, r: 10 }, setPartyPosition: vi.fn(),
        weather: null, setWeather: vi.fn(),
        travelInit: null, setTravelInit: vi.fn(),
        setTravelStateRef: vi.fn(),
        zoom: 2, setZoom: vi.fn(),
        panX: 0, setPanX: vi.fn(),
        panY: 0, setPanY: vi.fn(),
        needsResetViewRef: { current: false },
        ...overrides,
    };
}

function makeZoomPan() {
    return {
        svgWidth: 1039, svgHeight: 519,
        zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(),
        clampPan: vi.fn((z, x, y) => ({ x, y })),
        centerView: vi.fn(() => ({ x: 0, y: 0 })),
        panning: false,
        handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
    };
}

function makeTravelMgmt() {
    return {
        travelMode: 'inactive', travelPace: 'normal',
        destination: null, path: [], pathIndex: 0,
        accruedCost: 0, dailyBudget: 4, dayExhausted: false,
        lastMessage: null, pendingEvent: null,
        eventFrequency: 'normal', rerollsRemaining: 3,
        currentPosition: null, remainingSteps: [],
        paceInfo: { id: 'normal', name: 'Normal' },
        hexesRemaining: 0, horseback: false, forcedMarchHours: 0,
        exhaustionMultiplier: 100, partyHasMaxExhaustion: false,
        isTravelActive: false,
        startPlanning: vi.fn(), cancelTravel: vi.fn(),
        setDestinationAndPath: vi.fn(), toggleHorseback: vi.fn(),
        changePace: vi.fn(), advanceOneHex: vi.fn(() => ({ moved: false })),
        forceCamp: vi.fn(), forcedMarch: vi.fn(),
        acceptEvent: vi.fn(), skipEvent: vi.fn(), rerollEvent: vi.fn(),
        setEventFrequency: vi.fn(), setTravelLog: vi.fn(), setLastMessage: vi.fn(),
    };
}

/**
 * Renders HexMap with the linked POI, waits until the mount-time probe marks
 * the link valid (chip gate open), then rewires loadMaps to the POST-DELETE
 * list the caller supplies (`listAfterDelete` — default: the map is gone).
 * Returns { onPoiEntered, handleUnlinkMap, addEntry }.
 */
async function renderWithStaleGate({ listAfterDelete = { maps: [] }, loadMapsImpl } = {}) {
    const onPoiEntered = vi.fn();
    const handleUnlinkMap = vi.fn();
    const addEntry = vi.fn();
    useMapLoader.mockReturnValue(makeMapLoader());
    useZoomPan.mockReturnValue(makeZoomPan());
    useHexHover.mockReturnValue({ hoveredHex: null, setHoveredHex: vi.fn(), getHexFromEvent: vi.fn(), handleHexHover: vi.fn() });
    useTerrainPainting.mockReturnValue({ handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(), handleTerrainPointerUp: vi.fn() });
    usePoiManagement.mockReturnValue({
        selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(),
        showRename: null, setShowRename: vi.fn(),
        poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(),
        handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(),
        handlePoiPointerUp: vi.fn(), handlePoiContextMenu: vi.fn(),
        handleTogglePoiVisibility: vi.fn(), handleDeletePoi: vi.fn(),
        handleRenamePoi: vi.fn(), handleLinkMap: vi.fn(), handleUnlinkMap, handleRemoveRoads: vi.fn(),
    });
    useEncounterGeneration.mockReturnValue({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    useTravelManagement.mockReturnValue(makeTravelMgmt());
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
    render(<HexMap campaignName="test" mapName="qa-hex" characters={[]} onPoiEntered={onPoiEntered} />);
    await vi.waitFor(() => {
        expect([...(poiLayerProps.current.validLinkedMaps || [])]).toEqual(['QA Room']);
    });
    // The delete lands AFTER the mount probe — the gate Set is now stale, and
    // every later click must consult the live list instead.
    if (loadMapsImpl) {
        mapsService.loadMaps.mockImplementation(loadMapsImpl);
    } else {
        mapsService.loadMaps.mockResolvedValue(listAfterDelete);
    }
    return { onPoiEntered, handleUnlinkMap, addEntry };
}

const toastNode = () => document.querySelector('.travel-toast');

describe('HexMap POI enter — stale linked-map gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        poiLayerProps.current = null;
        subscriberProps.current = null;
        // Mount probe: the linked map exists (this is what put the name into
        // validLinkedMaps before the deletion happened out from under us).
        mapsService.loadMapData.mockResolvedValue({});
        mapsService.loadMaps.mockResolvedValue({ maps: [LINKED_ROW] });
    });

    it('refuses a deleted target with a NAMED toast, self-heals the link, retires the chip, and logs — no navigation', async () => {
        const { onPoiEntered, handleUnlinkMap, addEntry } = await renderWithStaleGate();

        poiLayerProps.current.onPoiEnter(POI);

        await vi.waitFor(() => {
            expect(handleUnlinkMap).toHaveBeenCalledWith('poi-qa');
        });
        expect(onPoiEntered).not.toHaveBeenCalled();
        const toast = toastNode();
        expect(toast).toBeTruthy();
        expect(toast).toHaveAttribute('role', 'status');
        expect(toast).toHaveTextContent('Linked map "QA Room" no longer exists — Enter link cleared.');
        // Chip retired immediately (no remount wait): the name leaves the gate Set.
        await vi.waitFor(() => {
            expect([...poiLayerProps.current.validLinkedMaps]).not.toContain('QA Room');
        });
        // Honest audit row naming the vanished target (automation-must-log).
        expect(addEntry).toHaveBeenCalledWith({
            type: 'travel', action: 'enter_refused', hex: { q: 19, r: 10 },
            terrain: 'plains', weather: null, weatherIcon: null,
            eventType: null, eventTitle: null, linkedMap: 'QA Room', refusal: 'missing',
        });
    });

    it('keeps the link when the maps list is UNREACHABLE — a blip is not proof of deletion', async () => {
        const { onPoiEntered, handleUnlinkMap, addEntry } = await renderWithStaleGate({
            loadMapsImpl: () => Promise.reject(new Error('Failed to fetch')),
        });

        poiLayerProps.current.onPoiEnter(POI);

        await vi.waitFor(() => {
            expect(toastNode()).toHaveTextContent('Could not verify linked map "QA Room" — try again.');
        });
        expect(onPoiEntered).not.toHaveBeenCalled();
        expect(handleUnlinkMap).not.toHaveBeenCalled();
        expect([...poiLayerProps.current.validLinkedMaps]).toContain('QA Room');
        expect(addEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'travel', action: 'enter_refused', linkedMap: 'QA Room', refusal: 'unreachable',
        }));
    });

    it('still enters when the live list confirms the target (slug match on a display-named link)', async () => {
        const { onPoiEntered, handleUnlinkMap, addEntry } = await renderWithStaleGate({
            listAfterDelete: { maps: [LINKED_ROW] },
        });

        poiLayerProps.current.onPoiEnter(POI);

        await vi.waitFor(() => expect(onPoiEntered).toHaveBeenCalledWith('QA Room'));
        expect(handleUnlinkMap).not.toHaveBeenCalled();
        expect(toastNode()).toBeNull();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('retires the chip proactively on a maps-list SSE event (no click needed)', async () => {
        await renderWithStaleGate({ listAfterDelete: { maps: [LINKED_ROW] } });        // External DELETE: probe now 404s the target; the SSE event must
        // re-run the probe so the chip drops without waiting for a click.
        mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

        subscriberProps.current.handleEvent({ key: 'maps-list-test', data: { action: 'deleted', map: 'qa-room' } });

        await vi.waitFor(() => {
            expect([...poiLayerProps.current.validLinkedMaps]).not.toContain('QA Room');
        });
        expect(mapsService.loadMapData).toHaveBeenLastCalledWith('test', 'QA Room');
    });
});
