import { render } from '@testing-library/react';
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
  it('renders nothing when placedItems is empty', () => {
    const { container } = render(<PlacedItems {...baseProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a barrel item', () => {
    const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a table item', () => {
    const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a bed item', () => {
    const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a firepit item', () => {
    const items = [{ id: 'firepit-1', type: 'firepit', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a door item', () => {
    const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a secret door item', () => {
    const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a trap item', () => {
    const items = [{ id: 'trap-1', type: 'trap', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a pillar item', () => {
    const items = [{ id: 'pillar-1', type: 'pillar', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders stairs item', () => {
    const items = [{ id: 'stairs-1', type: 'stairs', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders an altar item', () => {
    const items = [{ id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a bookshelf item', () => {
    const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a chair item', () => {
    const items = [{ id: 'chair-1', type: 'chair', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a chest item', () => {
    const items = [{ id: 'chest-1', type: 'chest', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a crate item', () => {
    const items = [{ id: 'crate-1', type: 'crate', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a fountain item', () => {
    const items = [{ id: 'fountain-1', type: 'fountain', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a skeleton item', () => {
    const items = [{ id: 'skeleton-1', type: 'skeleton', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a statue item', () => {
    const items = [{ id: 'statue-1', type: 'statue', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a torch item', () => {
    const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a web item', () => {
    const items = [{ id: 'web-1', type: 'web', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders an arrow slit wall item', () => {
    const items = [{ id: 'arrow-1', type: 'arrowSlitWall', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a tree item', () => {
    const items = [{ id: 'tree-1', type: 'tree', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a boulder item', () => {
    const items = [{ id: 'boulder-1', type: 'boulder', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders a bush item', () => {
    const items = [{ id: 'bush-1', type: 'bush', gridX: 0, gridY: 0, visible: true }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

  it('renders an NPC item', () => {
    const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const npcGroups = container.querySelectorAll('.npc-group');
    expect(npcGroups.length).toBe(1);
  });

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

  it('applies rotation to table items', () => {
    const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const placedItems = container.querySelectorAll('.placed-item');
    expect(placedItems.length).toBeGreaterThan(0);
  });

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

  it('renders NPC with initial when no image', () => {
    const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
    expect(container.textContent).toContain('G');
  });

  it('renders NPC with image when npcImages has entry', () => {
    const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{ Goblin: '/goblin.png' }} />);
    const images = container.querySelectorAll('image');
    expect(images.length).toBeGreaterThan(0);
  });

  it('renders NPC with name text', () => {
    const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
    expect(container.textContent).toContain('Goblin');
  });

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
