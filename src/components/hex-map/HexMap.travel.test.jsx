// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// JSDOM PointerEvent polyfill (needed for React 19 onPointerLeave)
if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.pointerId = init.pointerId || 0;
            this.pointerType = init.pointerType || 'mouse';
        }
    };
}

// ── Mock child components (travel-aware mocks) ──
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./HexMapToolbar.jsx', () => ({
    default: ({ onBack, mapName, zoomIn, zoomOut, resetView, tool, setTool }) =>
        <div data-testid="toolbar">
            <button data-testid="toolbar-back" onClick={onBack}>Back</button>
            <span data-testid="toolbar-name">{mapName}</span>
            <button data-testid="toolbar-zoomin" onClick={zoomIn}>+</button>
            <button data-testid="toolbar-zoomout" onClick={zoomOut}>-</button>
            <button data-testid="toolbar-resetview" onClick={resetView}>Reset</button>
            <button data-testid="tool-travel" onClick={() => setTool('travel')}>Travel</button>
            <span data-testid="current-tool">{tool}</span>
        </div>,
}));
vi.mock('./POILayer.jsx', () => ({ default: () => <g data-testid="poi-layer" /> }));
vi.mock('./POIPanel.jsx', () => ({ default: ({ onClose }) => <div data-testid="poi-panel"><button onClick={onClose}>Close</button></div> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: ({ selectedPoi, onClose }) => selectedPoi ? <g data-testid="poi-context-menu"><text onClick={onClose}>Close</text></g> : null }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => <div data-testid="marching-panel" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: ({ position }) => position ? <g data-testid="party-marker" /> : null }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: ({ weather }) => weather ? <div data-testid="weather-overlay" /> : null }));
vi.mock('./EventDialog.jsx', () => ({ default: ({ event, onAccept, onSkip, onReroll }) => event ? <div data-testid="event-dialog"><button data-testid="event-accept" onClick={onAccept}>Accept</button><button data-testid="event-skip" onClick={onSkip}>Skip</button><button data-testid="event-reroll" onClick={onReroll}>Reroll</button></div> : null }));
vi.mock('./TravelPanel.jsx', () => ({
    default: ({ isTravelActive, onAdvance, onForceCamp, onForcedMarch, onCancel, onChangePace, onToggleHorseback }) =>
        <div data-testid="travel-panel">
            {isTravelActive && <>
                <button data-testid="btn-advance" onClick={onAdvance}>Advance</button>
                <button data-testid="btn-camp" onClick={onForceCamp}>Camp</button>
                <button data-testid="btn-forced-march" onClick={onForcedMarch}>Forced March</button>
                <button data-testid="btn-cancel" onClick={onCancel}>Cancel</button>
                <button data-testid="btn-pace" onClick={onChangePace}>Change Pace</button>
                <button data-testid="btn-horseback" onClick={onToggleHorseback}>Horseback</button>
            </>}
        </div>,
}));
vi.mock('./TravelPathLayer.jsx', () => ({ default: ({ path }) => path && path.length > 0 ? <g data-testid="travel-path-layer" /> : null }));
vi.mock('./svg/CampSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/CitySVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/DungeonSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/HazardSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/LandmarkSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/LoreSiteSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/NaturalWonderSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/SettlementSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('./svg/TowerSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));

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
import useEncounterGeneration from './hooks/useEncounterGeneration.js';
import useHexMapSSESync from './hooks/useHexMapSSESync.js';
import useTravelManagement from '../../hooks/management/useTravelManagement.js';
import useLog from '../../hooks/runtime/useLog.js';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { generateWeather } from '../../services/campaign/weatherService.js';
import HexMap from './HexMap.jsx';

const MODES = { INACTIVE: 'inactive', PLANNING: 'planning', TRAVELING: 'traveling', PAUSED: 'paused' };

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

function makeHexHover(overrides = {}) {
    return {
        hoveredHex: null, setHoveredHex: vi.fn(),
        getHexFromEvent: vi.fn(), handleHexHover: vi.fn(),
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
        MODES,
        ...overrides,
    };
}

function setupDefaultMocks() {
    useMapLoader.mockReturnValue(makeMapLoader());
    useZoomPan.mockReturnValue({ svgWidth: 1039, svgHeight: 519, zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(), clampPan: vi.fn((z, x, y) => ({ x, y })), centerView: vi.fn(() => ({ x: 0, y: 0 })), panning: false, handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(), handleWheel: vi.fn() });
    useHexHover.mockReturnValue(makeHexHover());
    useTerrainPainting.mockReturnValue({ handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(), handleTerrainPointerUp: vi.fn() });
    usePoiManagement.mockReturnValue({ selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(), showRename: null, setShowRename: vi.fn(), poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(), handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(), handlePoiPointerUp: vi.fn(), handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(), handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(), handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn(), handlePOIDrop: vi.fn() });
    useEncounterGeneration.mockReturnValue({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    useTravelManagement.mockReturnValue(makeTravelMgmt());
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry: vi.fn() });
    mapsService.formatMapName.mockReturnValue('Test Map');
}

