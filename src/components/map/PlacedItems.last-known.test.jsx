// @maintained-by-ai
// Lane: last-known-position ghosting on the placed creature-token layer
// (roadmap Item 7) — the RENDER half of the rule. Since the SK 2026-11-19
// hoist the position-memory oracle runs at MAP level (Map.jsx owns the
// useLastKnownPositions call so the cache survives a 2D↔3D view flip — flip
// persistence pinned in Map.ghost-flip.test.jsx) and hands PlacedItems the
// derived ghostCells for this pass. Here PlacedItems is pure rendering: the
// ghost paints the SAME marker at the last-seen cell with the .token-ghost
// stale styling (dimmed class, honest title, no live status chips cloned onto
// remembered ground), a live fogged token with no memory stays culled, the GM
// lane (ghostCells === null) always paints truth, re-reveal snaps to truth,
// and OFF/null is byte-identical to the historic fog cull.
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
// test-utils mocks: gridCenter(x) = x * 50 + 25.
const CENTER = (cell) => cell * 50 + 25;

const monster = (over = {}) => ({
    id: 'gob-1', type: 'monster', name: 'Goblin 1',
    gridX: 2, gridY: 2, visible: true, ...over,
});

const fogOf = (...cells) => new Set(cells);
// What the parent's hoisted pass hands down: null on the GM lane / toggle OFF,
// otherwise a Map of fogged creature itemId -> last-seen {gridX, gridY}.
const ghostsOf = (entries) => new Map(entries);
const lan = (items, fog, over = {}) =>
    render(<PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
        placedItems={items} fog={fog} {...over} />);

describe('PlacedItems — last-known-position ghosts (render half)', () => {
    beforeEach(() => {
        getStore('Goblin 1').clear();
        getStore('campaign').clear();
    });

    it('ghost paints the same creature marker (monster ring) at the last-seen cell, stale-marked', () => {
        const { container } = lan(
            [monster({ gridX: 5, gridY: 7 })],
            fogOf('5,7'),
            { ghostCells: ghostsOf([['gob-1', { gridX: 2, gridY: 2 }]]) },
        );
        const ghost = container.querySelector('g.npc-group.token-ghost');
        expect(ghost).toBeInTheDocument();
        expect(ghost.querySelector('circle.npc-circle')).toHaveClass('monster-circle');
        expect(ghost.querySelector('circle.npc-circle')).toHaveAttribute('cx', String(CENTER(2)));
        expect(ghost.querySelector('circle.npc-circle')).toHaveAttribute('cy', String(CENTER(2)));
        expect(ghost.getAttribute('title')).toContain('last seen here');
        // One marker only: the true (fogged) cell paints nothing.
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
    });

    it('re-reveal snaps to truth: the current cell leaves the fog set, the parent pass empties ghostCells, and the live token paints immediately', () => {
        const view = lan(
            [monster({ gridX: 5, gridY: 7 })],
            fogOf('5,7'),
            { ghostCells: ghostsOf([['gob-1', { gridX: 2, gridY: 2 }]]) },
        );
        expect(view.container.querySelector('g.npc-group.token-ghost')).toBeInTheDocument();

        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]} fog={new Set()}
                ghostCells={new Map()} />
        );
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelector('circle.npc-circle')).toHaveAttribute('cx', String(CENTER(5)));
    });

    it('null ghostCells (toggle OFF / GM pass) is byte-identical to the historic cull: fogged monster paints nothing, ever', () => {
        const { container } = lan(
            [monster({ gridX: 5, gridY: 7 })], fogOf('5,7'), { ghostCells: null });
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(0);
    });

    it('never-seen creature in fog stays invisible (empty memory: no ghost, no pre-cognition)', () => {
        const { container } = lan(
            [monster({ gridX: 5, gridY: 7 })], fogOf('5,7'), { ghostCells: new Map() });
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(0);
    });

    it('GM always sees truth (null pass): fogged monster renders live at its REAL cell with no ghost chrome', () => {
        const view = render(
            <PlacedItems {...baseProps} isLocalhost campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]} fog={fogOf('5,7')}
                ghostCells={null} />
        );
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelector('circle.npc-circle')).toHaveAttribute('cx', String(CENTER(5)));
        // GM keeps its drag hit areas on the true token.
        expect(view.container.querySelector('rect.placed-hit-area')).toBeInTheDocument();
    });

    it('hidden-items law untouched: the hook pre-filters visible:false rows out of memory, so no ghostCells entry exists and the LAN lane culls the row', () => {
        const { container } = lan(
            [monster({ gridX: 5, gridY: 7, visible: false })],
            fogOf('5,7'),
            { ghostCells: new Map() },
        );
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(0);
    });

    it('a ghost clones no live status chips (stale ground leaks no current conditions)', () => {
        setRuntimeObject('Goblin 1', { activeConditions: ['blinded'] }, CAMPAIGN, true);
        // RG 2026-11-19 occlusion fix: chips moved to the hoisted
        // TokenStatusLayer (Map.jsx renders it after this lane), so this
        // component owns no chip DOM on ANY face — live or ghost. The live
        // chip + ghost-zero-row laws through the real composition are pinned
        // in TokenStatusLayer.test.jsx.
        const { container } = lan(
            [monster({ gridX: 5, gridY: 7 })],
            fogOf('5,7'),
            { ghostCells: ghostsOf([['gob-1', { gridX: 2, gridY: 2 }]]) },
        );
        expect(container.querySelector('g.npc-group.token-ghost')).toBeInTheDocument();
        expect(container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
    });

    it('props never ghost (creature lanes only — the hook never records non-creature rows)', () => {
        const barrel = { id: 'b-1', type: 'barrel', gridX: 2, gridY: 2, visible: true };
        const { container } = lan(
            [{ ...barrel, gridX: 5, gridY: 7 }], fogOf('5,7'), { ghostCells: new Map() });
        expect(container.querySelectorAll('.placed-item')).toHaveLength(0);
        expect(container.querySelector('.token-ghost')).toBeNull();
    });
});
