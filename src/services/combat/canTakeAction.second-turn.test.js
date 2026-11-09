// @maintained-by-ai
/**
 * LANE: canTakeAction.js turnLockDenial — CLA-360 (Second Turn) seam
 * (bug-turnlock-denies-holder-on-own-second-turn, owner ruling 2026-11-09:
 * the twin row IS the holder's extra turn — the holder and their companions
 * must pass the turn-lock while their `(Second Turn)` twin is active).
 * The activeHolderName value arrives from assertCanAct.js readActiveCreature
 * (the shared ST remap); the impure wrapper/audit sinks are pinned in
 * assertCanAct.second-turn.test.js, not re-derived here.
 * Exact verdict bytes (#829); non-ST face byte-unchanged pins included.
 */
import { canTakeAction } from './canTakeAction.js';
import { spend, registerCompanion, hasBudget } from './turnState.js';

const ON = { mode: 'on', turnLock: true, actionEconomy: true };
const ALLOW = { allowed: true, reason: null };
const DENY = (reason) => ({ allowed: false, reason });

const TWIN = 'EvasiveFighter (Second Turn)';
const HOLDER = 'EvasiveFighter';

/** Explicit falsy defaults (#940) — mirrors canTakeAction.test.js ctx(). */
const ctx = (over = {}) => ({
    enforcement: { ...ON },
    creatureName: HOLDER,
    bucket: 'action',
    activeCreatureName: TWIN,
    activeHolderName: HOLDER,
    turnState: null,
    cannotAct: false,
    cannotActActions: false,
    cannotActReason: null,
    hasBudget,
    ...over,
});

const spent = (name, bucket, state = {}) => spend(state, name, bucket).turnState;

describe('canTakeAction turn-lock × (Second Turn) seam (CLA-360)', () => {
    it.each([
        // ---- ST-seam allows (the twin is the holder's own turn) ----
        ['holder acts on the action bucket while their twin is active', {}, ALLOW],
        ['holder acts on the bonusAction bucket while their twin is active',
            { bucket: 'bonusAction' }, ALLOW],
        ['§18 D2 + ST seam: companion owned by the holder acts while the twin is active',
            { creatureName: 'Wolf 1', turnState: registerCompanion({}, 'Wolf 1', HOLDER) }, ALLOW],
        ['ST seam: holder with a spent action still pays economy, never turn-lock',
            { turnState: spent(HOLDER, 'action') }, DENY('No action left this turn.')],
        // ---- ST-seam denials (exact reason bytes name the ACTING-ROW twin) ----
        ['a DIFFERENT creature is denied while the twin is active — copy names the twin row',
            { creatureName: 'ElderPaladin' },
            DENY(`It is ${TWIN}'s turn — ElderPaladin cannot act now.`)],
        ['companion of a DIFFERENT owner is denied while the twin is active',
            { creatureName: 'Wolf 1', turnState: registerCompanion({}, 'Wolf 1', 'FeyRanger') },
            DENY(`It is ${TWIN}'s turn — Wolf 1 cannot act now.`)],
        ['holder is denied when a DIFFERENT creature is active (holderName not set)',
            { activeCreatureName: 'ElderPaladin', activeHolderName: null },
            DENY(`It is ElderPaladin's turn — ${HOLDER} cannot act now.`)],
        // ---- non-ST face byte-unchanged (activeHolderName null everywhere) ----
        ['non-ST: normal off-turn denial stands (byte-identical to the pre-fix face)',
            { creatureName: 'Goblin', activeCreatureName: 'Rakan', activeHolderName: null },
            DENY(`It is Rakan's turn — Goblin cannot act now.`)],
        ['non-ST: registered companion still acts while its owner is active',
            { creatureName: 'Wolf 1', activeCreatureName: 'FeyRanger', activeHolderName: null, turnState: registerCompanion({}, 'Wolf 1', 'FeyRanger') }, ALLOW],
    ])('%s', (title, over, expected) => {
        expect(canTakeAction(ctx(over)), title).toEqual(expected);
    });

    it('master switch off ignores the ST seam entirely (L1–4 guarantee)', () => {
        expect(canTakeAction(ctx({
            enforcement: { mode: 'off', turnLock: true, actionEconomy: true },
            creatureName: 'Goblin',
        }))).toEqual(ALLOW);
    });
});
