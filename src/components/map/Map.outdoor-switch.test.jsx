// @maintained-by-ai
// ─── Lane: Map CONTAINER — outdoor mapName switch (#798) ─────────────────────
// OWNED here (only this deep tree can prove):
//   • outdoor → outdoor switch remounts HexMap so its real useMapLoader
//     re-runs: load fires for the NEW name with exact bytes, rendered
//     content becomes the NEW map's, and stale rows of the OLD map are gone.
//     Pre-fix (#798 red capture): Map.jsx rendered <HexMap> with no key, the
//     hook's never-reset isInitialized guard (hex-map useMapLoader :161)
//     early-returned the deps effect (:186 arm dead), and the flip produced
//     NO load call for the new name — the old map's terrain/pois stayed on
//     screen. Fix: key={mapName} on <HexMap> in Map.jsx (:351).
//   • late-resolve generation pin: a load for the OLD name resolving after
//     the flip settles into the UNMOUNTED old instance (setState no-op) —
//     it must not repaint the new map nor persist the old map's bytes.
//   • single-mount unchanged: same mapName across re-renders loads exactly
//     once and — dirty gate (backlog 2026-10-26) — flushes ZERO saves with no
//     edits (envelope exactness on real edits owned by useMapLoader.api).
//
// Cited to owners (never re-driven here):
//   outdoor dispatch props-down / mount census ..... Map.test.jsx #922 T4
//   hex loader load bytes (constant name) ........... useMapLoader.loadExisting
//   hex loader post-load setters + envelope ......... useMapLoader.api
//   late-resolve-after-unmount (hook level) ......... useMapLoader.api canary
//   SSE connection primitive .......................... subscriber #915
//
// MapsManager / App-level switching is out of this lane's frame: everything
// below drives <Map> directly, campaign is 'test-campaign'.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const H = vi.hoisted(() => ({
    loadCalls: [],       // [campaign, name] per mapsService.loadMapData call
    saveCalls: [],       // [campaign, name, data] per mapsService.saveMapData call
    toolbarMounts: [],   // mapName per HexMapToolbar MOUNT (lifecycle census)
    terrain: [],         // terrain prop per TerrainLayer render
    pois: [],          // pois prop per POILayer render
    deferA: false,       // when true, map A's load hangs until H.resolveA
    resolveA: null,
    payloadA: null,
    payloadB: null,
}));

// ── Transport seam: name-dispatching map store ──
vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    loadMapData: vi.fn((campaign, name) => {
        H.loadCalls.push([campaign, name]);
        if (name === 'vale-a.json' && H.deferA) {
            return new Promise(resolve => { H.resolveA = () => resolve(H.payloadA); });
        }
        return Promise.resolve(name === 'vale-a.json' ? H.payloadA : H.payloadB);
    }),
    saveMapData: vi.fn((campaign, name, data) => {
        H.saveCalls.push([campaign, name, data]);
        return Promise.resolve();
    }),
    createMap: vi.fn(() => Promise.resolve({ name: 'test', alreadyExists: false })),
    formatMapName: vi.fn((name) => name || ''),
}));

