// @maintained-by-ai
/**
 * LANE: canTakeAction.js — the PURE gate decision table (L5-001, #815 hand-derived).
 * Every bucket × state edge falsifiable in one row (#842), exact verdict bytes
 * (#829), state read-only proof (#744), honest fallbacks (#945), no timers /
 * no wall-clock — state only (no-timers CANON).
 *
 * ACTION-ECONOMY FAMILY MAP (who owns what, do not duplicate):
 *  - turnState.test.js: budget math + reactionCap numbers (#983 state storage
 *    transitions cited there :36-50) — the gate here only CONSUMES real hasBudget.
 *  - assertCanAct.test.js / .charge.test.js: impure wrapper (popup/audit sinks,
 *    charge-on-allow, race backstop) — same strings re-surfaced through that
 *    wrapper are pinned THERE, not re-derived here.
 *  - classifyBucket.test.js (#984): bucket CLASSIFICATION — this table feeds
 *    bucket strings in; it never tests how an action got its bucket.
 *  - chargeEconomy.test.js: chargeSlot persistence + queue-NEXT.
 *
 * OLD → NEW MAP (consolidations):
 *  master-off it.each 4→3 rows (undefined/null hit one `!enforcement` branch)
 *  'cannotAct denies every bucket…' + 'cannotActActions blocks…' → rows 14-18
 *  turn-lock 3 tests → rows 19-20 (+ off-flag row 9)
 *  economy 4 tests → rows 21-23 (+ off-flag row 10, no-checker row 11)
 *  'free/special exempt' → row 4 (special/legendary stay turnState.test.js's)
 *  D1 §18 test → rows 6 + 23 (cap consumed at the gate, exact reason byte)
 *  D2 §18 4 tests → rows 12/13/24/25 (spend() math REMOVED —
 *    owned by turnState.test.js 'is per-creature (multi-actor)' :66)
 *  'resolveEnforcement' strengthened: garbage shape + exact toEqual key set.
 */
import { canTakeAction, resolveEnforcement, ENFORCEMENT_DEFAULTS } from './canTakeAction.js';
import { spend, registerCompanion, emptyTurnEntry, hasBudget } from './turnState.js';

const ON = { mode: 'on', turnLock: true, actionEconomy: true };
const ALLOW = { allowed: true, reason: null };
const DENY = (reason) => ({ allowed: false, reason });

