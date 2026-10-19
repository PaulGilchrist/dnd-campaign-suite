// @maintained-by-ai
// Lane: ItemsPanel palette contract. SVG decor leaves are wholesale-stubbed
// HERE BY DESIGN (#890-#902 cite this file) — their pixels are golden-tested
// beside each leaf; this file owns the PANEL only.
//
// Seam split:
//   palette census + per-tile drag payload ........ this file
//   panel open/close through the Map mount .......... Map-tool-handlers.test.jsx
//   drop-side handling of the payload .............. hooks/useMapDrops.test.js
//   right-click menu dispatch ........................ ItemContextMenu.test.jsx
//
// Old -> new test map:
//   visibility x3 ........................... -> 'renders nothing when closed...'
//   items rendering (outdoor only) ........ -> palette census x2 (exact ordered, both variants)
//   drag and drop x4 (spot checks) ........ -> folded into palette census (every tile's payload)
//   characters section x4 ................. -> Characters section x2
//   character image x3 .................... -> 'resolves character avatars'

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ItemsPanel from './ItemsPanel';

// Mock all SVG decor leaves — this lane never asserts into them (#870).
vi.mock('./AltarSVG.jsx', () => ({ default: () => 'AltarSVG' }));
vi.mock('./ArrowSlitWallSVG.jsx', () => ({ default: () => 'ArrowSlitWallSVG' }));
vi.mock('./BarrelSVG.jsx', () => ({ default: () => 'BarrelSVG' }));
vi.mock('./BedSVG.jsx', () => ({ default: () => 'BedSVG' }));
vi.mock('./BookshelfSVG.jsx', () => ({ default: () => 'BookshelfSVG' }));
vi.mock('./BoulderSVG.jsx', () => ({ default: () => 'BoulderSVG' }));
vi.mock('./BushSVG.jsx', () => ({ default: () => 'BushSVG' }));
vi.mock('./ChairSVG.jsx', () => ({ default: () => 'ChairSVG' }));
vi.mock('./ChestSVG.jsx', () => ({ default: () => 'ChestSVG' }));
vi.mock('./CrateSVG.jsx', () => ({ default: () => 'CrateSVG' }));
vi.mock('./DoorSVG.jsx', () => ({ default: () => 'DoorSVG' }));
vi.mock('./FirePitSVG.jsx', () => ({ default: () => 'FirePitSVG' }));
vi.mock('./FountainSVG.jsx', () => ({ default: () => 'FountainSVG' }));
vi.mock('./PillarSVG.jsx', () => ({ default: () => 'PillarSVG' }));
vi.mock('./SecretDoorSVG.jsx', () => ({ default: () => 'SecretDoorSVG' }));
vi.mock('./StairsSVG.jsx', () => ({ default: () => 'StairsSVG' }));
vi.mock('./StatueSVG.jsx', () => ({ default: () => 'StatueSVG' }));
vi.mock('./TableSVG.jsx', () => ({ default: () => 'TableSVG' }));
vi.mock('./TorchSVG.jsx', () => ({ default: () => 'TorchSVG' }));
vi.mock('./TrapSVG.jsx', () => ({ default: () => 'TrapSVG' }));
vi.mock('./TreeSVG.jsx', () => ({ default: () => 'TreeSVG' }));
vi.mock('./WebSVG.jsx', () => ({ default: () => 'WebSVG' }));

const createProps = (overrides = {}) => ({
    itemsPanelOpen: true,
    onClose: vi.fn(),
    characters: [],
    players: [],
    mapVariant: 'indoor',
    ...overrides,
});

// Ordered exactly as ItemsPanel renders them; type is the exact 'text/plain'
// payload useMapDrops turns into the placed item's type — no drift allowed.
const INDOOR_PALETTE = [
    { label: 'Altar', type: 'altar' },
    { label: 'Arrow Slit Wall', type: 'arrowSlitWall' },
    { label: 'Barrel', type: 'barrel' },
    { label: 'Bed', type: 'bed' },
    { label: 'Bookshelf', type: 'bookshelf' },
    { label: 'Chair', type: 'chair' },
    { label: 'Treasure Chest', type: 'chest' },
    { label: 'Crate', type: 'crate' },
    { label: 'Door', type: 'door' },
    { label: 'Fire Pit', type: 'firepit' },
    { label: 'Fountain', type: 'fountain' },
    { label: 'Pillar', type: 'pillar' },
    { label: 'Secret Door', type: 'secretDoor' },
    { label: 'Stairs', type: 'stairs' },
    { label: 'Statue', type: 'statue' },
    { label: 'Table', type: 'table' },
    { label: 'Torch', type: 'torch' },
    { label: 'Trap', type: 'trap' },
    { label: 'Spider Web', type: 'web' },
    { label: 'NPC', type: 'npc' },
];

