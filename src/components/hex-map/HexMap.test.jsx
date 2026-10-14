// HexMap integration tests: rendering, toolbar wiring, panel/overlay visibility,
// SVG pointer interaction, background-click state cleanup, and POI drag-and-drop.
// Travel-tool/advance behavior lives in HexMap.travel.test.jsx and event-handler
// behavior lives in HexMap.additional.test.jsx; this file does not duplicate those.
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

// ── Mock child components ──
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: ({ position }) => position ? <g data-testid="party-marker" /> : null }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: ({ path }) => path && path.length > 0 ? <g data-testid="travel-path-layer" /> : null }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: ({ weather }) => weather ? <div data-testid="weather-overlay" /> : null }));
vi.mock('./EventDialog.jsx', () => ({ default: ({ event, onAccept, onSkip, onReroll }) => event ? <div data-testid="event-dialog"><button data-testid="event-accept" onClick={onAccept}>Accept</button><button data-testid="event-skip" onClick={onSkip}>Skip</button><button data-testid="event-reroll" onClick={onReroll}>Reroll</button></div> : null }));
vi.mock('./TravelPanel.jsx', () => ({ default: ({ isTravelActive }) => isTravelActive ? <div data-testid="travel-panel" /> : null }));

// POI layer captures props so tests can inspect what HexMap passes to it.
const { poiLayerProps } = vi.hoisted(() => ({ poiLayerProps: { current: null } }));
vi.mock('./POILayer.jsx', () => ({
    default: (props) => {
        poiLayerProps.current = props;
        return <g data-testid="poi-layer" />;
    },
}));

vi.mock('./POIPanel.jsx', () => ({ default: ({ onClose }) => <div data-testid="poi-panel"><button data-testid="poi-panel-close" onClick={onClose}>Close</button></div> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: ({ selectedPoi, onClose }) => selectedPoi ? <g data-testid="poi-context-menu"><text onClick={onClose}>Close</text></g> : null }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: ({ onClose }) => <div data-testid="marching-panel"><button data-testid="marching-panel-close" onClick={onClose}>Close</button></div> }));