// ── Map.jsx subtree: inert (each is owned by its own lane) ──
vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: () => Promise.resolve([]),
}));
vi.mock('./hooks/useMapLoader.js', () => ({
    default: vi.fn(() => ({
        mapData: { type: 'outdoor', players: [], walls: new Set() },
        setMapData: vi.fn(),
        placedItems: [],
        setPlacedItems: vi.fn(),
        flushSave: vi.fn(),
    })),
}));
vi.mock('./hooks/useZoomPan.js', () => ({
    default: vi.fn(() => ({
        zoom: 1, panX: 0, panY: 0,
        zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(),
        gridCenterX: (gx) => gx * 40 + 20,
        gridCenterY: (gy) => gy * 40 + 20,
        getGridFromEvent: vi.fn(() => ({ gridX: 5, gridY: 5 })),
        panning: false,
        handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(),
        handleWheel: vi.fn(), clientToSVG: vi.fn(),
    })),
}));
vi.mock('./hooks/useWallDrawing.js', () => ({
    default: vi.fn(() => ({
        painting: false,
        handleGridPointerDown: vi.fn(), handleGridPointerMove: vi.fn(),
        handleGridPointerUp: vi.fn(), handleGridPointerLeave: vi.fn(),
    })),
}));
vi.mock('./hooks/useSelectMove.js', () => ({
    default: vi.fn(() => ({
        selectionRect: null, selectedWalls: new Set(), selectedItems: new Set(),
        moveOffset: null,
        selectedWallsRef: { current: new Set() }, selectedItemsRef: { current: new Set() },
        selectStart: { current: null }, moveStartGrid: { current: null },
        moveOffsetRef: { current: null }, selectionRectRef: { current: null },
        selectionBoundsRef: { current: null }, placedItemsRef: { current: [] },
        mapDataRef: { current: null },
        handleSelectPointerDown: vi.fn(), handleSelectPointerMove: vi.fn(),
        handleSelectPointerUp: vi.fn(),
    })),
}));
vi.mock('./hooks/useRuler.js', () => ({
    default: vi.fn(() => ({
        rulerMode: false, setRulerMode: vi.fn(),
        rulerStart: null, rulerEnd: null, rulerPreview: null,
        resetRuler: vi.fn(),
        handleRulerPointerDown: vi.fn(), handleRulerPointerMove: vi.fn(),
        handleRulerPointerUp: vi.fn(),
    })),
}));
vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: vi.fn(() => ({
        overlays: [], addOverlay: vi.fn(), updateOverlay: vi.fn(),
        updateOverlayImmediate: vi.fn(), removeOverlay: vi.fn(),
        clearOverlays: vi.fn(), handleSSEEvent: vi.fn(),
    })),
}));
vi.mock('./hooks/useSpellHandlers.js', () => ({
    default: vi.fn(() => ({
        spellDraft: null, dragOverlay: null, rotateOverlay: null,
        spellDragActiveRef: { current: false },
        handleSpellPointerDown: vi.fn(), handleSpellPointerMove: vi.fn(),
        handleSpellPointerUp: vi.fn(), handleSpellDragMove: vi.fn(),
        handleSpellDragEnd: vi.fn(),
    })),
}));
vi.mock('./hooks/usePlayerDragging.js', () => ({
    default: vi.fn(() => ({
        dragging: null,
        handlePointerDown: vi.fn(), handlePointerMove: vi.fn(), handlePointerUp: vi.fn(),
    })),
}));
vi.mock('./hooks/useItemDragging.js', () => ({
    default: vi.fn(() => ({
        itemDragging: null,
        handleItemPointerDown: vi.fn(), handleItemPointerMove: vi.fn(),
        handleItemPointerUp: vi.fn(), handleItemPointerLeave: vi.fn(),
    })),
}));
vi.mock('./hooks/useNpcImageCache.js', () => ({
    default: vi.fn(() => ({ npcImages: {}, setNpcImages: vi.fn() })),
}));
vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({ handleSSEEvent: vi.fn() })),
}));
vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => ({ fog: new Set(), visible: new Set() })),
}));
vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => ({ handleDrop: vi.fn() })),
}));
vi.mock('./Map3D/Map3D.jsx', () => ({ default: () => null }));

// ── HexMap subtree: REAL container + REAL useMapLoader (the #798 suspect) ──
// Its interaction hooks/layers are inert here (owned by hex-map lanes); only
// '../hex-map/hooks/useMapLoader.js' stays un-mocked on purpose.
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../../services/campaign/weatherService.js', () => ({
    generateWeather: vi.fn(() => ({ condition: 'clear', label: 'Clear', icon: 'sun', moveCostMod: 1, budgetMod: 1, encounterMod: 0, description: 'Clear skies' })),
}));
vi.mock('../../services/encounters/autoEncounterService.js', () => ({
    autoStartEncounterFromEvent: vi.fn(),
}));
vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: vi.fn(() => ({ logEntries: [], initialized: true, addEntry: vi.fn() })),
}));
vi.mock('../../hooks/ui/useMonstersData.js', () => ({
    useMonstersData: vi.fn(() => ({ monsters: [], loading: false, error: null })),
}));
vi.mock('../../hooks/management/useTravelManagement.js', () => ({
    default: vi.fn(() => ({
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
    })),
}));
vi.mock('../hex-map/hooks/useZoomPan.js', () => ({
    default: vi.fn(() => ({
        svgWidth: 1039, svgHeight: 519,
        zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(),
        clampPan: vi.fn((z, x, y) => ({ x, y })),
        centerView: vi.fn(() => ({ x: 0, y: 0 })),
        panning: false,
        handlePanStart: vi.fn(), handlePanMove: vi.fn(), handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
    })),
}));
vi.mock('../hex-map/hooks/useHexHover.js', () => ({
    default: vi.fn(() => ({
        hoveredHex: null, setHoveredHex: vi.fn(),
        getHexFromEvent: vi.fn(), handleHexHover: vi.fn(),
    })),
}));
vi.mock('../hex-map/hooks/useTerrainPainting.js', () => ({
    default: vi.fn(() => ({
        handleTerrainPointerDown: vi.fn(), handleTerrainPointerMove: vi.fn(),
        handleTerrainPointerUp: vi.fn(),
    })),
}));
vi.mock('../hex-map/hooks/usePoiManagement.js', () => ({
    default: vi.fn(() => ({
        selectedPoiMenu: null, setSelectedPoiMenu: vi.fn(),
        showRename: null, setShowRename: vi.fn(),
        poiDragging: null, roadStartPoiId: null, setRoadStartPoiId: vi.fn(),
        handlePoiPointerDown: vi.fn(), handlePoiPointerMove: vi.fn(),
        handlePoiPointerUp: vi.fn(),
        handlePoiContextMenu: vi.fn(), handleTogglePoiVisibility: vi.fn(),
        handleDeletePoi: vi.fn(), handleRenamePoi: vi.fn(),
        handleLinkMap: vi.fn(), handleUnlinkMap: vi.fn(), handleRemoveRoads: vi.fn(),
    })),
}));
vi.mock('../hex-map/hooks/useEncounterGeneration.js', () => ({
    default: vi.fn(() => ({ generateMonsterPlacements: vi.fn(), handleStartEncounter: vi.fn() })),
}));
vi.mock('../hex-map/hooks/useHexMapSSESync.js', () => ({
    default: vi.fn(() => ({ handleSSEEvent: vi.fn() })),
}));
vi.mock('../hex-map/hooks/useTravelToolSync.js', () => ({ default: vi.fn() }));

