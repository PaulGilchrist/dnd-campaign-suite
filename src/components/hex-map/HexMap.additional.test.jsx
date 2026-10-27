// @maintained-by-ai
// HexMap container wiring — event/command overflow file. Three-way split of the HexMap container tests:
//   HexMap.test.jsx        — rendering/loading, toolbar, panel open/close, SVG wheel/context/click cleanup,
//                            POI layer partyPosition prop, drop-to-add-POI.
//   HexMap.travel.test.jsx — travel-tool destination selection and advanceOneHex logging.
//   this file              — EventDialog accept/skip/reroll dispatch + logging, force camp / forced march /
//                            weather reroll command handlers, POI linked-map validation & enter gating,
//                            TravelPanel flag forwarding, WeatherOverlay visibility.
// EventDialog's own rendering is owned by EventDialog.test.jsx — every accept/skip/reroll click below
// also proves the dialog is mounted with the wired callbacks, so no separate "dialog appears" tests here.
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

// Capture POI layer props so tests can inspect values HexMap passes to it
// (validLinkedMaps is async state HexMap computes, onPoiEnter is the container's own handler).
const { poiLayerProps } = vi.hoisted(() => ({ poiLayerProps: { current: null } }));

// ── Mock child components ──
// Static layers and the toolbar are inert here (their wiring is owned by HexMap.test.jsx);
// panels stay mocked because their modules import services we keep off the network.
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

