// @maintained-by-ai
/**
 * LANE: turnState.js — the CANON pure per-creature turn-economy STATE MATH
 * (L5-001/002, §18 D1/D2). State only, no wall-clock: every seam is driven by
 * the caller at an initiative boundary (#app no-timers CANON — source verified
 * Date.now-free).
 *
 * ECONOMY SPLIT (who owns what, do not duplicate):
 *  - canTakeAction.test.js (#988): pure gate verdict bytes — the gate CONSUMES
 *    hasBudget/budgetCap live there; verdict strings are never re-derived here.
 *  - chargeEconomy.test.js (#989): the store bridge (cloneDeep +
 *    setRuntimeValue('campaign','turnState') + enforcement + exact persisted
 *    bytes); THIS file owns the state math the bridge mutates — turnState.js
 *    itself has ZERO store writes (purity is the contract, pinned at 9).
 *  - movementBudget.test.js (#1017): grid path-cost/snap math; it cites
 *    remainingMovement/spendMovement bytes back HERE.
 *  - classifyBucket.test.js (#984): bucket classification — strings fed in here.
 *
 * CONSULTED BYTES (export census → consumer): getTurnState normalization →
 * steadyAimHandler/TurnEconomyStrip; hasBudget/budgetCap → assertCanAct/canTakeAction;
 * spend/refund/spendMovement → chargeEconomy bridge; remainingMovement →
 * movementBudget/useSelectMove/usePlayerDragging; resetForTurn/closeTurn/
 * openTurn/rearmReactions → initiative seams in navigationHandlers.js (turn
 * advance, rewind, round wrap — never a clock); registerCompanion → animateDead.
 *
 * Math is the SUT: hand-derived once per leg (#815/#710, no loop-oracles);
 * boundary exact-exhaust cost==cap vs cap+1 and remaining==cost vs +1 (#943);
 * over-spend honestly charges FULL feet, clamp lives only in the remaining-VIEW
 * (#945 authored); refund floors at 0, never-over-max (#989 legs); refusal
 * returns the SAME store reference (toBe contract #993/#1067); null store
 * freshens at seams (#989 turnState:null); per-creature isolation co-located
 * survivor (#948); junk-input zero-mutate; honest titles (#910).
 *
 * OLD → NEW MAP (24 → 12):
 *  'defaults fresh empty' → 1 (+ fresh-copy leg)
 *  'coerces garbage' + D1 'junk caps' + D2 'junk companionOf' → 2 (normalize table)
 *  'charges each bucket' (BUCKET_CAPS pin) + D1 'defaults to 1' + D1 'raised cap'
 *      → 3/4 (caps pin + cap table; budgetCap consumed per row, cap+1 refuses)
 *  'is per-creature' → 5 (canon #948, cited by #988/#989 headers)
 *  'free pass without charging' + 'free always budget' + 'free refund no-op' → 6
 *  'un-charges' + 'floors at zero' → 7 (single refund seam, exact bytes #787,
 *      + null-store freshen + raised-cap refund legs)
 *  D2 'links' + 'self-link refused' → 8 (+ re-link-no-refund leg)
 *  'never mutates input' → 9 (deepFreeze across ALL nine producers)
 *  'resetForTurn' + 'closeTurn' + 'rearm everyone' + D1 'round-wrap preserves'
 *      → 10 (one turn+round lifecycle; + openTurn leg — initiative-rewind
 *      export at navigationHandlers.js:160, previously untested)
 *  movement 'charges + remaining' → 11 (+ exact boundary + honest over-spend)
 *  movement 'clamps neg/NaN' + 'default speed fallback' → 12 (+ zero-speed honest)
 */
import {
    BUCKET_CAPS,
    DEFAULT_SPEED_FEET,
    REACTION_CAP_MAX,
    emptyTurnEntry,
    getTurnState,
    budgetCap,
    hasBudget,
    spend,
    refund,
    spendMovement,
    remainingMovement,
    resetForTurn,
    closeTurn,
    openTurn,
    rearmReactions,
    registerCompanion,
} from './turnState.js';

const FRESH = emptyTurnEntry();

