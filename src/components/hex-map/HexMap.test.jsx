import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HexMap from './HexMap.jsx';

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    loadMapData: vi.fn(() => Promise.resolve(null)),
    formatMapName: vi.fn((name) => name),
}));

vi.mock('../../services/campaign/weatherService.js', () => ({
    generateWeather: vi.fn(() => ({ label: 'Clear', icon: 'sun' })),
}));

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
    GRID_COLS_MULTIPLIER: 4,
    TOOL_NONE: 'none',
    TOOL_PAINT: 'paint',
    TOOL_ERASE: 'erase',
    TOOL_RIVER: 'river',
    TOOL_PAN: 'pan',
    TOOL_TRAVEL: 'travel',
    TOOL_ROAD: 'road',
    TERRAIN_TYPES: [{ id: 'plains', name: 'Plains' }],
    POI_TYPES: [{ id: 'camp', name: 'Camp' }],
}));

vi.mock('./TerrainLayer.jsx', () => ({ default: () => <div data-testid="terrain-layer">Terrain</div> }));
vi.mock('./HexGridLayer.jsx', () => ({ default: () => <div data-testid="hex-grid-layer">Grid</div> }));
vi.mock('./HexMapToolbar.jsx', () => ({ default: () => <div data-testid="hex-map-toolbar">Toolbar</div> }));
vi.mock('./POILayer.jsx', () => ({ default: () => <div data-testid="poi-layer">POI Layer</div> }));
vi.mock('./POIPanel.jsx', () => ({ default: () => <div data-testid="poi-panel">POI Panel</div> }));
vi.mock('./POIContextMenu.jsx', () => ({ default: () => <div data-testid="poi-context-menu">POI Context Menu</div> }));
vi.mock('./MarchingOrderPanel.jsx', () => ({ default: () => <div data-testid="marching-order-panel">Marching Order</div> }));
vi.mock('./PartyMarkerLayer.jsx', () => ({ default: () => <div data-testid="party-marker-layer">Party Marker</div> }));
vi.mock('./RiverLayer.jsx', () => ({ default: () => <div data-testid="river-layer">River Layer</div> }));
vi.mock('./RoadLayer.jsx', () => ({ default: () => <div data-testid="road-layer">Road Layer</div> }));
vi.mock('./TravelPanel.jsx', () => ({ default: () => <div data-testid="travel-panel">Travel Panel</div> }));
vi.mock('./TravelPathLayer.jsx', () => ({ default: () => <div data-testid="travel-path-layer">Travel Path</div> }));
vi.mock('./WeatherOverlay.jsx', () => ({ default: () => <div data-testid="weather-overlay">Weather</div> }));
vi.mock('./EventDialog.jsx', () => ({ default: () => <div data-testid="event-dialog">Event Dialog</div> }));

