// @improved-by-ai
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
        it('should render the root map div with SVG and toolbar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const mapDiv = container.querySelector('div.map');
            expect(mapDiv).toBeInTheDocument();
            expect(mapDiv.querySelector('svg.grid-svg')).toBeInTheDocument();
            expect(mapDiv.querySelector('.toolbar-row')).toBeInTheDocument();
        });

        it('should render the SVG element with grid-svg class', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('grid-svg');
        });

        it('should render the MapToolbar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const toolbarRow = container.querySelector('.toolbar-row');
            expect(toolbarRow).toBeInTheDocument();
        });

        it('should render all SVG defs', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const defs = container.querySelector('svg defs');
            expect(defs).toBeInTheDocument();
            expect(defs.children.length).toBeGreaterThan(0);
        });
    });

    describe('SVG defs rendering', () => {
        const defTests = [
            { tagName: 'BARRELSVG', id: 'barrel' },
            { tagName: 'TABLESVG', id: 'table' },
            { tagName: 'BEDSVG', id: 'bed' },
            { tagName: 'FIREPITSVG', id: 'firepit' },
            { tagName: 'DOORSVG', id: 'door' },
            { tagName: 'SECRETDOORSVG', id: 'secretDoor' },
            { tagName: 'TRAPSVG', id: 'trap' },
            { tagName: 'PILLARSVG', id: 'pillar' },
            { tagName: 'STAIRSSVG', id: 'stairs' },
            { tagName: 'ALTARSVG', id: 'altar' },
            { tagName: 'ARROWSLITWALLSVG', id: 'arrowSlitWall' },
            { tagName: 'BOOKSHELVESVG', id: 'bookshelf' },
            { tagName: 'CHAIRSVG', id: 'chair' },
            { tagName: 'CHESTSVG', id: 'chest' },
            { tagName: 'CRATESVG', id: 'crate' },
            { tagName: 'FOUNTAINSVG', id: 'fountain' },
            { tagName: 'SKELETONSVG', id: 'skeleton' },
            { tagName: 'STATUESVG', id: 'statue' },
            { tagName: 'TORCHSVG', id: 'torch' },
            { tagName: 'WEBSVG', id: 'web' },
            { tagName: 'TREESVG', id: 'tree' },
            { tagName: 'BOULDERSVG', id: 'boulder' },
            { tagName: 'BUSHSVG', id: 'bush' },
        ];

        for (const { tagName, id } of defTests) {
            it(`should render ${tagName} def with id ${id}`, async () => {
                const { container } = render(
                    <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
                );
                const defs = container.querySelector('svg defs');
                const el = Array.from(defs?.children || []).find(
                    (el) => el.tagName === tagName && el.getAttribute('id') === id
                );
                expect(el).not.toBeNull();
            });
        }
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
            expect(gridBg).toBeInTheDocument();
        });

        it('should render placed items component children', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render fog overlay', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render spell overlay renderer', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render ruler overlay', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
        });
    });

    describe('context menus when null', () => {
        it('should not render context menus when items, rooms, and players are null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('g.item-context-menu')).toBeNull();
            expect(container.querySelector('g.room-context-menu')).toBeNull();
            expect(container.querySelector('g.player-context-menu')).toBeNull();
        });
    });

    describe('selection rendering', () => {
        it('should not render selection previews when nothing is selected', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.selection-preview')).toBeNull();
            expect(container.querySelector('rect.room-draw-preview')).toBeNull();
            expect(container.querySelector('rect.selection-outline')).toBeNull();
        });
    });

    describe('room rendering', () => {
        it('should not render rooms when rooms array is empty', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelectorAll('rect.room-highlight').length).toBe(0);
            expect(container.querySelectorAll('text.room-label').length).toBe(0);
        });
    });

    describe('spell overlay rendering', () => {
        it('should not render pending overlay when spellDraft is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.pending-overlay')).toBeNull();
        });
    });

    describe('conditional component rendering', () => {
        it('should not render rename popover when renamePopover is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('monster-name-autocomplete')).toBeNull();
        });

        it('should not render ItemsPanel when itemsPanelOpen is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('items-panel')).toBeNull();
        });

        it('should not render ItemsPanel when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('items-panel')).toBeNull();
        });

        it('should not render MonsterCardModal when viewingMonster is null', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('monster-card-modal')).toBeNull();
        });
    });

    describe('SVG event handlers', () => {
        it('should render SVG with correct cursor style', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
            expect(svg.getAttribute('style')).toContain('cursor: grab');
        });

        it('should handle pointer events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const pointerEvents = ['pointerdown', 'pointermove', 'pointerup'];
            for (const eventType of pointerEvents) {
                const event = new PointerEvent(eventType, { bubbles: true });
                expect(() => svg.dispatchEvent(event)).not.toThrow();
            }
        });

        it('should handle wheel events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new WheelEvent('wheel', { bubbles: true, metaKey: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should handle click events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new MouseEvent('click', { bubbles: true, button: 0 });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });
    });

    describe('map data props', () => {
        it('should render players and grid elements on the map', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('svg.grid-svg')).toBeInTheDocument();
        });

        it('should render grid and walls on the map', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.grid-bg')).toBeInTheDocument();
        });
    });

    describe('toolbar rendering', () => {
        it('should render toolbar with buttons and back button', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const toolbar = container.querySelector('.toolbar');
            expect(toolbar).toBeInTheDocument();
            const buttons = toolbar.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(2);
        });

        it('should render back button when onBack is provided', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const backBtn = container.querySelector('.toolbar-back-btn');
            expect(backBtn).toBeInTheDocument();
        });

        it('should render grid size input when isLocalhost is true', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const gridSizeInput = container.querySelector('.grid-size-input');
            expect(gridSizeInput).toBeInTheDocument();
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
            expect(mapTitle).toBeInTheDocument();
            expect(mapTitle.textContent).toBe('test-map');
        });
    });

    describe('campaign and map name props', () => {
        it('should render with campaign name in the component', async () => {
            const { container } = render(
                <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
            );
            const mapDiv = container.querySelector('div.map');
            expect(mapDiv).toBeInTheDocument();
        });

        it('should render with map name in the toolbar', async () => {
            const { container } = render(
                <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
            );
            const mapTitle = container.querySelector('.toolbar-row h4');
            expect(mapTitle).toBeInTheDocument();
        });
    });

    describe('character prop', () => {
        it('should render characters on the map', async () => {
            const characters = [{ name: 'Thorin', imagePath: 'https://example.com/thorin.png' }];
            const { container } = render(
                <Map campaignName="test-campaign" characters={characters} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('svg.grid-svg')).toBeInTheDocument();
        });
    });

    describe('isLocalhost prop', () => {
        it('should render core map elements when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.grid-bg')).toBeInTheDocument();
            expect(container.querySelector('svg.grid-svg')).toBeInTheDocument();
        });
    });

    describe('onBack prop', () => {
        it('should call onBack when back button is clicked', async () => {
            const onBack = vi.fn();
            render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={onBack} />
            );
            const backBtn = screen.getByTitle('Back');
            fireEvent.click(backBtn);
            expect(onBack).toHaveBeenCalled();
        });
    });

    describe('SVG viewBox', () => {
        it('should render SVG with correct viewBox when zoom is 1', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const viewBox = svg.getAttribute('viewBox');
            expect(viewBox).toContain('0 0');
            expect(viewBox).toContain('1200');
        });
    });

    describe('display name', () => {
        it('should be a function component', () => {
            expect(typeof Map).toBe('function');
        });
    });
});
