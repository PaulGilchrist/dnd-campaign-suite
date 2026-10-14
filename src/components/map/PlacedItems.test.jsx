import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

// ── Item factory ────────────────────────────────────────────────────────────
const makeItem = (overrides) => ({
  id: 'item-1',
  type: 'barrel',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

// ── Empty / edge cases ──────────────────────────────────────────────────────
describe('PlacedItems - edge cases and empty input', () => {
  it('renders nothing when placedItems is empty', () => {
    const { container } = render(<PlacedItems {...baseProps} placedItems={[]} />);
    expect(container.querySelector('g.placed-item')).toBeNull();
    expect(container.querySelector('g.npc-group')).toBeNull();
  });

  it('renders nothing when placedItems is undefined', () => {
    const { container } = render(<PlacedItems {...baseProps} />);
    expect(container.querySelector('g.placed-item')).toBeNull();
    expect(container.querySelector('g.npc-group')).toBeNull();
  });
});

// ── Door - open/closed state ────────────────────────────────────────────────
describe('PlacedItems - door open/closed state', () => {
  it('renders closed door with use element', () => {
    const items = [makeItem({ type: 'door' })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    expect(container.querySelector('use[href="#door"]')).toBeInTheDocument();
  });

  it('renders open door without use element', () => {
    const items = [makeItem({ type: 'door', open: true })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    expect(container.querySelector('use[href="#door"]')).toBeNull();
  });

  it('renders open door hit area as rect', () => {
    const items = [makeItem({ type: 'door' })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const hitArea = container.querySelector('rect.item-hit-area');
    expect(hitArea).toBeInTheDocument();
  });

  it('renders open door as horizontal rects when not rotated', () => {
    const items = [makeItem({ type: 'door', open: true })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
    expect(rects.length).toBe(2);
    expect(rects[0]).toHaveAttribute('width', '36');
    expect(rects[0]).toHaveAttribute('height', '5');
  });

  it('renders open door as vertical rects when rotated 90', () => {
    const items = [makeItem({ type: 'door', open: true, rotation: 90 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
    expect(rects.length).toBe(2);
    expect(rects[0]).toHaveAttribute('width', '5');
    expect(rects[0]).toHaveAttribute('height', '36');
  });
});

// ── Reposition highlight shapes per type ────────────────────────────────────
describe('PlacedItems - reposition highlight shapes', () => {
  it.each(['barrel', 'firepit'])('renders circle highlight for %s when dragging', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'item-1' }} />
    );
    expect(container.querySelector('circle.reposition-highlight')).toBeInTheDocument();
  });

  it.each([
    'altar', 'arrowSlitWall', 'bed', 'bookshelf', 'chair', 'chest', 'crate',
    'door', 'fountain', 'pillar', 'secretDoor', 'skeleton', 'stairs',
    'statue', 'table', 'torch', 'trap', 'tree', 'web',
  ])('renders rect highlight for %s when dragging', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'item-1' }} />
    );
    expect(container.querySelector('rect.reposition-highlight')).toBeInTheDocument();
  });
});

// ── Type filtering ──────────────────────────────────────────────────────────
describe('PlacedItems - all non-NPC types render correctly', () => {
  it('renders all non-NPC types as placed-item groups with use elements', () => {
    const types = [
      'altar', 'arrowSlitWall', 'barrel', 'bed', 'bookshelf', 'boulder', 'bush',
      'chair', 'chest', 'crate', 'door', 'firepit', 'fountain', 'pillar',
      'secretDoor', 'skeleton', 'stairs', 'statue', 'table', 'torch', 'trap',
      'tree', 'web',
    ];
    types.forEach((type) => {
      const items = [makeItem({ type })];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
      expect(container.querySelector(`use[href="#${type}"]`)).toBeInTheDocument();
    });
  });
});

// ── Rotation support ────────────────────────────────────────────────────────
describe('PlacedItems - rotation', () => {
  it.each(['bed', 'altar', 'bookshelf', 'door', 'secretDoor', 'stairs', 'chair', 'torch', 'arrowSlitWall'])('renders %s with rotation transform when rotation is set', (type) => {
      const items = [makeItem({ type, rotation: 90 })];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector(`use[href="#${type}"]`);
      expect(useEl).toHaveAttribute('transform');
      expect(useEl.getAttribute('transform')).toMatch(/rotate\(/);
    });

  it.each(['bed', 'altar', 'bookshelf', 'door', 'secretDoor', 'stairs', 'chair', 'torch', 'arrowSlitWall'])('renders %s without transform when rotation is absent', (type) => {
      const items = [makeItem({ type })];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector(`use[href="#${type}"]`);
      expect(useEl).not.toHaveAttribute('transform');
    });
});
