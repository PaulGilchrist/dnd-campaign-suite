// @maintained-by-ai
// Lane: TurnEconomyStrip GM-movement ADVISORY (owner decision 2026-11-10 —
// "GM moves are free by design", advisory only, zero enforcement change).
//
// Backlog face: NPC placedItems tokens drag free across the board while PC
// tokens hard-clamp at sheet speed (movementBudget is player-token-only),
// yet a monster's own economy strip still renders a used/ft movement
// denominator. The design law now lives in useItemDragging.js and the
// movement badge on a non-player row explains it via its title tooltip.
// This file pins the shipped advisory bytes and proves the player-row
// tooltip is byte-unchanged (no behavioral copy drift).
//
// Zero-module-mock leaf (exemplar: TurnEconomyStrip.test.jsx) — the real
// in-memory campaign store is seeded directly, no mocks needed.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import TurnEconomyStrip from './TurnEconomyStrip.jsx';

// Shipped copy verbatim (design law header in useItemDragging.js).
const ADVISORY =
    'GM-driven moves are not charged against this budget — monster movement is GM-adjudicated, so the drag clamp is player-token-only by design (these moves still provoke opportunity reactions).';

function prime(turnState) {
    getStore('campaign').set('enforcement', { mode: 'on', movementBudget: true });
    if (turnState !== undefined) getStore('campaign').set('turnState', turnState);
}

beforeEach(() => {
    getStore('campaign').clear();
});

function movementBadge(name) {
    const strip = screen.getByLabelText(`Turn economy for ${name}`);
    return Array.from(strip.querySelectorAll('.creature-badge')).find(b => /\d+\/\d+ ft/.test(b.textContent));
}

describe('TurnEconomyStrip — GM-movement advisory tooltip', () => {
    it('gmMovement row: movement badge title carries the shipped "GM moves are free by design" advisory', () => {
        prime({ Wolf: { movementUsedFeet: 0 } });
        render(<TurnEconomyStrip creatureName="Wolf" speedFeet={40} gmMovement />);
        const badge = movementBadge('Wolf');
        expect(badge.textContent.trim()).toBe('0/40 ft');
        expect(badge.getAttribute('title')).toBe(ADVISORY);
    });

    it('gmMovement row: the action/bonus/reaction segments keep their plain tooltips (advisory is movement-segment-only)', () => {
        prime();
        render(<TurnEconomyStrip creatureName="Wolf" speedFeet={40} gmMovement />);
        const titles = screen.getAllByTestId('creature-badge').map(el => el.getAttribute('title'));
        expect(titles.slice(0, 3)).toEqual(['Action this turn', 'Bonus this turn', 'Reaction this turn']);
        expect(titles[3]).toBe(ADVISORY);
    });

    it('player row (gmMovement omitted): movement badge title stays byte-identical to the remaining-ft copy', () => {
        prime({ Rakan: { movementUsedFeet: 10 } });
        render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} />);
        expect(movementBadge('Rakan').getAttribute('title')).toBe('20 ft of movement remaining this turn');
    });

    it('gmMovement={false} behaves exactly like the omitted prop (player lane unchanged)', () => {
        prime();
        render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} gmMovement={false} />);
        expect(movementBadge('Rakan').getAttribute('title')).toBe('30 ft of movement remaining this turn');
    });

    // Accessibility mirror (backlog 2026-11-10 GB improvement): the advisory
    // was title-only, invisible on touch + unreliable for screen readers.
    // Every GM face now ALSO carries it in the badge aria-label; only the
    // space-rich card face (showGmHint) additionally renders the visible
    // "(GM-driven)" hint. Player faces stay byte-unchanged (no aria-label,
    // no hint).
    it('gmMovement row: movement badge aria-label mirrors the advisory copy', () => {
        prime({ Wolf: { movementUsedFeet: 0 } });
        render(<TurnEconomyStrip creatureName="Wolf" speedFeet={40} gmMovement />);
        expect(movementBadge('Wolf').getAttribute('aria-label')).toBe(`0/40 ft — ${ADVISORY}`);
    });

    it('card face (showGmHint): movement badge renders the visible "(GM-driven)" hint', () => {
        prime({ Wolf: { movementUsedFeet: 0 } });
        render(<TurnEconomyStrip creatureName="Wolf" speedFeet={40} gmMovement showGmHint />);
        const badge = movementBadge('Wolf');
        expect(badge.textContent.trim()).toBe('0/40 ft (GM-driven)');
        const hint = badge.querySelector('.turn-economy-gm-hint');
        expect(hint).not.toBeNull();
        expect(hint.textContent).toBe('(GM-driven)');
        // aria + title lanes keep the full advisory bytes alongside the hint
        expect(badge.getAttribute('aria-label')).toBe(`0/40 ft — ${ADVISORY}`);
        expect(badge.getAttribute('title')).toBe(ADVISORY);
    });

    it('header face (showGmHint omitted): movement label stays byte-unchanged (compact, aria-only advisory)', () => {
        prime({ Wolf: { movementUsedFeet: 0 } });
        render(<TurnEconomyStrip creatureName="Wolf" speedFeet={40} gmMovement />);
        expect(movementBadge('Wolf').textContent.trim()).toBe('0/40 ft');
        expect(movementBadge('Wolf').querySelector('.turn-economy-gm-hint')).toBeNull();
    });

    it('player row: no hint, no advisory aria-label (accessible name stays the honest face)', () => {
        prime({ Rakan: { movementUsedFeet: 10 } });
        render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} showGmHint />);
        const badge = movementBadge('Rakan');
        expect(badge.getAttribute('aria-label')).toBeNull();
        expect(badge.querySelector('.turn-economy-gm-hint')).toBeNull();
        expect(badge.textContent.trim()).toBe('10/30 ft');
    });
});
