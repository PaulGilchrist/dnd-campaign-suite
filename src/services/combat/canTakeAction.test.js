import { canTakeAction, resolveEnforcement, ENFORCEMENT_DEFAULTS } from './canTakeAction.js';
import { hasBudget, spend } from './turnState.js';

const ON = { mode: 'on', turnLock: true, actionEconomy: true };
const ctx = (over = {}) => ({
    enforcement: ON,
    creatureName: 'Rakan',
    bucket: 'action',
    activeCreatureName: 'Rakan',
    turnState: null,
    cannotAct: false,
    cannotActActions: false,
    cannotActReason: null,
    hasBudget,
    ...over,
});

describe('canTakeAction (L5-001)', () => {
    describe('master switch off ⇒ allow everything (L1–4 guarantee)', () => {
        it.each([
            ['null enforcement', null],
            ['undefined enforcement', undefined],
            ['mode off', { mode: 'off', turnLock: true, actionEconomy: true }],
            ['garbage enforcement', 'nonsense'],
        ])('%s', (_name, enforcement) => {
            const r = canTakeAction(ctx({
                enforcement,
                creatureName: 'NotActive',
                activeCreatureName: 'Rakan',
                cannotAct: true,
                cannotActReason: 'Stunned',
                turnState: spend({}, 'Rakan', 'action').turnState,
            }));
            expect(r).toEqual({ allowed: true, reason: null });
        });
    });

    describe('condition gate', () => {
        it('cannotAct denies every bucket including reactions', () => {
            const r = canTakeAction(ctx({ cannotAct: true, cannotActReason: 'Stunned — you cannot take actions.' }));
            expect(r.allowed).toBe(false);
            expect(r.reason).toMatch(/Stunned/);
            expect(canTakeAction(ctx({ cannotAct: true, bucket: 'reaction' })).allowed).toBe(false);
            expect(canTakeAction(ctx({ cannotAct: true, bucket: 'free' })).allowed).toBe(false);
        });

        it('cannotActActions blocks action/bonusAction but not reactions/free', () => {
            expect(canTakeAction(ctx({ cannotActActions: true, cannotActReason: 'Stinking Cloud' })).allowed).toBe(false);
            expect(canTakeAction(ctx({ cannotActActions: true, bucket: 'bonusAction' })).allowed).toBe(false);
            expect(canTakeAction(ctx({ cannotActActions: true, bucket: 'reaction' })).allowed).toBe(true);
            expect(canTakeAction(ctx({ cannotActActions: true, bucket: 'free' })).allowed).toBe(true);
        });
    });

    describe('turn-lock', () => {
        it('denies non-active creature actions/bonus actions with a named reason', () => {
            const r = canTakeAction(ctx({ creatureName: 'Goblin', activeCreatureName: 'Rakan' }));
            expect(r.allowed).toBe(false);
            expect(r.reason).toMatch(/Rakan's turn/);
            expect(canTakeAction(ctx({ creatureName: 'Goblin', bucket: 'bonusAction' })).allowed).toBe(false);
        });

        it('allows reactions and free interactions off-turn (rules-correct)', () => {
            expect(canTakeAction(ctx({ creatureName: 'Goblin', bucket: 'reaction' })).allowed).toBe(true);
            expect(canTakeAction(ctx({ creatureName: 'Goblin', bucket: 'free' })).allowed).toBe(true);
        });

        it('off ⇒ any creature may act', () => {
            const flags = { mode: 'on', turnLock: false, actionEconomy: false };
            expect(canTakeAction(ctx({ enforcement: flags, creatureName: 'Goblin', activeCreatureName: 'Rakan' })).allowed).toBe(true);
        });
    });

    describe('action economy', () => {
        it('denies when the bucket budget is exhausted', () => {
            const ts = spend({}, 'Rakan', 'action').turnState;
            const r = canTakeAction(ctx({ turnState: ts }));
            expect(r.allowed).toBe(false);
            expect(r.reason).toMatch(/No action left/);
        });

        it('bonus + reaction buckets are independent budgets', () => {
            let ts = spend({}, 'Rakan', 'action').turnState;
            expect(canTakeAction(ctx({ turnState: ts, bucket: 'bonusAction' })).allowed).toBe(true);
            expect(canTakeAction(ctx({ turnState: ts, bucket: 'reaction' })).allowed).toBe(true);
        });

        it('free/special/unknown buckets are exempt', () => {
            const ts = spend({}, 'Rakan', 'action').turnState;
            expect(canTakeAction(ctx({ turnState: ts, bucket: 'free' })).allowed).toBe(true);
            expect(canTakeAction(ctx({ turnState: ts, bucket: 'special' })).allowed).toBe(true);
        });

        it('no injected budget checker ⇒ graceful allow (never invents enforcement)', () => {
            expect(canTakeAction(ctx({ hasBudget: undefined })).allowed).toBe(true);
        });
    });

    describe('resolveEnforcement', () => {
        it('fills defaults for missing/partial config', () => {
            expect(resolveEnforcement(null)).toEqual(ENFORCEMENT_DEFAULTS);
            expect(resolveEnforcement({ mode: 'on' })).toMatchObject({
                ...ENFORCEMENT_DEFAULTS,
                mode: 'on',
                turnLock: false,
            });
        });
    });
});

// §18 D1/D2 — feature-raised reaction caps + companion turn-lock exception.
describe('D1 reaction cap at the gate (§18)', () => {
    const economyOn = { mode: 'on', turnLock: false, actionEconomy: true };
    it('default cap 1 denies the second reaction, raised cap 2 admits it', () => {
        const spent = { Rakan: { actionsUsed: 0, bonusActionsUsed: 0, reactionsUsed: 1, movementUsedFeet: 0, hasMoved: false, turnActive: true } };
        expect(canTakeAction(ctx({ enforcement: economyOn, bucket: 'reaction', turnState: spent })).allowed).toBe(false);
        const raised = { Rakan: { ...spent.Rakan, reactionCap: 2 } };
        expect(canTakeAction(ctx({ enforcement: economyOn, bucket: 'reaction', turnState: raised })).allowed).toBe(true);
    });
});

describe('D2 companion at the turn-lock gate (§18)', () => {
    it('a registered companion acts while its OWNER is active', () => {
        const ts = { 'Wolf 1': { actionsUsed: 0, bonusActionsUsed: 0, reactionsUsed: 0, movementUsedFeet: 0, hasMoved: false, turnActive: false, companionOf: 'FeyRanger' } };
        const r = canTakeAction(ctx({ creatureName: 'Wolf 1', activeCreatureName: 'FeyRanger', turnState: ts }));
        expect(r.allowed).toBe(true);
    });

    it('off the owner\'s turn the normal denial stands', () => {
        const ts = { 'Wolf 1': { actionsUsed: 0, bonusActionsUsed: 0, reactionsUsed: 0, movementUsedFeet: 0, hasMoved: false, turnActive: false, companionOf: 'FeyRanger' } };
        const r = canTakeAction(ctx({ creatureName: 'Wolf 1', activeCreatureName: 'HexWarlock', turnState: ts }));
        expect(r.allowed).toBe(false);
        expect(r.reason).toContain('HexWarlock');
    });

    it('companion economy charges itself: owner slots stay whole', () => {
        const ts = {
            FeyRanger: { actionsUsed: 1, bonusActionsUsed: 1, reactionsUsed: 0, movementUsedFeet: 0, hasMoved: true, turnActive: true },
            'Wolf 1': { actionsUsed: 0, bonusActionsUsed: 0, reactionsUsed: 0, movementUsedFeet: 0, hasMoved: false, turnActive: true, companionOf: 'FeyRanger' },
        };
        // Owner spent everything — the companion still has its own budget.
        expect(canTakeAction(ctx({ creatureName: 'FeyRanger', activeCreatureName: 'FeyRanger', bucket: 'action', turnState: ts })).allowed).toBe(false);
        expect(canTakeAction(ctx({ creatureName: 'Wolf 1', activeCreatureName: 'FeyRanger', bucket: 'action', turnState: ts })).allowed).toBe(true);
        const after = spend(ts, 'Wolf 1', 'action').turnState;
        expect(after.FeyRanger.actionsUsed).toBe(1); // owner untouched by companion spend
        expect(after['Wolf 1'].actionsUsed).toBe(1);
    });

    it('turnLock off ⇒ companion exception is moot (master honesty)', () => {
        const r = canTakeAction(ctx({ creatureName: 'Wolf 1', activeCreatureName: 'FeyRanger', enforcement: { mode: 'on', turnLock: false, actionEconomy: false } }));
        expect(r.allowed).toBe(true);
    });
});
