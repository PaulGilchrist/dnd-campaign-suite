// @maintained-by-ai
// HexMap 2D ↔ 3D view-swap lane (indoor twin pinned in Map.test.jsx #924).
// Owns ONLY the swap: the toolbar's onEnter3D handler mounts the read-only
// HexMap3D with the exact structural props HexMap computes, unmounts the SVG
// console (toolbar/layers/panels included), and the exit returns it. Child
// prop forwarding, pointer routing, and travel lanes belong to
// HexMap.test.jsx / HexMap.travel.test.jsx — HexMap3D itself is stubbed
// here; its contract is HexMap3D/HexMap3D.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.pointerId = init.pointerId || 0;
            this.pointerType = init.pointerType || 'mouse';
        }
    };
}

const { childProps } = vi.hoisted(() => ({
    childProps: { toolbar: null, hex3d: null },
}));

vi.mock('./HexMapToolbar.jsx', () => ({
    default: (props) => {
        childProps.toolbar = props;
        return (
            <div data-testid="toolbar">
                {props.onEnter3D && (
                    <button data-testid="enter-3d" onClick={props.onEnter3D}>3D</button>
                )}
            </div>
        );
    },
}));

vi.mock('./HexMap3D/HexMap3D.jsx', () => ({
    default: (props) => {
        childProps.hex3d = props;
        return (
            <div data-testid="hex3d">
                <button data-testid="hex3d-exit" onClick={props.onExit}>2D</button>
            </div>
        );
    },
}));

