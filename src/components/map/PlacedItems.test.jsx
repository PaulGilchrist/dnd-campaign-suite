// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

// ── Item type registry ──────────────────────────────────────────────────────
// All non-NPC item types that render as <g.placed-item> with a <use> element.
// Used for parameterized testing to avoid 20+ near-identical test functions.
const NON_NPC_TYPES = [
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

// Types that render a circle hit area (barrel only — circle cx/cy/r)
const CIRCLE_HIT_AREA_TYPES = ['barrel'];

// Types that render a rect hit area
const RECT_HIT_AREA_TYPES = [
  'altar', 'arrowSlitWall', 'bed', 'bookshelf', 'chair', 'chest', 'crate',
  'door', 'firepit', 'fountain', 'pillar', 'secretDoor', 'skeleton', 'stairs',
  'statue', 'table', 'torch', 'trap', 'tree', 'web',
];

// Types that support rotation via transform attribute on the <use> element.
const ROTATION_TYPES = ['bed', 'altar', 'bookshelf', 'door', 'secretDoor', 'stairs', 'chair', 'torch', 'arrowSlitWall'];

// Types whose reposition highlight is a circle
const CIRCLE_HIGHLIGHT_TYPES = ['barrel', 'firepit'];

// Types whose reposition highlight is a rect
const RECT_HIGHLIGHT_TYPES = [
  'altar', 'arrowSlitWall', 'bed', 'bookshelf', 'chair', 'chest', 'crate',
  'door', 'fountain', 'pillar', 'secretDoor', 'skeleton', 'stairs',
  'statue', 'table', 'torch', 'trap', 'tree', 'web',
];

// ── Helpers ─────────────────────────────────────────────────────────────────
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

  it('renders nothing for unknown item type', () => {
    const items = [makeItem({ type: 'unknownType' })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    expect(container.innerHTML).toBe('');
  });
});

