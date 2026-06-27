import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlacedItems, { baseProps, mockHandleItemPointerDown } from './PlacedItems.test-utils';

describe('PlacedItems - Event handlers', () => {
  describe('barrel event handlers', () => {
    it('calls handleItemPointerDown on barrel pointer down', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'barrel-1');
    });

    it('calls setSelectedItem on barrel context menu', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 2, gridY: 3, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'barrel-1', gridX: 2, gridY: 3 });
    });

    it('prevents default and propagation on barrel context menu', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      const event = new Event('contextmenu', { bubbles: true });
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      event.preventDefault = preventDefault;
      event.stopPropagation = stopPropagation;
      hitArea.dispatchEvent(event);
      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('table event handlers', () => {
    it('calls handleItemPointerDown on table pointer down', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'table-1');
    });

    it('calls setSelectedItem on table context menu', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 1, gridY: 2, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'table-1', gridX: 1, gridY: 2 });
    });
  });

  describe('bed event handlers', () => {
    it('calls handleItemPointerDown on bed pointer down', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'bed-1');
    });

    it('calls setSelectedItem on bed context menu', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 3, gridY: 4, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'bed-1', gridX: 3, gridY: 4 });
    });
  });

  describe('firepit event handlers', () => {
    it('calls handleItemPointerDown on firepit pointer down', () => {
      const items = [{ id: 'firepit-1', type: 'firepit', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'firepit-1');
    });

    it('calls setSelectedItem on firepit context menu', () => {
      const items = [{ id: 'firepit-1', type: 'firepit', gridX: 5, gridY: 6, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'firepit-1', gridX: 5, gridY: 6 });
    });
  });

  describe('door event handlers', () => {
    it('calls handleItemPointerDown on door pointer down', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'door-1');
    });

    it('calls setSelectedItem on door context menu', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 7, gridY: 8, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'door-1', gridX: 7, gridY: 8 });
    });
  });

  describe('secretDoor event handlers', () => {
    it('calls handleItemPointerDown on secretDoor pointer down', () => {
      const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'secret-1');
    });

    it('calls setSelectedItem on secretDoor context menu', () => {
      const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 9, gridY: 10, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'secret-1', gridX: 9, gridY: 10 });
    });
  });

  describe('trap event handlers', () => {
    it('calls handleItemPointerDown on trap pointer down', () => {
      const items = [{ id: 'trap-1', type: 'trap', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'trap-1');
    });

    it('calls setSelectedItem on trap context menu', () => {
      const items = [{ id: 'trap-1', type: 'trap', gridX: 11, gridY: 12, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'trap-1', gridX: 11, gridY: 12 });
    });
  });

  describe('pillar event handlers', () => {
    it('calls handleItemPointerDown on pillar pointer down', () => {
      const items = [{ id: 'pillar-1', type: 'pillar', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'pillar-1');
    });

    it('calls setSelectedItem on pillar context menu', () => {
      const items = [{ id: 'pillar-1', type: 'pillar', gridX: 13, gridY: 14, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'pillar-1', gridX: 13, gridY: 14 });
    });
  });

  describe('stairs event handlers', () => {
    it('calls handleItemPointerDown on stairs pointer down', () => {
      const items = [{ id: 'stairs-1', type: 'stairs', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'stairs-1');
    });

    it('calls setSelectedItem on stairs context menu', () => {
      const items = [{ id: 'stairs-1', type: 'stairs', gridX: 15, gridY: 16, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'stairs-1', gridX: 15, gridY: 16 });
    });
  });

  describe('altar event handlers', () => {
    it('calls handleItemPointerDown on altar pointer down', () => {
      const items = [{ id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'altar-1');
    });

    it('calls setSelectedItem on altar context menu', () => {
      const items = [{ id: 'altar-1', type: 'altar', gridX: 17, gridY: 18, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'altar-1', gridX: 17, gridY: 18 });
    });
  });

  describe('bookshelf event handlers', () => {
    it('calls handleItemPointerDown on bookshelf pointer down', () => {
      const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'bookshelf-1');
    });

    it('calls setSelectedItem on bookshelf context menu', () => {
      const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 19, gridY: 20, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'bookshelf-1', gridX: 19, gridY: 20 });
    });
  });

  describe('chair event handlers', () => {
    it('calls handleItemPointerDown on chair pointer down', () => {
      const items = [{ id: 'chair-1', type: 'chair', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'chair-1');
    });

    it('calls setSelectedItem on chair context menu', () => {
      const items = [{ id: 'chair-1', type: 'chair', gridX: 21, gridY: 22, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'chair-1', gridX: 21, gridY: 22 });
    });
  });

  describe('chest event handlers', () => {
    it('calls handleItemPointerDown on chest pointer down', () => {
      const items = [{ id: 'chest-1', type: 'chest', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'chest-1');
    });

    it('calls setSelectedItem on chest context menu', () => {
      const items = [{ id: 'chest-1', type: 'chest', gridX: 23, gridY: 24, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'chest-1', gridX: 23, gridY: 24 });
    });
  });

  describe('crate event handlers', () => {
    it('calls handleItemPointerDown on crate pointer down', () => {
      const items = [{ id: 'crate-1', type: 'crate', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'crate-1');
    });

    it('calls setSelectedItem on crate context menu', () => {
      const items = [{ id: 'crate-1', type: 'crate', gridX: 25, gridY: 26, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'crate-1', gridX: 25, gridY: 26 });
    });
  });

  describe('fountain event handlers', () => {
    it('calls handleItemPointerDown on fountain pointer down', () => {
      const items = [{ id: 'fountain-1', type: 'fountain', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'fountain-1');
    });

    it('calls setSelectedItem on fountain context menu', () => {
      const items = [{ id: 'fountain-1', type: 'fountain', gridX: 27, gridY: 28, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'fountain-1', gridX: 27, gridY: 28 });
    });
  });

  describe('skeleton event handlers', () => {
    it('calls handleItemPointerDown on skeleton pointer down', () => {
      const items = [{ id: 'skeleton-1', type: 'skeleton', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'skeleton-1');
    });

    it('calls setSelectedItem on skeleton context menu', () => {
      const items = [{ id: 'skeleton-1', type: 'skeleton', gridX: 29, gridY: 30, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'skeleton-1', gridX: 29, gridY: 30 });
    });
  });

  describe('statue event handlers', () => {
    it('calls handleItemPointerDown on statue pointer down', () => {
      const items = [{ id: 'statue-1', type: 'statue', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'statue-1');
    });

    it('calls setSelectedItem on statue context menu', () => {
      const items = [{ id: 'statue-1', type: 'statue', gridX: 31, gridY: 32, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'statue-1', gridX: 31, gridY: 32 });
    });
  });

  describe('torch event handlers', () => {
    it('calls handleItemPointerDown on torch pointer down', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'torch-1');
    });

    it('calls setSelectedItem on torch context menu', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 33, gridY: 34, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'torch-1', gridX: 33, gridY: 34 });
    });
  });

  describe('web event handlers', () => {
    it('calls handleItemPointerDown on web pointer down', () => {
      const items = [{ id: 'web-1', type: 'web', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'web-1');
    });

    it('calls setSelectedItem on web context menu', () => {
      const items = [{ id: 'web-1', type: 'web', gridX: 35, gridY: 36, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'web-1', gridX: 35, gridY: 36 });
    });
  });

  describe('arrowSlitWall event handlers', () => {
    it('calls handleItemPointerDown on arrowSlitWall pointer down', () => {
      const items = [{ id: 'arrow-1', type: 'arrowSlitWall', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'arrow-1');
    });

    it('calls setSelectedItem on arrowSlitWall context menu', () => {
      const items = [{ id: 'arrow-1', type: 'arrowSlitWall', gridX: 37, gridY: 38, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'arrow-1', gridX: 37, gridY: 38 });
    });
  });

  describe('tree event handlers', () => {
    it('calls handleItemPointerDown on tree pointer down', () => {
      const items = [{ id: 'tree-1', type: 'tree', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'tree-1');
    });

    it('calls setSelectedItem on tree context menu', () => {
      const items = [{ id: 'tree-1', type: 'tree', gridX: 39, gridY: 40, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'tree-1', gridX: 39, gridY: 40 });
    });
  });

  describe('boulder event handlers', () => {
    it('calls handleItemPointerDown on boulder pointer down', () => {
      const items = [{ id: 'boulder-1', type: 'boulder', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'boulder-1');
    });

    it('calls setSelectedItem on boulder context menu', () => {
      const items = [{ id: 'boulder-1', type: 'boulder', gridX: 41, gridY: 42, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'boulder-1', gridX: 41, gridY: 42 });
    });
  });

  describe('bush event handlers', () => {
    it('calls handleItemPointerDown on bush pointer down', () => {
      const items = [{ id: 'bush-1', type: 'bush', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'bush-1');
    });

    it('calls setSelectedItem on bush context menu', () => {
      const items = [{ id: 'bush-1', type: 'bush', gridX: 43, gridY: 44, visible: true }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('.item-hit-area');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'bush-1', gridX: 43, gridY: 44 });
    });
  });

  describe('NPC event handlers', () => {
    it('context menu on NPC hit area calls setSelectedItem with correct data', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 5, gridY: 7, visible: true, name: 'Goblin' }];
      const setSelectedItem = vi.fn();
      const { container } = render(
        <PlacedItems {...baseProps} placedItems={items} setSelectedItem={setSelectedItem} />
      );
      const hitArea = container.querySelector('rect[fill="transparent"]');
      hitArea.dispatchEvent(new Event('contextmenu', { bubbles: true }));
      expect(setSelectedItem).toHaveBeenCalledWith({ id: 'npc-1', gridX: 5, gridY: 7 });
    });

    it('pointer down on NPC hit area calls handleItemPointerDown', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('rect[fill="transparent"]');
      hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.objectContaining({ bubbles: true }), 'npc-1');
    });
  });
});