// Inert SVG chrome — the swap lane never asserts on them.
vi.mock('./TerrainLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('./POILayer.jsx', () => ({ default: () => <g /> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: () => null }));
vi.mock('./POIPanel.jsx', () => ({ default: () => null }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => null }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: () => null }));
vi.mock('./EventDialog.jsx', () => ({ default: () => null }));
vi.mock('./TravelPanel.jsx', () => ({ default: ({ isTravelActive }) => (isTravelActive ? <div data-testid="travel-panel" /> : null) }));
vi.mock('./TravelToast.jsx', () => ({ default: ({ message }) => (message ? <div data-testid="travel-toast">{message}</div> : null) }));
// vi.mock factories are hoisted — a loop variable is out of scope there, so
// the nine inert POI icons are spelled out (HexMap.test.jsx pattern).
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
vi.mock('../../services/campaign/weatherService.js', () => ({
    generateWeather: vi.fn(() => ({ label: 'Clear', icon: 'sun' })),
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
import { GRID_COLS_MULTIPLIER } from '../../config/outdoorConfig.js';
import HexMap from './HexMap.jsx';

const terrain = { '0,0': 'forest' };
const rivers = ['2,2'];
const roads = [{ id: 'r1', hexes: ['0,0', '1,0'] }];
const pois = [{ id: 'p1', type: 'tower', q: 1, r: 1, visible: true, label: 'Watchtower' }];
const partyPosition = { q: 1, r: 1 };
const weather = { label: 'Rain', icon: 'cloud-rain' };
const travelPath = [{ q: 1, r: 1 }, { q: 2, r: 1 }];

function makeMapLoader(overrides = {}) {
    return {
        loading: false, mapData: { displayName: 'North Reach' }, setMapData: vi.fn(),
        gridSize: 30, setGridSize: vi.fn(),
        terrain, setTerrain: vi.fn(),
        rivers, setRivers: vi.fn(),
        roads, setRoads: vi.fn(),
        pois, setPois: vi.fn(),
        marchingOrder: [], setMarchingOrder: vi.fn(),
        partyPosition, setPartyPosition: vi.fn(),
        weather, setWeather: vi.fn(),
        travelInit: null, setTravelInit: vi.fn(),
        setTravelStateRef: vi.fn(),
        zoom: 2, setZoom: vi.fn(),
        panX: 0, setPanX: vi.fn(),
        panY: 0, setPanY: vi.fn(),
        needsResetViewRef: { current: false },
        ...overrides,
    };
}

function setupDefaultMocks() {
    useMapLoader.mockReturnValue(makeMapLoader());
    useZoomPan.mockReturnValue({
        svgWidth: 1039, svgHeight: 519,
        zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(),
        clampPan: vi.fn((z, x, y) => ({ x, y })),
        centerView: vi.fn(() => ({ x: 0, y: 0 })),
        panning: false,
        handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
    });
    useHexHover.mockReturnValue({
        hoveredHex: null, setHoveredHex: vi.fn(),
        getHexFromEvent: vi.fn(), handleHexHover: vi.fn(),
    });
    useTerrainPainting.mockReturnValue({
        handleTerrainPointerDown: vi.fn(),
        handleTerrainPointerMove: vi.fn(),
        handleTerrainPointerUp: vi.fn(),
    });
    usePoiManagement.mockReturnValue({
        selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(),
        showRename: null, setShowRename: vi.fn(),
        poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(),
        handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(),
        handlePoiPointerUp: vi.fn(),
        handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(),
        handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(),
        handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn(),
        pendingDelete: null, cancelDelete: vi.fn(), confirmDelete: vi.fn(),
    });
    useTravelManagement.mockReturnValue({
        travelMode: 'inactive', travelPace: 'normal',
        destination: null, path: travelPath, pathIndex: 0,
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
    });
    useEncounterGeneration.mockReturnValue({
        generateMonsterPlacements: vi.fn(),
        handleStartEncounter: vi.fn(),
    });
    useHexMapSSESync.mockReturnValue({ handleSSEEvent: vi.fn() });
    useMonstersData.mockReturnValue({ monsters: [], loading: false, error: null });
    useLog.mockReturnValue({ logEntries: [], initialized: true, addEntry: vi.fn() });
}

const mapSvg = () => document.querySelector('.hex-svg');

describe('HexMap 2D ↔ 3D swap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        childProps.toolbar = null;
        childProps.hex3d = null;
        setupDefaultMocks();
    });

    it('starts in 2D: the SVG console is mounted and HexMap3D never appears', () => {
        render(<HexMap campaignName="test" mapName="north-reach" isLocalhost />);
        expect(mapSvg()).toBeInTheDocument();
        expect(screen.queryByTestId('hex3d')).not.toBeInTheDocument();
        expect(childProps.toolbar.onEnter3D).toBeTypeOf('function');
    });

    it('entering 3D mounts HexMap3D with the exact structural props and unmounts the SVG console', () => {
        render(<HexMap campaignName="test" mapName="north-reach" isLocalhost />);
        fireEvent.click(screen.getByTestId('enter-3d'));

        expect(screen.getByTestId('hex3d')).toBeInTheDocument();
        expect(mapSvg()).not.toBeInTheDocument();
        expect(screen.queryByTestId('toolbar')).not.toBeInTheDocument();
        expect(childProps.hex3d).toMatchObject({
            displayName: 'North Reach',
            hexCols: 30 * GRID_COLS_MULTIPLIER,
            hexRows: 30,
            terrain,
            rivers,
            roads,
            pois,
            partyPosition,
            travelPath,
            travelPathIndex: 0,
            weather,
            isLocalhost: true,
        });
        expect(childProps.hex3d.onExit).toBeTypeOf('function');
    });

    it('the 3D exit returns the 2D console', () => {
        render(<HexMap campaignName="test" mapName="north-reach" isLocalhost />);
        fireEvent.click(screen.getByTestId('enter-3d'));
        fireEvent.click(screen.getByTestId('hex3d-exit'));
        expect(mapSvg()).toBeInTheDocument();
        expect(screen.queryByTestId('hex3d')).not.toBeInTheDocument();
    });

    it('keeps the arrival-toast lane mounted while the diorama is up', () => {
        const { rerender } = render(<HexMap campaignName="test" mapName="north-reach" isLocalhost />);
        fireEvent.click(screen.getByTestId('enter-3d'));
        // No toast armed → nothing rendered, but the swap never unmounts the
        // toast sibling: a later arrival message still lands.
        expect(screen.queryByTestId('travel-toast')).not.toBeInTheDocument();
        expect(screen.getByTestId('subscriber')).toBeInTheDocument();
        rerender(<HexMap campaignName="test" mapName="north-reach" isLocalhost />);
        expect(screen.getByTestId('hex3d')).toBeInTheDocument();
    });
});