const OUTDOOR_PALETTE = [
    { label: 'Barrel', type: 'barrel' },
    { label: 'Boulder', type: 'boulder' },
    { label: 'Bush', type: 'bush' },
    { label: 'Crate', type: 'crate' },
    { label: 'Fire Pit', type: 'firepit' },
    { label: 'Torch', type: 'torch' },
    { label: 'Tree', type: 'tree' },
    { label: 'NPC', type: 'npc' },
];

function assertPaletteAndPayloads(palette, props = {}) {
    const { container } = render(<ItemsPanel {...createProps(props)} />);
    const labels = [...container.querySelectorAll('.items-panel-content > .items-panel-item > span')]
        .map(span => span.textContent);
    expect(labels).toEqual(palette.map(({ label }) => label));

    palette.forEach(({ label, type }) => {
        const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() };
        fireEvent.dragStart(screen.getByText(label).closest('.items-panel-item'), { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', type);
    });
}

describe('ItemsPanel', () => {
    it('renders nothing when closed; when open its close button fires onClose once', () => {
        const onClose = vi.fn();
        const { container, unmount } = render(
            <ItemsPanel {...createProps({ onClose })} itemsPanelOpen={false} />
        );
        expect(container.innerHTML).toBe('');
        unmount();

        render(<ItemsPanel {...createProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('indoor map shows the exact ordered indoor palette, each tile dragging its exact type', () => {
        assertPaletteAndPayloads(INDOOR_PALETTE, { mapVariant: 'indoor' });
    });

    it('outdoor map shows the exact ordered outdoor palette, each tile dragging its exact type', () => {
        assertPaletteAndPayloads(OUTDOOR_PALETTE, { mapVariant: 'outdoor' });
    });

    it('shows a Characters section of non-player characters only, draggable with character: prefix', () => {
        render(<ItemsPanel {...createProps({
            characters: [{ name: 'Player1' }, { name: 'Goblin' }],
            players: [{ name: 'Player1' }],
        })} />);
        expect(screen.getByText('Characters')).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.queryByText('Player1')).not.toBeInTheDocument();

        const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() };
        fireEvent.dragStart(screen.getByText('Goblin').closest('.items-panel-item'), { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'character:Goblin');
    });

    it('hides the Characters section when nothing is draggable there', () => {
        const { unmount } = render(<ItemsPanel {...createProps({ characters: [], players: [] })} />);
        expect(screen.queryByText('Characters')).not.toBeInTheDocument();
        unmount();

        render(<ItemsPanel {...createProps({
            characters: [{ name: 'Player1' }],
            players: [{ name: 'Player1' }],
        })} />);
        expect(screen.queryByText('Characters')).not.toBeInTheDocument();
    });

    it('resolves character avatars: campaign-relative path, untouched URL, initial fallback', () => {
        const { unmount } = render(<ItemsPanel {...createProps({
            campaignName: 'my-campaign',
            characters: [
                { name: 'Goblin', imagePath: 'portraits/goblin.png' },
                { name: 'Spider', imagePath: 'https://example.com/spider.png' },
                { name: 'Therk' },
            ],
        })} />);
        expect(screen.getByRole('img', { name: 'Goblin' }))
            .toHaveAttribute('src', 'campaigns/my-campaign/portraits/goblin.png');
        expect(screen.getByRole('img', { name: 'Spider' }))
            .toHaveAttribute('src', 'https://example.com/spider.png');
        expect(screen.queryByRole('img', { name: 'Therk' })).not.toBeInTheDocument();
        expect(screen.getByText('T')).toBeInTheDocument();
        unmount();

        // without a campaignName the relative path is used verbatim
        render(<ItemsPanel {...createProps({
            characters: [{ name: 'Goblin', imagePath: 'portraits/goblin.png' }],
        })} />);
        expect(screen.getByRole('img', { name: 'Goblin' }))
            .toHaveAttribute('src', 'portraits/goblin.png');
    });
});
