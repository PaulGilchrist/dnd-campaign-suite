// @maintained-by-ai
// Backlog 2026-11-01 (AV) — quest_draft accept-scrutiny scrubbing lane:
// unknown proper names are named by the advisory, ledger-known names stay
// silent, and an empty/missing ledger degrades gracefully (never guesses).
// Component rendering of the chip is AiWorldConsole.name-scrutiny.test.jsx.
import { extractProperNameRuns, findUnknownLedgerNames, ledgerNameList } from './proposalNameAudit.js';

const LEDGERS = {
    npcNames: ['Marta Copperkettle'],
    settlementNames: ['Bravor'],
};

const quest = (description, rewards) => ({ kind: 'quest_draft', name: 'The Sunken Vault', description, rewards });

describe('extractProperNameRuns — the prose scrub', () => {
    it('finds multi-word and hyphenated candidates, joined as phrases', () => {
        expect(extractProperNameRuns('Deliver the seal to Nobody McFakeface beneath Nowhere-on-Sea.'))
            .toEqual(['Nobody McFakeface', 'Nowhere-on-Sea']);
    });

    it('skips sentence-initial single words (verbs capitalise too) but not sentence-initial phrases', () => {
        expect(extractProperNameRuns('Recover the ledger.')).toEqual([]);
        expect(extractProperNameRuns('Nobody McFakeface wants it back.')).toEqual(['Nobody McFakeface']);
        expect(extractProperNameRuns('Nowhere-on-Sea lies below.')).toEqual(['Nowhere-on-Sea']); // hyphen = name signal
    });

    it('skips acronyms/Roman numerals and lone tokens (I, A)', () => {
        expect(extractProperNameRuns('Pay II at DC 15 for I and A.'))
            .toEqual([]);
    });

    it('non-string / empty input is graceful', () => {
        expect(extractProperNameRuns(null)).toEqual([]);
        expect(extractProperNameRuns('')).toEqual([]);
        expect(extractProperNameRuns(42)).toEqual([]);
    });
});

describe('findUnknownLedgerNames — advisory names only the unknowns', () => {
    it('unknown name → the advisory names it (in order, deduped)', () => {
        expect(findUnknownLedgerNames(
            quest('Bring it to Nobody McFakeface beneath Nowhere-on-Sea, then warn Nobody McFakeface again.'),
            LEDGERS,
        )).toEqual(['Nobody McFakeface', 'Nowhere-on-Sea']);
    });

    it('ledger-known name → no advisory (case-insensitive, partial-name counts)', () => {
        expect(findUnknownLedgerNames(quest('Deliver it to Marta Copperkettle in Bravor.'), LEDGERS)).toEqual([]);
        expect(findUnknownLedgerNames(quest('Report to MARTA copperkettle at dusk in Bravor.'), LEDGERS)).toEqual([]);
        expect(findUnknownLedgerNames(quest("Deliver Marta's ledger quietly."), LEDGERS)).toEqual([]); // possessive folds
        expect(findUnknownLedgerNames(quest('Deliver it to Marta.'), LEDGERS)).toEqual([]); // first name still grounds
    });

    it('mixed prose → only the unrecognised names surface', () => {
        expect(findUnknownLedgerNames(quest('Deliver it to Marta on behalf of Nobody McFakeface.'), LEDGERS))
            .toEqual(['Nobody McFakeface']);
    });

    it('rewards prose is checked alongside the description', () => {
        expect(findUnknownLedgerNames(quest('A quiet errand.', 'A nod from Nobody McFakeface'), LEDGERS))
            .toEqual(['Nobody McFakeface']);
    });

    it('empty or missing ledger → graceful silence (nothing to check against)', () => {
        const fabricated = quest('Bring it to Nobody McFakeface beneath Nowhere-on-Sea.');
        expect(findUnknownLedgerNames(fabricated, { npcNames: [], settlementNames: [] })).toEqual([]);
        expect(findUnknownLedgerNames(fabricated, null)).toEqual([]);
        expect(findUnknownLedgerNames(fabricated, undefined)).toEqual([]);
    });

    it('no checkable names in prose → nothing advisory', () => {
        expect(findUnknownLedgerNames(quest('Recover the lost ledger and return it quietly.'), LEDGERS)).toEqual([]);
    });

    it('only quest_draft is scrutinised — sibling kinds never query the ledgers', () => {
        expect(findUnknownLedgerNames({ kind: 'npc_dialogue', npcName: 'Nobody McFakeface', text: 'hi' }, LEDGERS)).toEqual([]);
        expect(findUnknownLedgerNames({ kind: 'rumor', text: 'Nobody McFakeface lurks.' }, LEDGERS)).toEqual([]);
        expect(findUnknownLedgerNames(null, LEDGERS)).toEqual([]);
    });

    it('the quest title itself is a title, never an unrecognised reference', () => {
        expect(findUnknownLedgerNames(quest('A simple errand for Marta.'), LEDGERS)).toEqual([]);
    });
});