describe('turnState canon math (L5-001, §18 D1/D2)', () => {
    it('getTurnState: absent entry yields the exact fresh byte-set, as a fresh copy each read', () => {
        expect(getTurnState(null, 'Goblin')).toEqual(FRESH);
        expect(getTurnState({}, 'Goblin')).toEqual(FRESH);
        // non-object garbage entries also freshen
        expect(getTurnState({ Goblin: 'nonsense' }, 'Goblin')).toEqual(FRESH);
        // callers must never alias the template — mutating one read cannot poison the next
        const a = getTurnState(null, 'Goblin');
        a.actionsUsed = 99;
        expect(getTurnState(null, 'Goblin')).toEqual(FRESH);
    });

    it.each([
        ['missing fields default in', { actionsUsed: 'x' }, {}],
        ['junk numerics floor to 0',
            { actionsUsed: 'x', bonusActionsUsed: NaN, reactionsUsed: 'x', movementUsedFeet: {} },
            { actionsUsed: 0, bonusActionsUsed: 0, reactionsUsed: 0, movementUsedFeet: 0 }],
        // #1070 fix#363: forged negative *Used values clamp to 0 (over-grant vector
        // closed — Number(-5)||0 was -5, and -5 < cap would buy extra actions/reactions).
        ['negative numeric *Used clamps to 0 (forged-store over-grant close)',
            { actionsUsed: -5, bonusActionsUsed: -2, reactionsUsed: -1, movementUsedFeet: -100 },
            { actionsUsed: 0, bonusActionsUsed: 0, reactionsUsed: 0, movementUsedFeet: 0 }],
        ['truthiness on the two flags only', { hasMoved: 1, turnActive: 0 }, { hasMoved: true, turnActive: false }],
        ['junk reactionCap floors to 1 — unlimited is impossible', { reactionCap: 'lots' }, { reactionCap: 1 }],
        ['zero/negative caps floor to 1', { reactionCap: -2 }, { reactionCap: 1 }],
        ['out-of-range caps floor to 1 (not clamp-to-max)', { reactionCap: 99 }, { reactionCap: 1 }],
        ['cap exactly at REACTION_CAP_MAX passes', { reactionCap: REACTION_CAP_MAX }, { reactionCap: 3 }],
        ['fractional caps floor', { reactionCap: 1.9 }, { reactionCap: 1 }],
        ['blank/typed junk companionOf → null', { companionOf: '  ' }, { companionOf: null }],
        ['real companionOf survives', { companionOf: 'FeyRanger' }, { companionOf: 'FeyRanger' }],
    ])('getTurnState normalizes corrupted store: %s', (_name, patch, expected) => {
        expect(getTurnState({ R: { ...FRESH, ...patch } }, 'R'))
            .toEqual({ ...FRESH, ...expected });
    });

    it('BUCKET_CAPS pins the charging buckets to one — no bucket invented at the gate', () => {
        expect(BUCKET_CAPS).toEqual({ action: 1, bonusAction: 1, reaction: 1 });
    });

    it.each([
        ['action', {}, 1],
        ['bonusAction', {}, 1],
        ['reaction', {}, 1],                                    // D1 default == old fixed cap
        ['reaction', { reactionCap: 2 }, 2],                 // D1 feature grant
        ['reaction', { reactionCap: REACTION_CAP_MAX }, 3], // D1 max-grant boundary
    ])('%s cap %i: charges up to cap, refuses cap+1', (bucket, grant, cap) => {
        let ts = Object.keys(grant).length ? { R: { ...FRESH, ...grant } } : {};
        const field = `${bucket}sUsed`;
        expect(budgetCap(ts, 'R', bucket)).toBe(cap);
        expect(hasBudget(ts, 'R', bucket)).toBe(true);
        for (let i = 1; i <= cap; i++) {
            const r = spend(ts, 'R', bucket);
            expect(r.ok, `charge ${i}`).toBe(true);
            ts = r.turnState;
            expect(getTurnState(ts, 'R')[field]).toBe(i);
        }
        expect(hasBudget(ts, 'R', bucket)).toBe(false);
        const denied = spend(ts, 'R', bucket);
        expect(denied.ok).toBe(false);
        expect(denied.turnState).toBe(ts); // refusal: SAME store ref, zero charge (#993)
    });

    it('is per-creature: spending A never burns B (#948 isolation canon)', () => {
        let ts = spend({}, 'Goblin', 'action').turnState;
        ts = spendMovement(ts, 'Goblin', 20).turnState;
        const r = spend(ts, 'Rakan', 'action');
        expect(r.ok).toBe(true);
        expect(getTurnState(r.turnState, 'Goblin').actionsUsed).toBe(1);
        expect(getTurnState(r.turnState, 'Rakan').actionsUsed).toBe(1);
        expect(getTurnState(r.turnState, 'Rakan').movementUsedFeet).toBe(0);
    });

    it.each(['free', 'special', 'legendary', 'passive', 'none', 'nonsense'])(
        'bucket "%s" passes without ever charging (hasBudget/spend/refund)', (bucket) => {
            const ts = spend({}, 'Goblin', 'action').turnState;
            expect(hasBudget(ts, 'Goblin', bucket)).toBe(true);
            const s = spend(ts, 'Goblin', bucket);
            expect(s.ok).toBe(true);
            expect(s.turnState).toBe(ts); // same store — no charge, no phantom entry
            const r = refund(ts, 'Goblin', bucket);
            expect(r.ok).toBe(true);
            expect(r.turnState).toBe(ts);
            expect(getTurnState(ts, 'Goblin').actionsUsed).toBe(1);
        });

    it('refund seam: null-store freshens, charge, refuse exhausted, refund, refuse phantom — exact bytes (#787)', () => {
        // null store on an allow path freshens AND charges honestly
        const first = spend(null, 'Goblin', 'action');
        expect(first.turnState).toEqual({ Goblin: { ...FRESH, actionsUsed: 1 } });
        expect(spend(null, 'Goblin', 'nonsense').turnState).toEqual({}); // free pass → fresh {}

        let ts = { R: { ...FRESH, reactionCap: 2 } }; // raised cap: refund works up to spent
        ts = spend(ts, 'R', 'reaction').turnState;
        const r1 = refund(ts, 'R', 'reaction');
        expect(r1.ok).toBe(true);
        expect(r1.turnState.R.actionsUsed).toBe(0); // no cross-bucket bleed
        expect(ts.R.reactionsUsed).toBe(1);         // input untouched

        // floors at 0 — no phantom credit, SAME store returned (#989 never-over-max)
        const r2 = refund(r1.turnState, 'R', 'reaction');
        expect(r2.ok).toBe(false);
        expect(r2.turnState).toBe(r1.turnState);

        // exhausted action slot: refuse charges nothing, refund restores exactly once
        const spentTs = spend({}, 'Rakan', 'action').turnState;
        expect(spend(spentTs, 'Rakan', 'action').ok).toBe(false);
        const r3 = refund(spentTs, 'Rakan', 'action');
        expect(r3.ok).toBe(true);
        expect(r3.turnState).toEqual({ Rakan: { ...FRESH, actionsUsed: 0 } });
        expect(refund(r3.turnState, 'Rakan', 'action').ok).toBe(false);
    });

    it('registerCompanion links, refuses phantom owners, re-links without refunding', () => {
        let ts = { 'Wolf 1': { ...FRESH, actionsUsed: 1 } };
        ts = registerCompanion(ts, 'Wolf 1', 'FeyRanger');
        expect(ts['Wolf 1'].companionOf).toBe('FeyRanger');
        expect(ts['Wolf 1'].actionsUsed).toBe(1); // never refunds spent economy

        // re-registration onto a new owner only re-links
        ts = registerCompanion(ts, 'Wolf 1', 'OtherRanger');
        expect(ts['Wolf 1'].companionOf).toBe('OtherRanger');
        expect(ts['Wolf 1'].actionsUsed).toBe(1);

        // self-link and blank names are refused — store returned untouched
        expect(registerCompanion({}, 'Wolf', 'Wolf')).toEqual({});
        expect(registerCompanion({}, '', 'FeyRanger')).toEqual({});
        expect(registerCompanion({}, null, 'FeyRanger')).toEqual({});
    });

    it('every producer is pure over a deep-frozen store (immutability contract)', () => {
        const deepFreeze = (o) => {
            Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
            return Object.freeze(o);
        };
        const frozen = deepFreeze({
            Rakan: { ...FRESH, actionsUsed: 1, movementUsedFeet: 10, hasMoved: true, reactionCap: 2, companionOf: 'Master' },
            Goblin: { ...FRESH },
        });
        // none of these may write — any mutation attempt on frozen state throws
        expect(spend(frozen, 'Rakan', 'action').ok).toBe(false);
        expect(spend(frozen, 'Goblin', 'action').ok).toBe(true);
        expect(refund(frozen, 'Rakan', 'action').ok).toBe(true);
        expect(spendMovement(frozen, 'Goblin', 5).feetCharged).toBe(5);
        expect(resetForTurn(frozen, 'Rakan').Rakan.turnActive).toBe(true);
        expect(closeTurn(frozen, 'Rakan').Rakan.turnActive).toBe(false);
        expect(openTurn(frozen, 'Goblin').Goblin.turnActive).toBe(true);
        expect(rearmReactions(frozen).Rakan.reactionsUsed).toBe(0);
        expect(registerCompanion(frozen, 'Goblin', 'Rakan').Goblin.companionOf).toBe('Rakan');
        expect(spend(frozen, 'Goblin', 'bonusAction').turnState).not.toBe(frozen);
    });

    it('turn+round lifecycle: close and rewind never refund; rearm re-arms reactions keeping grants; reset clears turn-scoped only', () => {
        let ts = resetForTurn({}, 'Goblin'); // activation opens at the initiative seam (never a clock)
        ts = { ...ts, Goblin: { ...ts.Goblin, reactionCap: 2 } }; // §18 D1 feature grant
        ts = spend(ts, 'Goblin', 'action').turnState;
        ts = spend(ts, 'Goblin', 'reaction').turnState;
        ts = spend(ts, 'Goblin', 'reaction').turnState;
        ts = spendMovement(ts, 'Goblin', 25).turnState;
        ts = registerCompanion(ts, 'Goblin', 'Master');
        ts = spend(ts, 'Rakan', 'reaction').turnState; // bystander with its own economy

        ts = closeTurn(ts, 'Goblin'); // outgoing — flips turnActive, refunds nothing
        expect(ts.Goblin).toEqual({ ...FRESH, reactionCap: 2, actionsUsed: 1, reactionsUsed: 2,
            movementUsedFeet: 25, hasMoved: true, turnActive: false, companionOf: 'Master' });

        ts = openTurn(ts, 'Goblin'); // initiative rewind (navigationHandlers.js:160) — reopen, no refund
        expect(ts.Goblin.turnActive).toBe(true);
        expect(ts.Goblin.reactionsUsed).toBe(2);

        ts = rearmReactions(ts); // round wrap
        expect(ts.Goblin.reactionsUsed).toBe(0);
        expect(ts.Goblin.reactionCap).toBe(2);   // standing grant PERSISTS across the wrap
        expect(ts.Rakan.reactionsUsed).toBe(0);  // everyone re-arms
        expect(ts.Goblin.movementUsedFeet).toBe(25); // movement is turn-scoped, untouched by rearm

        ts = resetForTurn(ts, 'Goblin'); // next activation
        expect(ts.Goblin).toEqual({ ...FRESH, reactionCap: 2, companionOf: 'Master', turnActive: true });
        expect(ts.Rakan).toEqual(FRESH); // bystander saw only the round-wrap rearm
    });

    it('movement: charges feet, exact boundary spends to zero, over-spend charges honestly', () => {
        expect(remainingMovement({}, 'Goblin', 30)).toBe(30);

        let r = spendMovement({}, 'Goblin', 10);
        expect(r.ok).toBe(true);
        expect(r.feetCharged).toBe(10);
        let ts = r.turnState;
        expect(getTurnState(ts, 'Goblin').movementUsedFeet).toBe(10);
        expect(getTurnState(ts, 'Goblin').hasMoved).toBe(true);
        expect(remainingMovement(ts, 'Goblin', 30)).toBe(20);

        // boundary exact: cost == remaining fits to zero
        r = spendMovement(ts, 'Goblin', 20);
        ts = r.turnState;
        expect(r.feetCharged).toBe(20);
        expect(remainingMovement(ts, 'Goblin', 30)).toBe(0);

        // over-spend is honestly charged IN FULL; only the remaining-VIEW clamps
        // (authored: caller snaps the token to the clamped distance, #945)
        r = spendMovement(ts, 'Goblin', 1);
        ts = r.turnState;
        expect(r.ok).toBe(true);
        expect(r.feetCharged).toBe(1);
        expect(ts.Goblin.movementUsedFeet).toBe(31);
        expect(remainingMovement(ts, 'Goblin', 30)).toBe(0);
    });

    it('movement guards junk feet (zero charge, store untouched) and unknown speeds (30 ft default)', () => {
        const ts = {};
        for (const feet of [-50, NaN, 'x', Infinity, 0]) {
            const r = spendMovement(ts, 'Goblin', feet);
            expect(r.ok, `feet=${feet}`).toBe(true);
            expect(r.feetCharged, `feet=${feet}`).toBe(0);
            expect(r.turnState).toBe(ts); // no entry even created
        }
        expect(getTurnState(ts, 'Goblin').hasMoved).toBe(false);

        expect(remainingMovement({}, 'Goblin', undefined)).toBe(DEFAULT_SPEED_FEET);
        expect(remainingMovement({}, 'Goblin', -1)).toBe(DEFAULT_SPEED_FEET);
        expect(remainingMovement({}, 'Goblin', Infinity)).toBe(DEFAULT_SPEED_FEET);
        expect(remainingMovement({}, 'Goblin', 0)).toBe(0); // zero speed is authored-honest
    });
});
