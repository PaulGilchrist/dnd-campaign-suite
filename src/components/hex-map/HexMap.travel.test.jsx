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

/** Returns the map SVG element for interaction tests. */
const mapSvg = () => screen.getByTestId('hex-svg');

/** Renders HexMap with the travel tool pre-activated. Returns the travel management mock. */
function renderWithTravelTool({ tmOverrides = {}, hoverOverrides = {}, mapOverrides = {} }) {
    const tm = makeTravelMgmt(tmOverrides);
    useTravelManagement.mockReturnValue(tm);
    useHexHover.mockReturnValue(makeHexHover(hoverOverrides));
    useMapLoader.mockReturnValue(makeMapLoader(mapOverrides));
    render(<HexMap campaignName="test" mapName="test-map" />);
    fireEvent.click(screen.getByTestId('tool-travel'));
    return tm;
}

/**
 * Renders HexMap with an active travel session and a two-hex path.
 * Returns `{ tm, addEntry }` for assertions.
 */
function renderWithActiveTravel({ mapOverrides = {}, ...tmOverrides }) {
    const tm = makeTravelMgmt({
        isTravelActive: true,
        path: [{ q: 10, r: 5 }, { q: 11, r: 5 }],
        pathIndex: 0,
        ...tmOverrides,
    });
    useTravelManagement.mockReturnValue(tm);
    useMapLoader.mockReturnValue(makeMapLoader(mapOverrides));
    const addEntry = vi.fn();
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
    render(<HexMap campaignName="test" mapName="test-map" />);
    return { tm, addEntry };
}

function clickAdvance() {
    fireEvent.click(screen.getByTestId('btn-advance'));
}

