// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

function makeItem(type, overrides = {}) {
  return {
    id: `${type}-1`,
    type,
    gridX: 0,
    gridY: 0,
    visible: true,
    ...overrides,
  };
}

function renderPlacedItems(placedItems, { isLocalhost = false, fog = new Map(), ...rest } = {}) {
  return render(
    <PlacedItems
      {...baseProps}
      placedItems={placedItems}
      isLocalhost={isLocalhost}
      fog={fog}
      {...rest}
    />,
  );
}

describe('PlacedItems - Fog of war hiding', () => {
  describe('fog hides non-localhost items', () => {
    it('hides furniture when fog covers the cell', () => {
      const items = [makeItem('barrel')];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });

    it('hides npcs when fog covers the cell', () => {
      const items = [makeItem('npc', { name: 'Goblin' })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('circle.npc-circle')).toBeNull();
    });

    it('shows items when fog does not cover the cell', () => {
      const items = [makeItem('barrel')];
      const fog = new Map([['1,1', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });

    it('hides non-localhost item when visible=false and fog covers cell', () => {
      const items = [makeItem('barrel', { visible: false })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });
  });

  describe('fog does not affect localhost', () => {
    it('shows items on localhost even when fog covers the cell', () => {
      const items = [makeItem('barrel')];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });

    it('shows npcs on localhost even when fog covers the cell', () => {
      const items = [makeItem('npc', { name: 'Goblin' })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      expect(container.querySelector('circle.npc-circle')).toBeInTheDocument();
    });
  });

  describe('fog + visible=false interaction', () => {
    it('shows localhost invisible items at reduced opacity even when fog covers cell', () => {
      const items = [makeItem('barrel', { visible: false })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      const el = container.querySelector('use[href="#barrel"]');
      expect(el).toBeInTheDocument();
      expect(el.getAttribute('opacity')).toBe('0.5');
    });
  });

  describe('multiple items with fog', () => {
    it('hides only the item under fog, shows others on different cells', () => {
      const items = [
        makeItem('barrel', { id: 'barrel-1', gridX: 0, gridY: 0 }),
        makeItem('barrel', { id: 'barrel-2', gridX: 1, gridY: 1 }),
      ];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelectorAll('use[href="#barrel"]')).toHaveLength(1);
    });

    it('hides all items when fog covers all their cells', () => {
      const items = [
        makeItem('barrel', { id: 'barrel-1', gridX: 0, gridY: 0 }),
        makeItem('barrel', { id: 'barrel-2', gridX: 1, gridY: 1 }),
      ];
      const fog = new Map([['0,0', true], ['1,1', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelectorAll('use[href="#barrel"]')).toHaveLength(0);
    });

    it('shows all items on localhost even when fog covers all cells', () => {
      const items = [
        makeItem('barrel', { id: 'barrel-1', gridX: 0, gridY: 0 }),
        makeItem('barrel', { id: 'barrel-2', gridX: 1, gridY: 1 }),
      ];
      const fog = new Map([['0,0', true], ['1,1', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      expect(container.querySelectorAll('use[href="#barrel"]')).toHaveLength(2);
    });
  });
});
