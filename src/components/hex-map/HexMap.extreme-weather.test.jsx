// @maintained-by-ai
/*
 * HexMap — extreme-weather audit row + stale-prompt clear (bug 2026-10-27-G).
 *
 * Live defects:
 * 1. the travel/extreme_weather log row carried hex:null/terrain:null even
 *    though the party stands on a hex — the row that SPECIFICALLY logs the
 *    blocked state lost its location context;
 * 2. after a manual .travel-weather-reroll unblocked travel (budget re-
 *    derived, advance live) the panel header STILL read "Extreme … makes
 *    travel impossible. Camp and wait it out." — nothing cleared the prompt
 *    until some other message write happened.
 *
 * Pinned contract:
 * - blocked advance logs extreme_weather with the party's current hex +
 *   terrain (unknown in-bounds hex plays as 'plains', mirroring the engine);
 *   the row stays null-honest only when there is genuinely no party position;
 * - a manual re-roll whose PREVIOUS weather blocked travel and whose NEW roll
 *   travels again clears lastMessage (and re-derives pace/budget as before);
 * - re-rolls that do not lift a block (still extreme) or never had one
 *   (clear→clear, no prior weather) leave lastMessage untouched.
 *
 * Lane map: advance/day_exhausted log bytes by HexMap.travel.test.jsx; camp +
 * reroll dispatch basics by HexMap.additional.test.jsx; prompt copy by
 * useTravelManagement.extreme-weather-copy.test.jsx; panel affordance by
 * TravelPanel.extreme-weather-camp.test.jsx.
 */
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

// ── Mock child components (travel-test rig); the panel mock exposes ONLY the
// weather re-roll affordance this lane clicks.
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
vi.mock('./EventDialog.jsx', () => ({ default: () => <div data-testid="event-dialog" /> }));
vi.mock('./TravelPanel.jsx', () => ({
    default: ({ isTravelActive, onAdvance, onReRollWeather }) =>
        <div data-testid="travel-panel">
            {isTravelActive && <button data-testid="btn-advance" onClick={onAdvance}>Advance</button>}
            {/* Re-roll ungated in the mock: HexMap's own isTravelActive guard
                inside handleReRollWeather is what the inactive test pins. */}
            <button data-testid="btn-reroll" onClick={onReRollWeather}>Re-roll</button>
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
vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    loadMapData: vi.fn(() => Promise.resolve(null)),
    formatMapName: vi.fn((name) => name || ''),
}));
// Default NEW roll travels (Clear, moveCostMod 1); individual tests retarget
// it to prove the still-blocked lane leaves the prompt alone.
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
import { generateWeather } from '../../services/campaign/weatherService.js';
import HexMap from './HexMap.jsx';

const PARTY = { q: 15, r: 8 };

// weatherService.js production "extreme" row (label/icon verbatim).
const EXTREME = { condition: 'extreme', label: 'Extreme', icon: 'triangle-exclamation', visibility: 0, moveCostMod: null, budgetMod: 0, encounterMod: 30 };

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

