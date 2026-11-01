// @maintained-by-ai: 2026-11-01
// Regression (bug-ai-dress-tokens-invisible-write-only-lane): AI-Dress monster
// tokens now persist as placedItems rows of type 'monster' — the renderer
// MUST draw them (the legacy items[] lane draw zero was the bug). Monster
// markers reuse the NPC token machinery (g.npc-group, title label, fog/
// visibility rules, GM hit areas) and read distinct via the purple
// .monster-circle ring + skull glyph. NPC bytes stay byte-identical (pinned
// by the PlacedItems family; this file only adds the monster leg).

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';
import { HIDDEN_MARKER_OPACITY } from '../../config/mapConfig';

const renderItems = (items, over = {}) =>
    render(<PlacedItems {...baseProps} {...over} placedItems={items} />);

const monster = (over) => ({
    id: 'ai-dress-token-3-3-0', name: 'QA Goblin', type: 'monster',
    gridX: 3, gridY: 3, visible: true, ...over,
});

describe('PlacedItems — creature token lane (monster rows render)', () => {
    beforeEach(() => baseProps.setSelectedItem.mockClear());

    it('renders a placed monster token with the npc-group marker, title and name label', () => {
        const { container, getByTitle } = renderItems([monster()]);
        const g = getByTitle('QA Goblin');
        expect(g).toHaveClass('npc-group');
        expect(container.querySelector('circle.npc-circle.monster-circle')).toBeInTheDocument();
        expect(container.querySelector('text.npc-name')).toHaveTextContent('QA Goblin');
        expect(container.querySelector('text.npc-initial')).toHaveTextContent('☠');
    });

    it('NPC markers keep the red ring and the name initial (no monster styling)', () => {
        const { container } = renderItems([
            { id: 'npc-1', name: 'Thug 1', type: 'npc', gridX: 2, gridY: 1, visible: true },
        ]);
        const circle = container.querySelector('circle.npc-circle');
        expect(circle).not.toHaveClass('monster-circle');
        expect(container.querySelector('text.npc-initial')).toHaveTextContent('T');
    });

    it('hidden monsters dim for the GM and vanish for LAN players (shared visibility law)', () => {
        const hidden = monster({ visible: false });
        const gm = renderItems([hidden]);
        expect(gm.container.querySelectorAll('g.npc-group')).toHaveLength(1);
        expect(gm.container.querySelector('circle.npc-circle')).toHaveStyle({ opacity: HIDDEN_MARKER_OPACITY });

        const lan = renderItems([hidden], { isLocalhost: false });
        expect(lan.container.querySelectorAll('g.npc-group')).toHaveLength(0);
    });

    it('a fogged monster stays invisible to LAN players but visible to the GM', () => {
        const fog = new Map([['3,3', true]]);
        const lan = renderItems([monster()], { isLocalhost: false, fog });
        expect(lan.container.querySelectorAll('g.npc-group')).toHaveLength(0);
        const gm = renderItems([monster()], { fog });
        expect(gm.container.querySelectorAll('g.npc-group')).toHaveLength(1);
    });

    it('the GM hit area (drag + right-click menu wiring) covers monster tokens', () => {
        const { container } = renderItems([monster()]);
        const rect = container.querySelector('g.npc-group rect[fill="transparent"]');
        expect(rect).toBeInTheDocument();
        // right-click opens the ItemContextMenu lane via setSelectedItem
        fireEvent(rect, new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(baseProps.setSelectedItem).toHaveBeenCalledWith({ id: 'ai-dress-token-3-3-0', gridX: 3, gridY: 3 });
    });
});
