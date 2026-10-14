// @maintained-by-ai: 2026-10-14
// Remote clients must never receive localhost-only map elements (hit areas,
// drag highlights) or the secret-door icon. Each item renderer in PlacedItems.jsx
// carries its own `isLocalhost` guard, so every type is exercised here.
// Positive localhost coverage lives in PlacedItems.test.jsx and
// PlacedItems-localhost-rendering.test.jsx.
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

const makeItem = (overrides) => ({
  id: 'item-1',
  type: 'barrel',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

// Drag state is always set so the remote "no highlight" assertions are meaningful.
function renderItems(items, isLocalhost) {
  return render(
    <PlacedItems
      {...baseProps}
      placedItems={items}
      isLocalhost={isLocalhost}
      itemDragging={{ itemId: 'item-1' }}
    />,
  );
}

describe('PlacedItems - localhost-only elements hidden from remote clients', () => {
  it.each([
    'altar', 'arrowSlitWall', 'barrel', 'bed', 'bookshelf', 'boulder', 'bush',
    'chair', 'chest', 'crate', 'door', 'firepit', 'fountain', 'pillar',
    'skeleton', 'stairs', 'statue', 'table', 'torch', 'trap', 'tree', 'web',
  ])('renders %s icon on remote without hit area or highlight', (type) => {
    const { container } = renderItems([makeItem({ type })], false);
    expect(container.querySelector(`use[href="#${type}"]`)).toBeInTheDocument();
    expect(container.querySelector('.item-hit-area')).toBeNull();
    expect(container.querySelector('.reposition-highlight')).toBeNull();
  });

  it.each([false, true])('keeps the secret-door icon GM-only when visible=%s', (visible) => {
    const items = [makeItem({ type: 'secretDoor', visible })];
    expect(renderItems(items, true).container.querySelector('use[href="#secretDoor"]')).toBeInTheDocument();
    expect(renderItems(items, false).container.querySelector('use[href="#secretDoor"]')).not.toBeInTheDocument();
  });

  it('renders hit area and highlight for the GM (control for the remote assertions)', () => {
    const { container } = renderItems([makeItem({ type: 'door' })], true);
    expect(container.querySelector('.item-hit-area')).toBeInTheDocument();
    expect(container.querySelector('rect.reposition-highlight')).toBeInTheDocument();
  });
});
