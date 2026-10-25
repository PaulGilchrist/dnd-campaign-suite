// @maintained-by-ai
// Arrival toast lane (backlog 2026-10-25 pm: "travel panel closes silently on
// arrival"). ARRIVAL flips travel-mode inactive and TravelPanel unmounts, so the
// completion must surface via the display-only .travel-toast rendered by HexMap.jsx
// above the panel slot. Covers: the TravelToast presentational component, the
// handleAdvance arrival trigger, the benign auto-hide timer (display only — no
// game state advances), and silence on non-arrival moves/blocked advances.
// Panel-transport of onAdvance + arrival log bytes stay pinned by
// HexMap.travel.test.jsx — not re-pinned here.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TravelToast from './TravelToast.jsx';

// JSDOM PointerEvent polyfill (needed for React 19 onPointerLeave in HexMap.jsx)
if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.pointerId = init.pointerId || 0;
            this.pointerType = init.pointerType || 'mouse';
        }
    };
}

// ── Mock child components — trimmed to this lane: only the advance button matters ──
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./HexMapToolbar.jsx', () => ({
    default: () => <div data-testid="toolbar" />,
}));
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
// The panel unmounts on arrival (isTravelActive → false upstream) — the mock keeps
// the advance button click-through; unmount independence is structural (HexMap renders
// the toast, not the panel).
vi.mock('./TravelPanel.jsx', () => ({
    default: ({ isTravelActive, onAdvance }) =>
        <div data-testid="travel-panel">
            {isTravelActive && <button data-testid="btn-advance" onClick={onAdvance}>Advance</button>}
        </div>,
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
        travelMode: 'traveling', travelPace: 'normal',
        destination: { q: 11, r: 5 }, path: [{ q: 10, r: 5 }, { q: 11, r: 5 }], pathIndex: 0,
        accruedCost: 0, dailyBudget: 4, dayExhausted: false,
        lastMessage: null, pendingEvent: null,
        eventFrequency: 'normal', rerollsRemaining: 3,
        currentPosition: null, remainingSteps: [],
        paceInfo: { id: 'normal', name: 'Normal' },
        hexesRemaining: 1, horseback: false, forcedMarchHours: 0,
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

/** Renders HexMap with an active travel session whose advanceOneHex returns `result`. */
function renderWithAdvance(result) {
    const tm = makeTravelMgmt({ advanceOneHex: vi.fn(() => result) });
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
    render(<HexMap campaignName="test" mapName="test-map" />);
    return { tm, addEntry };
}

const toastNode = () => document.querySelector('.travel-toast');

describe('TravelToast component', () => {
    it('renders nothing when there is no message', () => {
        const { container } = render(<TravelToast message={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a polite live-region status with the arrival copy', () => {
        const { container } = render(<TravelToast message="Arrived at destination — travel complete" />);
        const toast = container.querySelector('.travel-toast');
        expect(toast).toBeTruthy();
        expect(toast).toHaveAttribute('role', 'status');
        expect(toast).toHaveTextContent('Arrived at destination — travel complete');
        expect(container.querySelector('.fa-flag-checkered')).toBeTruthy();
    });
});

describe('HexMap arrival toast', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('surfaces the arrival toast when the route completes (panel auto-close is no longer silent)', () => {
        const { addEntry } = renderWithAdvance({ moved: true, arrived: true, event: null });
        expect(toastNode()).toBeNull(); // nothing before the completing click
        fireEvent.click(screen.getByTestId('btn-advance'));
        expect(toastNode()).toBeTruthy();
        expect(toastNode()).toHaveAttribute('role', 'status');
        expect(toastNode()).toHaveTextContent('Arrived at destination — travel complete');
        // Existing arrival behavior unchanged: the same click still logs 'arrived'.
        expect(addEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'travel', action: 'arrived' }));
    });

    it('auto-hides the toast on the benign display-only timer without extra game writes', () => {
        const { addEntry } = renderWithAdvance({ moved: true, arrived: true, event: null });
        fireEvent.click(screen.getByTestId('btn-advance'));
        expect(toastNode()).toBeTruthy();
        const writesAtArrival = addEntry.mock.calls.length;
        act(() => { vi.advanceTimersByTime(2600); });
        expect(toastNode()).toBeNull();
        // The hide timer is display-only: it logs nothing (no game state on a timer).
        expect(addEntry).toHaveBeenCalledTimes(writesAtArrival);
    });

    it.each([
        { label: 'a mid-route move', result: { moved: true, arrived: false, event: null } },
        { label: 'a move that triggers an event', result: { moved: true, arrived: false, event: { type: 'discovery', title: 'Ruins' } } },
        { label: 'a blocked advance', result: { moved: false } },
    ])('stays silent on $label', ({ result }) => {
        renderWithAdvance(result);
        fireEvent.click(screen.getByTestId('btn-advance'));
        expect(toastNode()).toBeNull();
        act(() => { vi.advanceTimersByTime(3000); });
        expect(toastNode()).toBeNull();
    });
});
