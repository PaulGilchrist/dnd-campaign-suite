// @maintained-by-ai
// HexMap travel lane — travel-tool destination selection (arm → click payload, every guard,
// right-click) and exact advance-log bytes (advance / advance_with_event / arrived /
// day_exhausted / extreme_weather / silence, incl. branch precedence).
// Base container wiring lives in HexMap.test.jsx (#793); camp / forced-march / weather-reroll /
// event accept-skip-reroll live in HexMap.additional.test.jsx (#792) — not re-tested here.
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

// ── Mock child components — trimmed to this lane's consumers: only the travel
// toolbar button (tool arming) and the Advanced travel-panel button are interactive here.
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./HexMapToolbar.jsx', () => ({
    default: ({ setTool }) => <button data-testid="tool-travel" onClick={() => setTool('travel')}>Travel</button>,
}));
vi.mock('./POILayer.jsx', () => ({ default: () => <g data-testid="poi-layer" /> }));
vi.mock('./POIPanel.jsx', () => ({ default: () => <div data-testid="poi-panel" /> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: () => <g data-testid="poi-context-menu" /> }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => <div data-testid="marching-panel" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: () => <g data-testid="party-marker" /> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: () => <div data-testid="weather-overlay" /> }));
// EventDialog / camp-command buttons inside TravelPanel are owned by HexMap.additional.test.jsx (#792).
vi.mock('./EventDialog.jsx', () => ({ default: () => <div data-testid="event-dialog" /> }));
vi.mock('./TravelPanel.jsx', () => ({
    default: ({ isTravelActive, onAdvance }) =>
        <div data-testid="travel-panel">
            {isTravelActive && <button data-testid="btn-advance" onClick={onAdvance}>Advance</button>}
        </div>,
}));
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
// Shared SSE connection — mock keeps the container off the network; the wiring byte itself
// is pinned by the base lane (HexMap.test.jsx #793), not re-pinned here.
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));

// ── Mock hooks and services ──
vi.mock('./hooks/useMapLoader.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useZoomPan.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useHexHover.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useTerrainPainting.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/usePoiManagement.js', () => ({ default: vi.fn() }));
// Real useTravelToolSync flips the tool via effects — no-op keeps tool arming deterministic.
vi.mock('./hooks/useTravelToolSync.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useEncounterGeneration.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useHexMapSSESync.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/management/useTravelManagement.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/ui/useMonstersData.js', () => ({ useMonstersData: vi.fn() }));
vi.mock('../../hooks/runtime/useLog.js', () => ({ default: vi.fn() }));
// Only the mapsService calls HexMap.jsx makes at render time (formatMapName in the header);
// loadMaps/loadMapData keep the mount effects from hitting the network.
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
}

/** Returns the map SVG element for interaction tests. */
const mapSvg = () => screen.getByTestId('hex-svg');

/** Renders HexMap with the travel tool pre-armed. Returns the travel management mock. */
function renderWithTravelTool({ tmOverrides = {}, hoverOverrides = {}, mapOverrides = {} }) {
    const tm = makeTravelMgmt(tmOverrides);
    useTravelManagement.mockReturnValue(tm);
    useHexHover.mockReturnValue(makeHexHover(hoverOverrides));
    useMapLoader.mockReturnValue(makeMapLoader(mapOverrides));
    render(<HexMap campaignName="test" mapName="test-map" />);
    fireEvent.click(screen.getByTestId('tool-travel'));
    return tm;
}

const PARTY = { q: 15, r: 8 };
const DEST = { q: 20, r: 10 };

