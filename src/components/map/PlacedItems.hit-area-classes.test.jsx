// @maintained-by-ai: 2026-11-01
// Shared hit-area class contract (backlog 2026-11-01 BB): every GM right-click
// hit shape across the four placed-marker lanes carries the ONE shared class
// `placed-hit-area` IN ADDITION TO its lane-specific anchor, so automation can
// probe all lanes with a single selector instead of hardcoding per-lane anchors:
//   creature token (PlacedItems rect)  | furniture (circle/rect .item-hit-area)
//   indoor POI (IndoorPoiLayer .poi-hit-area) | hex POI (POILayer rects)
// Additive only — this file also pins that the legacy per-lane selectors still
// resolve and that contextmenu still dispatches through the classed shapes.
// Owned elsewhere: PlacedItems-event-handlers.test.jsx (pointer wiring),
// POILayer.test.jsx (hex dispatch), Map.indoor-pois.test.jsx (indoor menus).

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';
import IndoorPoiLayer from './IndoorPoiLayer.jsx';
import POILayer from '../hex-map/POILayer.jsx';

const SHARED = 'placed-hit-area';

const gridCenterX = (x) => x * 50 + 25;
const gridCenterY = (y) => y * 50 + 25;

const makeItem = (overrides) => ({
  id: 'item-1',
  type: 'barrel',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

const renderItems = (items) => render(<PlacedItems {...baseProps} placedItems={items} />);

const renderIndoorPois = (pois, handlePoiContextMenu = vi.fn()) => {
  const result = render(
    <IndoorPoiLayer
      pois={pois}
      isLocalhost
      fog={new Map()}
      gridCenterX={gridCenterX}
      gridCenterY={gridCenterY}
      handlePoiContextMenu={handlePoiContextMenu}
      selectedPoi={null}
    />
  );
  return { handlePoiContextMenu, ...result };
};

const makeHexPoi = (overrides = {}) => ({
  id: 'poi-1',
  type: 'city',
  q: 0,
  r: 0,
  label: 'City A',
  visible: true,
  linkedMap: null,
  ...overrides,
});

const renderHexPois = (pois, overrides = {}) => {
  const props = {
    pois,
    onPoiPointerDown: vi.fn(),
    onPoiContextMenu: vi.fn(),
    poiDragging: null,
    poiHover: null,
    isLocalhost: true,
    partyPosition: null,
    onPoiEnter: vi.fn(),
    validLinkedMaps: new Set(),
    roadStartPoiId: null,
    ...overrides,
  };
  const result = render(<POILayer {...props} />);
  return { props, ...result };
};

describe('placed-hit-area shared class (backlog 2026-11-01 BB)', () => {
  describe('creature token lane (PlacedItems)', () => {
    it('npc and monster token hit rects carry the shared class and still arm the menu', () => {
      const { container, rerender } = renderItems([makeItem({ type: 'npc', name: 'Thug 1' })]);
      let hit = container.querySelector('g[title="Thug 1"] rect.placed-hit-area');
      expect(hit).toBeInTheDocument();

      rerender(<PlacedItems {...baseProps} placedItems={[makeItem({ type: 'monster', name: 'Goblin' })]} />);
      hit = container.querySelector('g[title="Goblin"] rect.placed-hit-area');
      expect(hit).toBeInTheDocument();
      fireEvent.contextMenu(hit);
      expect(baseProps.setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
    });
  });

  describe('furniture lane (PlacedItems)', () => {
    it('barrel circle keeps .item-hit-area and gains the shared class', () => {
      const { container } = renderItems([makeItem({ type: 'barrel' })]);
      const legacy = container.querySelector('g[title="barrel (0,0)"] circle.item-hit-area');
      expect(legacy).toBeInTheDocument(); // legacy selector still resolves
      expect(legacy).toHaveClass(SHARED);
    });

    it('shared rectHitArea types keep .item-hit-area and gain the shared class', () => {
      const { container } = renderItems([
        makeItem({ id: 'c1', type: 'chest', name: 'Gold Chest' }),
        makeItem({ id: 't1', type: 'tree', name: 'Old Oak' }), // outdoor prop branch
      ]);
      const rects = container.querySelectorAll(`rect.item-hit-area.${SHARED}`);
      expect(rects).toHaveLength(2);
    });
  });

  describe('indoor POI lane (IndoorPoiLayer)', () => {
    it('poi rect keeps .poi-hit-area, gains the shared class, and still arms the menu', () => {
      const { container, handlePoiContextMenu } = renderIndoorPois([
        { id: 'poi-a', label: 'Well', gridX: 3, gridY: 4, visible: true },
      ]);
      const legacy = container.querySelector('rect.poi-hit-area');
      expect(legacy).toBeInTheDocument(); // legacy selector still resolves
      expect(legacy).toHaveClass(SHARED);
      fireEvent.contextMenu(container.querySelector(`rect.poi-hit-area.${SHARED}`));
      expect(handlePoiContextMenu).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'poi-a' }),
        expect.any(Object)
      );
    });
  });

  describe('hex POI lane (POILayer)', () => {
    it('non-enterable hit rect carries the shared class inside the legacy g.poi-item selector', () => {
      const { container, props } = renderHexPois([makeHexPoi()]);
      const legacy = container.querySelector('g.poi-item rect[fill="transparent"]');
      expect(legacy).toBeInTheDocument(); // legacy selector still resolves
      expect(legacy).toHaveClass(SHARED);
      fireEvent.contextMenu(legacy);
      expect(props.onPoiContextMenu).toHaveBeenCalledWith('poi-1', expect.any(Object));
    });

    it('enterable hit rect carries the shared class too', () => {
      // Adjacent to the party with a valid linked map => enterable branch.
      const { container } = renderHexPois(
        [makeHexPoi({ id: 'enter', type: 'dungeon', q: 0, r: 1, linkedMap: 'dungeon-map.json' })],
        { partyPosition: { q: 0, r: 0 }, validLinkedMaps: new Set(['dungeon-map.json']) }
      );
      const hit = container.querySelector('g.poi-item-enterable rect.placed-hit-area');
      expect(hit).toBeInTheDocument();
    });
  });
});
