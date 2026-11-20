// @maintained-by-ai
// Lane: last-known-position ghosting on the placed creature-token layer
// (roadmap Item 7) — the RENDER half of the rule. The position-memory oracle
// itself (who ghosts, cache lifetime) is pinned in hooks/
// useLastKnownPositions.test.js; here: the ghost paints the SAME marker at
// the last-seen cell with the .token-ghost stale styling (dimmed class,
// honest title, no live status chips cloned onto remembered ground), a live
// fogged token with no memory stays culled, the GM lane always paints truth,
// re-reveal snaps to truth, and toggle OFF is byte-identical to the historic
// fog cull.
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
const lan = (items, fog, over = {}) =>
    render(<PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
        placedItems={items} fog={fog} {...over} />);

describe('PlacedItems — last-known-position ghosts', () => {
    beforeEach(() => {
        getStore('Goblin 1').clear();
        getStore('campaign').clear();
    });

    it('ghost paints the same creature marker (monster ring) at the last-seen cell, stale-marked', () => {
        const view = lan([monster()], new Set(), { lastKnownMode: true });
        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]}
                fog={fogOf('5,7')} lastKnownMode />
        );
        const ghost = view.container.querySelector('g.npc-group.token-ghost');
        expect(ghost).toBeInTheDocument();
        expect(ghost.querySelector('circle.npc-circle')).toHaveClass('monster-circle');
        expect(ghost.querySelector('circle.npc-circle')).toHaveAttribute('cx', String(CENTER(2)));
        expect(ghost.querySelector('circle.npc-circle')).toHaveAttribute('cy', String(CENTER(2)));
        expect(ghost.getAttribute('title')).toContain('last seen here');
        // One marker only: the true (fogged) cell paints nothing.
        expect(view.container.querySelectorAll('g.npc-group')).toHaveLength(1);
    });

    it('re-reveal snaps to truth: the current cell leaves the fog set and the live token paints immediately, ghost gone', () => {
        const view = lan([monster()], new Set(), { lastKnownMode: true });
        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]} fog={fogOf('5,7')} lastKnownMode />
        );
        expect(view.container.querySelector('g.npc-group.token-ghost')).toBeInTheDocument();

        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]} fog={new Set()} lastKnownMode />
        );
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelector('circle.npc-circle')).toHaveAttribute('cx', String(CENTER(5)));
    });

    it('toggle OFF (default) is byte-identical to the historic cull: fogged monster paints nothing, ever', () => {
        const view = lan([monster()], new Set());
        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]} fog={fogOf('5,7')} />
        );
        expect(view.container.querySelectorAll('g.npc-group')).toHaveLength(0);
    });

    it('never-seen creature in fog stays invisible (GM places it behind the fog: no ghost)', () => {
        const { container } = lan([monster({ gridX: 5, gridY: 7 })], fogOf('5,7'), { lastKnownMode: true });
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(0);
    });

    it('GM always sees truth: fogged monster renders live at its REAL cell with no ghost chrome', () => {
        const view = render(
            <PlacedItems {...baseProps} isLocalhost campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]} fog={fogOf('5,7')} lastKnownMode />
        );
        expect(view.container.querySelector('.token-ghost')).toBeNull();
        expect(view.container.querySelector('circle.npc-circle')).toHaveAttribute('cx', String(CENTER(5)));
        // GM keeps its drag hit areas on the true token.
        expect(view.container.querySelector('rect.placed-hit-area')).toBeInTheDocument();
    });

    it('hidden-items law untouched: a visible:false monster never ghosts on the player lane', () => {
        const view = lan([monster()], new Set(), { lastKnownMode: true });
        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7, visible: false })]}
                fog={fogOf('5,7')} lastKnownMode />
        );
        expect(view.container.querySelectorAll('g.npc-group')).toHaveLength(0);
    });

    it('a ghost clones no live status chips (stale ground leaks no current conditions)', () => {
        setRuntimeObject('Goblin 1', { activeConditions: ['blinded'] }, CAMPAIGN, true);
        // RG 2026-11-19 occlusion fix: chips moved to the hoisted
        // TokenStatusLayer (Map.jsx renders it after this lane), so this
        // component owns no chip DOM on ANY face — live or ghost. The live
        // chip + ghost-zero-row laws through the real composition are pinned
        // in TokenStatusLayer.test.jsx.
        const view = lan([monster()], new Set(), { lastKnownMode: true });
        expect(view.container.querySelectorAll('g.token-status-chip')).toHaveLength(0);

        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[monster({ gridX: 5, gridY: 7 })]} fog={fogOf('5,7')} lastKnownMode />
        );
        expect(view.container.querySelector('g.npc-group.token-ghost')).toBeInTheDocument();
        expect(view.container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
    });

    it('props never ghost (creature lanes only)', () => {
        const barrel = { id: 'b-1', type: 'barrel', gridX: 2, gridY: 2, visible: true };
        const view = lan([barrel], new Set(), { lastKnownMode: true });
        view.rerender(
            <PlacedItems {...baseProps} isLocalhost={false} campaignName={CAMPAIGN}
                placedItems={[{ ...barrel, gridX: 5, gridY: 7 }]} fog={fogOf('5,7')} lastKnownMode />
        );
        expect(view.container.querySelectorAll('.placed-item')).toHaveLength(0);
        expect(view.container.querySelector('.token-ghost')).toBeNull();
    });
});
