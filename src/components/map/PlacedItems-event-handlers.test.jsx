// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlacedItems, { baseProps, mockHandleItemPointerDown } from './PlacedItems.test-utils';

const REGULAR_ITEM_TYPES = [
  'barrel', 'table', 'bed', 'firepit', 'door', 'secretDoor', 'trap',
  'pillar', 'stairs', 'altar', 'bookshelf', 'chair', 'chest', 'crate',
  'fountain', 'skeleton', 'statue', 'torch', 'web', 'arrowSlitWall',
  'tree', 'boulder', 'bush',
];

describe('PlacedItems - Event handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pointerdown events', () => {
    it.each(REGULAR_ITEM_TYPES)('calls handleItemPointerDown with event and itemId for %s', (type) => {
      const itemId = `${type}-1`;
      const items = [{ id: itemId, type, gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      expect(hitArea).not.toBeNull();
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(
        expect.objectContaining({ bubbles: true }),
        itemId
      );
    });

    it('calls handleItemPointerDown for NPC', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('rect[fill="transparent"]');
      expect(hitArea).not.toBeNull();
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(
        expect.objectContaining({ bubbles: true }),
        'npc-1'
      );
    });

    it('renders no hit areas when placedItems is empty', () => {
      const { container } = render(<PlacedItems {...baseProps} placedItems={[]} />);
      expect(container.querySelector('.item-hit-area')).toBeNull();
      expect(container.querySelector('rect[fill="transparent"]')).toBeNull();
    });
  });

  describe('contextmenu events', () => {
    it.each(REGULAR_ITEM_TYPES)('calls setSelectedItem with correct data for %s', (type) => {
      const gridX = 5;
      const gridY = 7;
      const items = [{ id: `${type}-1`, type, gridX, gridY, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      expect(hitArea).not.toBeNull();
      const event = new Event('contextmenu', { bubbles: true });
      hitArea.dispatchEvent(event);
      expect(setSelectedItem).toHaveBeenCalledWith({ id: `${type}-1`, gridX, gridY });
    });

    it('calls setSelectedItem with correct data for NPC', () => {
      const gridX = 3;
      const gridY = 4;
      const items = [{ id: 'npc-1', type: 'npc', gridX, gridY, visible: true, name: 'Goblin' }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('rect[fill="transparent"]');
      expect(hitArea).not.toBeNull();
      const event = new Event('contextmenu', { bubbles: true });
      hitArea.dispatchEvent(event);
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'npc-1', gridX, gridY });
    });
  });
});