describe('findUnknownLedgerNames — possessive/plural face (YB 2026-11-13)', () => {
    // Documented rule: POSSESSIVE variants resolve stem-exact against the
    // ledger — a candidate is suppressed when its normalised phrase, minus a
    // trailing "'s" / "’s" (any possessive) or a plain plural "s" (ONLY when
    // the de-s stem IS an exact ledger name), equals a ledger name. Never
    // fuzzy: a typo sharing most words ("Iron Conshortium") stays flagged,
    // and "Iron Consortiumii" (not the ledger stem) stays flagged.
    const LEDGERS = {
        npcNames: ['Marta Copperkettle'],
        settlementNames: ['Ironhaven'],
        factionNames: ['The Iron Consortium'],
    };

    it("straight- and curly-quote possessives of a ledger name are suppressed", () => {
        expect(findUnknownLedgerNames(quest("The Iron Consortium's agents watch the docks."), LEDGERS)).toEqual([]);
        expect(findUnknownLedgerNames(quest('The Iron Consortium’s agents watch the docks.'), LEDGERS)).toEqual([]);
    });

    it('the plain ledger name and its partial refs stay suppressed too', () => {
        expect(findUnknownLedgerNames(quest('The Iron Consortium moved through Ironhaven quietly.'), LEDGERS)).toEqual([]);
    });

    it('plural-s candidate suppressed only when the de-s stem is an EXACT ledger name', () => {
        // Ledger "The Iron Consortium" → "The Iron Consortiums" stems to it exactly.
        expect(findUnknownLedgerNames(quest('The Iron Consortiums gather at the quay.'), LEDGERS)).toEqual([]);
        // Ledger "Iron Consortium" (no article): "Iron Consortiums" resolves…
        expect(findUnknownLedgerNames(quest('Iron Consortiums gather at the quay.'),
            { ...LEDGERS, factionNames: ['Iron Consortium'] })).toEqual([]);
        // …but a stem that is NOT a ledger name never resolves.
        expect(findUnknownLedgerNames(quest('Iron Consortiumii gather at the quay.'),
            { ...LEDGERS, factionNames: ['Iron Consortium'] })).toEqual(['Iron Consortiumii']);
    });

    it('genuine unknowns — typos and invented names — are still flagged', () => {
        expect(findUnknownLedgerNames(quest('Spies from The Iron Conshortium gather at the quay.'), LEDGERS))
            .toEqual(['The Iron Conshortium']);
        // "the" breaks the capitalised run, so both halves of the invented
        // name surface — proof the invented name is never swallowed.
        expect(findUnknownLedgerNames(quest("The Iron Consortium's agent Marta Copperkettle meets Zarvok the Unlit."), LEDGERS))
            .toEqual(['Zarvok', 'Unlit']);
    });
});

describe('ledgerNameList — payload shape tolerance', () => {
    it('reads {npcs:[…]} / {settlements:[…]} wrappers and bare arrays', () => {
        expect(ledgerNameList({ npcs: [{ name: 'Marta' }, { name: null }, {}] }, 'npcs')).toEqual(['Marta']);
        expect(ledgerNameList([{ name: 'Bravor' }], 'settlements')).toEqual(['Bravor']);
        expect(ledgerNameList(null, 'npcs')).toEqual([]);
        expect(ledgerNameList({ npcs: 'garbage' }, 'npcs')).toEqual([]);
    });
});
