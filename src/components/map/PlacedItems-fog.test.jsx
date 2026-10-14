// @maintained-by-ai: 2026-10-14
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

const placedItemsEl = (items, fog, isLocalhost = false) => (
  <PlacedItems {...baseProps} placedItems={items} fog={fog} isLocalhost={isLocalhost} />
);

describe('PlacedItems - Fog of war hiding', () => {
  it.each([
    { name: 'undefined', fog: undefined },
    { name: 'null', fog: null },
    { name: 'empty Map', fog: new Map() },
  ])('shows items to remote clients when fog is $name', ({ fog }) => {
    const { container } = render(placedItemsEl([makeItem('barrel')], fog));
    expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
  });

  it('hides items on fogged cells and shows items on clear cells', () => {
    const items = [
      makeItem('barrel', { gridX: 0, gridY: 0 }),
      makeItem('chest', { gridX: 1, gridY: 1 }),
      makeItem('npc', { name: 'Goblin', gridX: 2, gridY: 2 }),
    ];
    const { container, rerender } = render(placedItemsEl(items, new Map([['0,0', true]])));
    expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    expect(container.querySelector('use[href="#chest"]')).toBeInTheDocument();
    expect(container.querySelector('circle.npc-circle')).toBeInTheDocument();

    // Fog covering every cell hides everything (including open-door rects)
    rerender(placedItemsEl(
      [...items, makeItem('door', { open: true, gridX: 3, gridY: 3 })],
      new Map([['0,0', true], ['1,1', true], ['2,2', true], ['3,3', true]]),
    ));
    expect(container.querySelectorAll('.placed-item, .npc-group')).toHaveLength(0);
    expect(container.querySelectorAll('rect[fill="#8B5A2B"]')).toHaveLength(0);
  });

  it('shows localhost invisible items at reduced opacity even when fog covers cell', () => {
    const { container } = render(
      placedItemsEl([makeItem('barrel', { visible: false })], new Map([['0,0', true]]), true),
    );
    const el = container.querySelector('use[href="#barrel"]');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('opacity')).toBe('0.5');
  });

  it('hides remote invisible items even when fog does not cover the cell', () => {
    const { container } = render(
      placedItemsEl([makeItem('barrel', { visible: false })], new Map([['1,1', true]])),
    );
    expect(container.querySelector('use[href="#barrel"]')).toBeNull();
  });
});
