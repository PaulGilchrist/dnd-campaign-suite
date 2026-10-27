// @maintained-by-ai
// Backlog 2026-10-27-G — travel-toggle desync on file-trip adoption. Opening a
// map whose FILE carries a live trip (adoption lane: resumedTripRef true) mounts
// the TravelPanel while the toolbar toggle used to stay inactive /
// aria-pressed=false. Contract pinned end-to-end with the REAL HexMapToolbar
// and the REAL useTravelToolSync (the hook's branches are unit-owned by
// hooks/useTravelToolSync.test.js; here we prove the container wires them so
// `tool === TOOL_TRAVEL` is the SINGLE source of truth for .active/aria-pressed):
//   1. adopted live trip ⇒ panel mounted AND toolbar button .active +
//      aria-pressed="true" (mirror lands on the post-adoption passes, exactly
//      like the real async lane: the mount pass is guarded, the adoption echo
//      churns re-run the sync effect);
//   2. Cancel (mode → inactive) ⇒ the force-off branch clears the auto-press —
//      toggle back to inactive / aria-pressed="false", no stale pressed state;
//   3. manual lane unchanged: press arms (active + pressed), re-press clears
//      (18f43185c — no regression).
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

// ── Mock child components — inert EXCEPT the REAL HexMapToolbar (left
// unmocked: its travel button's .active + aria-pressed IS the assertion) and a
// TravelPanel stub mirroring the real panel's self-gating + Cancel surface.
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./POILayer.jsx', () => ({ default: () => <g data-testid="poi-layer" /> }));
vi.mock('./POIPanel.jsx', () => ({ default: () => <div data-testid="poi-panel" /> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: () => <g data-testid="poi-context-menu" /> }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => <div data-testid="marching-panel" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: () => <g data-testid="party-marker" /> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: () => <g data-testid="travel-path-layer" /> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: () => <div data-testid="weather-overlay" /> }));
vi.mock('./EventDialog.jsx', () => ({ default: () => <div data-testid="event-dialog" /> }));
vi.mock('./TravelPanel.jsx', () => ({
    default: ({ isTravelActive, onCancel }) =>
        isTravelActive
            ? <div data-testid="travel-panel"><button data-testid="btn-cancel" onClick={onCancel}>Cancel</button></div>
            : null,
}));
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
// useTravelToolSync is deliberately NOT mocked — the mirror branch under test.
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

// Persisted (map-file) weather — keeps every lane clear of the auto-roll seam
// (owned by HexMap.weather-mount.test.jsx) so zero generateWeather noise.
const WEATHER = { condition: 'cloudy', label: 'Cloudy', icon: 'cloud', moveCostMod: 1, budgetMod: 1, encounterMod: 0, description: 'Overcast' };
const PARTY = { q: 15, r: 8 };

