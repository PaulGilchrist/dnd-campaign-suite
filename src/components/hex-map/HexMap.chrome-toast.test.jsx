// @maintained-by-ai
// Panel chrome-click → .travel-toast wiring (backlog 2026-11-11 JU): the
// floating TravelPanel occupies the grid's lower-left and silently absorbed
// destination clicks. HexMap derives `awaitingDestination` (panel open +
// planning mode + no armed destination) and wires onNoDestinationClick to the
// SAME showMapToast lane the arrival toast uses. Guards against the failures
// a leaf test cannot see: the flag deriving from the wrong mode/destination
// bytes, and the callback bypassing the shared toast slot. The panel-side
// chrome-vs-control discrimination is owned by
// TravelPanel.chrome-click.test.jsx — not re-pinned here.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// JSDOM PointerEvent polyfill (needed for React 19 onPointer* in HexMap/panel)
if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.pointerId = init.pointerId || 0;
            this.pointerType = init.pointerType || 'mouse';
        }
    };
}

// ── Mock child components — REAL TravelPanel (the lane under test feeds it) ──
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./HexMapToolbar.jsx', () => ({ default: () => <div data-testid="toolbar" /> }));
vi.mock('./POILayer.jsx', () => ({ default: () => <g data-testid="poi-layer" /> }));
vi.mock('./POIPanel.jsx', () => ({ default: () => <div data-testid="poi-panel" /> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: () => <g data-testid="poi-context-menu" /> }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => <div data-testid="marching-panel" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: () => <g data-testid="party-marker" /> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: () => <div data-testid="weather-overlay" /> }));
vi.mock('./EventDialog.jsx', () => ({ default: () => null }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: () => <g data-testid="travel-path-layer" /> }));
vi.mock('./svg/CampSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/CitySVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/DungeonSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/HazardSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/LandmarkSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/LoreSiteSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/NaturalWonderSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/SettlementSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('./svg/TowerSVG.jsx', () => ({ default: () => <g /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));

// ── Mock hooks and services ──
vi.mock('./hooks/useMapLoader.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useZoomPan.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useHexHover.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useTerrainPainting.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/usePoiManagement.js', () => ({ default: vi.fn() }));
// Hook-mocked sync returns undefined → committedTravelFace adopts the synced
// isTravelActive — exactly the pre-improve panel-mount read.
vi.mock('./hooks/useTravelToolSync.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useEncounterGeneration.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useHexMapSSESync.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/management/useTravelManagement.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/ui/useMonstersData.js', () => ({ useMonstersData: vi.fn() }));
vi.mock('../../hooks/runtime/useLog.js', () => ({ default: vi.fn() }));
vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    loadMapData: vi.fn(() => Promise.resolve(null)),
    formatMapName: vi.fn((name) => name || ''),
}));
vi.mock('../../services/campaign/weatherService.js', () => ({
    generateWeather: vi.fn(() => ({ condition: 'clear', label: 'Clear', icon: 'sun', moveCostMod: 1, budgetMod: 1, encounterMod: 0, description: 'Clear skies' })),
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
import HexMap from './HexMap.jsx';

const TOAST_COPY = 'Select a destination hex on the map';

function makeMapLoader(overrides = {}) {
    return {
        loading: false, setMapData: vi.fn(),
        gridSize: 30, setGridSize: vi.fn(),
        terrain: {}, setTerrain: vi.fn(),
        rivers: [], setRivers: vi.fn(),
        roads: [], setRoads: vi.fn(),
        pois: [], setPois: vi.fn(),
        marchingOrder: [], setMarchingOrder: vi.fn(),
        partyPosition: { q: 10, r: 5 }, setPartyPosition: vi.fn(),
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

function makeTravelMgmt(overrides = {}) {
    return {
        travelMode: 'planning', travelPace: 'normal',
        destination: null, path: [], pathIndex: 0,
        accruedCost: 0, dailyBudget: 4, dayExhausted: false,
        lastMessage: null, pendingEvent: null,
        eventFrequency: 'none', rerollsRemaining: 3,
        currentPosition: null, remainingSteps: [],
        paceInfo: { id: 'normal', name: 'Normal' },
        hexesRemaining: 0, horseback: false, forcedMarchHours: 0,
        exhaustionMultiplier: 100, partyHasMaxExhaustion: false,
        isTravelActive: true,
        startPlanning: vi.fn(), cancelTravel: vi.fn(),
        setDestinationAndPath: vi.fn(), toggleHorseback: vi.fn(),
        changePace: vi.fn(), advanceOneHex: vi.fn(() => ({ moved: false })),
        forceCamp: vi.fn(), forcedMarch: vi.fn(),
        acceptEvent: vi.fn(), skipEvent: vi.fn(), rerollEvent: vi.fn(),
        setEventFrequency: vi.fn(), setTravelLog: vi.fn(), setLastMessage: vi.fn(),
        ...overrides,
    };
}

/** Renders HexMap with a live (mounted-panel) travel session. */
function renderHexMap(mgmtOverrides = {}) {
    const tm = makeTravelMgmt(mgmtOverrides);
    useTravelManagement.mockReturnValue(tm);
    useMapLoader.mockReturnValue(makeMapLoader());
    useZoomPan.mockReturnValue({ svgWidth: 1039, svgHeight: 519, zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(), clampPan: vi.fn((z, x, y) => ({ x, y })), centerView: vi.fn(() => ({ x: 0, y: 0 })), panning: false, handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(), handleWheel: vi.fn() });
    useHexHover.mockReturnValue({ hoveredHex: null, setHoveredHex: vi.fn(), getHexFromEvent: vi.fn(), handleHexHover: vi.fn() });
    useTerrainPainting.mockReturnValue({ handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(), handleTerrainPointerUp: vi.fn() });
    usePoiManagement.mockReturnValue({ selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(), showRename: null, setShowRename: vi.fn(), poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(), handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(), handlePoiPointerUp: vi.fn(), handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(), handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(), handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn(), handlePOIDrop: vi.fn() });
    useEncounterGeneration.mockReturnValue({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    const addEntry = vi.fn();
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
    const utils = render(<HexMap campaignName="test" mapName="test-map" />);
    return { tm, addEntry, ...utils };
}

const toastNode = () => document.querySelector('.travel-toast');
const chromeClick = () => fireEvent.pointerUp(screen.getByText('Travel Mode'));

describe('HexMap panel chrome-click toast', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('surfaces the awaiting-destination notice on the shared .travel-toast lane', () => {
        const { addEntry } = renderHexMap();
        expect(toastNode()).toBeNull(); // nothing before the dead click
        chromeClick();
        expect(toastNode()).toBeTruthy();
        expect(toastNode()).toHaveAttribute('role', 'status');
        expect(toastNode()).toHaveTextContent(TOAST_COPY);
        // Display-only feedback: zero game writes (no log row, no store POST).
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('auto-hides on the shared toast timer, like the arrival sibling', () => {
        renderHexMap();
        chromeClick();
        expect(toastNode()).toBeTruthy();
        act(() => { vi.advanceTimersByTime(2600); });
        expect(toastNode()).toBeNull();
    });

    it('a control press acts WITHOUT the toast (pace chip → changePace)', () => {
        const { tm } = renderHexMap();
        const chip = document.querySelector('.travel-pace-btn');
        fireEvent.pointerUp(chip);
        fireEvent.click(chip);
        expect(tm.changePace).toHaveBeenCalledWith('slow');
        expect(toastNode()).toBeNull();
    });

    it.each([
        { label: 'traveling', overrides: { travelMode: 'traveling', destination: { q: 12, r: 5 }, path: [{ q: 10, r: 5 }, { q: 12, r: 5 }], pathIndex: 1 } },
        { label: 'paused', overrides: { travelMode: 'paused', destination: { q: 12, r: 5 }, path: [{ q: 10, r: 5 }, { q: 12, r: 5 }], pathIndex: 1 } },
        { label: 'planning with an armed destination', overrides: { destination: { q: 12, r: 5 }, path: [{ q: 10, r: 5 }, { q: 12, r: 5 }] } },
    ])('stays silent while $label', ({ overrides }) => {
        renderHexMap(overrides);
        chromeClick();
        expect(toastNode()).toBeNull();
        act(() => { vi.advanceTimersByTime(3000); });
        expect(toastNode()).toBeNull();
    });
});