vi.mock('./svg/SettlementSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/CitySVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/DungeonSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/CampSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/TowerSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/LoreSiteSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/HazardSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/NaturalWonderSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));
vi.mock('./svg/LandmarkSVG.jsx', () => ({ default: ({ id }) => <defs><g id={id} /></g> }));

vi.mock('./hooks/useHexMapSSESync.js', () => ({
    default: vi.fn(() => ({ handleSSEEvent: vi.fn() })),
}));

vi.mock('./hooks/useTravelToolSync.js', () => ({ default: vi.fn() }));
vi.mock('./hooks/useZoomPan.js', () => ({
    default: vi.fn(() => ({
        svgWidth: 800,
        svgHeight: 400,
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetView: vi.fn(),
        clampPan: vi.fn((zoom, panX, panY) => ({ x: panX, y: panY })),
        centerView: vi.fn((zoom) => ({ x: 0, y: 0 })),
        panning: false,
        handlePanStart: vi.fn(),
        handlePanMove: vi.fn(),
        handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
    })),
}));

vi.mock('./hooks/useHexHover.js', () => ({
    default: vi.fn(() => ({
        hoveredHex: null,
        setHoveredHex: vi.fn(),
        getHexFromEvent: vi.fn(() => ({ q: 5, r: 5 })),
        handleHexHover: vi.fn(),
    })),
}));

vi.mock('./hooks/useTerrainPainting.js', () => ({
    default: vi.fn(() => ({
        handleTerrainPointerDown: vi.fn(),
        handleTerrainPointerMove: vi.fn(),
        handleTerrainPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/usePoiManagement.js', () => ({
    default: vi.fn(() => ({
        selectedPoiMenu: null,
        setSelectedPoiMenu: vi.fn(),
        showRename: null,
        setShowRename: vi.fn(),
        poiDragging: false,
        roadStartPoiId: null,
        setRoadStartPoiId: vi.fn(),
        handlePoiPointerDown: vi.fn(),
        handlePoiPointerMove: vi.fn(),
        handlePoiPointerUp: vi.fn(),
        handlePoiContextMenu: vi.fn(),
        handleTogglePoiVisibility: vi.fn(),
        handleDeletePoi: vi.fn(),
        handleRenamePoi: vi.fn(),
        handleLinkMap: vi.fn(),
        handleUnlinkMap: vi.fn(),
        handleRemoveRoads: vi.fn(),
    })),
}));

vi.mock('./hooks/useMapLoader.js', () => ({
    default: vi.fn(() => ({
        loading: false,
        setMapData: vi.fn(),
        gridSize: 10,
        setGridSize: vi.fn(),
        terrain: {},
        setTerrain: vi.fn(),
        rivers: [],
        setRivers: vi.fn(),
        roads: [],
        setRoads: vi.fn(),
        pois: [],
        setPois: vi.fn(),
        marchingOrder: [],
        setMarchingOrder: vi.fn(),
        partyPosition: null,
        setPartyPosition: vi.fn(),
        weather: null,
        setWeather: vi.fn(),
        travelInit: null,
        setTravelInit: vi.fn(),
        setTravelStateRef: vi.fn(),
        zoom: 1,
        setZoom: vi.fn(),
        panX: 0,
        setPanX: vi.fn(),
        panY: 0,
        setPanY: vi.fn(),
        needsResetViewRef: { current: false },
    })),
}));

vi.mock('../../hooks/management/useTravelManagement.js', () => ({
    default: vi.fn(() => ({
        travelMode: 'inactive',
        travelPace: 'normal',
        destination: null,
        path: [],
        pathIndex: 0,
        accruedCost: 0,
        dailyBudget: 30,
        dayExhausted: false,
        lastMessage: '',
        paceInfo: {},
        hexesRemaining: 0,
        isTravelActive: false,
        pendingEvent: null,
        currentPosition: null,
        travelState: null,
        travelInit: null,
        rerollsRemaining: 3,
        eventFrequency: 0.3,
        horseback: false,
        partyHasMaxExhaustion: false,
        forcedMarchHours: 4,
        exhaustionMultiplier: 1,
        changePace: vi.fn(),
        cancelTravel: vi.fn(),
        startPlanning: vi.fn(),
        setDestinationAndPath: vi.fn(),
        advanceOneHex: vi.fn(() => ({ moved: false })),
        forceCamp: vi.fn(),
        toggleHorseback: vi.fn(),
        setEventFrequency: vi.fn(),
        acceptEvent: vi.fn(() => null),
        skipEvent: vi.fn(),
        rerollEvent: vi.fn(),
        MODES: { INACTIVE: 'inactive' },
    })),
}));

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
    useMonstersData: vi.fn(() => ({ monsters: [] })),
}));

vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: vi.fn(() => ({ addEntry: vi.fn() })),
}));

vi.mock('../common/Subscriber.jsx', () => ({ default: ({ campaignName, handleEvent }) => <div data-testid="subscriber">Subscriber</div> }));

const mockCampaignName = 'test-campaign';
const mockMapName = 'test-map';
const mockOnBack = vi.fn();
const mockOnEncounterCreated = vi.fn();
const mockOnPoiEntered = vi.fn();

