// @maintained-by-ai
// HexMap container lane — rendering/loading transition, toolbar wiring (back/name/tool-select/
// viewport/panels), SVG pointer·wheel·context routing, background-click cleanup, exact child
// prop forwarding, and POI/character drag-and-drop.
// Travel-tool destination selection + advance logging live in HexMap.travel.test.jsx and
// event-dialog dispatch, camp/weather commands, POI linked-map validation, TravelPanel flag
// forwarding, and weather-overlay visibility live in HexMap.additional.test.jsx (#792 split).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// JSDOM doesn't support PointerEvent; React 19 needs it for onPointerLeave handlers
if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.pointerId = init.pointerId || 0;
            this.pointerType = init.pointerType || 'mouse';
        }
    };
}

// Capture props forwarded to each child so one render can verify container→child wiring
// against the exact values HexMap.jsx computes from its hooks.
const { childProps } = vi.hoisted(() => ({
    childProps: { terrain: null, river: null, grid: null, road: null, poi: null, party: null, travelPath: null, subscriber: null },
}));

// ── Mock child components ──
vi.mock('./TerrainLayer.jsx', () => ({ default: (props) => { childProps.terrain = props; return <g data-testid="terrain-layer" />; } }));
vi.mock('./HexGridLayer.jsx', () => ({ default: (props) => { childProps.grid = props; return <g data-testid="hex-grid-layer" />; } }));
vi.mock('./RiverLayer.jsx', () => ({ default: (props) => { childProps.river = props; return <g data-testid="river-layer" />; } }));
vi.mock('./RoadLayer.jsx', () => ({ default: (props) => { childProps.road = props; return <g data-testid="road-layer" />; } }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: (props) => { childProps.party = props; return props.position ? <g data-testid="party-marker" /> : null; } }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: (props) => { childProps.travelPath = props; return <g data-testid="travel-path-layer" />; } }));
vi.mock('./POILayer.jsx', () => ({ default: (props) => { childProps.poi = props; return <g data-testid="poi-layer" />; } }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: ({ weather }) => weather ? <div data-testid="weather-overlay" /> : null }));
vi.mock('./EventDialog.jsx', () => ({ default: ({ event }) => event ? <div data-testid="event-dialog" /> : null }));
vi.mock('./TravelPanel.jsx', () => ({ default: ({ isTravelActive }) => isTravelActive ? <div data-testid="travel-panel" /> : null }));

// POIContextMenu only mounts when a POI menu is open; its Close byte drives the container's
// own dismiss handler tested in the click-cleanup lane below.
vi.mock('./POIContextMenu.jsx', () => ({ default: ({ selectedPoi, onClose }) => selectedPoi ? <g data-testid="poi-context-menu"><text onClick={onClose}>Close</text></g> : null }));
vi.mock('./POIPanel.jsx', () => ({ default: ({ onClose }) => <div data-testid="poi-panel"><button data-testid="poi-panel-close" onClick={onClose}>Close</button></div> }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: ({ onClose }) => <div data-testid="marching-panel"><button data-testid="marching-panel-close" onClick={onClose}>Close</button></div> }));

// Catch-all SVG mocks: icons live inside <defs> and are inert at this level.
vi.mock('./svg/CampSVG.jsx', () => ({ default: () => <g data-testid="svg-camp" /> }));
vi.mock('./svg/CitySVG.jsx', () => ({ default: () => <g data-testid="svg-city" /> }));
vi.mock('./svg/DungeonSVG.jsx', () => ({ default: () => <g data-testid="svg-dungeon" /> }));
vi.mock('./svg/HazardSVG.jsx', () => ({ default: () => <g data-testid="svg-hazard" /> }));
vi.mock('./svg/LandmarkSVG.jsx', () => ({ default: () => <g data-testid="svg-landmark" /> }));
vi.mock('./svg/LoreSiteSVG.jsx', () => ({ default: () => <g data-testid="svg-lore" /> }));
vi.mock('./svg/NaturalWonderSVG.jsx', () => ({ default: () => <g data-testid="svg-wonder" /> }));
vi.mock('./svg/SettlementSVG.jsx', () => ({ default: () => <g data-testid="svg-settlement" /> }));
vi.mock('./svg/TowerSVG.jsx', () => ({ default: () => <g data-testid="svg-tower" /> }));