function makeTravelMgmt(overrides = {}) {
    return {
        travelMode: 'planning', travelPace: 'normal',
        destination: null, path: [], pathIndex: 0,
        accruedCost: 0, dailyBudget: 0, dayExhausted: false,
        lastMessage: null, pendingEvent: null,
        eventFrequency: 'normal', rerollsRemaining: 3,
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

function setupDefaultMocks() {
    useZoomPan.mockReturnValue({ svgWidth: 1039, svgHeight: 519, zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(), clampPan: vi.fn((z, x, y) => ({ x, y })), centerView: vi.fn(() => ({ x: 0, y: 0 })), panning: false, handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(), handleWheel: vi.fn() });
    useHexHover.mockReturnValue({ hoveredHex: null, setHoveredHex: vi.fn(), getHexFromEvent: vi.fn(), handleHexHover: vi.fn() });
    useTerrainPainting.mockReturnValue({ handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(), handleTerrainPointerUp: vi.fn() });
    usePoiManagement.mockReturnValue({ selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(), showRename: null, setShowRename: vi.fn(), poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(), handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(), handlePoiPointerUp: vi.fn(), handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(), handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(), handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn(), handlePOIDrop: vi.fn() });
    useEncounterGeneration.mockReturnValue({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
}

/** Renders with an active travel session. Returns `{ tm, addEntry }`. */
function renderActive({ tmOverrides = {}, mapOverrides = {} } = {}) {
    const tm = makeTravelMgmt(tmOverrides);
    useTravelManagement.mockReturnValue(tm);
    useMapLoader.mockReturnValue(makeMapLoader(mapOverrides));
    const addEntry = vi.fn();
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry });
    render(<HexMap campaignName="test" mapName="test-map" />);
    return { tm, addEntry };
}

describe('HexMap — extreme-weather audit row + stale-prompt clear', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultMocks();
    });

    describe('extreme_weather log row', () => {
        it('carries the party hex and its terrain when the blocked advance rejects', () => {
            const { addEntry } = renderActive({
                mapOverrides: { partyPosition: PARTY, terrain: { '15,8': 'mountains' }, weather: EXTREME },
            });
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry).toHaveBeenCalledWith({
                type: 'travel', action: 'extreme_weather',
                hex: { q: 15, r: 8 }, terrain: 'mountains',
                weather: 'Extreme', weatherIcon: 'triangle-exclamation',
                eventType: null, eventTitle: null,
            });
        });

        it('plays an unknown in-bounds hex as plains (engine fallback, API-created maps)', () => {
            const { addEntry } = renderActive({
                mapOverrides: { partyPosition: PARTY, terrain: {}, weather: EXTREME },
            });
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry).toHaveBeenCalledWith(expect.objectContaining({
                action: 'extreme_weather', hex: PARTY, terrain: 'plains',
            }));
        });

        it('stays null-honest when there is genuinely no party position', () => {
            const { addEntry } = renderActive({
                mapOverrides: { partyPosition: null, weather: EXTREME },
            });
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry).toHaveBeenCalledWith(expect.objectContaining({
                action: 'extreme_weather', hex: null, terrain: null,
            }));
        });

        it('prefers the hook currentPosition over the raw party position', () => {
            const { addEntry } = renderActive({
                tmOverrides: { currentPosition: { q: 12, r: 6 } },
                mapOverrides: { partyPosition: PARTY, terrain: { '12,6': 'forest' }, weather: EXTREME },
            });
            fireEvent.click(screen.getByTestId('btn-advance'));
            expect(addEntry).toHaveBeenCalledWith(expect.objectContaining({
                action: 'extreme_weather', hex: { q: 12, r: 6 }, terrain: 'forest',
            }));
        });
    });

    describe('manual weather re-roll clears the stale prompt', () => {
        it('clears lastMessage when a blocking roll re-rolls into travel-able weather', () => {
            const { tm } = renderActive({
                mapOverrides: { partyPosition: PARTY, weather: EXTREME },
            });
            fireEvent.click(screen.getByTestId('btn-reroll'));
            // Pace/budget re-derivation from the NEW roll is unchanged (ff52b0907).
            expect(tm.changePace).toHaveBeenCalledWith('normal', expect.objectContaining({ condition: 'clear' }));
            expect(tm.setLastMessage).toHaveBeenCalledTimes(1);
            expect(tm.setLastMessage).toHaveBeenCalledWith(null);
        });

        it('leaves the prompt alone when the re-roll is STILL blocking', () => {
            generateWeather.mockReturnValueOnce(EXTREME);
            const { tm } = renderActive({
                mapOverrides: { partyPosition: PARTY, weather: EXTREME },
            });
            fireEvent.click(screen.getByTestId('btn-reroll'));
            expect(tm.changePace).toHaveBeenCalledTimes(1);
            expect(tm.setLastMessage).not.toHaveBeenCalled();
        });

        it('leaves the prompt alone for a non-blocking re-roll (no block was lifted)', () => {
            const { tm } = renderActive({
                mapOverrides: {
                    partyPosition: PARTY,
                    weather: { condition: 'rain', label: 'Rain', icon: 'cloud-rain', moveCostMod: 1.25, budgetMod: 1 },
                },
            });
            fireEvent.click(screen.getByTestId('btn-reroll'));
            expect(tm.changePace).toHaveBeenCalledTimes(1);
            expect(tm.setLastMessage).not.toHaveBeenCalled();
        });

        it('writes nothing while travel is inactive even off a blocking roll', () => {
            const { tm } = renderActive({
                tmOverrides: { isTravelActive: false },
                mapOverrides: { partyPosition: PARTY, weather: EXTREME },
            });
            fireEvent.click(screen.getByTestId('btn-reroll'));
            expect(tm.changePace).not.toHaveBeenCalled();
            expect(tm.setLastMessage).not.toHaveBeenCalled();
        });
    });
});