describe('HexMap travel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    describe('Tool activation', () => {
        it('sets destination on click with travel tool and party position', () => {
            const tm = makeTravelMgmt({ isTravelActive: false, travelMode: 'inactive' });
            const hh = makeHexHover({ getHexFromEvent: vi.fn(() => ({ q: 20, r: 10 })) });
            useTravelManagement.mockReturnValue(tm);
            useHexHover.mockReturnValue(hh);
            useMapLoader.mockReturnValue(makeMapLoader({ partyPosition: { q: 15, r: 8 } }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('tool-travel'));
            fireEvent.click(document.querySelector('.hex-svg'));
            expect(tm.startPlanning).toHaveBeenCalled();
            expect(tm.setDestinationAndPath).toHaveBeenCalledWith({ q: 20, r: 10 });
        });

        it.each([
            { scenario: 'without party position', partyPosition: null, getHexResult: { q: 20, r: 10 } },
            { scenario: 'when clicking same hex as party position', partyPosition: { q: 15, r: 8 }, getHexResult: { q: 15, r: 8 } },
            { scenario: 'when hex is out of bounds', partyPosition: { q: 15, r: 8 }, getHexResult: { q: -1, r: 5 } },
        ])('does nothing $scenario', ({ partyPosition, getHexResult }) => {
            const tm = makeTravelMgmt({ isTravelActive: false });
            const hh = makeHexHover({ getHexFromEvent: vi.fn(() => getHexResult) });
            useTravelManagement.mockReturnValue(tm);
            useHexHover.mockReturnValue(hh);
            if (partyPosition) {
                useMapLoader.mockReturnValue(makeMapLoader({ partyPosition }));
            }
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('tool-travel'));
            fireEvent.click(document.querySelector('.hex-svg'));
            expect(tm.startPlanning).not.toHaveBeenCalled();
            expect(tm.setDestinationAndPath).not.toHaveBeenCalled();
        });
    });

    describe('Travel actions', () => {
        it.each([
            { buttonTestId: 'btn-advance', handlerName: 'advanceOneHex' },
            { buttonTestId: 'btn-camp', handlerName: 'forceCamp' },
            { buttonTestId: 'btn-forced-march', handlerName: 'forcedMarch' },
        ])('calls $handlerName when $buttonTestId is clicked', ({ buttonTestId, handlerName }) => {
            const tm = makeTravelMgmt({ isTravelActive: true, travelMode: 'traveling' });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId(buttonTestId));
            expect(tm[handlerName]).toHaveBeenCalled();
        });
    });

    describe('Cancel, pace, and horseback actions', () => {
        it('calls cancelTravel when cancel button is clicked', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, travelMode: 'traveling' });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-cancel'));
            expect(tm.cancelTravel).toHaveBeenCalled();
        });

        it('calls changePace when pace button is clicked', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, travelMode: 'traveling' });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-pace'));
            expect(tm.changePace).toHaveBeenCalled();
        });

        it('calls toggleHorseback when horseback button is clicked', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, travelMode: 'traveling' });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-horseback'));
            expect(tm.toggleHorseback).toHaveBeenCalled();
        });
    });

    describe('Advance result handling', () => {
        it('calls advanceOneHex and logs advance', () => {
            const addEntry = vi.fn();
            const tm = makeTravelMgmt({
                isTravelActive: true, path: [{ q: 10, r: 5 }, { q: 11, r: 5 }], pathIndex: 0,
                advanceOneHex: vi.fn(() => ({ moved: true, arrived: false, event: null })),
            });
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(tm.advanceOneHex).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
            expect(addEntry.mock.calls[0][0].action).toBe('advance');
            expect(addEntry.mock.calls[0][0].type).toBe('travel');
        });

        it('logs advance_with_event when advance returns event', () => {
            const addEntry = vi.fn();
            const tm = makeTravelMgmt({
                isTravelActive: true, path: [{ q: 10, r: 5 }, { q: 11, r: 5 }], pathIndex: 0,
                advanceOneHex: vi.fn(() => ({ moved: true, arrived: false, event: { type: 'combat' } })),
            });
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry.mock.calls[0][0].action).toBe('advance_with_event');
        });

        it('logs arrived when advance returns arrived', () => {
            const addEntry = vi.fn();
            const tm = makeTravelMgmt({
                isTravelActive: true, path: [{ q: 10, r: 5 }, { q: 11, r: 5 }], pathIndex: 1,
                advanceOneHex: vi.fn(() => ({ moved: true, arrived: true, event: null })),
            });
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry.mock.calls[0][0].action).toBe('arrived');
        });

        it('logs day_exhausted when advance fails and day exhausted', () => {
            const addEntry = vi.fn();
            const tm = makeTravelMgmt({
                isTravelActive: true, path: [{ q: 10, r: 5 }, { q: 11, r: 5 }], pathIndex: 0,
                dayExhausted: true,
                advanceOneHex: vi.fn(() => ({ moved: false })),
            });
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry).toHaveBeenCalled();
            expect(addEntry.mock.calls[0][0].action).toBe('day_exhausted');
        });

        it('logs extreme_weather when advance fails due to weather', () => {
            const addEntry = vi.fn();
            const weather = { condition: 'storm', moveCostMod: null, budgetMod: 1, encounterMod: 0, description: 'Storm' };
            const tm = makeTravelMgmt({
                isTravelActive: true, path: [{ q: 10, r: 5 }, { q: 11, r: 5 }], pathIndex: 0,
                dayExhausted: false,
                advanceOneHex: vi.fn(() => ({ moved: false })),
            });
            useTravelManagement.mockReturnValue(tm);
            useMapLoader.mockReturnValue(makeMapLoader({ partyPosition: { q: 15, r: 8 }, weather }));
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry).toHaveBeenCalled();
            expect(addEntry.mock.calls[0][0].action).toBe('extreme_weather');
        });
    });

    describe('Camp handler', () => {
        it('generates weather on camp', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, forceCamp: vi.fn() });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-camp'));
            expect(generateWeather).toHaveBeenCalled();
        });
    });

    describe('Travel panel visibility', () => {
        it('renders travel panel and action buttons when active, hides buttons when inactive', () => {
            useTravelManagement.mockReturnValue(makeTravelMgmt({ isTravelActive: true, travelMode: 'traveling' }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            expect(screen.getByTestId('travel-panel')).toBeInTheDocument();
            expect(screen.getByTestId('btn-advance')).toBeInTheDocument();
            expect(screen.getByTestId('btn-camp')).toBeInTheDocument();
            expect(screen.getByTestId('btn-forced-march')).toBeInTheDocument();
            expect(screen.getByTestId('btn-cancel')).toBeInTheDocument();
            expect(screen.getByTestId('btn-pace')).toBeInTheDocument();
            expect(screen.getByTestId('btn-horseback')).toBeInTheDocument();
        });

        it('renders travel panel without action buttons when not active', () => {
            useTravelManagement.mockReturnValue(makeTravelMgmt({ isTravelActive: false }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            expect(screen.getByTestId('travel-panel')).toBeInTheDocument();
            expect(screen.queryByTestId('btn-advance')).not.toBeInTheDocument();
            expect(screen.queryByTestId('btn-camp')).not.toBeInTheDocument();
            expect(screen.queryByTestId('btn-forced-march')).not.toBeInTheDocument();
            expect(screen.queryByTestId('btn-cancel')).not.toBeInTheDocument();
            expect(screen.queryByTestId('btn-pace')).not.toBeInTheDocument();
            expect(screen.queryByTestId('btn-horseback')).not.toBeInTheDocument();
        });
    });

    describe('Event handling during travel', () => {
        it('calls acceptEvent when event accept button is clicked', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, pendingEvent: { type: 'combat' } });
            const addEntry = vi.fn();
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('event-accept'));
            expect(tm.acceptEvent).toHaveBeenCalled();
        });

        it('calls skipEvent when event skip button is clicked', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, pendingEvent: { type: 'skirmish' } });
            const addEntry = vi.fn();
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('event-skip'));
            expect(tm.skipEvent).toHaveBeenCalled();
        });

        it('calls rerollEvent when event reroll button is clicked', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, pendingEvent: { type: 'wild-magic' } });
            const addEntry = vi.fn();
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('event-reroll'));
            expect(tm.rerollEvent).toHaveBeenCalled();
        });

        it('does not show event dialog when no pending event', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, pendingEvent: null });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            expect(screen.queryByTestId('event-dialog')).not.toBeInTheDocument();
        });
    });

    describe('Travel mode paused', () => {
        it('renders travel panel when paused', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, travelMode: 'paused' });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            expect(screen.getByTestId('travel-panel')).toBeInTheDocument();
        });

        it('renders action buttons when paused', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, travelMode: 'paused' });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            expect(screen.getByTestId('btn-advance')).toBeInTheDocument();
            expect(screen.getByTestId('btn-cancel')).toBeInTheDocument();
        });
    });

    describe('Empty path during travel', () => {
        it('renders travel panel when path is empty', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, path: [], pathIndex: 0 });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            expect(screen.getByTestId('travel-panel')).toBeInTheDocument();
        });

        it('does not render travel path layer when path is empty', () => {
            const tm = makeTravelMgmt({ isTravelActive: true, path: [], pathIndex: 0 });
            useTravelManagement.mockReturnValue(tm);
            render(<HexMap campaignName="test" mapName="test-map" />);
            expect(screen.queryByTestId('travel-path-layer')).not.toBeInTheDocument();
        });
    });
});