// EventDialog only renders when `event` is truthy — matches HexMap.jsx behavior.
vi.mock('./EventDialog.jsx', () => ({
    default: ({ event, onAccept, onSkip, onReroll }) =>
        event ? <div data-testid="event-dialog">
            <button data-testid="event-accept" onClick={onAccept}>Accept</button>
            <button data-testid="event-skip" onClick={onSkip}>Skip</button>
            <button data-testid="event-reroll" onClick={onReroll}>Reroll</button>
        </div> : null,
}));
// TravelPanel mock exposes forwarded travel state as readable spans and buttons only for the
// commands exercised in this file (advance click is owned by HexMap.travel.test.jsx).
vi.mock('./TravelPanel.jsx', () => ({
    default: ({ isTravelActive, onAdvance, onForceCamp, onForcedMarch, onReRollWeather, eventFrequency, horseback, forcedMarchHours, exhaustionMultiplier, partyHasMaxExhaustion }) =>
        <div data-testid="travel-panel">
            {isTravelActive && <>
                <button data-testid="btn-advance" onClick={onAdvance}>Advance</button>
                <button data-testid="btn-camp" onClick={onForceCamp}>Camp</button>
                <button data-testid="btn-forced-march" onClick={onForcedMarch}>Forced March</button>
                <button data-testid="btn-reroll-weather" onClick={onReRollWeather}>Reroll Weather</button>
                <span data-testid="event-frequency">{eventFrequency}</span>
                <span data-testid="horseback">{horseback ? 'true' : 'false'}</span>
                <span data-testid="forced-march-hours">{forcedMarchHours}</span>
                <span data-testid="exhaustion-multiplier">{exhaustionMultiplier}</span>
                <span data-testid="party-max-exhaustion">{partyHasMaxExhaustion ? 'true' : 'false'}</span>
            </>}
        </div>,
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
}));
vi.mock('../../services/campaign/weatherService.js', () => ({
    generateWeather: vi.fn(() => ({ condition: 'clear', label: 'Clear', icon: 'sun', moveCostMod: 1, budgetMod: 1, encounterMod: 0, description: 'Clear skies' })),
}));
// Auto-encounter audit seam — captured so the accept-wiring tests can pin the
// battleMapName threaded from the spawn result (backlog 2026-10-25 pm).
const { autoEncounterCalls } = vi.hoisted(() => ({ autoEncounterCalls: [] }));
vi.mock('../../services/encounters/autoEncounterService.js', () => ({
    autoStartEncounterFromEvent: vi.fn(async (args) => { autoEncounterCalls.push(args); return { started: false }; }),
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
    useZoomPan.mockReturnValue(makeZoomPan());
    useHexHover.mockReturnValue(makeHexHover());
    useTerrainPainting.mockReturnValue({ handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(), handleTerrainPointerUp: vi.fn() });
    usePoiManagement.mockReturnValue(makePoiManagement());
    useEncounterGeneration.mockReturnValue({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    useTravelManagement.mockReturnValue(makeTravelMgmt());
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry: vi.fn() });
    mapsService.formatMapName.mockImplementation((name) => name || '');
    // Linked maps are "valid" by default; tests opt into the failure path with
    // mockImplementation so the Promise.allSettled filter is exercised honestly.
    mapsService.loadMapData.mockImplementation(() => Promise.resolve({}));
}

/**
 * Renders HexMap at party/travel hex {q:10,r:5} with a pending event and an active
 * travel session, then the caller clicks `event-accept`. `acceptEvent` returns the
 * same pendingEvent (the real hook's contract). Returns `{ tm, addEntry }`.
 */
function renderEventAccept({ pendingEvent, travelOverrides = {}, mapOverrides = {}, encounter }) {
    const addEntry = vi.fn();
    const tm = makeTravelMgmt({
        isTravelActive: true,
        pendingEvent,
        acceptEvent: vi.fn(() => pendingEvent),
        currentPosition: { q: 10, r: 5 },
        ...travelOverrides,
    });
    useTravelManagement.mockReturnValue(tm);
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
    useMapLoader.mockReturnValue(makeMapLoader({ partyPosition: { q: 10, r: 5 }, ...mapOverrides }));
    useEncounterGeneration.mockReturnValue(encounter);
    render(<HexMap campaignName="test" mapName="test-map" />);
    return { tm, addEntry };
}

describe('HexMap event & command wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        poiLayerProps.current = null;
        autoEncounterCalls.length = 0;
        setupDefaultMocks();
    });

    describe('Force camp and forced march commands', () => {
        it.each([
            { label: 'camps at the travel position', handler: 'forceCamp', action: 'camp', btnTestId: 'btn-camp', currentPosition: { q: 15, r: 8 }, fallbackPos: { q: 10, r: 5 }, weather: 'Clear', regeneratesWeather: true },
            { label: 'forced-marches at the travel position', handler: 'forcedMarch', action: 'forced_march', btnTestId: 'btn-forced-march', currentPosition: { q: 15, r: 8 }, fallbackPos: { q: 10, r: 5 }, weather: 'Storm', regeneratesWeather: false },
            { label: 'camps at the party hex when travel has no position', handler: 'forceCamp', action: 'camp', btnTestId: 'btn-camp', currentPosition: null, fallbackPos: { q: 20, r: 12 }, weather: 'Storm', regeneratesWeather: true },
            { label: 'forced-marches at the party hex when travel has no position', handler: 'forcedMarch', action: 'forced_march', btnTestId: 'btn-forced-march', currentPosition: null, fallbackPos: { q: 20, r: 12 }, weather: 'Rain', regeneratesWeather: false },
        ])('$label: dispatches the handler and logs once', ({ handler, action, btnTestId, currentPosition, fallbackPos, weather, regeneratesWeather }) => {
            const addEntry = vi.fn();
            const tm = makeTravelMgmt({ isTravelActive: true, [handler]: vi.fn(), currentPosition });
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            useMapLoader.mockReturnValue(makeMapLoader({ partyPosition: fallbackPos, weather: { label: weather } }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId(btnTestId));
            expect(tm[handler]).toHaveBeenCalledTimes(1);
            if (regeneratesWeather) {
                // The fresh roll must be handed to forceCamp explicitly — the
                // hook's weather closure is the pre-roll one (stale-budget bug).
                expect(tm[handler]).toHaveBeenCalledWith(
                    expect.objectContaining({ condition: 'clear', label: 'Clear', budgetMod: 1 }));
            } else {
                expect(tm[handler]).toHaveBeenCalledWith();
            }
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action, hex: currentPosition || fallbackPos,
                terrain: null, weather, weatherIcon: null, eventType: null, eventTitle: null,
            });
            if (regeneratesWeather) {
                expect(generateWeather).toHaveBeenCalledTimes(1);
            } else {
                expect(generateWeather).not.toHaveBeenCalled();
            }
        });
    });

    describe('Weather reroll command', () => {
        it('panel weather reroll regenerates weather from the party terrain and resumes the current pace', () => {
            const addEntry = vi.fn();
            const tm = makeTravelMgmt({ isTravelActive: true, travelPace: 'fast' });
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            useMapLoader.mockReturnValue(makeMapLoader({
                partyPosition: { q: 10, r: 5 },
                terrain: { '10,5': 'desert' },
            }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId('btn-reroll-weather'));
            expect(generateWeather).toHaveBeenCalledWith('desert');
            // Budget must be re-derived from the FRESH roll, not the stale
            // weather closure (camp-reroll-stale-weather-budget bug).
            expect(tm.changePace).toHaveBeenCalledWith('fast',
                expect.objectContaining({ condition: 'clear', label: 'Clear', budgetMod: 1 }));
            // The reroll button is a manual GM weather action — it must not log travel entries.
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('POI linked-map validation and entry gating', () => {
        it('validates each unique linked map once and fires onPoiEntered only for validated links', async () => {
            mapsService.loadMapData.mockImplementation((campaign, name) =>
                name === 'missing' ? Promise.reject(new Error('Map not found')) : Promise.resolve({}));
            const onPoiEntered = vi.fn();
            const pois = [
                { id: 'poi-1', q: 10, r: 5, type: 'city', linkedMap: 'dungeon-1', visible: true },
                { id: 'poi-2', q: 20, r: 10, type: 'dungeon', linkedMap: 'dungeon-1', visible: true },
                { id: 'poi-3', q: 12, r: 6, type: 'tower', linkedMap: 'missing', visible: true },
                { id: 'poi-4', q: 3, r: 3, type: 'camp', visible: true },
            ];
            useMapLoader.mockReturnValue(makeMapLoader({ pois }));
            render(<HexMap campaignName="test" mapName="test-map" onPoiEntered={onPoiEntered} />);
            await vi.waitFor(() => {
                expect([...poiLayerProps.current.validLinkedMaps]).toEqual(['dungeon-1']);
            });
            expect(mapsService.loadMapData).toHaveBeenCalledTimes(2);
            expect(mapsService.loadMapData).toHaveBeenCalledWith('test', 'dungeon-1');
            expect(mapsService.loadMapData).toHaveBeenCalledWith('test', 'missing');
            poiLayerProps.current.onPoiEnter(pois[0]);
            expect(onPoiEntered).toHaveBeenCalledWith('dungeon-1');
            poiLayerProps.current.onPoiEnter(pois[2]); // link failed validation
            poiLayerProps.current.onPoiEnter(pois[3]); // no linked map
            expect(onPoiEntered).toHaveBeenCalledTimes(1);
        });

        it('exposes an empty valid set and performs no loads when no POI links a map', async () => {
            useMapLoader.mockReturnValue(makeMapLoader({
                pois: [{ id: 'poi-1', q: 10, r: 5, type: 'city', visible: true }],
            }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            await vi.waitFor(() => {
                expect(poiLayerProps.current.validLinkedMaps.size).toBe(0);
            });
            expect(mapsService.loadMapData).not.toHaveBeenCalled();
        });
    });

    describe('Event accept', () => {
        it('accepting a combat event with monsters generates placements and starts the encounter at the travel hex', async () => {
            const placements = [{ id: 'mon-1', name: 'goblin' }];
            const encounter = {
                generateMonsterPlacements: vi.fn(() => placements),
                handleStartEncounter: vi.fn(async () => 'Test Map - Goblin Raid at (15,8)'),
            };
            const { tm, addEntry } = renderEventAccept({
                pendingEvent: { type: 'combat', title: 'Goblin Raid', encounter: { monsters: [{ name: 'goblin', qty: 2 }] } },
                travelOverrides: { currentPosition: { q: 15, r: 8 } },
                mapOverrides: { partyPosition: { q: 15, r: 8 }, terrain: { '15,8': 'plains' } },
                encounter,
            });
            fireEvent.click(screen.getByTestId('event-accept'));
            expect(tm.acceptEvent).toHaveBeenCalledTimes(1);
            expect(encounter.generateMonsterPlacements).toHaveBeenCalledWith([{ name: 'goblin', qty: 2 }], 30);
            expect(encounter.handleStartEncounter).toHaveBeenCalledWith(15, 8, placements, 'Goblin Raid');
            // The spawned arena's readable label rides into the auto-encounter
            // audit so the log names the map the Maps list shows.
            await vi.waitFor(() => expect(autoEncounterCalls).toHaveLength(1));
            expect(autoEncounterCalls[0]).toEqual(expect.objectContaining({
                campaignName: 'test',
                battleMapName: 'Test Map - Goblin Raid at (15,8)',
            }));
            expect(autoEncounterCalls[0].event).toEqual(expect.objectContaining({ title: 'Goblin Raid' }));
            // travel/event_accept row (backlog 2026-10-27 run F): exactly one
            // row, existing fields byte-identical, PLUS battleMap carrying the
            // RESOLVED spawn label (not a hard-coded string).
            const acceptRows = addEntry.mock.calls.map(([e]) => e).filter((e) => e.action === 'event_accept');
            expect(acceptRows).toHaveLength(1);
            expect(acceptRows[0]).toEqual({
                type: 'travel', action: 'event_accept', hex: { q: 15, r: 8 }, terrain: 'plains',
                weather: null, weatherIcon: null, eventType: 'combat', eventTitle: 'Goblin Raid',
                battleMap: 'Test Map - Goblin Raid at (15,8)',
            });
        });

        it('logs exactly one label-free event_accept row when the spawn promise rejects', async () => {
            const encounter = {
                generateMonsterPlacements: vi.fn(),
                handleStartEncounter: vi.fn(async () => { throw new Error('staging exploded'); }),
            };
            const { addEntry } = renderEventAccept({
                pendingEvent: { type: 'combat', title: 'Goblin Raid', encounter: { monsters: [{ name: 'goblin', qty: 1 }] } },
                travelOverrides: { currentPosition: { q: 15, r: 8 } },
                mapOverrides: { partyPosition: { q: 15, r: 8 }, terrain: { '15,8': 'plains' } },
                encounter,
            });
            fireEvent.click(screen.getByTestId('event-accept'));
            // automation-must-log: even a rejecting spawn lane records the accept —
            // once, with no battleMap field (never a stale/wrong name).
            await vi.waitFor(() => expect(addEntry).toHaveBeenCalledTimes(1));
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action: 'event_accept', hex: { q: 15, r: 8 }, terrain: 'plains',
                weather: null, weatherIcon: null, eventType: 'combat', eventTitle: 'Goblin Raid',
            });
        });

        it.each([
            { scenario: 'starts a bare encounter when the event has no monsters', pos: { q: 15, r: 8 }, expectStart: true },
            { scenario: 'starts no encounter when there is no position', pos: null, expectStart: false },
        ])('$scenario', async ({ pos, expectStart }) => {
            const encounter = { generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() };
            const { tm, addEntry } = renderEventAccept({
                pendingEvent: { type: 'combat' },
                travelOverrides: { currentPosition: pos },
                mapOverrides: { partyPosition: pos },
                encounter,
            });
            fireEvent.click(screen.getByTestId('event-accept'));
            expect(tm.acceptEvent).toHaveBeenCalledTimes(1);
            expect(encounter.generateMonsterPlacements).not.toHaveBeenCalled();
            if (expectStart) {
                expect(encounter.handleStartEncounter).toHaveBeenCalledWith(15, 8, [], undefined);
                await vi.waitFor(() => expect(autoEncounterCalls).toHaveLength(1));
                // Spawn mock resolved with no label ⇒ audit degrades to naming-free copy.
                expect(autoEncounterCalls[0].battleMapName).toBeNull();
            } else {
                expect(encounter.handleStartEncounter).not.toHaveBeenCalled();
                await vi.waitFor(() => expect(autoEncounterCalls).toHaveLength(1));
                expect(autoEncounterCalls[0].battleMapName).toBeNull();
            }
            // No spawn label resolved ⇒ event_accept row keeps its exact
            // pre-run-F shape: battleMap absent, not null, never a stale name.
            const acceptRows = addEntry.mock.calls.map(([e]) => e).filter((e) => e.action === 'event_accept');
            expect(acceptRows).toHaveLength(1);
            expect(acceptRows[0]).not.toHaveProperty('battleMap');
        });

        it.each([
            { eventType: 'weatherChange', isTravelActive: true, expectWeatherRegen: true, expectPaceResume: true },
            { eventType: 'weatherChange', isTravelActive: false, expectWeatherRegen: true, expectPaceResume: false },
            { eventType: 'skirmish', isTravelActive: true, expectWeatherRegen: false, expectPaceResume: false },
        ])('accepting $eventType (travel active=$isTravelActive) applies side effects and logs the exact entry', async ({ eventType, isTravelActive, expectWeatherRegen, expectPaceResume }) => {
            const encounter = { generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() };
            const { tm, addEntry } = renderEventAccept({
                pendingEvent: { type: eventType, title: 'Storm Front' },
                travelOverrides: { isTravelActive, travelPace: 'fast' },
                mapOverrides: { terrain: { '10,5': 'desert' } },
                encounter,
            });
            fireEvent.click(screen.getByTestId('event-accept'));
            expect(tm.acceptEvent).toHaveBeenCalledTimes(1);
            if (expectWeatherRegen) {
                expect(generateWeather).toHaveBeenCalledWith('desert');
            } else {
                expect(generateWeather).not.toHaveBeenCalled();
            }
            if (expectPaceResume) {
                expect(tm.changePace).toHaveBeenCalledWith('fast',
                    expect.objectContaining({ condition: 'clear', label: 'Clear' }));
            } else {
                expect(tm.changePace).not.toHaveBeenCalled();
            }
            expect(encounter.handleStartEncounter).not.toHaveBeenCalled();
            // Non-combat advisory accept spawns no battle map: exactly one row,
            // shape byte-identical to pre-run-F (strict toEqual has no room for
            // a battleMap key — criterion: field absent when nothing spawns).
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action: 'event_accept', hex: { q: 10, r: 5 }, terrain: 'desert',
                weather: null, weatherIcon: null, eventType, eventTitle: 'Storm Front',
            });
        });
    });

    describe('Event skip and reroll', () => {
        it.each([
            { handler: 'skipEvent', action: 'event_skip', btnTestId: 'event-skip', eventType: 'skirmish', eventTitle: 'Goblin Ambush', weather: 'Cloudy' },
            { handler: 'rerollEvent', action: 'event_reroll', btnTestId: 'event-reroll', eventType: 'wild-magic', eventTitle: 'Wild Surge', weather: 'Fog' },
        ])('handles $handler and logs the exact travel entry', ({ handler, action, btnTestId, eventType, eventTitle, weather }) => {
            const addEntry = vi.fn();
            const tm = makeTravelMgmt({
                isTravelActive: true,
                pendingEvent: { type: eventType, title: eventTitle },
                [handler]: vi.fn(),
                currentPosition: { q: 12, r: 6 },
            });
            useTravelManagement.mockReturnValue(tm);
            useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
            useMapLoader.mockReturnValue(makeMapLoader({ partyPosition: { q: 10, r: 5 }, weather: { label: weather } }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            fireEvent.click(screen.getByTestId(btnTestId));
            expect(tm[handler]).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action, hex: { q: 12, r: 6 }, terrain: null,
                weather, weatherIcon: null, eventType, eventTitle,
            });
        });
    });

    describe('TravelPanel and EventDialog mounting', () => {
        it.each([true, false])('forwards travel state to TravelPanel only while active (isTravelActive=%s)', (isTravelActive) => {
            useTravelManagement.mockReturnValue(makeTravelMgmt({
                isTravelActive,
                horseback: true,
                forcedMarchHours: 6,
                exhaustionMultiplier: 50,
                partyHasMaxExhaustion: true,
                eventFrequency: 'frequent',
            }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            if (isTravelActive) {
                expect(screen.getByTestId('btn-advance')).toBeInTheDocument();
                expect(screen.getByTestId('btn-camp')).toBeInTheDocument();
                expect(screen.getByTestId('btn-forced-march')).toBeInTheDocument();
                expect(screen.getByTestId('btn-reroll-weather')).toBeInTheDocument();
                expect(screen.getByTestId('event-frequency')).toHaveTextContent('frequent');
                expect(screen.getByTestId('horseback')).toHaveTextContent('true');
                expect(screen.getByTestId('forced-march-hours')).toHaveTextContent('6');
                expect(screen.getByTestId('exhaustion-multiplier')).toHaveTextContent('50');
                expect(screen.getByTestId('party-max-exhaustion')).toHaveTextContent('true');
            } else {
                expect(screen.queryByTestId('btn-advance')).not.toBeInTheDocument();
                expect(screen.queryByTestId('event-frequency')).not.toBeInTheDocument();
            }
            // No pending event in either case — the dialog stays unmounted.
            expect(screen.queryByTestId('event-dialog')).not.toBeInTheDocument();
        });
    });

    describe('Weather overlay visibility', () => {
        it.each([
            { weather: { label: 'Rain', icon: 'cloud-rain' }, visible: true },
            { weather: null, visible: false },
        ])('shows the weather overlay when weather is set=%s', ({ weather, visible }) => {
            useMapLoader.mockReturnValue(makeMapLoader({ weather }));
            render(<HexMap campaignName="test" mapName="test-map" />);
            if (visible) {
                expect(screen.getByTestId('weather-overlay')).toBeInTheDocument();
            } else {
                expect(screen.queryByTestId('weather-overlay')).not.toBeInTheDocument();
            }
        });
    });
});
