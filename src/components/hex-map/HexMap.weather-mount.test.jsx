// @maintained-by-ai
// Backlog 2026-10-26-C — weather persistence lane. Unlike the sibling HexMap
// container tests (which no-op useTravelToolSync for determinism), this file
// runs the REAL hook: it is the only place the tool-mount → weather-generation
// seam is pinned end-to-end. Locked policy:
//   • tool activation with persisted (map-file) weather ⇒ zero generateWeather /
//     zero setWeather calls — the panel just displays the persisted object;
//   • tool activation with NO weather (first travel) ⇒ exactly one roll;
//   • the panel's manual re-roll button always rolls, weather or not;
//   • the camp (new-day) seam keeps its unconditional roll (owned by
//     HexMap.additional.test.jsx "Force camp and forced march commands").
import { render, screen, fireEvent } from '@testing-library/react';
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

const SEEDED = { condition: 'storm', label: 'Storm', icon: 'cloud-bolt', moveCostMod: 1.5, budgetMod: 0.75, encounterMod: 0, description: 'Seeded GM storm' };
const ROLLED = { condition: 'clear', label: 'Clear', icon: 'sun', moveCostMod: 1, budgetMod: 1, encounterMod: 0, description: 'Rolled clear skies' };

// ── Mock child components ── (layers/panels inert; the toolbar exposes real
// setTool so tool activation drives the REAL useTravelToolSync effect).
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./HexMapToolbar.jsx', () => ({
    default: ({ setTool }) => (
        <div>
            <button data-testid="tool-travel" onClick={() => setTool('travel')}>Travel</button>
            <button data-testid="tool-paint" onClick={() => setTool('paint')}>Paint</button>
        </div>
    ),
}));
vi.mock('./POILayer.jsx', () => ({ default: () => <g data-testid="poi-layer" /> }));
vi.mock('./POIPanel.jsx', () => ({ default: () => <div data-testid="poi-panel" /> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: () => <g data-testid="poi-context-menu" /> }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => <div data-testid="marching-panel" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: () => <g data-testid="party-marker" /> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: () => <g data-testid="travel-path-layer" /> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: ({ weather }) =>
    weather ? <div data-testid="weather-overlay">{weather.label}</div> : null }));
vi.mock('./EventDialog.jsx', () => ({ default: () => <div data-testid="event-dialog" /> }));
// Panel mock mirrors the real gating chain: whole panel only while travel is
// active (TravelPanel.jsx:163), weather row only when weather exists
// (TravelWeatherSection :42), reroll click dispatches the container handler.
vi.mock('./TravelPanel.jsx', () => ({
    default: ({ isTravelActive, weather, onReRollWeather }) =>
        isTravelActive ? <div data-testid="travel-panel">
            {weather ? <>
                <span data-testid="panel-weather">{weather.label}</span>
                <button data-testid="btn-reroll-weather" onClick={onReRollWeather}>Reroll Weather</button>
            </> : null}
        </div> : null,
}));
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
// useTravelToolSync is deliberately NOT mocked — this file's whole point.
vi.mock('./hooks/useMapLoader.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useZoomPan.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useHexHover.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useTerrainPainting.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/usePoiManagement.js', () => ({ default: vi.fn() }));
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
    generateWeather: vi.fn(() => ROLLED),
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
import { generateWeather } from '../../services/campaign/weatherService.js';
import HexMap from './HexMap.jsx';

const PARTY = { q: 10, r: 5 };