// ── Barrel - circle hit area, basic positioning ─────────────────────────────
describe('PlacedItems - barrel', () => {
  it('renders barrel use element at correct position for grid (0,0)', () => {
    const items = [makeItem({ type: 'barrel' })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const useEl = container.querySelector('use[href="#barrel"]');
    expect(useEl).toBeInTheDocument();
    expect(useEl).toHaveAttribute('x', '7');
    expect(useEl).toHaveAttribute('y', '7');
  });

  it('renders barrel hit area circle at correct center', () => {
    const items = [makeItem({ type: 'barrel' })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const circle = container.querySelector('circle.item-hit-area');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('cx', '25');
    expect(circle).toHaveAttribute('cy', '25');
    expect(circle).toHaveAttribute('r', '20');
  });
});

// ── Rotation support types ──────────────────────────────────────────────────
describe('PlacedItems - rotation support', () => {
  it.each(ROTATION_TYPES)('renders %s without transform when rotation is absent or undefined', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const useEl = container.querySelector(`use[href="#${type}"]`);
    expect(useEl).not.toHaveAttribute('transform');
  });

  it.each(ROTATION_TYPES)('renders %s with rotation transform applied', (type) => {
    const items = [makeItem({ type, rotation: 90 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const useEl = container.querySelector(`use[href="#${type}"]`);
    expect(useEl).toHaveAttribute('transform');
    expect(useEl.getAttribute('transform')).toMatch(/rotate\(/);
  });

  it('renders bed with custom rotation angle and grid position', () => {
    const items = [makeItem({ type: 'bed', gridX: 1, gridY: 1, rotation: 45 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const useEl = container.querySelector('use[href="#bed"]');
    expect(useEl).toHaveAttribute('transform', 'rotate(45, 95, 75)');
  });

  it('renders table with rotation 90 and different x/y positioning', () => {
    const items = [makeItem({ type: 'table', rotation: 90 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const useEl = container.querySelector('use[href="#table"]');
    expect(useEl).toHaveAttribute('transform', 'rotate(90, 25, 45)');
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

  it('renders open door horizontal rects at correct positions', () => {
    const items = [makeItem({ type: 'door', open: true })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
    expect(rects.length).toBe(2);
    expect(rects[0]).toHaveAttribute('x', '7');
    expect(rects[0]).toHaveAttribute('y', '7');
    expect(rects[0]).toHaveAttribute('width', '36');
    expect(rects[0]).toHaveAttribute('height', '5');
    expect(rects[1]).toHaveAttribute('x', '7');
    expect(rects[1]).toHaveAttribute('y', '38');
    expect(rects[1]).toHaveAttribute('width', '36');
    expect(rects[1]).toHaveAttribute('height', '5');
  });

  it('renders open door vertical rects at correct positions', () => {
    const items = [makeItem({ type: 'door', open: true, rotation: 90 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
    expect(rects.length).toBe(2);
    expect(rects[0]).toHaveAttribute('x', '7');
    expect(rects[0]).toHaveAttribute('y', '7');
    expect(rects[0]).toHaveAttribute('width', '5');
    expect(rects[0]).toHaveAttribute('height', '36');
    expect(rects[1]).toHaveAttribute('x', '38');
    expect(rects[1]).toHaveAttribute('y', '7');
    expect(rects[1]).toHaveAttribute('width', '5');
    expect(rects[1]).toHaveAttribute('height', '36');
  });

  it('renders door hit area as rect', () => {
    const items = [makeItem({ type: 'door' })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const hitArea = container.querySelector('rect.item-hit-area');
    expect(hitArea).toBeInTheDocument();
    expect(hitArea).toHaveAttribute('x', '7');
    expect(hitArea).toHaveAttribute('y', '7');
    expect(hitArea).toHaveAttribute('width', '36');
    expect(hitArea).toHaveAttribute('height', '36');
  });
});

// ── NPC rendering ───────────────────────────────────────────────────────────
describe('PlacedItems - NPC rendering', () => {
  const npcItem = makeItem({ type: 'npc', name: 'Goblin' });

  it('renders NPC in npc-group instead of placed-item group', () => {
    const { container } = render(<PlacedItems {...baseProps} placedItems={[npcItem]} />);
    expect(container.querySelector('g.npc-group')).toBeInTheDocument();
    expect(container.querySelector('g.placed-item')).toBeNull();
  });

  it('renders NPC circle with correct class and position', () => {
    const { container } = render(<PlacedItems {...baseProps} placedItems={[npcItem]} />);
    const circle = container.querySelector('circle.npc-circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('cx', '25');
    expect(circle).toHaveAttribute('cy', '25');
    expect(circle).toHaveAttribute('r', '20');
  });

  it('renders NPC clipPath with correct id referencing the item id', () => {
    const { container } = render(<PlacedItems {...baseProps} placedItems={[npcItem]} npcImages={{}} />);
    const clipPath = container.querySelector('clipPath[id="npc-clip-item-1"]');
    expect(clipPath).toBeInTheDocument();
    const clipCircle = clipPath.querySelector('circle');
    expect(clipCircle).toBeInTheDocument();
    expect(clipCircle).toHaveAttribute('cx', '25');
    expect(clipCircle).toHaveAttribute('cy', '25');
    expect(clipCircle).toHaveAttribute('r', '20');
  });

  it('renders NPC initial text from name first character', () => {
    render(<PlacedItems {...baseProps} placedItems={[npcItem]} npcImages={{}} />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('renders NPC name text below the circle', () => {
    const { container } = render(<PlacedItems {...baseProps} placedItems={[npcItem]} npcImages={{}} />);
    const nameText = container.querySelector('text.npc-name');
    expect(nameText).toBeInTheDocument();
    expect(nameText).toHaveTextContent('Goblin');
    expect(nameText).toHaveAttribute('x', '25');
    expect(nameText).toHaveAttribute('y', '41');
  });

  it('renders NPC initial text centered in the circle', () => {
    const { container } = render(<PlacedItems {...baseProps} placedItems={[npcItem]} npcImages={{}} />);
    const initialText = container.querySelector('text.npc-initial');
    expect(initialText).toBeInTheDocument();
    expect(initialText).toHaveAttribute('x', '25');
    expect(initialText).toHaveAttribute('y', '25');
  });

  it('renders NPC image from npcImages prop', () => {
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={[npcItem]} npcImages={{ Goblin: '/goblin.png' }} />
    );
    const image = container.querySelector('image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('xlink:href', '/goblin.png');
    expect(image).toHaveAttribute('width', '36');
    expect(image).toHaveAttribute('height', '36');
    expect(image).toHaveAttribute('clip-path', 'url(#npc-clip-item-1)');
  });

  it('renders NPC image from imageUrl prop when npcImages is empty', () => {
    const itemWithUrl = makeItem({ type: 'npc', name: 'Goblin', imageUrl: '/custom.png' });
    const { container } = render(<PlacedItems {...baseProps} placedItems={[itemWithUrl]} npcImages={{}} />);
    const image = container.querySelector('image');
    expect(image).toHaveAttribute('xlink:href', '/custom.png');
  });

  it('prefers npcImages over imageUrl when both are present', () => {
    const itemWithUrl = makeItem({ type: 'npc', name: 'Goblin', imageUrl: '/custom.png' });
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={[itemWithUrl]} npcImages={{ Goblin: '/goblin.png' }} />
    );
    const image = container.querySelector('image');
    expect(image).toHaveAttribute('xlink:href', '/goblin.png');
  });

  it('renders NPC at correct grid position', () => {
    const items = [makeItem({ type: 'npc', name: 'Orc', gridX: 3, gridY: 2 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const circle = container.querySelector('circle.npc-circle');
    expect(circle).toHaveAttribute('cx', '175');
    expect(circle).toHaveAttribute('cy', '125');
  });
});

// ── Localhost vs remote visibility ──────────────────────────────────────────
describe('PlacedItems - localhost vs remote visibility', () => {
  it('hides hit areas and reposition highlights on remote', () => {
    const items = [makeItem({ type: 'barrel' })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />
    );
    expect(container.querySelectorAll('.item-hit-area').length).toBe(0);
    expect(container.querySelectorAll('.reposition-highlight').length).toBe(0);
  });

  it('shows hit areas and reposition highlights on localhost', () => {
    const items = [makeItem({ type: 'barrel' })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'item-1' }} />
    );
    expect(container.querySelectorAll('.item-hit-area').length).toBe(1);
    expect(container.querySelectorAll('.reposition-highlight').length).toBe(1);
  });

  it('renders localhost invisible items at 0.5 opacity', () => {
    const items = [makeItem({ type: 'barrel', visible: false })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} />);
    const useEl = container.querySelector('use[href="#barrel"]');
    expect(useEl).toHaveAttribute('opacity', '0.5');
  });

  it('renders visible items at full opacity regardless of localhost', () => {
    const items = [makeItem({ type: 'barrel', visible: true })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} />);
    const useEl = container.querySelector('use[href="#barrel"]');
    expect(useEl).toHaveAttribute('opacity', '1');
  });

  it('hides remote invisible items entirely', () => {
    const items = [makeItem({ type: 'barrel', visible: false })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />);
    expect(container.querySelector('use[href="#barrel"]')).toBeNull();
  });
});

// ── Fog occlusion ───────────────────────────────────────────────────────────
describe('PlacedItems - fog occlusion', () => {
  it('hides fog-covered items on remote', () => {
    const fog = new Map([['0,0', true]]);
    const items = [makeItem({ type: 'barrel', gridX: 0, gridY: 0 })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />
    );
    expect(container.querySelector('use[href="#barrel"]')).toBeNull();
  });

  it('shows fog-covered items on localhost', () => {
    const fog = new Map([['0,0', true]]);
    const items = [makeItem({ type: 'barrel', gridX: 0, gridY: 0 })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={true} fog={fog} />
    );
    expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
  });

  it('hides non-fogged items on remote when visible is false', () => {
    const fog = new Map();
    const items = [makeItem({ type: 'barrel', gridX: 0, gridY: 0, visible: false })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />
    );
    expect(container.querySelector('use[href="#barrel"]')).toBeNull();
  });
});

// ── Grid position calculations ──────────────────────────────────────────────
describe('PlacedItems - grid position calculations', () => {
  it('positions barrel hit area circle at grid (5,3)', () => {
    const items = [makeItem({ type: 'barrel', gridX: 5, gridY: 3 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const circle = container.querySelector('circle.item-hit-area');
    expect(circle).toHaveAttribute('cx', '275');
    expect(circle).toHaveAttribute('cy', '175');
  });

  it('positions multiple items at different grid coordinates', () => {
    const items = [
      makeItem({ id: 'barrel-a', type: 'barrel', gridX: 0, gridY: 0 }),
      makeItem({ id: 'barrel-b', type: 'barrel', gridX: 10, gridY: 5 }),
    ];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const circles = container.querySelectorAll('circle.item-hit-area');
    expect(circles.length).toBe(2);
    expect(circles[0]).toHaveAttribute('cx', '25');
    expect(circles[0]).toHaveAttribute('cy', '25');
    expect(circles[1]).toHaveAttribute('cx', '525');
    expect(circles[1]).toHaveAttribute('cy', '275');
  });

  it('positions door hit area rect at grid (5,3)', () => {
    const items = [makeItem({ type: 'door', gridX: 5, gridY: 3 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const rect = container.querySelector('rect.item-hit-area');
    expect(rect).toHaveAttribute('x', '257');
    expect(rect).toHaveAttribute('y', '157');
  });
});

// ── Reposition highlight shapes per type ────────────────────────────────────
describe('PlacedItems - reposition highlight shapes', () => {
  it.each(CIRCLE_HIGHLIGHT_TYPES)('renders circle highlight for %s when dragging', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'item-1' }} />
    );
    expect(container.querySelector('circle.reposition-highlight')).toBeInTheDocument();
  });

  it.each(RECT_HIGHLIGHT_TYPES)('renders rect highlight for %s when dragging', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'item-1' }} />
    );
    expect(container.querySelector('rect.reposition-highlight')).toBeInTheDocument();
  });
});

// ── Key uniqueness ──────────────────────────────────────────────────────────
describe('PlacedItems - key uniqueness', () => {
  it('renders each placed item group with a unique key based on item id', () => {
    const items = [
      makeItem({ id: 'barrel-1', type: 'barrel' }),
      makeItem({ id: 'barrel-2', type: 'barrel', gridX: 1 }),
    ];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    expect(container.querySelectorAll('g.placed-item').length).toBe(2);
  });

  it('renders each npc group with a unique key based on item id', () => {
    const items = [
      makeItem({ id: 'npc-1', type: 'npc', name: 'Goblin' }),
      makeItem({ id: 'npc-2', type: 'npc', name: 'Orc', gridX: 1 }),
    ];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    expect(container.querySelectorAll('g.npc-group').length).toBe(2);
  });
});

// ── Type filtering and unknown types ────────────────────────────────────────
describe('PlacedItems - type filtering and unknown types', () => {
  it('renders multiple item types in a single render', () => {
    const items = [
      makeItem({ id: 'barrel-1', type: 'barrel' }),
      makeItem({ id: 'chest-1', type: 'chest', gridX: 1 }),
      makeItem({ id: 'npc-1', type: 'npc', name: 'Goblin', gridX: 2 }),
    ];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    expect(container.querySelector('use[href="#chest"]')).toBeInTheDocument();
    expect(container.querySelector('circle.npc-circle')).toBeInTheDocument();
  });
});

// ── Parameterized: every non-NPC type renders placed-item group with use ────
describe('PlacedItems - all non-NPC types render placed-item group with use element', () => {
  it.each(NON_NPC_TYPES)('renders %s as placed-item group with use element', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    expect(container.querySelector(`use[href="#${type}"]`)).toBeInTheDocument();
  });
});

// ── Parameterized: every non-NPC type renders correct hit area shape ────────
describe('PlacedItems - all non-NPC types render correct hit area shape', () => {
  it.each(CIRCLE_HIT_AREA_TYPES)('renders %s with circle hit area', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const group = container.querySelector(`g.placed-item`);
    expect(group.querySelector('circle.item-hit-area')).toBeInTheDocument();
  });

  it.each(RECT_HIT_AREA_TYPES)('renders %s with rect hit area', (type) => {
    const items = [makeItem({ type })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const group = container.querySelector(`g.placed-item`);
    expect(group.querySelector('rect.item-hit-area')).toBeInTheDocument();
  });
});