describe('HexMap travel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    describe('Travel tool destination selection', () => {
        it.each([
            { label: 'starts planning', isTravelActive: false, expectStartPlanning: true },
            { label: 'does not start planning', isTravelActive: true, expectStartPlanning: false },
        ])('sets destination $label when travel is $isTravelActive', ({ isTravelActive, expectStartPlanning }) => {
            const tm = renderWithTravelTool({
                tmOverrides: { isTravelActive },
                hoverOverrides: { getHexFromEvent: vi.fn(() => ({ q: 20, r: 10 })) },
                mapOverrides: { partyPosition: { q: 15, r: 8 } },
            });
            fireEvent.click(mapSvg());
            if (expectStartPlanning) {
                expect(tm.startPlanning).toHaveBeenCalledTimes(1);
            } else {
                expect(tm.startPlanning).not.toHaveBeenCalled();
            }
            expect(tm.setDestinationAndPath).toHaveBeenCalledWith({ q: 20, r: 10 });
        });

        it.each([
            { scenario: 'when there is no party position', partyPosition: null, getHexResult: { q: 20, r: 10 } },
            { scenario: 'when the click resolves to the party hex', partyPosition: { q: 15, r: 8 }, getHexResult: { q: 15, r: 8 } },
            { scenario: 'when the click resolves to no hex', partyPosition: { q: 15, r: 8 }, getHexResult: null },
            { scenario: 'when the hex is outside the grid bounds', partyPosition: { q: 15, r: 8 }, getHexResult: { q: -1, r: 5 } },
        ])('does nothing $scenario', ({ partyPosition, getHexResult }) => {
            const tm = renderWithTravelTool({
                tmOverrides: { isTravelActive: false },
                hoverOverrides: { getHexFromEvent: vi.fn(() => getHexResult) },
                mapOverrides: { partyPosition },
            });
            fireEvent.click(mapSvg());
            expect(tm.startPlanning).not.toHaveBeenCalled();
            expect(tm.setDestinationAndPath).not.toHaveBeenCalled();
        });

        it('does not set a destination on a right-click', () => {
            const tm = renderWithTravelTool({
                tmOverrides: { isTravelActive: false },
                hoverOverrides: { getHexFromEvent: vi.fn(() => ({ q: 20, r: 10 })) },
                mapOverrides: { partyPosition: { q: 15, r: 8 } },
            });
            fireEvent.click(mapSvg(), { button: 2 });
            expect(tm.startPlanning).not.toHaveBeenCalled();
            expect(tm.setDestinationAndPath).not.toHaveBeenCalled();
        });
    });

    describe('Advance logging', () => {
        it.each([
            {
                label: 'a full advance entry',
                advanceResult: { moved: true, arrived: false, event: null },
                mapOverrides: {
                    terrain: { '11,5': 'forest' },
                    weather: { label: 'Overcast', icon: 'cloud' },
                },
                expected: {
                    action: 'advance',
                    hex: { q: 11, r: 5 }, terrain: 'forest',
                    weather: 'Overcast', weatherIcon: 'cloud',
                    eventType: null, eventTitle: null,
                },
            },
            {
                label: 'advance_with_event with event details when an event triggers',
                advanceResult: { moved: true, arrived: false, event: { type: 'combat', title: 'Ambush' } },
                mapOverrides: {
                    terrain: { '11,5': 'plains' },
                    weather: { label: 'Clear', icon: 'sun' },
                },
                expected: {
                    action: 'advance_with_event',
                    hex: { q: 11, r: 5 }, terrain: 'plains',
                    weather: 'Clear', weatherIcon: 'sun',
                    eventType: 'combat', eventTitle: 'Ambush',
                },
            },
            {
                label: 'arrived without a target hex when the path ends',
                advanceResult: { moved: true, arrived: true, event: null },
                mapOverrides: { weather: { label: 'Clear', icon: 'sun' } },
                pathIndex: 1,
                expected: {
                    action: 'arrived',
                    hex: null, terrain: null,
                    weather: 'Clear', weatherIcon: 'sun',
                    eventType: null, eventTitle: null,
                },
            },
        ])('logs $label', ({ advanceResult, mapOverrides, pathIndex, expected }) => {
            const { tm, addEntry } = renderWithActiveTravel({
                pathIndex: pathIndex ?? 0,
                advanceOneHex: vi.fn(() => advanceResult),
                mapOverrides,
            });
            clickAdvance();
            expect(tm.advanceOneHex).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', ...expected,
            });
        });

        it('logs day_exhausted when the party cannot move and the day is spent', () => {
            const { addEntry } = renderWithActiveTravel({
                dayExhausted: true,
                advanceOneHex: vi.fn(() => ({ moved: false })),
                mapOverrides: { weather: { label: 'Clear', icon: 'sun' } },
            });
            clickAdvance();
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action: 'day_exhausted',
                hex: null, terrain: null,
                weather: 'Clear', weatherIcon: 'sun',
                eventType: null, eventTitle: null,
            });
        });

        it('logs extreme_weather when the party cannot move due to blocking weather', () => {
            const { addEntry } = renderWithActiveTravel({
                advanceOneHex: vi.fn(() => ({ moved: false })),
                mapOverrides: {
                    weather: { condition: 'storm', moveCostMod: null, label: 'Storm', icon: 'storm' },
                },
            });
            clickAdvance();
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action: 'extreme_weather',
                hex: null, terrain: null,
                weather: 'Storm', weatherIcon: 'storm',
                eventType: null, eventTitle: null,
            });
        });

        it('does not log when the party cannot move for an unclassified reason', () => {
            const { tm, addEntry } = renderWithActiveTravel({
                advanceOneHex: vi.fn(() => ({ moved: false })),
                mapOverrides: { weather: { condition: 'clear', moveCostMod: 1 } },
            });
            clickAdvance();
            expect(tm.advanceOneHex).toHaveBeenCalledTimes(1);
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('logs day_exhausted over extreme_weather when both conditions apply', () => {
            const { addEntry } = renderWithActiveTravel({
                dayExhausted: true,
                advanceOneHex: vi.fn(() => ({ moved: false })),
                mapOverrides: { weather: { condition: 'storm', moveCostMod: null } },
            });
            clickAdvance();
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action: 'day_exhausted',
                hex: null, terrain: null,
                weather: null, weatherIcon: null,
                eventType: null, eventTitle: null,
            });
        });

        it('logs advance_with_event over arrived when both apply', () => {
            const { addEntry } = renderWithActiveTravel({
                pathIndex: 1,
                advanceOneHex: vi.fn(() => ({ moved: true, arrived: true, event: { type: 'combat', title: 'Ambush' } })),
                mapOverrides: { weather: { label: 'Clear', icon: 'sun' } },
            });
            clickAdvance();
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action: 'advance_with_event',
                hex: null, terrain: null,
                weather: 'Clear', weatherIcon: 'sun',
                eventType: 'combat', eventTitle: 'Ambush',
            });
        });
    });
});