function makeMapLoader(overrides = {}) {
    return {
        loading: false, setMapData: vi.fn(), mapData: null,
        gridSize: 30, setGridSize: vi.fn(),
        terrain: {}, setTerrain: vi.fn(),
        rivers: [], setRivers: vi.fn(),
        roads: [], setRoads: vi.fn(),
        pois: [], setPois: vi.fn(),
        marchingOrder: [], setMarchingOrder: vi.fn(),
        partyPosition: PARTY, setPartyPosition: vi.fn(),
        weather: WEATHER, setWeather: vi.fn(),
        travelInit: null, setTravelInit: vi.fn(),
        setTravelStateRef: vi.fn(),
        // Set by the real loader's load path ONLY when the map FILE carries a
        // live trip — the adoption flag HexMap threads into the sync hook.
        resumedTripRef: { current: false },
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

const TRAVEL_TOGGLE = () => screen.getByRole('button', {
    name: 'Travel mode — plan and execute overland travel',
});

/** Fresh every-prop-churn stubs (mirrors a post-load/SSE re-render). */
function setup(loaderOverrides = {}, tmOverrides = {}) {
    const loader = makeMapLoader(loaderOverrides);
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

/** Adoption state as the loader + hook leave it post-load: file carried a live
 *  trip, travel is live, and the GM never touched the toolbar. */
const ADOPTED_OVERRIDES = {
    loader: { resumedTripRef: { current: true }, travelInit: { travelMode: 'traveling' } },
    tm: { isTravelActive: true, travelMode: 'traveling', path: [{ q: 15, r: 8 }, { q: 12, r: 8 }], pathIndex: 0, destination: { q: 12, r: 8 } },
};

describe('HexMap travel-toggle sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('file-trip adoption mounts the panel AND presses the toolbar toggle', () => {
        setup(ADOPTED_OVERRIDES.loader, ADOPTED_OVERRIDES.tm);
        const { tm } = setup(ADOPTED_OVERRIDES.loader, ADOPTED_OVERRIDES.tm);
        const { rerender } = render(<HexMap campaignName="test" mapName="test-map" />);

        // Post-adoption churn pass (per-value SSE echoes keep re-churning the
        // adopted trip in the real lane): fresh prop identities re-run the
        // sync effect — the mirror branch must press the toggle.
        setup(ADOPTED_OVERRIDES.loader, ADOPTED_OVERRIDES.tm);
        rerender(<HexMap campaignName="test" mapName="test-map" />);

        // Panel auto-mounted AND the toggle mirrors it (AC1).
        expect(screen.getByTestId('travel-panel')).toBeInTheDocument();
        const toggle = TRAVEL_TOGGLE();
        expect(toggle).toHaveClass('active');
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        // The mirror is a pure press — never a re-plan, never a cancel.
        expect(tm.startPlanning).not.toHaveBeenCalled();
        expect(tm.cancelTravel).not.toHaveBeenCalled();
    });

    it('Cancel from the adopted state unmounts the panel AND unpresses the toggle', () => {
        setup(ADOPTED_OVERRIDES.loader, ADOPTED_OVERRIDES.tm);
        const { rerender } = render(<HexMap campaignName="test" mapName="test-map" />);
        const { tm } = setup(ADOPTED_OVERRIDES.loader, ADOPTED_OVERRIDES.tm);
        rerender(<HexMap campaignName="test" mapName="test-map" />);
        expect(TRAVEL_TOGGLE()).toHaveAttribute('aria-pressed', 'true');

        // Panel Cancel → cancelTravel; the echo lands mode=inactive (the real
        // synced lane writes mode + unmount together).
        fireEvent.click(screen.getByTestId('btn-cancel'));
        expect(tm.cancelTravel).toHaveBeenCalledTimes(1);
        setup(ADOPTED_OVERRIDES.loader, { isTravelActive: false, travelMode: 'inactive' });
        rerender(<HexMap campaignName="test" mapName="test-map" />);

        // Panel gone AND toggle inert in the settled commit (AC2) — the
        // force-off branch cleared the auto-press with no stale pressed state.
        expect(screen.queryByTestId('travel-panel')).not.toBeInTheDocument();
        const toggle = TRAVEL_TOGGLE();
        expect(toggle).not.toHaveClass('active');
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('manual lane unchanged: press arms active + pressed, re-press clears both', () => {
        // No file trip (resumedTripRef false): the classic 18f43185c toggle,
        // driven by HexMap's real `tool` state through the real toolbar.
        const { tm } = setup();
        render(<HexMap campaignName="test" mapName="test-map" />);

        const toggle = TRAVEL_TOGGLE();
        expect(toggle).not.toHaveClass('active');
        expect(toggle).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(toggle);
        expect(TRAVEL_TOGGLE()).toHaveClass('active');
        expect(TRAVEL_TOGGLE()).toHaveAttribute('aria-pressed', 'true');
        expect(tm.startPlanning).toHaveBeenCalledTimes(1);

        // Re-press: the toolbar's own toggle sends the tool back to NONE and
        // the button unpresses — with an idle trip nothing else fires.
        fireEvent.click(TRAVEL_TOGGLE());
        expect(TRAVEL_TOGGLE()).not.toHaveClass('active');
        expect(TRAVEL_TOGGLE()).toHaveAttribute('aria-pressed', 'false');
        expect(tm.cancelTravel).not.toHaveBeenCalled();
    });
});
