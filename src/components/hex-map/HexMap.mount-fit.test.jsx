// @maintained-by-ai
// ─── Lane: board mount auto-fit decision (fitVersion law, YG backlog 2026-11-16) ─
// The full-mount seam for the ONE canonical branch: consumeMountFit fits ONLY
// when the loader-held fitVersion differs from HEX_FIT_VERSION. A stamped doc
// mounts VERBATIM (no fit computation, no stamp claim, no setter churn); a
// stamp-less or stale-stamped doc consumes exactly one whole-board fit and
// claims the stamp in the same commit (the loader side — one write carrying
// view + fitVersion, verbatim carry on later edits — is pinned in
// hooks/useMapLoader.fit-stamp.test.js).
//
// jsdom pins rect dimensions on every element via an Element.prototype spy so
// the fit never runs against fake 0×0 geometry (playbook §32/§632: the guard
// `rect.width <= 2 * HEX_FIT_INSET_PX` is what kept every legacy container
// mock inert — those mocks omit heldFitVersion/claimMountFitStamp entirely and
// stay byte-identical because the fit only ever fires behind that rect gate).
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock child components (layers/panels/toolbar inert — this file owns only
// the view-normalize layout pass decision) ──
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g data-testid="terrain-layer" /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g data-testid="hex-grid-layer" /> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g data-testid="river-layer" /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g data-testid="road-layer" /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: () => <g data-testid="party-marker" /> }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: () => <g data-testid="travel-path-layer" /> }));
vi.mock('./POILayer.jsx', () => ({ default: () => <g data-testid="poi-layer" /> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: () => null }));
vi.mock('./EventDialog.jsx', () => ({ default: () => null }));
vi.mock('./TravelPanel.jsx', () => ({ default: () => null }));
vi.mock('./POIContextMenu.jsx', () => ({ default: () => null }));
vi.mock('./POIPanel.jsx', () => ({ default: () => null }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => null }));
vi.mock('./HexMapToolbar.jsx', () => ({ default: () => <div /> }));
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
vi.mock('./hooks/useTravelToolSync.js', () => ({ default: vi.fn(() => false) }));
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
    generateWeather: vi.fn(() => null),
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
import { GRID_COLS_MULTIPLIER } from '../../config/outdoorConfig.js';
import { HEX_FIT_VERSION, fitHexView } from '../../services/maps/hexViewMath.js';

// The svg's painted box the fit must solve against (any value > 2× inset;
// matches the sibling container harnesses' svgWidth/svgHeight).
const RECT = { width: 1039, height: 519 };
const GRID_SIZE = 8;
const HEX_COLS = GRID_SIZE * GRID_COLS_MULTIPLIER;
// Stale stored view — deliberately NOT the fit output, so a fit leg is visible.
const STORED = { zoom: 3, panX: 40, panY: 60 };

function makeMapLoader(overrides = {}) {
    return {
        loading: false, setMapData: vi.fn(),
        gridSize: GRID_SIZE, setGridSize: vi.fn(),
        terrain: {}, setTerrain: vi.fn(),
        rivers: [], setRivers: vi.fn(),
        roads: [], setRoads: vi.fn(),
        pois: [], setPois: vi.fn(),
        marchingOrder: [], setMarchingOrder: vi.fn(),
        partyPosition: null, setPartyPosition: vi.fn(),
        weather: null, setWeather: vi.fn(),
        travelInit: null, setTravelInit: vi.fn(),
        setTravelStateRef: vi.fn(),
        mapData: { type: 'outdoor' },
        ...STORED,
        setZoom: vi.fn(), setPanX: vi.fn(), setPanY: vi.fn(),
        heldFitVersion: null, claimMountFitStamp: vi.fn(),
        needsResetViewRef: { current: false },
        hexMapNameRef: { current: 'mount-fit-map' },
        hexMapDisplayNameRef: { current: 'Mount Fit Map' },
        ...overrides,
    };
}

