// @maintained-by-ai
// Backlog 2026-11-22 (OOO) — incomplete-face pill copy pin: ONE all-lowercase
// label style (npcs/settlements/factions/quests), enumerated in lane order,
// built by the exported pure function the component renders verbatim.
// Component rendering is pinned by AiWorldConsole.ledger-incomplete.test.jsx.
import { incompleteLedgerCopy } from './incompleteLedgerCopy.js';

describe('incompleteLedgerCopy — exact pill copy, all-lowercase labels', () => {
    it('single lane → names it verbatim', () => {
        expect(incompleteLedgerCopy(['factions'])).toBe('Ledger check incomplete — factions unreadable');
    });

    it('npc lane → lowercase "npcs", never "NPC roster"', () => {
        expect(incompleteLedgerCopy(['npcs'])).toBe('Ledger check incomplete — npcs unreadable');
    });

    it('all four lanes, in lane order regardless of input order', () => {
        expect(incompleteLedgerCopy(['quests', 'factions', 'npcs', 'settlements']))
            .toBe('Ledger check incomplete — npcs, settlements, factions, quests unreadable');
    });

    it('empty / unknown / non-array input → empty string (component no-render contract)', () => {
        expect(incompleteLedgerCopy([])).toBe('');
        expect(incompleteLedgerCopy(['dragons'])).toBe('');
        expect(incompleteLedgerCopy(null)).toBe('');
        expect(incompleteLedgerCopy(undefined)).toBe('');
    });

    it('unknown keys are dropped; known ones still enumerate in lane order', () => {
        expect(incompleteLedgerCopy(['factions', 'dragons']))
            .toBe('Ledger check incomplete — factions unreadable');
    });
});
