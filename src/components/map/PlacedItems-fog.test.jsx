// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

const nonNpcTypes = [
  'altar',
  'arrowSlitWall',
  'barrel',
  'bed',
  'bookshelf',
  'boulder',
  'bush',
  'chair',
  'chest',
  'crate',
  'door',
  'firepit',
  'fountain',
  'pillar',
  'secretDoor',
  'skeleton',
  'stairs',
  'statue',
  'table',
  'torch',
  'trap',
  'tree',
  'web',
];

function selectorForType(type) {
  return type === 'npc' ? 'circle[class="npc-circle"]' : `use[href="#${type}"]`;
}

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
    it.each(
      nonNpcTypes.map((type) => [type]),
    )('hides %s when fog covers the cell', (type) => {
      const items = [makeItem(type)];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector(selectorForType(type))).toBeNull();
    });

    it.each(
      nonNpcTypes.map((type) => [type]),
    )('shows %s when fog does not cover the cell', (type) => {
      const items = [makeItem(type)];
      const fog = new Map([['1,1', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector(selectorForType(type))).toBeInTheDocument();
    });

    it('hides NPC when fog covers the cell', () => {
      const items = [makeItem('npc', { name: 'Goblin' })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('circle[class="npc-circle"]')).toBeNull();
    });

    it('shows NPC when fog does not cover the cell', () => {
      const items = [makeItem('npc', { name: 'Goblin' })];
      const fog = new Map([['1,1', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('circle[class="npc-circle"]')).toBeInTheDocument();
    });
  });

  describe('fog does not affect localhost', () => {
    it.each(
      nonNpcTypes.map((type) => [type]),
    )('shows %s on localhost even when fog covers the cell', (type) => {
      const items = [makeItem(type)];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      expect(container.querySelector(selectorForType(type))).toBeInTheDocument();
    });

    it('shows NPC on localhost even when fog covers the cell', () => {
      const items = [makeItem('npc', { name: 'Goblin' })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      expect(container.querySelector('circle[class="npc-circle"]')).toBeInTheDocument();
    });
  });

  describe('fog + visible=false interaction', () => {
    it.each(
      nonNpcTypes.map((type) => [type]),
    )('hides non-localhost %s when both visible=false and fog covers cell', (type) => {
      const items = [makeItem(type, { visible: false })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector(selectorForType(type))).toBeNull();
    });

    it.each(
      nonNpcTypes.map((type) => [type]),
    )('shows localhost invisible %s at 0.5 opacity even when fog covers cell', (type) => {
      const items = [makeItem(type, { visible: false })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      const el = container.querySelector(selectorForType(type));
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('opacity', '0.5');
    });

    it('shows localhost invisible NPC at 0.5 opacity even when fog covers cell', () => {
      const items = [makeItem('npc', { visible: false, name: 'Goblin' })];
      const fog = new Map([['0,0', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: true, fog });
      const circle = container.querySelector('circle[class="npc-circle"]');
      expect(circle).toBeInTheDocument();
      expect(circle).toHaveAttribute('style', 'opacity: 0.5;');
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

    it('hides item when fog covers the cell at negative coordinates', () => {
      const items = [makeItem('barrel', { gridX: -1, gridY: -2 })];
      const fog = new Map([['-1,-2', true]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });
  });

  describe('fog edge cases', () => {
    it('shows item when fog is an empty Map', () => {
      const items = [makeItem('barrel')];
      const fog = new Map();
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });

    it('shows item when fog is undefined', () => {
      const items = [makeItem('barrel')];
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog: undefined });
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });

    it('shows item when fog is null', () => {
      const items = [makeItem('barrel')];
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog: null });
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });

    it('hides item when fog key exists for the cell regardless of boolean value', () => {
      const items = [makeItem('barrel')];
      const fog = new Map([['0,0', false]]);
      const { container } = renderPlacedItems(items, { isLocalhost: false, fog });
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });

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
