// @maintained-by-ai
// Split-party presence core (plan initiative-split-party): the away-flag
// predicate, the end-of-round rejoin slot, board sort (away rows LAST), and
// the shared presence mutation both the card toggle and the bulk modal ride.
// Turn-navigation consumption is pinned in initiativeService.presence.test.js.
import { describe, it, expect } from 'vitest';
import {
    isCreaturePresent,
    computeEndOfRoundInitiative,
    sortCreaturesForBoard,
    applyPresenceChanges,
} from './creaturePresence.js';

const pc = (name, extra = {}) => ({ name, type: 'player', initiative: '', ...extra });
const npc = (name, extra = {}) => ({ name, type: 'npc', initiative: '10', ...extra });

describe('isCreaturePresent', () => {
    it('player rows: only away===true is absent (undefined/false ⇒ present)', () => {
        expect(isCreaturePresent(pc('A'))).toBe(true);
        expect(isCreaturePresent(pc('A', { away: false }))).toBe(true);
        expect(isCreaturePresent(pc('A', { away: true }))).toBe(false);
    });
    it('NPC/monster rows are always present (flag meaningless off players)', () => {
        expect(isCreaturePresent(npc('Goblin', { away: true }))).toBe(true);
    });
});

describe('computeEndOfRoundInitiative', () => {
    it('returns the lowest rolled value among PRESENT creatures', () => {
        expect(computeEndOfRoundInitiative([
            pc('A', { initiative: '18' }), pc('B', { initiative: '7' }), npc('G', { initiative: '12' }),
        ])).toBe(7);
    });
    it('blank slots are unrolled, not zero; away rows contribute nothing', () => {
        expect(computeEndOfRoundInitiative([
            pc('A', { initiative: '' }), pc('B', { initiative: '9', away: true }), npc('G', { initiative: '12' }),
        ])).toBe(12);
    });
    it('null when nobody present has rolled', () => {
        expect(computeEndOfRoundInitiative([pc('A'), pc('B', { away: true, initiative: '5' })])).toBeNull();
        expect(computeEndOfRoundInitiative([])).toBeNull();
        expect(computeEndOfRoundInitiative(null)).toBeNull();
    });
});

describe('sortCreaturesForBoard', () => {
    it('rolled descending, unrolled after, AWAY rows strictly last', () => {
        const cs = { creatures: [
            pc('ZedAway', { initiative: '', away: true }),
            pc('AnnUnrolled', { initiative: '' }),
            npc('Goblin', { initiative: '3' }),
            pc('Bo', { initiative: '15' }),
            npc('Orc', { initiative: '20' }),
            pc('Cy', { initiative: '20' }),
        ] };
        sortCreaturesForBoard(cs);
        expect(cs.creatures.map(c => c.name)).toEqual(['Cy', 'Orc', 'Bo', 'Goblin', 'AnnUnrolled', 'ZedAway']);
    });
});