// Subscriber is the app's single shared SSE connection — capture props to prove the
// container wires its own handleSSEEvent into it (never a raw EventSource).
vi.mock('../common/Subscriber.jsx', () => ({ default: (props) => { childProps.subscriber = props; return <div data-testid="subscriber" />; } }));

// ── Toolbar mock: tool strings match outdoorConfig constants ──
vi.mock('./HexMapToolbar.jsx', () => ({
    default: ({ onBack, mapName, zoomIn, zoomOut, resetView, tool, setTool, setPoiPanelOpen, setMarchingOrderOpen }) =>
        <div data-testid="toolbar">
            <button data-testid="toolbar-back" onClick={onBack}>Back</button>
            <span data-testid="toolbar-name">{mapName}</span>
            <span data-testid="current-tool">{tool}</span>
            <button data-testid="toolbar-zoomin" onClick={zoomIn}>+</button>
            <button data-testid="toolbar-zoomout" onClick={zoomOut}>-</button>
            <button data-testid="toolbar-resetview" onClick={resetView}>Reset</button>
            <button data-testid="toolbar-paint" onClick={() => setTool('paint')}>Paint</button>
            <button data-testid="toolbar-road" onClick={() => setTool('road')}>Road</button>
            <button data-testid="toolbar-poi-panel" onClick={() => setPoiPanelOpen(true)}>POIs</button>
            <button data-testid="toolbar-marching" onClick={() => setMarchingOrderOpen(true)}>Marching</button>
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
// Only the three mapsService calls HexMap.jsx itself makes (indoor-map loads are
// owned by HexMap.additional.test.jsx; save/load of map data lives in useMapLoader).
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
import useTravelManagement from '../../hooks/management/useTravelManagement.js';
import useEncounterGeneration from './hooks/useEncounterGeneration.js';
import useHexMapSSESync from './hooks/useHexMapSSESync.js';
import useLog from '../../hooks/runtime/useLog.js';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { GRID_COLS_MULTIPLIER, HEX_SIZE } from '../../config/outdoorConfig.js';
import HexMap from './HexMap.jsx';

// ── Mock factory helpers ──

function makeMapLoader(overrides = {}) {
    return {
        loading: false, mapData: null, setMapData: vi.fn(),
        gridSize: 30, setGridSize: vi.fn(),
        terrain: {}, setTerrain: vi.fn(),
        rivers: [], setRivers: vi.fn(),
        roads: [], setRoads: vi.fn(),
        pois: [], setPois: vi.fn(),
        marchingOrder: [], setMarchingOrder: vi.fn(),
        partyPosition: null, setPartyPosition: vi.fn(),
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

function makeZoomPan(overrides = {}) {
    return {
        svgWidth: 1039, svgHeight: 519,
        zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(),
        clampPan: vi.fn((z, x, y) => ({ x, y })),
        centerView: vi.fn(() => ({ x: 0, y: 0 })),
        panning: false,
        handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
        ...overrides,
    };
}

function makeHexHover(overrides = {}) {
    return {
        hoveredHex: null, setHoveredHex: vi.fn(),
        getHexFromEvent: vi.fn(), handleHexHover: vi.fn(),
        ...overrides,
    };
}

function makeTerrainPainting(overrides = {}) {
    return {
        handleTerrainPointerDown: vi.fn(),
        handleTerrainPointerMove: vi.fn(),
        handleTerrainPointerUp: vi.fn(),
        ...overrides,
    };
}

function makePoiManagement(overrides = {}) {
    return {
        selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(),
        showRename: null, setShowRename: vi.fn(),
        poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(),
        handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(),
        handlePoiPointerUp: vi.fn(),
        handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(),
        handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(),
        handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn(),
        ...overrides,
    };
}

function makeEncounterGeneration(overrides = {}) {
    return {
        generateMonsterPlacements: vi.fn(),
        handleStartEncounter: vi.fn(),
        ...overrides,
    };
}

function makeTravelMgmt(overrides = {}) {
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
        ...overrides,
    };
}

/** Call in beforeEach to reset every mocked hook to its default value. */
function setupDefaultMocks() {
    useMapLoader.mockReturnValue(makeMapLoader());
    useZoomPan.mockReturnValue(makeZoomPan());
    useHexHover.mockReturnValue(makeHexHover());
    useTerrainPainting.mockReturnValue(makeTerrainPainting());
    usePoiManagement.mockReturnValue(makePoiManagement());
    useTravelManagement.mockReturnValue(makeTravelMgmt());
    useEncounterGeneration.mockReturnValue(makeEncounterGeneration());
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry: vi.fn() });
    mapsService.formatMapName.mockImplementation((name) => name || '');
}

/** Renders the map in its default (loaded, idle) state. */
function renderMap(props = {}) {
    render(<HexMap campaignName="test" mapName="test-map" {...props} />);
}

const mapSvg = () => document.querySelector('.hex-svg');

describe('HexMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(childProps).forEach(k => { childProps[k] = null; });
        setupDefaultMocks();
    });

    it('shows a loading message until the map loads, then the full canvas', () => {
        useMapLoader.mockReturnValue(makeMapLoader({ loading: true }));
        const { rerender } = render(<HexMap campaignName="test" mapName="test-map" />);
        expect(screen.getByText('Loading map...')).toBeInTheDocument();
        // Toolbar stays mounted during load; the canvas itself does not exist yet.
        expect(mapSvg()).not.toBeInTheDocument();
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();

        useMapLoader.mockReturnValue(makeMapLoader());
        rerender(<HexMap campaignName="test" mapName="test-map" />);
        expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
        expect(mapSvg()).toBeInTheDocument();
        expect(screen.getByText('1 hex = 6 miles')).toBeInTheDocument();
    });

    // ── Read-only description panel (backlog 2026-10-26; indoor twin pinned
    // in Map.description-panel.test.jsx, panel internals in
    // ../common/MapDescriptionPanel.test.jsx) ──
    it('renders the header description panel when the loaded document has a description', () => {
        useMapLoader.mockReturnValue(makeMapLoader({ mapData: { description: '**frozen** pass' } }));
        renderMap();

        const panel = screen.getByTestId('map-description-panel');
        expect(panel.querySelector('.map-description-panel-body strong')?.textContent).toBe('frozen');
    });

    it('omits the description panel while loading and for empty/missing descriptions', () => {
        useMapLoader.mockReturnValue(makeMapLoader({ loading: true }));
        const { rerender } = render(<HexMap campaignName="test" mapName="test-map" />);
        expect(screen.queryByTestId('map-description-panel')).toBeNull();

        useMapLoader.mockReturnValue(makeMapLoader({ mapData: { description: '' } }));
        rerender(<HexMap campaignName="test" mapName="test-map" />);
        expect(screen.queryByTestId('map-description-panel')).toBeNull();

        useMapLoader.mockReturnValue(makeMapLoader({ mapData: { displayName: 'No Desc' } }));
        rerender(<HexMap campaignName="test" mapName="test-map" />);
        expect(screen.queryByTestId('map-description-panel')).toBeNull();
    });

    it('calls onBack when the back button is clicked', () => {
        const onBack = vi.fn();
        renderMap({ onBack });
        fireEvent.click(screen.getByTestId('toolbar-back'));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('formats and passes the map name to the toolbar', () => {
        mapsService.formatMapName.mockReturnValue('My Map');
        renderMap();
        expect(mapsService.formatMapName).toHaveBeenCalledWith('test-map');
        expect(screen.getByTestId('toolbar-name')).toHaveTextContent('My Map');
    });

    it('selects the paint tool and routes pointer-down to the terrain painter', () => {
        const tp = makeTerrainPainting();
        const zp = makeZoomPan();
        useTerrainPainting.mockReturnValue(tp);
        useZoomPan.mockReturnValue(zp);
        renderMap();
        fireEvent.click(screen.getByTestId('toolbar-paint'));
        expect(screen.getByTestId('current-tool')).toHaveTextContent('paint');
        fireEvent.pointerDown(mapSvg(), { button: 0, pointerId: 1 });
        expect(tp.handleTerrainPointerDown).toHaveBeenCalledTimes(1);
        expect(tp.handleTerrainPointerDown.mock.calls[0][1]).toBe('paint');
        expect(zp.handlePanStart).not.toHaveBeenCalled();
    });

    it('opens and closes the POI and marching order panels from the toolbar', () => {
        renderMap();
        fireEvent.click(screen.getByTestId('toolbar-poi-panel'));
        expect(screen.getByTestId('poi-panel')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('poi-panel-close'));
        expect(screen.queryByTestId('poi-panel')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('toolbar-marching'));
        expect(screen.getByTestId('marching-panel')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('marching-panel-close'));
        expect(screen.queryByTestId('marching-panel')).not.toBeInTheDocument();
    });

    it('routes wheel, zoom, and reset clicks to the zoom/pan hook', () => {
        const zp = makeZoomPan();
        useZoomPan.mockReturnValue(zp);
        renderMap();
        fireEvent.wheel(mapSvg());
        expect(zp.handleWheel).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('toolbar-zoomin'));
        expect(zp.zoomIn).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('toolbar-zoomout'));
        expect(zp.zoomOut).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('toolbar-resetview'));
        expect(zp.resetView).toHaveBeenCalledTimes(1);
    });

    it('suppresses the browser context menu on the map', () => {
        renderMap();
        // fireEvent returns false only when the handler called preventDefault.
        expect(fireEvent.contextMenu(mapSvg())).toBe(false);
    });

    it('routes pointer down/move/up/leave on the map to the pan, terrain, POI, and hover hooks', () => {
        const zp = makeZoomPan();
        const tp = makeTerrainPainting();
        const pm = makePoiManagement();
        const hh = makeHexHover();
        useZoomPan.mockReturnValue(zp);
        useTerrainPainting.mockReturnValue(tp);
        usePoiManagement.mockReturnValue(pm);
        useHexHover.mockReturnValue(hh);
        renderMap();

        // Default tool (none) → pointer-down starts a pan, not a paint stroke.
        fireEvent.pointerDown(mapSvg(), { button: 0, pointerId: 1 });
        expect(zp.handlePanStart).toHaveBeenCalledTimes(1);

        fireEvent.pointerMove(mapSvg(), { pointerId: 1 });
        expect(zp.handlePanMove).toHaveBeenCalledTimes(1);
        expect(tp.handleTerrainPointerMove).toHaveBeenCalledTimes(1);
        expect(pm.handlePoiPointerMove).toHaveBeenCalledTimes(1);
        expect(hh.handleHexHover).toHaveBeenCalledTimes(1);

        fireEvent.pointerUp(mapSvg(), { pointerId: 1 });
        expect(zp.handlePanEnd).toHaveBeenCalledTimes(1);
        expect(tp.handleTerrainPointerUp).toHaveBeenCalledTimes(1);
        expect(pm.handlePoiPointerUp).toHaveBeenCalledTimes(1);

        fireEvent.pointerLeave(mapSvg(), { pointerId: 1 });
        expect(hh.setHoveredHex).toHaveBeenCalledWith(null);
    });

    it('dismisses POI menu and rename state via background click or menu close, not right-click', () => {
        const pm = makePoiManagement({ selectedPoiMenu: { id: 'poi-1', q: 3, r: 4 } });
        usePoiManagement.mockReturnValue(pm);
        renderMap();
        expect(screen.getByTestId('poi-context-menu')).toBeInTheDocument();

        // The context menu's own close button routes through the container's onClose closure.
        fireEvent.click(screen.getByText('Close'));
        expect(pm.setSelectedPoiMenu).toHaveBeenCalledWith(null);
        expect(pm.setShowRename).toHaveBeenCalledWith(null);

        pm.setSelectedPoiMenu.mockClear();
        pm.setShowRename.mockClear();
        fireEvent.click(mapSvg());
        expect(pm.setSelectedPoiMenu).toHaveBeenCalledTimes(1);
        expect(pm.setSelectedPoiMenu).toHaveBeenCalledWith(null);
        expect(pm.setShowRename).toHaveBeenCalledWith(null);

        pm.setSelectedPoiMenu.mockClear();
        pm.setShowRename.mockClear();
        fireEvent.click(mapSvg(), { button: 2 });
        expect(pm.setSelectedPoiMenu).not.toHaveBeenCalled();
        expect(pm.setShowRename).not.toHaveBeenCalled();
    });

    it('clears the pending road start only when the road tool is active', () => {
        const pm = makePoiManagement();
        usePoiManagement.mockReturnValue(pm);
        renderMap();
        fireEvent.click(mapSvg());
        expect(pm.setRoadStartPoiId).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('toolbar-road'));
        expect(screen.getByTestId('current-tool')).toHaveTextContent('road');
        fireEvent.click(mapSvg());
        expect(pm.setRoadStartPoiId).toHaveBeenCalledTimes(1);
        expect(pm.setRoadStartPoiId).toHaveBeenCalledWith(null);
    });

    it('forwards exact container state to every child layer', () => {
        const ml = makeMapLoader({
            gridSize: 12,
            terrain: { '3,4': 'forest' },
            rivers: ['4,5'],
            roads: [{ id: 'road-1' }],
            pois: [{ id: 'poi-1', q: 3, r: 4, type: 'city', visible: true, label: 'City' }],
            partyPosition: { q: 10, r: 5 },
        });
        const pm = makePoiManagement();
        const tm = makeTravelMgmt();
        const eg = makeEncounterGeneration();
        const sse = { handleSSEEvent: vi.fn() };
        useMapLoader.mockReturnValue(ml);
        usePoiManagement.mockReturnValue(pm);
        useTravelManagement.mockReturnValue(tm);
        useEncounterGeneration.mockReturnValue(eg);
        useHexMapSSESync.mockReturnValue(sse);

        render(<HexMap campaignName="test" mapName="test-map" isLocalhost />);

        // hexCols is derived from the config oracle, never hand-computed.
        const hexCols = 12 * GRID_COLS_MULTIPLIER;
        expect(childProps.terrain).toEqual({ hexCols, hexRows: 12, terrain: ml.terrain });
        expect(childProps.river).toEqual({ rivers: ml.rivers, hexCols, hexRows: 12 });
        expect(childProps.grid).toEqual({ hexCols, hexRows: 12 });
        expect(childProps.road).toEqual({ roads: ml.roads });
        expect(childProps.travelPath).toEqual({ path: [], pathIndex: 0, partyPosition: ml.partyPosition });
        expect(childProps.poi).toEqual({
            pois: ml.pois,
            onPoiPointerDown: pm.handlePoiPointerDown,
            onPoiContextMenu: pm.handlePoiContextMenu,
            poiDragging: null,
            poiHover: null,
            isLocalhost: true,
            partyPosition: ml.partyPosition,
            onPoiEnter: expect.any(Function),
            validLinkedMaps: new Set(),
            roadStartPoiId: null,
        });
        expect(childProps.party).toEqual({
            position: ml.partyPosition,
            HEX_SIZE,
            hexCols,
            hexRows: 12,
            onPositionChange: ml.setPartyPosition,
            svgRef: expect.any(Object),
            onEncounter: eg.handleStartEncounter,
            contextMenuOpen: false,
            onContextMenu: expect.any(Function),
            travelMode: 'inactive',
            onAdvance: expect.any(Function),
            onCancelTravel: tm.cancelTravel,
        });
        // Single shared SSE connection: the container's sync handler must be
        // forwarded. The container now wraps it (maps-list events additionally
        // invalidate the linked-map probe), so pin identity via delegation.
        expect(childProps.subscriber.campaignName).toBe('test');
        expect(typeof childProps.subscriber.handleEvent).toBe('function');
        const sseEvent = { key: 'map-data-test-test-map', data: {} };
        childProps.subscriber.handleEvent(sseEvent);
        expect(sse.handleSSEEvent).toHaveBeenCalledWith(sseEvent);
    });

    describe('POI drag and drop', () => {
        function dropWith({ dragData, hex, mapOverrides = {} }) {
            const ml = makeMapLoader(mapOverrides);
            useMapLoader.mockReturnValue(ml);
            useHexHover.mockReturnValue(makeHexHover({ getHexFromEvent: vi.fn(() => hex) }));
            renderMap();
            const dt = { getData: vi.fn(() => dragData) };
            const allowed = fireEvent.drop(mapSvg(), { dataTransfer: dt });
            return { ml, dt, allowed };
        }

        it('adds a dropped POI with exact payload bytes, preserving existing POIs', () => {
            const { ml, dt, allowed } = dropWith({ dragData: 'city', hex: { q: 10, r: 5 } });
            expect(allowed).toBe(false); // handleDrop always calls preventDefault
            expect(dt.getData).toHaveBeenCalledTimes(1);
            expect(dt.getData).toHaveBeenCalledWith('text/plain');
            expect(ml.setPois).toHaveBeenCalledTimes(1);

            const existing = [{ id: 'poi-0', q: 0, r: 0, type: 'camp', visible: true, label: 'Camp' }];
            expect(ml.setPois.mock.calls[0][0](existing)).toEqual([
                existing[0],
                { id: expect.any(String), type: 'city', q: 10, r: 5, visible: true, label: 'City' },
            ]);
        });

        it('drops a character onto the marching order and seeds party position once', () => {
            const { ml, allowed } = dropWith({ dragData: 'character:Thorin', hex: { q: 4, r: 7 } });
            expect(allowed).toBe(false);
            expect(ml.setPois).not.toHaveBeenCalled();
            expect(ml.setMarchingOrder).toHaveBeenCalledTimes(1);
            expect(ml.setMarchingOrder.mock.calls[0][0]([])).toEqual(['Thorin']);
            const present = ['Thorin'];
            expect(ml.setMarchingOrder.mock.calls[0][0](present)).toBe(present); // no duplicates
            expect(ml.setPartyPosition).toHaveBeenCalledTimes(1);
            expect(ml.setPartyPosition.mock.calls[0][0](null)).toEqual({ q: 4, r: 7 });
            const existingPos = { q: 1, r: 1 };
            expect(ml.setPartyPosition.mock.calls[0][0](existingPos)).toBe(existingPos); // never overwrites
        });

        it('ignores drops with an unknown type, out-of-bounds hex, or an occupied hex', () => {
            const existing = [{ id: 'poi-0', q: 10, r: 5, type: 'camp', visible: true, label: 'Camp' }];
            const getHex = vi.fn(() => ({ q: 10, r: 5 }));
            const ml = makeMapLoader({ pois: existing });
            useMapLoader.mockReturnValue(ml);
            useHexHover.mockReturnValue(makeHexHover({ getHexFromEvent: getHex }));
            renderMap();

            const drop = (data) => fireEvent.drop(mapSvg(), { dataTransfer: { getData: vi.fn(() => data) } });
            expect(drop('not-a-poi-type')).toBe(false);  // unknown drag data
            expect(drop('city')).toBe(false);              // hex already occupied by existing POI
            getHex.mockReturnValue({ q: 10, r: 999 });     // outside hexRows bound
            expect(drop('tower')).toBe(false);
            expect(ml.setPois).not.toHaveBeenCalled();
            expect(ml.setMarchingOrder).not.toHaveBeenCalled();
        });
    });
});
