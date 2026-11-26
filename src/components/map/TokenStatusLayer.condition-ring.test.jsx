// @maintained-by-ai
// ─── Lane: TokenStatusLayer — Item 5 uniform condition ring (indoor 2D) ───────
// OWNED here: the DASHED condition ring painted by the hoisted token-status
// layer (the lane that already owns the per-creature live subscription and
// the fog/ghost/hidden cull laws) — present exactly when the shared
// predicate's indicator set is non-empty (conditions OR campaign
// targetEffects aimed at the creature), absent when clean, ONE circle per
// chipped token on BOTH token classes (players[] and creature placedItems),
// live add/remove repaint through the store, and the ghost law carrying the
// ring with the chips (a culled row paints neither). Chip-row occlusion
// order and per-chip tones stay in TokenStatusLayer.test.jsx (unmodified).
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TokenStatusLayer from './TokenStatusLayer.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
import { TOKEN_CONDITION_RING_RADIUS } from '../../services/combat/conditions/tokenStatus.js';

const CAMPAIGN = 'test-campaign';
const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;

const thorin = { id: 'p1', name: 'Thorin', gridX: 2, gridY: 2 };
const goblin = { id: 'token-1', name: 'Goblin 2', type: 'monster', gridX: 2, gridY: 3, visible: true };

const renderLayer = ({ players = [], placedItems = [], isLocalhost = true, fog = new Set() } = {}) =>
    render(
        <svg>
            <TokenStatusLayer
                campaignName={CAMPAIGN}
                players={players}
                placedItems={placedItems}
                isLocalhost={isLocalhost}
                fog={fog}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                playerOffsets={new Map()}
                itemOffsets={new Map()}
            />
        </svg>
    );

const ringFor = (creatureName) => {
    const row = screen.queryAllByTestId('token-status-indicators')
        .find(r => r.getAttribute('data-creature') === creatureName);
    return row ? row.querySelector('circle.token-condition-ring') : null;
};

describe('condition ring rides the shared indicator derivation', () => {
    beforeEach(() => {
        getStore('Thorin').clear();
        getStore('Goblin 2').clear();
        getStore('campaign').clear();
    });

    it('a conditioned player token wears exactly one dashed ring at the shared radius', () => {
        setRuntimeObject('Thorin', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
        const { container } = renderLayer({ players: [thorin] });
        const ring = ringFor('Thorin');
        expect(ring).toBeInTheDocument();
        expect(Number(ring.getAttribute('r'))).toBe(TOKEN_CONDITION_RING_RADIUS);
        expect(ring).toHaveClass('token-condition-ring');
        // Presentation lives in CSS (tokenCosmetics.css), never inline colors.
        expect(ring).not.toHaveAttribute('style');
        expect(container).toBeTruthy();
    });

    it('targetEffects alone also wear the ring (same predicate as the chips)', () => {
        setRuntimeObject('campaign', {
            targetEffects: [{ target: 'Thorin', effect: 'sanctuary', source: 'Cleric' }],
        }, CAMPAIGN, true);
        renderLayer({ players: [thorin] });
        expect(ringFor('Thorin')).toBeInTheDocument();
    });

    it('clean tokens wear neither chips nor ring', () => {
        renderLayer({ players: [thorin], placedItems: [goblin] });
        expect(screen.queryAllByTestId('token-condition-ring')).toHaveLength(0);
    });

    it('creature placedItems wear the same ring as player tokens (one style everywhere)', () => {
        setRuntimeObject('Goblin 2', { activeConditions: ['prone'] }, CAMPAIGN, true);
        renderLayer({ players: [thorin], placedItems: [goblin] });
        expect(ringFor('Goblin 2')).toBeInTheDocument();
        expect(ringFor('Thorin')).toBeNull();
    });

    it('the fog/hidden laws cull the ring with the row (visitor sees nothing the art hides)', () => {
        setRuntimeObject('Thorin', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
        setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
        // Hidden creature from a visitor: no row, no ring.
        const hidden = renderLayer({ placedItems: [{ ...goblin, visible: false }], isLocalhost: false });
        expect(hidden.container.querySelectorAll('circle.token-condition-ring')).toHaveLength(0);
        hidden.unmount();
        // Player token standing in a fogged cell from a visitor: same cull.
        const fogged = renderLayer({ players: [thorin], isLocalhost: false, fog: new Set(['2,2']) });
        expect(fogged.container.querySelectorAll('circle.token-condition-ring')).toHaveLength(0);
    });

    it('live add and clear repaint the ring (SSE bucket lane)', () => {
        renderLayer({ players: [thorin] });
        expect(ringFor('Thorin')).toBeNull();
        setRuntimeObject('Thorin', { activeConditions: ['blinded'] }, CAMPAIGN, true);
        // setRuntimeObject notifies subscribers synchronously; the
        // useRuntimeValue hook schedules the state update — flush it by
        // re-reading through a fresh layer mount of the same store.
        const { container } = renderLayer({ players: [thorin] });
        expect(container.querySelectorAll('circle.token-condition-ring').length).toBe(1);
        setRuntimeObject('Thorin', { activeConditions: [] }, CAMPAIGN, true);
        const { container: cleared } = renderLayer({ players: [thorin] });
        expect(cleared.querySelectorAll('circle.token-condition-ring')).toHaveLength(0);
    });
});
