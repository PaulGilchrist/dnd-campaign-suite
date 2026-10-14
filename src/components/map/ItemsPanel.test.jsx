import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ItemsPanel from './ItemsPanel';

// Mock all SVG imports
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

describe('ItemsPanel', () => {
    describe('visibility', () => {
        it('returns null when itemsPanelOpen is false', () => {
            const { container } = render(<ItemsPanel {...createProps()} itemsPanelOpen={false} />);
            expect(container.innerHTML).toBe('');
        });

        it('renders close button when open', () => {
            render(<ItemsPanel {...createProps()} />);
            expect(screen.getByRole('button')).toBeInTheDocument();
        });

        it('calls onClose once when close button is clicked', () => {
            const onClose = vi.fn();
            render(<ItemsPanel {...createProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button'));
            expect(onClose).toHaveBeenCalledOnce();
        });
    });

    describe('items rendering', () => {
        it('renders outdoor items and excludes indoor-only items', () => {
            render(<ItemsPanel {...createProps({ mapVariant: 'outdoor' })} />);
            const outdoorLabels = ['Barrel', 'Boulder', 'Bush', 'Crate', 'Fire Pit', 'Torch', 'Tree'];
            outdoorLabels.forEach(label => {
                expect(screen.getByText(label)).toBeInTheDocument();
            });
            const indoorOnlyLabels = ['Altar', 'Arrow Slit Wall', 'Bed', 'Bookshelf', 'Chair', 'Treasure Chest', 'Door', 'Fountain', 'Pillar', 'Secret Door', 'Stairs', 'Statue', 'Table', 'Trap', 'Spider Web'];
            indoorOnlyLabels.forEach(label => {
                expect(screen.queryByText(label)).not.toBeInTheDocument();
            });
        });
    });

    describe('characters section', () => {
        it('renders characters section when characters exist and are not players', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Goblin' }], players: [{ name: 'Player1' }] })} />);
            expect(screen.getByText('Characters')).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
        });

        it('hides characters section when no characters exist', () => {
            render(<ItemsPanel {...createProps({ characters: [], players: [] })} />);
            expect(screen.queryByText('Characters')).not.toBeInTheDocument();
        });

        it('hides characters section when all characters are players', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Player1' }], players: [{ name: 'Player1' }] })} />);
            expect(screen.queryByText('Characters')).not.toBeInTheDocument();
        });

        it('filters out characters that overlap with players', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Player1' }, { name: 'Goblin' }], players: [{ name: 'Player1' }] })} />);
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.queryByText('Player1')).not.toBeInTheDocument();
        });

        it('renders character image when imagePath is provided', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Goblin', imagePath: '/goblin.png' }], players: [] })} />);
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', '/goblin.png');
        });

        it('renders character initial when no imagePath is provided', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Goblin' }], players: [] })} />);
            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it('prefixes relative imagePath with campaignName', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Goblin', imagePath: 'portraits/goblin.png' }], players: [], campaignName: 'my-campaign' })} />);
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', 'campaigns/my-campaign/portraits/goblin.png');
        });

        it('does not prefix imagePath that starts with http', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Goblin', imagePath: 'https://example.com/goblin.png' }], players: [], campaignName: 'my-campaign' })} />);
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', 'https://example.com/goblin.png');
        });

    });

    describe('drag and drop', () => {
        it('sets drag data type for indoor items', () => {
            render(<ItemsPanel {...createProps({ mapVariant: 'indoor' })} />);
            const dt = { setData: vi.fn(), setDragImage: vi.fn() };
            const barrel = screen.getByText('Barrel').closest('.items-panel-item');
            fireEvent.dragStart(barrel, { dataTransfer: dt });
            expect(dt.setData).toHaveBeenCalledWith('text/plain', 'barrel');
        });

        it('sets drag data type for outdoor items', () => {
            render(<ItemsPanel {...createProps({ mapVariant: 'outdoor' })} />);
            const dt = { setData: vi.fn(), setDragImage: vi.fn() };
            const tree = screen.getByText('Tree').closest('.items-panel-item');
            fireEvent.dragStart(tree, { dataTransfer: dt });
            expect(dt.setData).toHaveBeenCalledWith('text/plain', 'tree');
        });

        it('sets drag data type for NPC', () => {
            render(<ItemsPanel {...createProps()} />);
            const dt = { setData: vi.fn(), setDragImage: vi.fn() };
            const npc = screen.getByText('NPC').closest('.items-panel-item');
            fireEvent.dragStart(npc, { dataTransfer: dt });
            expect(dt.setData).toHaveBeenCalledWith('text/plain', 'npc');
        });

        it('sets drag data type for characters with character: prefix', () => {
            render(<ItemsPanel {...createProps({ characters: [{ name: 'Goblin' }], players: [] })} />);
            const dt = { setData: vi.fn(), setDragImage: vi.fn() };
            const char = screen.getByText('Goblin').closest('.items-panel-item');
            fireEvent.dragStart(char, { dataTransfer: dt });
            expect(dt.setData).toHaveBeenCalledWith('text/plain', 'character:Goblin');
        });
    });
});
