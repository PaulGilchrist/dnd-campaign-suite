import {
    BUCKET_CAPS,
    getTurnState,
    hasBudget,
    spend,
    refund,
    spendMovement,
    remainingMovement,
    resetForTurn,
    closeTurn,
    rearmReactions,
} from './turnState.js';

describe('turnState (L5-001)', () => {
    it('defaults to a fresh empty entry when absent', () => {
        expect(getTurnState(null, 'Goblin')).toEqual({
            actionsUsed: 0,
            bonusActionsUsed: 0,
            reactionsUsed: 0,
            movementUsedFeet: 0,
            hasMoved: false,
            turnActive: false,
        });
    });

    it('coerces garbage entries to safe numbers/booleans', () => {
        const ts = { Goblin: { actionsUsed: 'x', hasMoved: 1 } };
        const e = getTurnState(ts, 'Goblin');
        expect(e.actionsUsed).toBe(0);
        expect(e.hasMoved).toBe(true);
    });

    describe('spend()', () => {
        it('charges each bucket up to its cap then refuses', () => {
            expect(BUCKET_CAPS).toEqual({ action: 1, bonusAction: 1, reaction: 1 });

            let ts = {};
            let r = spend(ts, 'Goblin', 'action');
            expect(r.ok).toBe(true);
            expect(getTurnState(r.turnState, 'Goblin').actionsUsed).toBe(1);

            r = spend(r.turnState, 'Goblin', 'action');
            expect(r.ok).toBe(false);
            expect(getTurnState(r.turnState, 'Goblin').actionsUsed).toBe(1); // unchanged

            r = spend(r.turnState, 'Goblin', 'bonusAction');
            expect(r.ok).toBe(true); // separate bucket
        });

        it('never mutates the input state (pure)', () => {
            const ts = { Goblin: getTurnState({}, 'Goblin') };
            spend(ts, 'Goblin', 'action');
            expect(ts.Goblin.actionsUsed).toBe(0);
        });

        it('free/special/legendary/unknown buckets pass without charging', () => {
            for (const bucket of ['free', 'special', 'legendary', 'passive', 'nonsense']) {
                const r = spend({}, 'Goblin', bucket);
                expect(r.ok).toBe(true);
                expect(r.turnState.Goblin).toBeUndefined();
            }
        });

        it('is per-creature (multi-actor)', () => {
            let ts = spend({}, 'Goblin', 'action').turnState;
            const r = spend(ts, 'Rakan', 'action');
            expect(r.ok).toBe(true);
            expect(getTurnState(r.turnState, 'Goblin').actionsUsed).toBe(1);
            expect(getTurnState(r.turnState, 'Rakan').actionsUsed).toBe(1);
        });
    });

    describe('hasBudget()', () => {
        it('tracks spend + reset', () => {
            let ts = spend({}, 'Goblin', 'reaction').turnState;
            expect(hasBudget(ts, 'Goblin', 'reaction')).toBe(false);
            ts = resetForTurn(ts, 'Goblin');
            expect(hasBudget(ts, 'Goblin', 'reaction')).toBe(false); // reactions re-arm per ROUND
            ts = rearmReactions(ts);
            expect(hasBudget(ts, 'Goblin', 'reaction')).toBe(true);
        });

        it('free buckets always have budget', () => {
            expect(hasBudget({}, 'Goblin', 'free')).toBe(true);
        });
    });

    describe('movement', () => {
        it('charges and reports remaining against speed', () => {
            let ts = {};
            expect(remainingMovement(ts, 'Goblin', 30)).toBe(30);
            const r = spendMovement(ts, 'Goblin', 10);
            ts = r.turnState;
            expect(getTurnState(ts, 'Goblin').movementUsedFeet).toBe(10);
            expect(getTurnState(ts, 'Goblin').hasMoved).toBe(true);
            expect(remainingMovement(ts, 'Goblin', 30)).toBe(20);
        });

        it('clamps negative and non-finite feet to 0 charged', () => {
            expect(spendMovement({}, 'Goblin', -50).feetCharged).toBe(0);
            expect(spendMovement({}, 'Goblin', NaN).feetCharged).toBe(0);
        });

        it('falls back to default speed when speed unknown', () => {
            expect(remainingMovement({}, 'Goblin', undefined)).toBe(30);
            expect(remainingMovement({}, 'Goblin', -1)).toBe(30);
        });
    });

    describe('turn transitions', () => {
        it('resetForTurn clears turn-scoped, keeps reactions', () => {
            let ts = spend({}, 'Goblin', 'action').turnState;
            ts = spend(ts, 'Goblin', 'reaction').turnState;
            ts = spendMovement(ts, 'Goblin', 25).turnState;
            ts = resetForTurn(ts, 'Goblin');
            const e = getTurnState(ts, 'Goblin');
            expect(e.actionsUsed).toBe(0);
            expect(e.movementUsedFeet).toBe(0);
            expect(e.hasMoved).toBe(false);
            expect(e.turnActive).toBe(true);
            expect(e.reactionsUsed).toBe(1);
        });

        it('closeTurn marks turn inactive without touching budgets', () => {
            let ts = spend({}, 'Goblin', 'action').turnState;
            ts = closeTurn(ts, 'Goblin');
            const e = getTurnState(ts, 'Goblin');
            expect(e.turnActive).toBe(false);
            expect(e.actionsUsed).toBe(1);
        });

        it('rearmReactions re-arms everyone but leaves the rest', () => {
            let ts = spend({}, 'Goblin', 'reaction').turnState;
            ts = spend(ts, 'Rakan', 'reaction').turnState;
            ts = spendMovement(ts, 'Goblin', 20).turnState;
            ts = rearmReactions(ts);
            expect(getTurnState(ts, 'Goblin').reactionsUsed).toBe(0);
            expect(getTurnState(ts, 'Rakan').reactionsUsed).toBe(0);
            expect(getTurnState(ts, 'Goblin').movementUsedFeet).toBe(20);
        });
    });

    describe('refund (L5-002, modal-cancel seam)', () => {
        it('un-charges a spent slot', () => {
            let ts = spend({}, 'Rakan', 'action').turnState;
            expect(getTurnState(ts, 'Rakan').actionsUsed).toBe(1);
            const r = refund(ts, 'Rakan', 'action');
            expect(r.ok).toBe(true);
            expect(getTurnState(r.turnState, 'Rakan').actionsUsed).toBe(0);
        });

        it('floors at zero — no phantom credit', () => {
            const r = refund({}, 'Rakan', 'action');
            expect(r.ok).toBe(false);
            expect(getTurnState(r.turnState, 'Rakan').actionsUsed).toBe(0);
        });

        it('free/special buckets are no-ops (ok:true, unchanged)', () => {
            const ts = spend({}, 'Rakan', 'action').turnState;
            const r = refund(ts, 'Rakan', 'free');
            expect(r.ok).toBe(true);
            expect(getTurnState(r.turnState, 'Rakan').actionsUsed).toBe(1);
        });
    });
});
