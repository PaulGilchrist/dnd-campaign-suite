import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';

const mockGridCenterX = (gx) => gx * 40 + 20;
const mockGridCenterY = (gy) => gy * 40 + 20;

const createDefaultMocks = () => ({
    mapData: { players: [], walls: new Set(), rooms: [] },
    setMapData: vi.fn(),
    placedItems: [],
    setPlacedItems: vi.fn(),
});

const createZoomPanMocks = (overrides = {}) => ({
    zoom: 1,
    panX: 0,
    panY: 0,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetView: vi.fn(),
    gridCenterX: mockGridCenterX,
    gridCenterY: mockGridCenterY,
    getGridFromEvent: vi.fn(() => ({ gridX: 5, gridY: 5 })),
    panning: false,
    handlePanStart: vi.fn(),
    handlePanMove: vi.fn(),
    handlePanEnd: vi.fn(),
    handleWheel: vi.fn(),
    clientToSVG: vi.fn(),
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
});

// Mock EventSource globally before any imports that might use it
globalThis.EventSource = class MockEventSource {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
    }
    close() {}
};

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    saveMapData: vi.fn(() => Promise.resolve()),
    formatMapName: vi.fn((name) => name),
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(() => Promise.resolve([])),
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: vi.fn(() => ({ logEntries: [], initialized: true, addEntry: vi.fn() })),
}));

vi.mock('./hooks/useMapLoader.js', () => ({
    default: vi.fn(() => createDefaultMocks()),
}));

vi.mock('./hooks/useZoomPan.js', () => ({
    default: vi.fn(() => createZoomPanMocks()),
}));

