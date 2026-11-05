// @maintained-by-ai: 2026-11-05
// Regression (bug-unregistered-placeditem-type-invisible-ghost): placedItems
// rows whose `type` the app does not know (the map API and AI-Dress `add
// item` ops accept ANY non-empty string) fell through PlacedItems.jsx's
// fixed whitelist and rendered ZERO DOM — no sprite, no `<use>` fallback,
// no hit area. The rows persisted but could never be selected, moved,
// hidden or deleted from the map UI. The dispatcher now ends with a ghost
// pass drawing every unknown row through this shared "?" placeholder
// (mounted in Map.jsx <defs> as #generic-prop) plus the normal hit area.
// This file owns the component contract (renderProp internals are pinned by
// the PlacedItems family; the mounted-board lane by Map.unknown-item.test).

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import PlacedItems, { baseProps, mockHandleItemPointerDown } from './PlacedItems.test-utils';
import { HIDDEN_MARKER_OPACITY } from '../../config/mapConfig';

const renderItems = (items, over = {}) =>
    render(<PlacedItems {...baseProps} {...over} placedItems={items} />);

// Live-shape ghost row exactly as the POST/AI-Dress lanes persist it: an
// invented type, no name, no rotation.
const ghost = (over) => ({
    id: 'cv-legacy', type: 'cauldron', gridX: 3, gridY: 3, visible: true, ...over,
});

// Mock grid centers are x*50+25 / y*50+25; ghosts are cell-sized (36×36),
// non-rotatable, so the icon box anchors at cx-18 = 157 / cy-18 = 157.
describe('PlacedItems — unregistered-type ghost lane', () => {
    beforeEach(() => {
        baseProps.setSelectedItem.mockClear();
        mockHandleItemPointerDown.mockClear();
    });

    it('renders the placeholder marker with a type+cell title instead of dropping the row', () => {
        const { getByTitle } = renderItems([ghost()]);
        const g = getByTitle('cauldron (3,3)');
        expect(g).toHaveClass('placed-item');
        const use = g.querySelector('use[href="#generic-prop"]');
        expect(use).toBeInTheDocument();
        expect(use).toHaveAttribute('x', '157');
        expect(use).toHaveAttribute('y', '157');
        // No phantom sprite lane for an unknown type.
        expect(g.querySelector('image')).toBeNull();
    });

    it('a renamed ghost titles by its plain name (shared placedItemLabel law)', () => {
        const { getByTitle } = renderItems([ghost({ name: 'Bubbas Cauldron' })]);
        expect(getByTitle('Bubbas Cauldron')).toBeInTheDocument();
    });

    it('the GM hit area arms the context menu (right-click) and the drag lane (pointerdown)', () => {
        const { container } = renderItems([ghost()]);
        const rect = container.querySelector('g.placed-item .item-hit-area');
        expect(rect).toBeInTheDocument();
        fireEvent(rect, new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(baseProps.setSelectedItem).toHaveBeenCalledWith({ id: 'cv-legacy', gridX: 3, gridY: 3 });
        fireEvent.pointerDown(rect);
        expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.anything(), 'cv-legacy');
    });

    it('named legacy `token` rows (the rename-fixture type) also render and stay selectable', () => {
        const { container, getByTitle } = renderItems([ghost({ id: 'tok-1', type: 'token' })]);
        expect(getByTitle('token (3,3)')).toBeInTheDocument();
        expect(container.querySelector('.item-hit-area')).toBeInTheDocument();
    });

    it('hidden ghosts dim for the GM and vanish for LAN players (shared visibility law)', () => {
        const hidden = ghost({ visible: false });
        const gm = renderItems([hidden]);
        expect(gm.container.querySelector('use[href="#generic-prop"]'))
            .toHaveAttribute('opacity', String(HIDDEN_MARKER_OPACITY));

        const lan = renderItems([hidden], { isLocalhost: false });
        expect(lan.container.querySelectorAll('g.placed-item')).toHaveLength(0);
    });

    it('a fogged ghost stays invisible to LAN players but visible to the GM', () => {
        const fog = new Map([['3,3', true]]);
        const lan = renderItems([ghost()], { isLocalhost: false, fog });
        expect(lan.container.querySelectorAll('g.placed-item')).toHaveLength(0);
        const gm = renderItems([ghost()], { fog });
        expect(gm.container.querySelectorAll('use[href="#generic-prop"]')).toHaveLength(1);
    });

    it('registered sprite/token/door types never touch the placeholder or the ghost pass', () => {
        const { container } = renderItems([
            { id: 'a', type: 'barrel', gridX: 1, gridY: 1, visible: true },
            { id: 'b', type: 'door', gridX: 2, gridY: 1, visible: true },
            { id: 'c', type: 'npc', name: 'Thug 1', gridX: 3, gridY: 1, visible: true },
            { id: 'd', type: 'monster', name: 'QA Goblin', gridX: 4, gridY: 1, visible: true },
            ghost(),
        ]);
        // Exactly one placeholder (the ghost), registered lanes keep their own bytes.
        expect(container.querySelectorAll('use[href="#generic-prop"]')).toHaveLength(1);
        expect(container.querySelector('image[href="/images/items/barrel.png"]')).toBeInTheDocument();
        expect(container.querySelector('image[href="/images/items/door.png"]')).toBeInTheDocument();
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(2);
    });

    it('renders nothing for an empty list (empty-input contract holds)', () => {
        const { container } = renderItems([]);
        expect(container.querySelector('g.placed-item, g.npc-group')).toBeNull();
    });
});
