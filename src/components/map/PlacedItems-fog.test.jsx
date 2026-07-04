// @improved-by-ai
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

function selectorForType(type) {
  return type === 'npc' ? 'circle.npc-circle' : `use[href="#${type}"]`;
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
    it.each([
      ['altar'],
      ['barrel'],
      ['chair'],
      ['chest'],
      ['door'],
      ['npc'],
      ['pillar'],
      ['table'],
      ['trap'],
    ])('hides %s when fog covers the cell', (type) => {
      const items = [makeItem(type, type === 'npc' ? { name: 'Goblin' } : {})];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector(selectorForType(type))).toBeNull();
    });

    it.each([
      ['altar'],
      ['barrel'],
      ['chair'],
      ['chest'],
      ['door'],
      ['npc'],
      ['pillar'],
      ['table'],
      ['trap'],
    ])('shows %s when fog does not cover the cell', (type) => {
      const items = [makeItem(type, type === 'npc' ? { name: 'Goblin' } : {})];
      const fog = new Map([['1,1', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector(selectorForType(type))).toBeInTheDocument();
    });

    it.each([
      ['barrel'],
      ['chest'],
      ['npc'],
    ])('hides non-localhost %s when both visible=false and fog covers cell', (type) => {
      const items = [makeItem(type, { visible: false, ...(type === 'npc' ? { name: 'Goblin' } : {}) })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector(selectorForType(type))).toBeNull();
    });
  });

  describe('fog does not affect localhost', () => {
    it('shows barrel on localhost even when fog covers the cell', () => {
      const items = [makeItem('barrel')];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      expect(container.querySelector(selectorForType('barrel'))).toBeInTheDocument();
    });

    it('shows NPC on localhost even when fog covers the cell', () => {
      const items = [makeItem('npc', { name: 'Goblin' })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      expect(container.querySelector('circle.npc-circle')).toBeInTheDocument();
    });
  });

  describe('fog + visible=false interaction', () => {
    it.each([
      ['barrel'],
      ['chest'],
      ['npc'],
    ])('shows localhost invisible %s at 0.5 opacity even when fog covers cell', (type) => {
      const items = [makeItem(type, { visible: false, ...(type === 'npc' ? { name: 'Goblin' } : {}) })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      const el = container.querySelector(selectorForType(type));
      expect(el).toBeInTheDocument();
      if (type === 'npc') {
        expect(el).toHaveAttribute('style', 'opacity: 0.5;');
      } else {
        expect(el).toHaveAttribute('opacity', '0.5');
      }
    });
  });

  describe('fog grid position matching', () => {
    it('hides item when fog matches its grid coordinates', () => {
      const items = [makeItem('barrel', { gridX: 5, gridY: 3 })];
      const fog = new Map([['5,3', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });

    it('shows item when fog covers different coordinates', () => {
      const items = [makeItem('barrel', { gridX: 5, gridY: 3 })];
      const fog = new Map([['1,1', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
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