/** Explicit falsy defaults (#940) — every ctx field named, nothing implicit. */
const ctx = (over = {}) => ({
    enforcement: { ...ON },
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

// Turn-seam truth: spent states built by real spend(), never fabricated shapes.
const spent = (name, bucket, state = {}) => spend(state, name, bucket).turnState;
const allSpent = spent('Rakan', 'action', spent('Rakan', 'bonusAction', spent('Rakan', 'reaction')));

describe('canTakeAction master switch (L1–4 guarantee)', () => {
    it.each([
        ['null enforcement', null],
        ['garbage enforcement (non-object)', 'nonsense'],
        ['mode off with loud denial context', { mode: 'off', turnLock: true, actionEconomy: true }],
    ])('%s ⇒ allow everything, reason null', (_name, enforcement) => {
        const r = canTakeAction(ctx({
            enforcement,
            creatureName: 'NotActive',
            activeCreatureName: 'Rakan',
            cannotAct: true,
            cannotActActions: true,
            cannotActReason: 'Stunned',
            turnState: allSpent,
        }));
        expect(r, `_name=${_name}`).toEqual(ALLOW);
    });
});

describe('canTakeAction gate decision table (§6.2 order, bucket × state)', () => {
    it.each([
        // ---- allows ----
        ['own turn: action allowed on fresh state', {}, ALLOW],
        ['own turn: bonus allowed even after the action is spent',
            { bucket: 'bonusAction', turnState: spent('Rakan', 'action') }, ALLOW],
        ['own turn: reaction allowed even after action+bonus are spent',
            { bucket: 'reaction', turnState: spent('Rakan', 'bonusAction', spent('Rakan', 'action')) }, ALLOW],
        ['free interaction exempt even with every slot spent',
            { bucket: 'free', turnState: allSpent }, ALLOW],
        ['unknown bucket: honest allow, no invented enforcement',
            { bucket: 'mystery', turnState: allSpent }, ALLOW],
        ['§18 D1: raised reactionCap admits the second reaction',
            { bucket: 'reaction', turnState: { Rakan: { ...emptyTurnEntry(), reactionCap: 2, reactionsUsed: 1 } } }, ALLOW],
        ['off-turn reaction allowed (rules-correct)',
            { creatureName: 'Goblin', bucket: 'reaction' }, ALLOW],
        ['off-turn free interaction allowed',
            { creatureName: 'Goblin', bucket: 'free' }, ALLOW],
        ['turnLock flag off admits another creature\'s action',
            { enforcement: { mode: 'on', turnLock: false, actionEconomy: true }, creatureName: 'Goblin' }, ALLOW],
        ['actionEconomy flag off admits an exhausted bucket',
            { enforcement: { mode: 'on', turnLock: true, actionEconomy: false }, turnState: spent('Rakan', 'action') }, ALLOW],
        ['missing budget checker never invents enforcement',
            { hasBudget: undefined, turnState: spent('Rakan', 'action') }, ALLOW],
        ['§18 D2: registered companion acts while its owner is active',
            { creatureName: 'Wolf 1', activeCreatureName: 'FeyRanger', turnState: registerCompanion({}, 'Wolf 1', 'FeyRanger') }, ALLOW],
        ['§18 D2: fresh companion acts while its owner is fully spent',
            { creatureName: 'Wolf 1', activeCreatureName: 'FeyRanger', turnState: registerCompanion(spent('FeyRanger', 'action'), 'Wolf 1', 'FeyRanger') }, ALLOW],
        // ---- denials (exact reason bytes) ----
        ['cannotAct denies, surfacing the authored reason verbatim',
            { cannotAct: true, cannotActReason: 'Stunned — you cannot take actions.' },
            DENY('Stunned — you cannot take actions.')],
        ['cannotAct denies a reaction too — the bucket does not matter',
            { cannotAct: true, bucket: 'reaction' },
            DENY('You cannot take actions while incapacitated.')],
        ['cannotActActions denies bonusAction, authored reason verbatim',
            { cannotActActions: true, cannotActReason: 'Stinking Cloud', bucket: 'bonusAction' },
            DENY('Stinking Cloud')],
        ['cannotActActions default reason pinned on the action bucket',
            { cannotActActions: true },
            DENY('Your condition blocks this action.')],
        ['cannotActActions admits a reaction',
            { cannotActActions: true, bucket: 'reaction' }, ALLOW],
        ['turn-lock names both creatures in the denial',
            { creatureName: 'Goblin' },
            DENY(`It is Rakan's turn — Goblin cannot act now.`)],
        ['turn-lock fallback names "another creature" when active name is missing',
            { creatureName: 'Goblin', activeCreatureName: null },
            DENY(`It is another creature's turn — Goblin cannot act now.`)],
        ['economy: exhausted action — exact bytes',
            { turnState: spent('Rakan', 'action') },
            DENY('No action left this turn.')],
        ['economy: exhausted bonusAction — exact bytes',
            { bucket: 'bonusAction', turnState: spent('Rakan', 'bonusAction') },
            DENY('No bonus action left this turn.')],
        ['§18 D1: exhausted reaction at default cap — exact bytes',
            { bucket: 'reaction', turnState: spent('Rakan', 'reaction') },
            DENY('No reaction left this turn.')],
        ['economy charges by name: exhausted owner denied, same turn as its companion',
            { creatureName: 'FeyRanger', activeCreatureName: 'FeyRanger', turnState: spent('FeyRanger', 'action') },
            DENY('No action left this turn.')],
        ['§18 D2: companion denied on a stranger\'s turn',
            { creatureName: 'Wolf 1', activeCreatureName: 'HexWarlock', turnState: registerCompanion({}, 'Wolf 1', 'FeyRanger') },
            DENY(`It is HexWarlock's turn — Wolf 1 cannot act now.`)],
    ])('%s', (title, over, expected) => {
        expect(canTakeAction(ctx(over)), title).toEqual(expected);
    });

    it.each([
        ['condition outranks turn-lock and economy',
            { creatureName: 'Goblin', cannotAct: true, cannotActReason: 'Petrified', turnState: spent('Goblin', 'action') },
            DENY('Petrified')],
        ['turn-lock outranks economy',
            { creatureName: 'Goblin', turnState: spent('Goblin', 'action') },
            DENY(`It is Rakan's turn — Goblin cannot act now.`)],
    ])('short-circuit order: %s', (title, over, expected) => {
        expect(canTakeAction(ctx(over)), title).toEqual(expected);
    });

    it('pure: frozen state on both verdicts — zero mutation, same bytes', () => {
        const deepFreeze = (o) => {
            Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); });
            return Object.freeze(o);
        };
        const ts = deepFreeze(spent('Rakan', 'action'));
        expect(canTakeAction(deepFreeze(ctx({ turnState: ts })))).toEqual(DENY('No action left this turn.'));
        expect(canTakeAction(deepFreeze(ctx({ turnState: ts, bucket: 'bonusAction' })))).toEqual(ALLOW);
        expect(ts).toEqual(spent('Rakan', 'action')); // untouched after both calls
    });
});

describe('resolveEnforcement', () => {
    it('never trusts shape: defaults to all-off, merges overrides exactly', () => {
        expect(resolveEnforcement(null)).toEqual(ENFORCEMENT_DEFAULTS);
        expect(resolveEnforcement('nonsense')).toEqual(ENFORCEMENT_DEFAULTS);
        expect(resolveEnforcement({ mode: 'on', lineOfSight: true })).toEqual({
            ...ENFORCEMENT_DEFAULTS, mode: 'on', lineOfSight: true,
        });
    });
});