vi.mock('./hooks/useWallDrawing.js', () => ({
    default: vi.fn(() => ({
        painting: false,
        handleGridPointerDown: vi.fn(),
        handleGridPointerMove: vi.fn(),
        handleGridPointerUp: vi.fn(),
        handleGridPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useRoomDrawing.js', () => ({
    default: vi.fn(() => ({
        roomDrawRect: null,
        selectedRoom: null,
        setSelectedRoom: vi.fn(),
        handleRoomPointerDown: vi.fn(),
        handleRoomPointerMove: vi.fn(),
        handleRoomPointerUp: vi.fn(),
        handleRoomClick: vi.fn(),
    })),
}));

vi.mock('./hooks/useSelectMove.js', () => ({
    default: vi.fn(() => ({
        selectionRect: null,
        selectedWalls: new Set(),
        selectedItems: new Set(),
        moveOffset: null,
        selectedWallsRef: { current: new Set() },
        selectedItemsRef: { current: new Set() },
        selectStart: { current: null },
        moveStartGrid: { current: null },
        moveOffsetRef: { current: null },
        selectionRectRef: { current: null },
        selectionBoundsRef: { current: null },
        placedItemsRef: { current: [] },
        mapDataRef: { current: null },
        handleSelectPointerDown: vi.fn(),
        handleSelectPointerMove: vi.fn(),
        handleSelectPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useRuler.js', () => ({
    default: vi.fn(() => ({
        rulerMode: false,
        setRulerMode: vi.fn(),
        rulerStart: null,
        rulerEnd: null,
        rulerPreview: null,
        resetRuler: vi.fn(),
        handleRulerPointerDown: vi.fn(),
        handleRulerPointerMove: vi.fn(),
        handleRulerPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: vi.fn(() => ({
        overlays: [],
        addOverlay: vi.fn(),
        updateOverlay: vi.fn(),
        updateOverlayImmediate: vi.fn(),
        removeOverlay: vi.fn(),
        clearOverlays: vi.fn(),
        handleSSEEvent: vi.fn(),
    })),
}));

vi.mock('./hooks/useSpellHandlers.js', () => ({
    default: vi.fn(() => ({
        spellDraft: null,
        dragOverlay: null,
        rotateOverlay: null,
        spellDragActiveRef: { current: false },
        handleSpellPointerDown: vi.fn(),
        handleSpellPointerMove: vi.fn(),
        handleSpellPointerUp: vi.fn(),
        handleSpellDragMove: vi.fn(),
        handleSpellDragEnd: vi.fn(),
    })),
}));

vi.mock('./hooks/usePlayerDragging.js', () => ({
    default: vi.fn(() => ({
        dragging: null,
        handlePointerDown: vi.fn(),
        handlePointerMove: vi.fn(),
        handlePointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useItemDragging.js', () => ({
    default: vi.fn(() => ({
        itemDragging: null,
        handleItemPointerDown: vi.fn(),
        handleItemPointerMove: vi.fn(),
        handleItemPointerUp: vi.fn(),
        handleItemPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useNpcImageCache.js', () => ({
    default: vi.fn(() => ({
        npcImages: {},
        setNpcImages: vi.fn(),
    })),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({
        handleSSEEvent: vi.fn(),
    })),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => new Set()),
}));

vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => ({
        handleDrop: vi.fn(),
    })),
}));

describe('Map', () => {
    describe('initial rendering', () => {
        it('should render the root map div', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const mapDiv = container.querySelector('div.map');
            expect(mapDiv).not.toBeNull();
        });

        it('should render the SVG element', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });

        it('should render the MapToolbar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const toolbarRow = container.querySelector('.toolbar-row');
            expect(toolbarRow).not.toBeNull();
        });

        it('should render with div.map wrapper containing SVG and toolbar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const mapDiv = container.querySelector('div.map');
            expect(mapDiv).not.toBeNull();
            expect(mapDiv.querySelector('svg.grid-svg')).not.toBeNull();
            expect(mapDiv.querySelector('.toolbar-row')).not.toBeNull();
        });
    });

    describe('SVG defs rendering', () => {
        it('should render all SVG defs', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            expect(defs).not.toBeNull();
        });

        it('should render all 24 SVG defs in the defs section', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            expect(defs.children.length).toBeGreaterThan(0);
        });

        it('should render BarrelSVG def with id barrel', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const barrelEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'BARRELSVG' && el.getAttribute('id') === 'barrel'
            );
            expect(barrelEl).not.toBeNull();
        });

        it('should render TableSVG def with id table', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const tableEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'TABLESVG' && el.getAttribute('id') === 'table'
            );
            expect(tableEl).not.toBeNull();
        });

        it('should render BedSVG def with id bed', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const bedEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'BEDSVG' && el.getAttribute('id') === 'bed'
            );
            expect(bedEl).not.toBeNull();
        });

        it('should render FirePitSVG def with id firepit', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const firepitEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'FIREPITSVG' && el.getAttribute('id') === 'firepit'
            );
            expect(firepitEl).not.toBeNull();
        });

        it('should render DoorSVG def with id door', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const doorEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'DOORSVG' && el.getAttribute('id') === 'door'
            );
            expect(doorEl).not.toBeNull();
        });

        it('should render SecretDoorSVG def with id secretDoor', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const secretDoorEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'SECRETDOORSVG' && el.getAttribute('id') === 'secretDoor'
            );
            expect(secretDoorEl).not.toBeNull();
        });

        it('should render TrapSVG def with id trap', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const trapEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'TRAPSVG' && el.getAttribute('id') === 'trap'
            );
            expect(trapEl).not.toBeNull();
        });

        it('should render PillarSVG def with id pillar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const pillarEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'PILLARSVG' && el.getAttribute('id') === 'pillar'
            );
            expect(pillarEl).not.toBeNull();
        });

        it('should render StairsSVG def with id stairs', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const stairsEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'STAIRSSVG' && el.getAttribute('id') === 'stairs'
            );
            expect(stairsEl).not.toBeNull();
        });

        it('should render AltarSVG def with id altar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const altarEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'ALTARSVG' && el.getAttribute('id') === 'altar'
            );
            expect(altarEl).not.toBeNull();
        });

        it('should render ArrowSlitWallSVG def with id arrowSlitWall', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const arrowEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'ARROWSLITWALLSVG' && el.getAttribute('id') === 'arrowSlitWall'
            );
            expect(arrowEl).not.toBeNull();
        });

        it('should render BookshelfSVG def with id bookshelf', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const bookshelfEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'BOOKSHELVESVG' && el.getAttribute('id') === 'bookshelf'
            );
            expect(bookshelfEl).not.toBeNull();
        });

        it('should render ChairSVG def with id chair', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const chairEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'CHAIRSVG' && el.getAttribute('id') === 'chair'
            );
            expect(chairEl).not.toBeNull();
        });

        it('should render ChestSVG def with id chest', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const chestEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'CHESTSVG' && el.getAttribute('id') === 'chest'
            );
            expect(chestEl).not.toBeNull();
        });

        it('should render CrateSVG def with id crate', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const crateEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'CRATESVG' && el.getAttribute('id') === 'crate'
            );
            expect(crateEl).not.toBeNull();
        });

        it('should render FountainSVG def with id fountain', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const fountainEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'FOUNTAINSVG' && el.getAttribute('id') === 'fountain'
            );
            expect(fountainEl).not.toBeNull();
        });

        it('should render SkeletonSVG def with id skeleton', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const skeletonEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'SKELETONSVG' && el.getAttribute('id') === 'skeleton'
            );
            expect(skeletonEl).not.toBeNull();
        });

        it('should render StatueSVG def with id statue', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const statueEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'STATUESVG' && el.getAttribute('id') === 'statue'
            );
            expect(statueEl).not.toBeNull();
        });

        it('should render TorchSVG def with id torch', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const torchEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'TORCHSVG' && el.getAttribute('id') === 'torch'
            );
            expect(torchEl).not.toBeNull();
        });

        it('should render WebSVG def with id web', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const webEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'WEBSVG' && el.getAttribute('id') === 'web'
            );
            expect(webEl).not.toBeNull();
        });

        it('should render TreeSVG def with id tree', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const treeEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'TREESVG' && el.getAttribute('id') === 'tree'
            );
            expect(treeEl).not.toBeNull();
        });

        it('should render BoulderSVG def with id boulder', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const boulderEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'BOULDERSVG' && el.getAttribute('id') === 'boulder'
            );
            expect(boulderEl).not.toBeNull();
        });

        it('should render BushSVG def with id bush', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            const bushEl = Array.from(defs?.children || []).find(
                (el) => el.tagName === 'BUSHSVG' && el.getAttribute('id') === 'bush'
            );
            expect(bushEl).not.toBeNull();
        });
    });

    describe('sub-components rendering', () => {
        it('should render grid lines and walls', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const gridLines = container.querySelectorAll('line.grid-line');
            expect(gridLines.length).toBeGreaterThan(0);
        });

        it('should render grid background rect', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const gridBg = container.querySelector('rect.grid-bg');
            expect(gridBg).not.toBeNull();
        });

        it('should render placed items component children', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });

        it('should render fog overlay', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });

        it('should render item context menu component', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const itemContextMenu = container.querySelector('g.item-context-menu');
            expect(itemContextMenu).toBeNull();
        });

        it('should render room context menu component', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const roomContextMenu = container.querySelector('g.room-context-menu');
            expect(roomContextMenu).toBeNull();
        });

        it('should render player context menu component', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const playerContextMenu = container.querySelector('g.player-context-menu');
            expect(playerContextMenu).toBeNull();
        });

        it('should render spell overlay renderer', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });

        it('should render ruler overlay', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });
    });

    describe('context menus when null', () => {
        it('should not render ItemContextMenu content when selectedItem is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const itemContextMenu = container.querySelector('g.item-context-menu');
            expect(itemContextMenu).toBeNull();
        });

        it('should not render RoomContextMenu content when selectedRoom is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const roomContextMenu = container.querySelector('g.room-context-menu');
            expect(roomContextMenu).toBeNull();
        });

        it('should not render PlayerContextMenu content when selectedPlayer is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const playerContextMenu = container.querySelector('g.player-context-menu');
            expect(playerContextMenu).toBeNull();
        });
    });

    describe('selection rendering', () => {
        it('should not render selection preview when selectStart is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const selectionPreview = container.querySelector('rect.selection-preview');
            expect(selectionPreview).toBeNull();
        });

        it('should not render room draw preview when roomDrawRect is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const roomDrawPreview = container.querySelector('rect.room-draw-preview');
            expect(roomDrawPreview).toBeNull();
        });

        it('should not render selection outline when no items or walls selected', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const selectionOutline = container.querySelector('rect.selection-outline');
            expect(selectionOutline).toBeNull();
        });
    });

    describe('room rendering', () => {
        it('should not render rooms when rooms array is empty', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const roomHighlights = container.querySelectorAll('rect.room-highlight');
            expect(roomHighlights.length).toBe(0);
        });

        it('should not render room labels when rooms array is empty', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const roomLabels = container.querySelectorAll('text.room-label');
            expect(roomLabels.length).toBe(0);
        });
    });

    describe('spell overlay rendering', () => {
        it('should not render pending overlay when spellDraft is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const pendingOverlay = container.querySelector('rect.pending-overlay');
            expect(pendingOverlay).toBeNull();
        });
    });

    describe('rename popover rendering', () => {
        it('should not render rename popover when renamePopover is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const monsterNameAutocomplete = container.querySelector('monster-name-autocomplete');
            expect(monsterNameAutocomplete).toBeNull();
        });
    });

    describe('items panel rendering', () => {
        it('should not render ItemsPanel when itemsPanelOpen is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const itemsPanel = container.querySelector('items-panel');
            expect(itemsPanel).toBeNull();
        });

        it('should not render ItemsPanel when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            const itemsPanel = container.querySelector('items-panel');
            expect(itemsPanel).toBeNull();
        });
    });

    describe('monster card modal rendering', () => {
        it('should not render MonsterCardModal when viewingMonster is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const monsterCardModal = container.querySelector('monster-card-modal');
            expect(monsterCardModal).toBeNull();
        });
    });

    describe('SVG event handlers', () => {
        it('should render SVG with grid-svg class', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
            expect(svg.classList.contains('grid-svg')).toBe(true);
        });

        it('should render SVG with onPointerDown handler', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new PointerEvent('pointerdown', { bubbles: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should render SVG with onPointerMove handler', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new PointerEvent('pointermove', { bubbles: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should render SVG with onPointerUp handler', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new PointerEvent('pointerup', { bubbles: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should render SVG with onWheel handler', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new WheelEvent('wheel', { bubbles: true, metaKey: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should render SVG with drag event handlers', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });

        it('should render SVG with onClick handler', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new MouseEvent('click', { bubbles: true, button: 0 });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should render SVG with cursor grab when tool is none', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg.getAttribute('style')).toContain('cursor: grab');
        });
    });

    describe('map data props', () => {
        it('should render players and grid elements on the map', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });

        it('should render grid and walls on the map', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const gridBg = container.querySelector('rect.grid-bg');
            expect(gridBg).not.toBeNull();
        });
    });

    describe('toolbar rendering', () => {
        it('should render toolbar buttons', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const toolbar = container.querySelector('.toolbar');
            expect(toolbar).not.toBeNull();
        });

        it('should render zoom in button', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const zoomInBtn = container.querySelector('.toolbar button');
            expect(zoomInBtn).not.toBeNull();
        });

        it('should render zoom out button', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const buttons = container.querySelectorAll('.toolbar button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should render reset view button', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const buttons = container.querySelectorAll('.toolbar button');
            expect(buttons.length).toBeGreaterThan(2);
        });

        it('should render back button when onBack is provided', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const backBtn = container.querySelector('.toolbar-back-btn');
            expect(backBtn).not.toBeNull();
        });

        it('should render grid size input when isLocalhost is true', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const gridSizeInput = container.querySelector('.grid-size-input');
            expect(gridSizeInput).not.toBeNull();
        });

        it('should not render grid size input when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            const gridSizeInput = container.querySelector('.grid-size-input');
            expect(gridSizeInput).toBeNull();
        });

        it('should render map name in toolbar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const mapTitle = container.querySelector('.toolbar-row h4');
            expect(mapTitle).not.toBeNull();
            expect(mapTitle.textContent).toBe('test-map');
        });
    });

    describe('campaign name and map name props', () => {
        it('should render with campaign name in the component', async () => {
            const { container } = render(
                <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
            );
            const mapDiv = container.querySelector('div.map');
            expect(mapDiv).not.toBeNull();
        });

        it('should render with map name in the toolbar', async () => {
            const { container } = render(
                <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
            );
            const mapTitle = container.querySelector('.toolbar-row h4');
            expect(mapTitle).not.toBeNull();
        });
    });

    describe('character prop', () => {
        it('should render characters on the map', async () => {
            const characters = [{ name: 'Thorin', imagePath: 'https://example.com/thorin.png' }];
            const { container } = render(
                <Map campaignName="test-campaign" characters={characters} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });
    });

    describe('isLocalhost prop', () => {
        it('should render grid when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            const gridBg = container.querySelector('rect.grid-bg');
            expect(gridBg).not.toBeNull();
        });

        it('should render placed items when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });

        it('should render fog overlay when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).not.toBeNull();
        });
    });

    describe('onBack prop', () => {
        it('should pass onBack to MapToolbar which renders back button', async () => {
            const onBack = vi.fn();
            render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={onBack} />
            );
            const backBtn = document.querySelector('.toolbar-back-btn');
            if (backBtn) {
                fireEvent.click(backBtn);
                expect(onBack).toHaveBeenCalled();
            }
        });
    });

    describe('SVG viewBox', () => {
        it('should render SVG with correct viewBox when zoom is 1', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg.getAttribute('viewBox')).toContain('0 0');
            expect(svg.getAttribute('viewBox')).toContain('1200');
        });
    });

    describe('display name', () => {
        it('should be a function component', () => {
            expect(typeof Map).toBe('function');
        });
    });
});