function makeMapLoader(overrides = {}) {
    return {
        loading: false, setMapData: vi.fn(),
        gridSize: 30, setGridSize: vi.fn(),
        terrain: {}, setTerrain: vi.fn(),
        rivers: [], setRivers: vi.fn(),
        roads: [], setRoads: vi.fn(),
        pois: [], setPois: vi.fn(),
        marchingOrder: [], setMarchingOrder: vi.fn(),
        partyPosition: PARTY, setPartyPosition: vi.fn(),
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

function setupMocks({ weather = null, tmOverrides = {} } = {}) {
    const loader = makeMapLoader({ weather });
    const tm = makeTravelMgmt(tmOverrides);
    useMapLoader.mockReturnValue(loader);
    useZoomPan.mockReturnValue({ svgWidth: 1039, svgHeight: 519, zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(), clampPan: vi.fn((z, x, y) => ({ x, y })), centerView: vi.fn(() => ({ x: 0, y: 0 })), panning: false, handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(), handleWheel: vi.fn() });
    useHexHover.mockReturnValue({ hoveredHex: null, setHoveredHex: vi.fn(), getHexFromEvent: vi.fn(), handleHexHover: vi.fn() });
    useTerrainPainting.mockReturnValue({ handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(), handleTerrainPointerUp: vi.fn() });
    usePoiManagement.mockReturnValue({ selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(), showRename: null, setShowRename: vi.fn(), poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(), handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(), handlePoiPointerUp: vi.fn(), handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(), handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(), handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn() });
    useEncounterGeneration.mockReturnValue({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    useTravelManagement.mockReturnValue(tm);
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry: vi.fn() });
    return { loader, tm };
}

describe('HexMap weather persistence (tool-mount gate)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('first tool press over persisted weather arms planning but leaves the weather untouched', () => {
        const { loader, tm } = setupMocks({ weather: SEEDED });
        render(<HexMap campaignName="test" mapName="test-map" />);
        // Mount path itself never rolls.
        expect(generateWeather).not.toHaveBeenCalled();
        expect(loader.setWeather).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('tool-travel'));
        // Activation may arm planning, but the seeded weather survives untouched.
        expect(tm.startPlanning).toHaveBeenCalledTimes(1);
        expect(generateWeather).not.toHaveBeenCalled();
        expect(loader.setWeather).not.toHaveBeenCalled();
        expect(screen.getByTestId('weather-overlay')).toHaveTextContent('Storm');
        expect(tm.cancelTravel).not.toHaveBeenCalled();
    });

    it('re-pressing the tool with travel live shows the persisted weather in the panel and rolls nothing', () => {
        const { loader, tm } = setupMocks({ weather: SEEDED, tmOverrides: { isTravelActive: true, travelMode: 'planning' } });
        render(<HexMap campaignName="test" mapName="test-map" />);
        fireEvent.click(screen.getByTestId('tool-travel'));
        expect(generateWeather).not.toHaveBeenCalled();
        expect(loader.setWeather).not.toHaveBeenCalled();
        expect(screen.getByTestId('panel-weather')).toHaveTextContent('Storm');
        expect(screen.getByTestId('weather-overlay')).toHaveTextContent('Storm');
        expect(tm.cancelTravel).not.toHaveBeenCalled();
    });

    it('tool press on a map with NO weather (first travel) auto-rolls exactly once and stores it', () => {
        const { loader, tm } = setupMocks({ weather: null });
        render(<HexMap campaignName="test" mapName="test-map" />);
        expect(generateWeather).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('tool-travel'));
        expect(tm.startPlanning).toHaveBeenCalledTimes(1);
        expect(generateWeather).toHaveBeenCalledTimes(1);
        expect(generateWeather).toHaveBeenCalledWith('plains');
        expect(loader.setWeather).toHaveBeenCalledWith(ROLLED);
    });

    it('manual re-roll affordance still rolls while persisted weather is present', () => {
        const { loader, tm } = setupMocks({
            weather: SEEDED,
            tmOverrides: { isTravelActive: true, travelMode: 'planning', travelPace: 'fast' },
        });
        render(<HexMap campaignName="test" mapName="test-map" />);
        fireEvent.click(screen.getByTestId('btn-reroll-weather'));
        // The gate lives ONLY on the tool-activation path — the manual button
        // unconditionally rolls from the party terrain and re-applies the pace.
        expect(generateWeather).toHaveBeenCalledWith('plains');
        expect(loader.setWeather).toHaveBeenCalledWith(ROLLED);
        expect(tm.changePace).toHaveBeenCalledWith('fast');
    });
});
