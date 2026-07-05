// @cleaned-by-ai
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

const defaultProps = {
  itemsPanelOpen: true,
  onClose: vi.fn(),
  characters: [],
  players: [],
  mapVariant: 'indoor',
};

describe('ItemsPanel', () => {
  describe('visibility', () => {
    it('renders nothing when itemsPanelOpen is false', () => {
      const { container } = render(<ItemsPanel {...defaultProps} itemsPanelOpen={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders close button when open', () => {
      render(<ItemsPanel {...defaultProps} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
      render(<ItemsPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('items rendering', () => {
    it('renders indoor items with correct labels', () => {
      render(<ItemsPanel {...defaultProps} />);
      const indoorLabels = ['Altar', 'Arrow Slit Wall', 'Barrel', 'Bed', 'Bookshelf', 'Chair', 'Treasure Chest', 'Crate', 'Door', 'Fire Pit', 'Fountain', 'Pillar', 'Secret Door', 'Stairs', 'Statue', 'Table', 'Torch', 'Trap', 'Spider Web', 'NPC'];
      indoorLabels.forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('renders outdoor items and excludes indoor-only items', () => {
      render(<ItemsPanel {...defaultProps} mapVariant="outdoor" />);
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
    it('renders characters section when characters are not in players', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[{ name: 'Player1' }]} />);
      expect(screen.getByText('Characters')).toBeInTheDocument();
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('does not render characters section when no characters', () => {
      render(<ItemsPanel {...defaultProps} characters={[]} players={[]} />);
      expect(screen.queryByText('Characters')).not.toBeInTheDocument();
    });

    it('does not render characters section when all characters are players', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Player1' }]} players={[{ name: 'Player1' }]} />);
      expect(screen.queryByText('Characters')).not.toBeInTheDocument();
    });

    it('renders character image when imagePath provided', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin', imagePath: '/goblin.png' }]} players={[]} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/goblin.png');
    });

    it('renders multiple missing characters with section title', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }, { name: 'Orc' }]} players={[{ name: 'Player1' }]} />);
      expect(screen.getByText('Characters')).toBeInTheDocument();
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText('Orc')).toBeInTheDocument();
    });
  });

  describe('drag and drop', () => {
    it('sets correct drag data type for items, NPC, and characters', () => {
      // Indoor item
      render(<ItemsPanel {...defaultProps} mapVariant="indoor" />);
      const indoorDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const barrel = screen.getAllByText('Barrel')[0].closest('.items-panel-item');
      fireEvent.dragStart(barrel, { dataTransfer: indoorDT });
      expect(indoorDT.setData).toHaveBeenCalledWith('text/plain', 'barrel');

      // Outdoor item
      render(<ItemsPanel {...defaultProps} mapVariant="outdoor" />);
      const outdoorDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const tree = screen.getAllByText('Tree')[0].closest('.items-panel-item');
      fireEvent.dragStart(tree, { dataTransfer: outdoorDT });
      expect(outdoorDT.setData).toHaveBeenCalledWith('text/plain', 'tree');

      // NPC
      render(<ItemsPanel {...defaultProps} />);
      const npcDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const npc = screen.getAllByText('NPC')[0].closest('.items-panel-item');
      fireEvent.dragStart(npc, { dataTransfer: npcDT });
      expect(npcDT.setData).toHaveBeenCalledWith('text/plain', 'npc');

      // Character
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[]} />);
      const charDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const char = screen.getByText('Goblin').closest('.items-panel-item');
      fireEvent.dragStart(char, { dataTransfer: charDT });
      expect(charDT.setData).toHaveBeenCalledWith('text/plain', 'character:Goblin');
    });
  });
});