describe('HexMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders hex map container', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('hex-map-toolbar')).toBeInTheDocument();
    });

    it('renders terrain layer', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('terrain-layer')).toBeInTheDocument();
    });

    it('renders hex grid layer', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('hex-grid-layer')).toBeInTheDocument();
    });

    it('renders river layer', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('river-layer')).toBeInTheDocument();
    });

    it('renders road layer', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('road-layer')).toBeInTheDocument();
    });

    it('renders POI layer', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('poi-layer')).toBeInTheDocument();
    });

    it('renders party marker layer', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('party-marker-layer')).toBeInTheDocument();
    });

    it('renders travel path layer', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('travel-path-layer')).toBeInTheDocument();
    });

    it('renders travel panel', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('travel-panel')).toBeInTheDocument();
    });

    it('renders event dialog', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('event-dialog')).toBeInTheDocument();
    });

    it('renders weather overlay', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('weather-overlay')).toBeInTheDocument();
    });

    it('renders POI context menu', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('poi-context-menu')).toBeInTheDocument();
    });

    it('renders SVG with defs', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        const svg = document.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg.querySelector('defs')).toBeInTheDocument();
    });

    it('renders compass', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByText('N')).toBeInTheDocument();
    });

    it('renders legend', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByText('1 hex = 6 miles')).toBeInTheDocument();
    });

    it('renders loading state when map is loading', () => {
        const useMapLoader = require('./hooks/useMapLoader.js').default;
        useMapLoader.mockReturnValue({
            loading: true,
            setMapData: vi.fn(),
            gridSize: 10,
            setGridSize: vi.fn(),
            terrain: {},
            setTerrain: vi.fn(),
            rivers: [],
            setRivers: vi.fn(),
            roads: [],
            setRoads: vi.fn(),
            pois: [],
            setPois: vi.fn(),
            marchingOrder: [],
            setMarchingOrder: vi.fn(),
            partyPosition: null,
            setPartyPosition: vi.fn(),
            weather: null,
            setWeather: vi.fn(),
            travelInit: null,
            setTravelInit: vi.fn(),
            setTravelStateRef: vi.fn(),
            zoom: 1,
            setZoom: vi.fn(),
            panX: 0,
            setPanX: vi.fn(),
            panY: 0,
            setPanY: vi.fn(),
            needsResetViewRef: { current: false },
        });
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByText('Loading map...')).toBeInTheDocument();
    });

    it('renders marching order panel when marchingOpen is true', () => {
        const useMapLoader = require('./hooks/useMapLoader.js').default;
        useMapLoader.mockReturnValue({
            loading: false,
            setMapData: vi.fn(),
            gridSize: 10,
            setGridSize: vi.fn(),
            terrain: {},
            setTerrain: vi.fn(),
            rivers: [],
            setRivers: vi.fn(),
            roads: [],
            setRoads: vi.fn(),
            pois: [],
            setPois: vi.fn(),
            marchingOrder: ['Thorin', 'Elara'],
            setMarchingOrder: vi.fn(),
            partyPosition: { q: 5, r: 5 },
            setPartyPosition: vi.fn(),
            weather: null,
            setWeather: vi.fn(),
            travelInit: null,
            setTravelInit: vi.fn(),
            setTravelStateRef: vi.fn(),
            zoom: 1,
            setZoom: vi.fn(),
            panX: 0,
            setPanX: vi.fn(),
            panY: 0,
            setPanY: vi.fn(),
            needsResetViewRef: { current: false },
        });
        const usePoiManagement = require('./hooks/usePoiManagement.js').default;
        usePoiManagement.mockReturnValue({
            selectedPoiMenu: null,
            setSelectedPoiMenu: vi.fn(),
            showRename: null,
            setShowRename: vi.fn(),
            poiDragging: false,
            roadStartPoiId: null,
            setRoadStartPoiId: vi.fn(),
            handlePoiPointerDown: vi.fn(),
            handlePoiPointerMove: vi.fn(),
            handlePoiPointerUp: vi.fn(),
            handlePoiContextMenu: vi.fn(),
            handleTogglePoiVisibility: vi.fn(),
            handleDeletePoi: vi.fn(),
            handleRenamePoi: vi.fn(),
            handleLinkMap: vi.fn(),
            handleUnlinkMap: vi.fn(),
            handleRemoveRoads: vi.fn(),
        });
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} marchingOpen={true} />);
        expect(screen.getByTestId('marching-order-panel')).toBeInTheDocument();
    });

    it('renders POI panel when poiPanelOpen is true', () => {
        const useMapLoader = require('./hooks/useMapLoader.js').default;
        useMapLoader.mockReturnValue({
            loading: false,
            setMapData: vi.fn(),
            gridSize: 10,
            setGridSize: vi.fn(),
            terrain: {},
            setTerrain: vi.fn(),
            rivers: [],
            setRivers: vi.fn(),
            roads: [],
            setRoads: vi.fn(),
            pois: [],
            setPois: vi.fn(),
            marchingOrder: [],
            setMarchingOrder: vi.fn(),
            partyPosition: null,
            setPartyPosition: vi.fn(),
            weather: null,
            setWeather: vi.fn(),
            travelInit: null,
            setTravelInit: vi.fn(),
            setTravelStateRef: vi.fn(),
            zoom: 1,
            setZoom: vi.fn(),
            panX: 0,
            setPanX: vi.fn(),
            panY: 0,
            setPanY: vi.fn(),
            needsResetViewRef: { current: false },
        });
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} poiPanelOpen={true} />);
        expect(screen.getByTestId('poi-panel')).toBeInTheDocument();
    });

    it('renders SVG with cursor style based on tool', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        const svg = document.querySelector('svg');
        expect(svg).toHaveStyle('cursor');
    });

    it('renders SVG with viewBox', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('viewBox');
    });

    it('renders party markers when characters provided', () => {
        const characters = [{ name: 'Thorin', level: 5 }];
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} characters={characters} />);
        expect(screen.getByTestId('party-marker-layer')).toBeInTheDocument();
    });

    it('renders Subscriber component', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        expect(screen.getByTestId('subscriber')).toBeInTheDocument();
    });

    it('renders SVG with event handlers', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('onPointerDown');
        expect(svg).toHaveAttribute('onPointerMove');
        expect(svg).toHaveAttribute('onPointerUp');
        expect(svg).toHaveAttribute('onWheel');
        expect(svg).toHaveAttribute('onClick');
    });

    it('renders SVG with draggable=false', () => {
        render(<HexMap campaignName={mockCampaignName} mapName={mockMapName} onBack={mockOnBack} />);
        const svg = document.querySelector('svg');
        expect(svg).toHaveAttribute('draggable', 'false');
    });
});