describe('HexMap travel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    describe('travel-tool destination selection', () => {
        // One row per branch of HexMap.jsx's travel onClick (button guard, partyPosition
        // guard, hex-null/bounds/party-hex guards, startPlanning guard) — #793 anchors :212.
        it.each([
            { label: 'starts planning and sets the destination while idle', isTravelActive: false, partyPosition: PARTY, hex: DEST, button: 0, expectStartPlanning: true, expectDestination: true },
            { label: 'sets a new destination without restarting planning while travelling', isTravelActive: true, partyPosition: PARTY, hex: DEST, button: 0, expectStartPlanning: false, expectDestination: true },
            { label: 'does nothing when there is no party position', isTravelActive: false, partyPosition: null, hex: DEST, button: 0, expectStartPlanning: false, expectDestination: false },
            { label: 'does nothing when the click resolves to no hex', isTravelActive: false, partyPosition: PARTY, hex: null, button: 0, expectStartPlanning: false, expectDestination: false },
            { label: 'does nothing when the hex is outside the grid bounds', isTravelActive: false, partyPosition: PARTY, hex: { q: -1, r: 5 }, button: 0, expectStartPlanning: false, expectDestination: false },
            { label: 'does nothing when the click resolves to the party hex', isTravelActive: false, partyPosition: PARTY, hex: PARTY, button: 0, expectStartPlanning: false, expectDestination: false },
            { label: 'does nothing on a right-click', isTravelActive: false, partyPosition: PARTY, hex: DEST, button: 2, expectStartPlanning: false, expectDestination: false },
        ])('$label', ({ isTravelActive, partyPosition, hex, button, expectStartPlanning, expectDestination }) => {
            const tm = renderWithTravelTool({
                tmOverrides: { isTravelActive },
                hoverOverrides: { getHexFromEvent: vi.fn(() => hex) },
                mapOverrides: { partyPosition },
            });
            fireEvent.click(mapSvg(), { button });
            if (expectStartPlanning) {
                expect(tm.startPlanning).toHaveBeenCalledTimes(1);
            } else {
                expect(tm.startPlanning).not.toHaveBeenCalled();
            }
            if (expectDestination) {
                expect(tm.setDestinationAndPath).toHaveBeenCalledWith(hex);
                expect(tm.setDestinationAndPath).toHaveBeenCalledTimes(1);
            } else {
                expect(tm.setDestinationAndPath).not.toHaveBeenCalled();
            }
        });
    });

    describe('advance logging', () => {
        // One row per branch of HexMap.jsx handleAdvance + logTravel bytes (#793 anchors :259):
        // moved → advance | advance_with_event | arrived (precedence), blocked → day_exhausted
        // | extreme_weather (precedence) | silence. Exact full payload per #786/#792.
        it.each([
            {
                label: 'a full advance entry',
                advanceResult: { moved: true, arrived: false, event: null },
                mapOverrides: { terrain: { '11,5': 'forest' }, weather: { label: 'Overcast', icon: 'cloud' } },
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
                mapOverrides: { terrain: { '11,5': 'plains' }, weather: { label: 'Clear', icon: 'sun' } },
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
                pathIndex: 1,
                mapOverrides: { weather: { label: 'Clear', icon: 'sun' } },
                expected: {
                    action: 'arrived',
                    hex: null, terrain: null,
                    weather: 'Clear', weatherIcon: 'sun',
                    eventType: null, eventTitle: null,
                },
            },
            {
                label: 'advance_with_event over arrived when both apply',
                advanceResult: { moved: true, arrived: true, event: { type: 'combat', title: 'Ambush' } },
                pathIndex: 1,
                mapOverrides: { weather: { label: 'Clear', icon: 'sun' } },
                expected: {
                    action: 'advance_with_event',
                    hex: null, terrain: null,
                    weather: 'Clear', weatherIcon: 'sun',
                    eventType: 'combat', eventTitle: 'Ambush',
                },
            },
            {
                label: 'day_exhausted when the party cannot move and the day is spent',
                advanceResult: { moved: false },
                dayExhausted: true,
                mapOverrides: { weather: { label: 'Clear', icon: 'sun' } },
                expected: {
                    action: 'day_exhausted',
                    hex: null, terrain: null,
                    weather: 'Clear', weatherIcon: 'sun',
                    eventType: null, eventTitle: null,
                },
            },
            {
                label: 'extreme_weather when the party cannot move due to blocking weather',
                advanceResult: { moved: false },
                mapOverrides: { weather: { condition: 'storm', moveCostMod: null, label: 'Storm', icon: 'storm' } },
                expected: {
                    action: 'extreme_weather',
                    hex: null, terrain: null,
                    weather: 'Storm', weatherIcon: 'storm',
                    eventType: null, eventTitle: null,
                },
            },
            {
                label: 'day_exhausted over extreme_weather when both conditions apply',
                advanceResult: { moved: false },
                dayExhausted: true,
                mapOverrides: { weather: { condition: 'storm', moveCostMod: null } },
                expected: {
                    action: 'day_exhausted',
                    hex: null, terrain: null,
                    weather: null, weatherIcon: null,
                    eventType: null, eventTitle: null,
                },
            },
            {
                label: 'nothing when the party cannot move for an unclassified reason',
                advanceResult: { moved: false },
                mapOverrides: { weather: { condition: 'clear', moveCostMod: 1 } },
                expected: null,
            },
        ])('logs $label', ({ advanceResult, mapOverrides, pathIndex = 0, expected, ...tmRest }) => {
            const { tm, addEntry } = renderWithActiveTravel({
                ...tmRest,
                pathIndex,
                advanceOneHex: vi.fn(() => advanceResult),
                mapOverrides,
            });
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(tm.advanceOneHex).toHaveBeenCalledTimes(1);
            if (expected) {
                expect(addEntry).toHaveBeenCalledWith({ type: 'travel', ...expected });
            } else {
                expect(addEntry).not.toHaveBeenCalled();
            }
        });
    });
});

/**
 * Renders HexMap with an active travel session and a two-hex path
 * ({q:10,r:5} → {q:11,r:5}), so a move lands on 11,5. Returns `{ tm, addEntry }`.
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