function setupMocks(loaderOverrides = {}) {
    const loader = makeMapLoader(loaderOverrides);
    useMapLoader.mockReturnValue(loader);
    useZoomPan.mockReturnValue({
        svgWidth: RECT.width, svgHeight: RECT.height,
        zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(),
        clampPan: vi.fn((z, x, y) => ({ x, y })),
        centerView: vi.fn(() => ({ x: 0, y: 0 })),
        panning: false,
        handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
    });
    useHexHover.mockReturnValue({ hoveredHex: null, setHoveredHex: vi.fn(), getHexFromEvent: vi.fn(), handleHexHover: vi.fn() });
    useTerrainPainting.mockReturnValue({ handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(), handleTerrainPointerUp: vi.fn() });
    usePoiManagement.mockReturnValue({ selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(), showRename: null, setShowRename: vi.fn(), poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(), handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(), handlePoiPointerUp: vi.fn(), handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(), handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(), handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn() });
    useEncounterGeneration.mockReturnValue({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    useTravelManagement.mockReturnValue({
        travelMode: 'inactive', travelPace: 'normal', destination: null, path: [],
        pathIndex: 0, accruedCost: 0, dailyBudget: 4, dayExhausted: false,
        lastMessage: null, pendingEvent: null, eventFrequency: 'normal',
        rerollsRemaining: 3, currentPosition: null, remainingSteps: [],
        paceInfo: { id: 'normal', name: 'Normal' }, hexesRemaining: 0, horseback: false,
        forcedMarchHours: 0, exhaustionMultiplier: 100, partyHasMaxExhaustion: false,
        isTravelActive: false, startPlanning: vi.fn(), cancelTravel: vi.fn(),
        setDestinationAndPath: vi.fn(), toggleHorseback: vi.fn(), changePace: vi.fn(),
        advanceOneHex: vi.fn(() => ({ moved: false })), forceCamp: vi.fn(), forcedMarch: vi.fn(),
        acceptEvent: vi.fn(), skipEvent: vi.fn(), rerollEvent: vi.fn(),
        setEventFrequency: vi.fn(), setTravelLog: vi.fn(), setLastMessage: vi.fn(),
    });
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry: vi.fn() });
    return { loader };
}

describe('HexMap mount auto-fit decision (fitVersion law)', () => {
    let rectSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
            // Only the board svg (data-testid="hex-svg") gets real painted
            // dimensions; every other element reads 0×0 exactly like bare jsdom.
            if (this.getAttribute && this.getAttribute('data-testid') === 'hex-svg') {
                return { ...RECT, x: 0, y: 0, top: 0, left: 0, right: RECT.width, bottom: RECT.height, toJSON: () => ({}) };
            }
            return { width: 0, height: 0, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
        });
    });

    afterEach(() => {
        rectSpy.mockRestore();
    });

    it('stamped doc (fitVersion === HEX_FIT_VERSION): stored view applied verbatim, no fit, no claim', () => {
        const { loader } = setupMocks({ heldFitVersion: HEX_FIT_VERSION });
        render(<HexMap campaignName="test" mapName="mount-fit-map" />);

        // The verbatim mount: the fitted bytes are NOT computed or pushed — the
        // loader-adopted STORED view stands untouched (zero setter calls means
        // zero envelope drift, hence zero PUTs — pinned writer-side in
        // hooks/useMapLoader.fit-stamp.test.js).
        expect(loader.claimMountFitStamp).not.toHaveBeenCalled();
        expect(loader.setZoom).not.toHaveBeenCalled();
        expect(loader.setPanX).not.toHaveBeenCalled();
        expect(loader.setPanY).not.toHaveBeenCalled();
    });

    it('stamp-less doc: exactly one whole-board fit, claimed in the same commit', () => {
        const { loader } = setupMocks({ heldFitVersion: null });
        render(<HexMap campaignName="test" mapName="mount-fit-map" />);

        const fit = fitHexView(HEX_COLS, GRID_SIZE, RECT.width, RECT.height);
        expect(loader.claimMountFitStamp).toHaveBeenCalledTimes(1);
        expect(loader.setZoom).toHaveBeenCalledWith(fit.zoom);
        expect(loader.setPanX).toHaveBeenCalledWith(fit.panX);
        expect(loader.setPanY).toHaveBeenCalledWith(fit.panY);
    });

    it('stale-stamped doc (older fitVersion): refits and restamps via the same single claim', () => {
        const { loader } = setupMocks({ heldFitVersion: 0 });
        render(<HexMap campaignName="test" mapName="mount-fit-map" />);

        const fit = fitHexView(HEX_COLS, GRID_SIZE, RECT.width, RECT.height);
        expect(loader.claimMountFitStamp).toHaveBeenCalledTimes(1);
        expect(loader.setZoom).toHaveBeenCalledWith(fit.zoom);
    });

    it('the fit is one-shot per board-open: a later pass (interaction re-render) never re-fits', () => {
        const { loader } = setupMocks({ heldFitVersion: null });
        const { rerender } = render(<HexMap campaignName="test" mapName="mount-fit-map" />);
        expect(loader.claimMountFitStamp).toHaveBeenCalledTimes(1);

        // Re-render with fresh callback identities but an unchanged loading flip:
        // the armed one-shot is spent, pan/zoom interactions must not re-fit.
        rerender(<HexMap campaignName="test" mapName="mount-fit-map" backMapTarget="maps" />);
        expect(loader.claimMountFitStamp).toHaveBeenCalledTimes(1);
    });

    it('never fits against fake (inset-swallowed) dimensions: the claim waits for real geometry', () => {
        rectSpy.mockImplementation(() => ({
            width: 60, height: 40, x: 0, y: 0, top: 0, left: 0, right: 60, bottom: 40, toJSON: () => ({}),
        }));
        const { loader } = setupMocks({ heldFitVersion: null });
        render(<HexMap campaignName="test" mapName="mount-fit-map" />);

        expect(loader.claimMountFitStamp).not.toHaveBeenCalled();
        expect(loader.setZoom).not.toHaveBeenCalled();
    });
});