// Catch-all SVG mock: all svg/* components render the same generic element.
vi.mock('./svg/CampSVG.jsx', () => ({ default: () => <g data-testid="svg-camp" /> }));
vi.mock('./svg/CitySVG.jsx', () => ({ default: () => <g data-testid="svg-city" /> }));
vi.mock('./svg/DungeonSVG.jsx', () => ({ default: () => <g data-testid="svg-dungeon" /> }));
vi.mock('./svg/HazardSVG.jsx', () => ({ default: () => <g data-testid="svg-hazard" /> }));
vi.mock('./svg/LandmarkSVG.jsx', () => ({ default: () => <g data-testid="svg-landmark" /> }));
vi.mock('./svg/LoreSiteSVG.jsx', () => ({ default: () => <g data-testid="svg-lore" /> }));
vi.mock('./svg/NaturalWonderSVG.jsx', () => ({ default: () => <g data-testid="svg-wonder" /> }));
vi.mock('./svg/SettlementSVG.jsx', () => ({ default: () => <g data-testid="svg-settlement" /> }));
vi.mock('./svg/TowerSVG.jsx', () => ({ default: () => <g data-testid="svg-tower" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));

// ── Toolbar mock: uses tool string values matching outdoorConfig constants ──
vi.mock('./HexMapToolbar.jsx', () => ({
    default: ({ onBack, mapName, zoomIn, zoomOut, resetView, setTool, setPoiPanelOpen, setMarchingOrderOpen }) =>
        <div data-testid="toolbar">
            <button data-testid="toolbar-back" onClick={onBack}>Back</button>
            <span data-testid="toolbar-name">{mapName}</span>
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
vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: vi.fn((setter) => setter) }));
vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    loadMapData: vi.fn(() => Promise.resolve(null)),
    saveMapData: vi.fn(() => Promise.resolve({})),
    createMap: vi.fn(() => Promise.resolve({ name: 'test', alreadyExists: false })),
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
import HexMap from './HexMap.jsx';

// ── Mock factory helpers ──

function makeMapLoader(overrides = {}) {
    return {
        loading: false, setMapData: vi.fn(),
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
    mapsService.formatMapName.mockReturnValue('Test Map');
}

/** Renders the map in its default (loaded, idle) state. */
function renderMap(props = {}) {
    render(<HexMap campaignName="test" mapName="test-map" {...props} />);
}

const mapSvg = () => document.querySelector('.hex-svg');

describe('HexMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        poiLayerProps.current = null;
        setupDefaultMocks();
    });

    describe('Rendering', () => {
        it('shows a loading message while the map is loading', () => {
            useMapLoader.mockReturnValue(makeMapLoader({ loading: true }));
            renderMap();
            expect(screen.getByText('Loading map...')).toBeInTheDocument();
        });

        it('renders the full canvas once loaded', () => {
            renderMap();
            expect(screen.queryByText('Loading map...')).not.toBeInTheDocument();
            expect(screen.getByText('1 hex = 6 miles')).toBeInTheDocument();
            expect(mapSvg()).toBeInTheDocument();
        });

        it('does not crash when onBack is not provided', () => {
            expect(() => renderMap({ onBack: undefined })).not.toThrow();
            expect(screen.getByTestId('toolbar')).toBeInTheDocument();
        });
    });

    describe('Toolbar wiring', () => {
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
    });

    describe('Panels and overlays', () => {
        it('opens and closes the POI panel from the toolbar', () => {
            renderMap();
            expect(screen.queryByTestId('poi-panel')).not.toBeInTheDocument();
            fireEvent.click(screen.getByTestId('toolbar-poi-panel'));
            expect(screen.getByTestId('poi-panel')).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('poi-panel-close'));
            expect(screen.queryByTestId('poi-panel')).not.toBeInTheDocument();
        });

        it('opens and closes the marching order panel from the toolbar', () => {
            renderMap();
            expect(screen.queryByTestId('marching-panel')).not.toBeInTheDocument();
            fireEvent.click(screen.getByTestId('toolbar-marching'));
            expect(screen.getByTestId('marching-panel')).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('marching-panel-close'));
            expect(screen.queryByTestId('marching-panel')).not.toBeInTheDocument();
        });
    });

    describe('SVG interaction events', () => {
        it('routes wheel events to the zoom/pan handler', () => {
            const zp = makeZoomPan();
            useZoomPan.mockReturnValue(zp);
            renderMap();
            fireEvent.wheel(mapSvg());
            expect(zp.handleWheel).toHaveBeenCalledTimes(1);
        });

        it('prevents the browser context menu on the map', () => {
            renderMap();
            const e = new Event('contextmenu', { bubbles: true, cancelable: true });
            const spy = vi.spyOn(e, 'preventDefault');
            fireEvent(mapSvg(), e);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('Map background click', () => {
        it('clears the POI menu and rename panel when the map is clicked', () => {
            const pm = makePoiManagement();
            usePoiManagement.mockReturnValue(pm);
            renderMap();
            fireEvent.click(mapSvg());
            expect(pm.setSelectedPoiMenu).toHaveBeenCalledWith(null);
            expect(pm.setShowRename).toHaveBeenCalledWith(null);
        });

        it('clears the pending road connection when the road tool is active', () => {
            const pm = makePoiManagement();
            usePoiManagement.mockReturnValue(pm);
            renderMap();
            fireEvent.click(screen.getByTestId('toolbar-road'));
            fireEvent.click(mapSvg());
            expect(pm.setRoadStartPoiId).toHaveBeenCalledWith(null);
        });

        it('does not clear road start when the road tool is not active', () => {
            const pm = makePoiManagement();
            usePoiManagement.mockReturnValue(pm);
            renderMap();
            fireEvent.click(mapSvg());
            expect(pm.setRoadStartPoiId).not.toHaveBeenCalled();
        });
    });

    describe('POI layer props', () => {
        it('passes partyPosition to the POI layer when set', () => {
            useMapLoader.mockReturnValue(makeMapLoader({ partyPosition: { q: 10, r: 5 } }));
            renderMap();
            expect(poiLayerProps.current.partyPosition).toEqual({ q: 10, r: 5 });
        });

        it('passes null partyPosition to the POI layer when not set', () => {
            renderMap();
            expect(poiLayerProps.current.partyPosition).toBeNull();
        });
    });

    describe('POI drag and drop', () => {
        function dropOnMap({ dragData, getHexFromEvent, mapOverrides = {} }) {
            const dt = { getData: vi.fn(() => dragData) };
            const ml = makeMapLoader(mapOverrides);
            useHexHover.mockReturnValue(makeHexHover({ getHexFromEvent }));
            useMapLoader.mockReturnValue(ml);
            renderMap();
            fireEvent.drop(mapSvg(), { dataTransfer: dt });
            return { dt, ml };
        }

        it('adds a dropped POI to the map, preserving existing POIs', () => {
            const { dt, ml } = dropOnMap({
                dragData: 'city',
                getHexFromEvent: vi.fn(() => ({ q: 10, r: 5 })),
            });
            expect(dt.getData).toHaveBeenCalledWith('text/plain');
            expect(ml.setPois).toHaveBeenCalledTimes(1);

            const existingPois = [{ id: 'poi-0', q: 0, r: 0, type: 'camp', visible: true, label: 'Camp' }];
            const newPois = ml.setPois.mock.calls[0][0](existingPois);
            expect(newPois).toHaveLength(2);
            expect(newPois[0]).toBe(existingPois[0]);
            expect(newPois[1]).toMatchObject({ type: 'city', q: 10, r: 5, visible: true, label: 'City' });
            expect(newPois[1].id).toBeTruthy();
        });
    });
});