describe('applyPresenceChanges', () => {
    it('split marks away AND wipes initiative (card parks at the back)', () => {
        const cs = { creatures: [pc('Ann', { initiative: '17' }), pc('Bo', { initiative: '9' }), npc('Goblin')] };
        const changes = applyPresenceChanges(cs, { Ann: true });
        expect(changes).toEqual([{ name: 'Ann', away: true, initiative: '' }]);
        // Goblin(10) > Bo(9) > blanked-away Ann parked last.
        expect(cs.creatures.map(c => c.name)).toEqual(['Goblin', 'Bo', 'Ann']);
        expect(cs.creatures[2]).toMatchObject({ name: 'Ann', away: true, initiative: '' });
    });

    it('rejoin clears the flag and auto-lands at the lowest PRESENT roll', () => {
        const cs = { creatures: [pc('Ann', { initiative: '17' }), pc('Bo', { initiative: '9', away: true, }) , pc('Cy', { initiative: '12' })] };
        cs.creatures[1].initiative = ''; // split wipes it — the realistic rejoin base
        const changes = applyPresenceChanges(cs, { Bo: false });
        expect(changes).toEqual([{ name: 'Bo', away: false, initiative: '12' }]);
        expect(cs.creatures.find(c => c.name === 'Bo').away).toBeUndefined();
        // Lowest present roll is 12 (Cy); Bo lands there, the 12s tie-break by name ascending.
        expect(cs.creatures.map(c => c.name)).toEqual(['Ann', 'Bo', 'Cy']);
    });

    it('rejoin with nobody rolled leaves the slot blank', () => {
        const cs = { creatures: [pc('Ann', { initiative: '' }), pc('Bo', { away: true, initiative: '' })] };
        const changes = applyPresenceChanges(cs, { Bo: false });
        expect(changes).toEqual([{ name: 'Bo', away: false, initiative: '' }]);
    });

    it('bulk change computes the end-of-round slot ONCE against the pre-change present set', () => {
        const cs = { creatures: [
            pc('Ann', { initiative: '17' }),
            pc('Bo', { away: true, initiative: '' }),
            pc('Cy', { away: true, initiative: '' }),
            npc('Goblin', { initiative: '6' }),
        ] };
        const changes = applyPresenceChanges(cs, { Ann: true, Bo: false, Cy: false });
        // Pre-change lowest present = Goblin 6 — both rejoiners land there.
        expect(changes).toEqual([
            { name: 'Ann', away: true, initiative: '' },
            { name: 'Bo', away: false, initiative: '6' },
            { name: 'Cy', away: false, initiative: '6' },
        ]);
        // Board: 6s tie-break by name (Bo, Cy, Goblin), blanked away Ann last.
        expect(cs.creatures.map(c => c.name)).toEqual(['Bo', 'Cy', 'Goblin', 'Ann']);
    });

    it('inert inputs: unknown names, NPCs, unchanged state, missing rows', () => {
        const cs = { creatures: [pc('Ann', { initiative: '17' }), npc('Goblin')] };
        expect(applyPresenceChanges(cs, { Ghost: true, Goblin: true, Ann: false })).toEqual([]);
        expect(applyPresenceChanges(cs, { Ann: true })).toHaveLength(1);
        expect(applyPresenceChanges(cs, { Ann: true })).toEqual([]); // already away
        expect(applyPresenceChanges(null, { Ann: true })).toEqual([]);
        expect(applyPresenceChanges({ creatures: [] }, {})).toEqual([]);
    });

    // ── Second-turn twin rejoin anchoring (FU 2026-11-09) ──────────────────
    // The grant law (thiefsReflexesService.js) authors the twin at holder
    // initiative − 10; Away→Rejoin must re-anchor to that seam instead of
    // re-rolling to the end-of-round slot (the old 19→10→3 drift).
    const twin = (holder, extra = {}) => pc(`${holder} (Second Turn)`, { secondTurn: true, holderName: holder, ...extra });

    it('split still wipes a second-turn twin (away law unchanged)', () => {
        const cs = { creatures: [pc('Ann', { initiative: '25' }), twin('Ann', { initiative: '15' })] };
        const changes = applyPresenceChanges(cs, { 'Ann (Second Turn)': true });
        expect(changes).toEqual([{ name: 'Ann (Second Turn)', away: true, initiative: '' }]);
        const row = cs.creatures.find(c => c.name === 'Ann (Second Turn)');
        expect(row).toMatchObject({ away: true, initiative: '', secondTurn: true, holderName: 'Ann' });
        // Away rows park strictly last (holder 25 first).
        expect(cs.creatures.map(c => c.name)).toEqual(['Ann', 'Ann (Second Turn)']);
    });

    it('ST rejoin re-anchors to holder initiative − 10 (grant law), not end-of-round', () => {
        const cs = { creatures: [
            pc('Ann', { initiative: '25' }),
            twin('Ann', { initiative: '', away: true }), // split wiped the slot
            pc('Cy', { initiative: '12' }), // end-of-round would be 12 — anchor wins
        ] };
        const changes = applyPresenceChanges(cs, { 'Ann (Second Turn)': false });
        expect(changes).toEqual([
            { name: 'Ann (Second Turn)', away: false, initiative: '15', holderName: 'Ann' },
        ]);
        expect(cs.creatures.find(c => c.name === 'Ann (Second Turn)').away).toBeUndefined();
    });

    it('ST rejoin anchors to the holder\'s CURRENT initiative (seam follows edits)', () => {
        const cs = { creatures: [pc('Ann', { initiative: '8' }), twin('Ann', { initiative: '', away: true })] };
        const changes = applyPresenceChanges(cs, { 'Ann (Second Turn)': false });
        // 8 − 10 = −2: the grant arithmetic has no clamp — mirrored exactly.
        expect(changes[0].initiative).toBe('-2');
    });

    it('ST rejoin falls back to end-of-round when holder initiative is blank', () => {
        const cs = { creatures: [
            pc('Ann', { initiative: '' }), // holder unrolled
            twin('Ann', { initiative: '', away: true }),
            pc('Cy', { initiative: '12' }),
        ] };
        const changes = applyPresenceChanges(cs, { 'Ann (Second Turn)': false });
        expect(changes).toEqual([{ name: 'Ann (Second Turn)', away: false, initiative: '12' }]);
    });

    it('ST rejoin falls back to end-of-round when the holder row is absent', () => {
        const cs = { creatures: [twin('Ghost', { initiative: '', away: true }), pc('Cy', { initiative: '12' })] };
        const changes = applyPresenceChanges(cs, { 'Ghost (Second Turn)': false });
        expect(changes).toEqual([{ name: 'Ghost (Second Turn)', away: false, initiative: '12' }]);
    });

    it('ST twin without holderName keeps the end-of-round law', () => {
        const cs = { creatures: [pc('Zed', { initiative: '', away: true, secondTurn: true }), pc('Cy', { initiative: '9' })] };
        const changes = applyPresenceChanges(cs, { Zed: false });
        expect(changes).toEqual([{ name: 'Zed', away: false, initiative: '9' }]);
    });

    it('mixed bulk rejoin: PC lands end-of-round, ST twin anchors holder−10 (own law each)', () => {
        const cs = { creatures: [
            pc('Ann', { initiative: '25' }),
            twin('Ann', { initiative: '', away: true }),
            pc('Bo', { initiative: '', away: true }),
            npc('Goblin', { initiative: '6' }),
        ] };
        const changes = applyPresenceChanges(cs, { 'Ann (Second Turn)': false, Bo: false });
        expect(changes).toEqual([
            { name: 'Ann (Second Turn)', away: false, initiative: '15', holderName: 'Ann' },
            { name: 'Bo', away: false, initiative: '6' },
        ]);
    });

    it('non-ST rows are byte-identical to the old law (PC lands lowest present roll)', () => {
        // Same fixture as the classic rejoin test — no holderName/secondTurn
        // anywhere, end-of-round must win exactly as before.
        const cs = { creatures: [pc('Ann', { initiative: '17' }), pc('Bo', { away: true }), pc('Cy', { initiative: '12' })] };
        const changes = applyPresenceChanges(cs, { Bo: false });
        expect(changes).toEqual([{ name: 'Bo', away: false, initiative: '12' }]);
    });
});