vi.mock('../hex-map/TerrainLayer.jsx', () => ({
    default: (props) => { H.terrain.push(props.terrain); return <g data-testid="terrain-layer" />; },
}));
vi.mock('../hex-map/POILayer.jsx', () => ({
    default: (props) => {
        H.pois.push(props.pois);
        return (
            <g data-testid="poi-layer">
                {props.pois.map(p => <text key={p.id}>{p.label}</text>)}
            </g>
        );
    },
}));
vi.mock('../hex-map/HexMapToolbar.jsx', async () => {
    const { useEffect } = await import('react');
    const HexToolbarProbe = ({ mapName, displayName }) => {
        // Mount census: pushed once per HexMapToolbar MOUNT, so an
        // outdoor→outdoor flip that does NOT remount HexMap is observable
        // (pre-fix: 'vale-b.json' renders as a prop update, never mounts).
        useEffect(() => { H.toolbarMounts.push(mapName); }, [mapName]);
        return <div data-testid="hex-toolbar"><span data-testid="hex-display-name">{displayName}</span></div>;
    };
    return { default: HexToolbarProbe };
});
vi.mock('../hex-map/HexGridLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('../hex-map/RiverLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('../hex-map/RoadLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('../hex-map/PartyMarkerLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('../hex-map/TravelPathLayer.jsx', () => ({ default: () => <g /> }));
vi.mock('../hex-map/WeatherOverlay.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/EventDialog.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/TravelPanel.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/POIPanel.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/MarchingOrderPanel.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/POIContextMenu.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/svg/CampSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/CitySVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/DungeonSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/HazardSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/LandmarkSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/LoreSiteSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/NaturalWonderSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/SettlementSVG.jsx', () => ({ default: (props) => <g {...props} /> }));
vi.mock('../hex-map/svg/TowerSVG.jsx', () => ({ default: (props) => <g {...props} /> }));

import Map from './Map.jsx';

const CAMPAIGN = 'test-campaign';
const MAP_A = 'vale-a.json';
const MAP_B = 'vale-b.json';
const CHARS = [{ name: 'Thorin' }];

// Distinct outdoor payloads: every observable byte (displayName, terrain,
// pois, weather, view) differs between A and B so staleness is detectable.
const payloadA = () => ({
    type: 'outdoor',
    displayName: 'Vale of A',
    terrain: { '1,1': 'hills' },
    rivers: [],
    roads: [],
    pois: [{ id: 'poi-a', type: 'camp', q: 1, r: 1, label: 'Watchtower A', visible: true }],
    gridSize: 12,
    zoom: 3,
    panX: 40,
    panY: 60,
    marchingOrder: ['Thorin'],
    partyPosition: { q: 7, r: 3 },
    weather: 'fog',
    travelState: {},
});
const payloadB = () => ({
    type: 'outdoor',
    displayName: 'Vale of B',
    terrain: { '9,9': 'mountain' },
    rivers: [],
    roads: [],
    pois: [{ id: 'poi-b', type: 'tower', q: 2, r: 2, label: 'Bastion B', visible: true }],
    gridSize: 12,
    zoom: 3,
    panX: 40,
    panY: 60,
    marchingOrder: ['Thorin'],
    partyPosition: { q: 7, r: 3 },
    weather: 'stormy',
    travelState: {},
});

const mapEl = (mapName) => (
    <Map
        campaignName={CAMPAIGN}
        characters={CHARS}
        isLocalhost
        mapName={mapName}
        onBack={vi.fn()}
        onEncounterCreated={vi.fn()}
        onPoiEntered={vi.fn()}
    />
);

const loadCallsFor = (name) => H.loadCalls.filter(c => c[1] === name);
const saveCallsFor = (name) => H.saveCalls.filter(c => c[1] === name);

describe('Map — outdoor mapName switch (#798)', () => {
    beforeEach(() => {
        H.loadCalls.length = 0;
        H.saveCalls.length = 0;
        H.toolbarMounts.length = 0;
        H.terrain.length = 0;
        H.pois.length = 0;
        H.deferA = false;
        H.resolveA = null;
        H.payloadA = payloadA();
        H.payloadB = payloadB();
    });

    it('A→B flip reloads: load fires for B with exact bytes and rendered content becomes B (stale A rows gone)', async () => {
        const { rerender } = render(mapEl(MAP_A));
        await waitFor(() => expect(screen.getByTestId('hex-display-name')).toHaveTextContent('Vale of A'));
        expect(loadCallsFor(MAP_A)).toEqual([[CAMPAIGN, MAP_A]]);

        // Flip the mapName prop on the still-mounted <Map> (GM map switch).
        rerender(mapEl(MAP_B));

        // The reload for B must actually fire — pre-fix this never happens
        // (dead guard) and this is the red capture of #798.
        await waitFor(() => expect(loadCallsFor(MAP_B)).toEqual([[CAMPAIGN, MAP_B]]));
        await waitFor(() => expect(screen.getByTestId('hex-display-name')).toHaveTextContent('Vale of B'));

        // Rendered content is B's, byte for byte; A's rows are gone.
        expect(screen.queryByText('Vale of A')).not.toBeInTheDocument();
        expect(screen.getByText('Bastion B')).toBeInTheDocument();
        expect(screen.queryByText('Watchtower A')).not.toBeInTheDocument();
        const lastTerrain = H.terrain[H.terrain.length - 1];
        expect(lastTerrain).toEqual(payloadB().terrain);

        // HexMapToolbar mounted once per map name (remount census): B's
        // toolbar MOUNTED, not merely re-rendered with a new prop.
        expect(H.toolbarMounts).toEqual([MAP_A, MAP_B]);

        // Save sanity (dirty gate, backlog 2026-10-26): a zero-edit A→B flip
        // persists NOTHING — no mount flush at either address, and no save
        // ever writes A's bytes into B's URL.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(saveCallsFor(MAP_B)).toHaveLength(0);
        expect(saveCallsFor(MAP_A)).toHaveLength(0);
    });

    it('late-resolving A load after the flip cannot repaint or persist B', async () => {
        H.deferA = true;
        const { rerender } = render(mapEl(MAP_A));
        expect(screen.getByText('Loading map...')).toBeInTheDocument();

        // Flip to B while A's load is still in flight; B resolves normally.
        rerender(mapEl(MAP_B));
        await waitFor(() => expect(screen.getByTestId('hex-display-name')).toHaveTextContent('Vale of B'));
        const savesAfterB = [...H.saveCalls];

        // A's straggler now resolves with A's bytes.
        await waitFor(() => expect(H.resolveA).toBeTruthy());
        await waitFor(() => { H.resolveA(); });

        // B stays B: content, terrain bytes and persisted snapshots unchanged.
        expect(screen.getByTestId('hex-display-name')).toHaveTextContent('Vale of B');
        expect(screen.queryByText('Vale of A')).not.toBeInTheDocument();
        expect(screen.getByText('Bastion B')).toBeInTheDocument();
        expect(H.terrain[H.terrain.length - 1]).toEqual(payloadB().terrain);
        expect(H.saveCalls).toEqual(savesAfterB);
        expect(saveCallsFor(MAP_A)).toHaveLength(0);
    });

    it('single-mount flow is quiet: stable mapName loads once and writes nothing without edits', async () => {
        const { rerender } = render(mapEl(MAP_A));
        await waitFor(() => expect(screen.getByTestId('hex-display-name')).toHaveTextContent('Vale of A'));

        rerender(mapEl(MAP_A));
        rerender(mapEl(MAP_A));

        // Guard/moot-key unchanged: exactly one load + one toolbar mount for A.
        expect(loadCallsFor(MAP_A)).toEqual([[CAMPAIGN, MAP_A]]);
        expect(loadCallsFor(MAP_B)).toHaveLength(0);
        expect(H.toolbarMounts).toEqual([MAP_A]);

        // Dirty gate (backlog 2026-10-26): the loaded snapshot seeds the
        // persistence baseline — re-renders of a stable, unedited map emit
        // ZERO saves (previously one mount-flush envelope save; envelope
        // exactness on real edits stays pinned in the hook api lane).
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(saveCallsFor(MAP_A)).toHaveLength(0);
    });
});
