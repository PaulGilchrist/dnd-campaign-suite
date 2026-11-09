// @maintained-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import TurnEconomyStrip from './TurnEconomyStrip.jsx';

// Regression pin — FY 2026-11-09 filed bug (turn-economy-strip-synthetic-name-
// no-holder-remap): while a Thief's-Reflexes (Second Turn) twin is the ACTIVE
// creature, its card strip and the Initiative header strip read the economy
// under the SYNTHETIC name and rendered a stale fresh face all turn, even
// though every charge writer and the gate key turnState on the HOLDER
// (economyNameFor law, navigationHandlers.js — mirrors c076dfdf1/4dc24883b).
//
// Owned here: the strip's economyName read-remap — holder-keyed spend shows on
// the twin row, display name keeps twin provenance, normal rows (economyName
// absent or === creatureName) stay byte-identical, an absent holder entry
// still defaults to a fresh face.
// NOT owned (cited, covered elsewhere):
//   seam resolution of the name itself → navigationHandlers.second-turn.test.js
//   mount wiring (which name reaches the strip) → CreatureCard / Initiative lanes
//   full render contract/gate matrix → TurnEconomyStrip.test.jsx

const HOLDER = 'EvasiveFighter';
const ST_ROW = 'EvasiveFighter (Second Turn)';

// The exact live-witness charge: twin-active, holder key actionsUsed 1 / movement 15.
const HOLDER_CHARGED = {
    [HOLDER]: {
        actionsUsed: 1,
        bonusActionsUsed: 0,
        reactionsUsed: 0,
        movementUsedFeet: 15,
        hasMoved: true,
        turnActive: true,
        reactionCap: 1,
        companionOf: null,
    },
};

beforeEach(() => {
    const store = getStore('campaign');
    store.clear();
    store.set('enforcement', { mode: 'on', turnLock: true, actionEconomy: true, movementBudget: true });
    store.set('turnState', HOLDER_CHARGED);
});

function badgeTexts() {
    return screen.getAllByTestId('creature-badge').map(el => el.textContent.trim());
}

describe('TurnEconomyStrip — (Second Turn) holder remap', () => {
    it('reads the holder key while displaying the twin row name', () => {
        render(<TurnEconomyStrip creatureName={ST_ROW} economyName={HOLDER} speedFeet={30} />);
        // The filed face: ['Action', 'Bonus', 'Reaction', '0/30 ft'] — stale fresh
        // face while the holder bucket drained. Must now mirror the holder.
        expect(badgeTexts()).toEqual(['Action used', 'Bonus', 'Reaction', '15/30 ft']);
        // Display name keeps twin provenance (strip is a per-row readout).
        expect(screen.getByText(ST_ROW)).toBeInTheDocument();
    });

    it('normal rows are byte-unchanged: no economyName, and economyName === creatureName', () => {
        const { rerender } = render(<TurnEconomyStrip creatureName={HOLDER} speedFeet={30} />);
        expect(badgeTexts()).toEqual(['Action used', 'Bonus', 'Reaction', '15/30 ft']);
        rerender(<TurnEconomyStrip creatureName={HOLDER} economyName={HOLDER} speedFeet={30} />);
        expect(badgeTexts()).toEqual(['Action used', 'Bonus', 'Reaction', '15/30 ft']);
    });

    it('reads the holder key even when only the synthetic bucket were charged — the holder entry is truth', () => {
        // A phantom synthetic-keyed record must never feed the twin strip: the
        // remap reads the holder's entry, which is fresh here.
        const store = getStore('campaign');
        store.set('turnState', { [ST_ROW]: { actionsUsed: 1, movementUsedFeet: 15 } });
        render(<TurnEconomyStrip creatureName={ST_ROW} economyName={HOLDER} speedFeet={30} />);
        expect(badgeTexts()).toEqual(['Action', 'Bonus', 'Reaction', '0/30 ft']);
    });
});
