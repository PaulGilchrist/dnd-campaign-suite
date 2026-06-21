// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlacedItems from './PlacedItems';

const mockGridCenterX = (x) => x * 50 + 25;
const mockGridCenterY = (y) => y * 50 + 25;

const mockHandleItemPointerDown = vi.fn();

const baseProps = {
  placedItems: [],
  isLocalhost: true,
  fog: new Map(),
  gridCenterX: mockGridCenterX,
  gridCenterY: mockGridCenterY,
  setSelectedItem: vi.fn(),
  npcImages: {},
  itemDragging: null,
  handleItemPointerDown: mockHandleItemPointerDown,
};

describe('PlacedItems', () => {
  describe('empty state', () => {
    it('renders nothing when placedItems is empty', () => {
      const { container } = render(<PlacedItems {...baseProps} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('rendering placed items', () => {
    const placeableItems = [
      'barrel', 'table', 'bed', 'firepit', 'door', 'secretDoor', 'trap',
      'pillar', 'stairs', 'altar', 'bookshelf', 'chair', 'chest', 'crate',
      'fountain', 'skeleton', 'statue', 'torch', 'web', 'arrowSlitWall',
      'tree', 'boulder', 'bush',
    ];

    it.each(placeableItems)('renders a %s item', (type) => {
      const items = [{ id: `${type}-1`, type, gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const placedItems = container.querySelectorAll('.placed-item');
      expect(placedItems.length).toBeGreaterThan(0);
    });

    it('handles door with rotation', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const placedItems = container.querySelectorAll('.placed-item');
      expect(placedItems.length).toBeGreaterThan(0);
    });

    it('handles secret door with rotation', () => {
      const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 0, gridY: 0, visible: true, rotation: 270 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const placedItems = container.querySelectorAll('.placed-item');
      expect(placedItems.length).toBeGreaterThan(0);
    });

    it('handles bed with vertical rotation', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const placedItems = container.querySelectorAll('.placed-item');
      expect(placedItems.length).toBeGreaterThan(0);
    });
  });

  describe('NPC rendering', () => {
    it('renders an NPC group', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const npcGroups = container.querySelectorAll('.npc-group');
      expect(npcGroups.length).toBe(1);
    });

    it('renders NPC with initial when no image', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('renders NPC with image when npcImages has entry', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{ Goblin: '/goblin.png' }} />);
      const images = container.querySelectorAll('image');
      expect(images.length).toBeGreaterThan(0);
    });

    it('renders NPC with name text', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });
  });

  describe('fog and visibility', () => {
    it('hides non-localhost items when fog covers them', () => {
      const fog = new Map([['0,0', true]]);
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      const placedItems = container.querySelectorAll('.placed-item');
      expect(placedItems.length).toBe(0);
    });

    it('hides non-localhost items when visible is false', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: false }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />);
      const placedItems = container.querySelectorAll('.placed-item');
      expect(placedItems.length).toBe(0);
    });

    it('shows non-localhost items when visible and not fogged', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />);
      const placedItems = container.querySelectorAll('.placed-item');
      expect(placedItems.length).toBeGreaterThan(0);
    });
  });

  describe('dragging and highlighting', () => {
    it('shows reposition highlight when item is being dragged', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} itemDragging={{ itemId: 'barrel-1' }} />);
      const highlights = container.querySelectorAll('.reposition-highlight');
      expect(highlights.length).toBeGreaterThan(0);
    });

    it('does not show reposition highlight for non-dragged item', () => {
      const items = [
        { id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true },
        { id: 'barrel-2', type: 'barrel', gridX: 1, gridY: 0, visible: true },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} itemDragging={{ itemId: 'barrel-1' }} />);
      const highlights = container.querySelectorAll('.reposition-highlight');
      expect(highlights.length).toBe(1);
    });
  });

  describe('multiple items', () => {
    it('renders multiple items of different types', () => {
      const items = [
        { id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true },
        { id: 'npc-1', type: 'npc', gridX: 1, gridY: 0, visible: true, name: 'Goblin' },
        { id: 'table-1', type: 'table', gridX: 2, gridY: 0, visible: true },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const allGroups = container.querySelectorAll('.placed-item, .npc-group');
      expect(allGroups.length).toBe(3);
    });
  });
});