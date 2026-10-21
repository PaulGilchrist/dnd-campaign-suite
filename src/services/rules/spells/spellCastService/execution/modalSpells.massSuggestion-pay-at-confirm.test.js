// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  MASS SUGGESTION PRODUCER LANE (#1386) — modalSpells.js:41-67     */
/*                                                                     */
/*  Unit under test: handleMassSuggestion REAL (gate :42 + popup      */
/*  builder :43-64). Sole REAL runner: every sibling MOCKS it          */
/*  (earlyReturns-modal:204/475, earlyReturns-generic:152,             */
/*  spellStats:127, execution-block-checks:170, index.* lanes —        */
/*  census grep 'handleMassSuggestion' 2026-10-21).                    */
/*                                                                     */
/*  PAY-AT-CONFIRM CONTRACT (SP-079 / §CLA-208 producer half):        */
/*  the open lane (handleNonSorcererCast / useSpellMetamagicGates)    */
/*  forwards _deferChooserSlotPayment WITHOUT calling prepareSpellCast;*/
/*  this producer copies that flag into payload.deferSlotPayment and   */
/*  carries the payment arithmetic bytes (slotLevel, castingTime,      */
/*  saveDc, playerStats, campaignName, action, saveType). The slot is  */
/*  consumed ONLY when MassSuggestionModal CONFIRMS (consumeMass-      */
/*  SuggestionSlot, modal :18/:306); a Skip/cancel spends nothing.     */
/*  If a payload key here drifts, the consumer destructure reads       */
/*  undefined → falsy → payment silently skipped or mis-leveled:       */
/*  THAT is the behavioral risk this lane pins with toStrictEqual      */
/*  exact key-set (no objectContaining).                               */
/*                                                                     */
/*  OWNERSHIP MAP — do not re-grow here:                              */
/*  - :704 dispatch tuple + envelope pass-through: earlyReturns-modal */
/*    .test.js:468 (#1471 arm table; producer MOCKED there).          */
/*  - confirm-side payment/skip/re-entry mechanics:                    */
/*    MassSuggestionModal.pay-at-confirm.test.jsx (component lane);   */
/*    open-no-spend: useSpellMetamagicGates.sp079-*.test.js.          */
/*  - modalSpells siblings: handlePowerWordHeal/Kill →                 */
/*    modalSpells.powerWordSpread.test.js (#1481/#CLA-392 own lane);  */
/*    calmEmotions/hypnoticPattern/sleep/fear producers → #1471 arms  */
/*    run REAL there (no other lane pins their bytes).                 */
/*  - mass_suggestion TRIGGER lane (post-popup automation):            */
/*    massSuggestionService.test.js + triggerSpells.js:169 — not here.*/
/*                                                                     */
/*  DISK EVIDENCE (REAL rows, both rulesets, fabricated-shape ban):  */
/*  5e spells.json: level 6, casting_time "1 action", dc_type WIS,    */
/*  concentration false. 2024 spells.json: level 6, casting_time       */
/*  "Action", dc_type WIS, concentration false. Producer forwards       */
/*  casting_time VERBATIM (no normalization) — both bytes pinned.      */
/*  saveDc passes through verbatim — NO innate +1 stamp in this lane   */
/*  (contrast fear :192 / hypnotic :103 which stamp; :21-style innate  */
/*  rows carry no bonus here). computeSpellStats guarantees numeric     */
/*  ≥8 upstream (#1473) — the :42 gate still rejects falsy DCs.        */
/*                                                                     */
/*  QUIRKS PINNED:                                                    */
/*  - sync-not-Promise: unlike the confusion :707 detached-IIFE        */
/*    double-unwrap quirk (#1471 :153), this producer returns a plain  */
/*    object — pinned so a future async-wrap trips loudly.              */
/*  - purity: two calls return fresh non-shared objects.               */
/*  - golden unguarded-deref (#1360): spell=undefined throws TypeError */
/*    at :42 — console-untouched, callers must pass an object.         */
/*  - !! coercion quirk: _deferChooserSlotPayment:'false' (string) →   */
/*    payload true — falsy/truthy table pinned (#1352 discipline).     */
/*  - case trail (#1457): gate lowercases (:42); payload action.name is*/
/*    a hardcoded literal, never echoing spell casing.                  */
/*                                                                     */
/*  NO-CLOCK (repo mandate): producer is synchronous, opens no modal,  */
/*  starts no timer; the popup it builds persists indefinitely until    */
/*  answered. No auto-dismiss/timeout exists or is asserted.            */
/*                                                                     */
/*  KILL MATRIX (mutant → killer):                                     */
/*  M1 flip defer byte → t1+t2 both modes · M2 rename payload key →    */
/*  t1/toStrictEqual key-set · M3 modalName/type bytes → t1 ·          */
/*  M4 drop spell.slotLevel arm → t3 upcast · M5 default 6→N →         */
/*  t3 bare row · M6 casting_time fallback → t3 bare row ·             */
/*  M7 drop saveDc gate → t4 DC table · M8 case-sensitive gate →      */
/*  t4 lowercase row · M9 echo spell.name into action.name → t4 ·      */
/*  M10 async-wrap result → t1 notInstanceOf(Promise) ·                */
/*  M11 reroute via shapechangeHandler/getCombatContext → t1 0-call    */
/*  census · M12 non-verbatim saveDc (innate stamp) → t1 saveDc 19.    */
/*  Campaign locked to 'test-campaign'. Barrel-vs-direct (#1475/76):   */
/*  direct './modalSpells.js' first-action import.                      */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* Mock roster == the complete REAL import list of modalSpells.js
   (:1 shapechangeHandler.handle, :2 damageUtils.getCombatContext —
   #1440 line-by-line audit). Both belong to OTHER handler arms;
   handleMassSuggestion must never touch them (0-call census, M11). */
vi.mock('../../../../automation/handlers/spells/shapechangeHandler.js', () => ({
    handle: vi.fn(),
}));
vi.mock('../../../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

import { handleMassSuggestion } from './modalSpells.js';
import { handle as shapechangeStub } from '../../../../automation/handlers/spells/shapechangeHandler.js';
import { getCombatContext as combatContextStub } from '../../../combat/damageUtils.js';

const CAMPAIGN = 'test-campaign';
const playerStats = { name: 'DivinationWizard', level: 20, spellAbilities: { saveDc: 19 } };

const diskRow5e = spells5e.find(s => s.name === 'Mass Suggestion');
const diskRow2024 = spells2024.find(s => s.name === 'Mass Suggestion');
if (!diskRow5e || !diskRow2024) {
    throw new Error('Mass Suggestion disk row missing — fixtures must be REAL rows');
}
if (diskRow5e.casting_time !== '1 action' || diskRow5e.level !== 6
    || diskRow2024.casting_time !== 'Action' || diskRow2024.level !== 6) {
    throw new Error('Mass Suggestion disk bytes drifted from documented fixtures');
}

describe('modalSpells.handleMassSuggestion (#1386) — REAL producer: gate, exact popup bytes, pay-at-confirm forwarding', () => {
    beforeEach(() => {
        // clearAllMocks retains factory impls (#1480/#1485 form); pure fn,
        // this only resets the stub call ledgers → order-independent tests.
        vi.clearAllMocks();
    });

    it('builds the strict massSuggestion popup envelope from REAL disk rows for both rulesets — pay-at-confirm bytes verbatim, sync and pure', () => {
        const deferred5e = handleMassSuggestion(
            { ...diskRow5e, _deferChooserSlotPayment: true, slotLevel: 6 },
            19, playerStats, CAMPAIGN,
        );

        // Full-object strict equality: exact key-set at every level —
        // the 8 payload keys are precisely what MassSuggestionModal
        // destructures; drift = silent payment loss at confirm.
        expect(deferred5e).toStrictEqual({
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'massSuggestion',
                    payload: {
                        action: { name: 'Mass Suggestion', automation: { type: 'mass_suggestion' } },
                        playerStats,
                        campaignName: CAMPAIGN,
                        saveType: 'WIS',
                        saveDc: 19,
                        deferSlotPayment: true,
                        slotLevel: 6,
                        castingTime: '1 action',
                    },
                },
            },
        });

        // Identity: playerStats forwarded by reference, not cloned (#M purity).
        expect(deferred5e.result.automationPopup.payload.playerStats).toBe(playerStats);
        // Sync producer — NOT the confusion :707 detached-Promise form (M10).
        expect(deferred5e.result).not.toBeInstanceOf(Promise);

        // Purity: repeated calls yield fresh, deep-equal envelopes.
        const again = handleMassSuggestion(
            { ...diskRow5e, _deferChooserSlotPayment: true, slotLevel: 6 },
            19, playerStats, CAMPAIGN,
        );
        expect(again.result).not.toBe(deferred5e.result);
        expect(again).toStrictEqual(deferred5e);

        // 2024 disk row: casting_time forwarded VERBATIM as 'Action'
        // (no normalization to the 5e '1 action' byte) — both-ruleset proof.
        const deferred2024 = handleMassSuggestion(
            { ...diskRow2024, _deferChooserSlotPayment: true },
            19, playerStats, CAMPAIGN,
        );
        expect(deferred2024.result.automationPopup.payload.castingTime).toBe('Action');
        expect(deferred2024.result.automationPopup.payload.slotLevel).toBe(6);

        // Zero side effects on this lane: the two foreign-arm deps untouched (M11).
        expect(shapechangeStub).toHaveBeenCalledTimes(0);
        expect(combatContextStub).toHaveBeenCalledTimes(0);
    });

    it('deferSlotPayment is the ONLY byte differing between pay-at-confirm and paid-at-open modes, with !! coercion semantics', () => {
        const basePayload = {
            action: { name: 'Mass Suggestion', automation: { type: 'mass_suggestion' } },
            playerStats,
            campaignName: CAMPAIGN,
            saveType: 'WIS',
            saveDc: 19,
            slotLevel: 6,
            castingTime: '1 action',
        };

        // Paid-at-open twin (no flag): strict false — never undefined —
        // so the consumer's `if (deferSlotPayment)` reads a real boolean.
        const paid = handleMassSuggestion(diskRow5e, 19, playerStats, CAMPAIGN);
        expect(paid.result.automationPopup.payload)
            .toStrictEqual({ ...basePayload, deferSlotPayment: false });

        // Falsy/truthy table (#1352) through the !! at :58: every falsy
        // open-lane byte normalizes to false; a truthy string 'false'
        // coerces to true (quirk pinned — callers must send real booleans).
        const coercion = [
            [undefined, false], [null, false], [false, false], [0, false], ['', false],
            [true, true], [1, true], ['false', true],
        ];
        for (const [flag, expected] of coercion) {
            const out = handleMassSuggestion(
                { ...diskRow5e, _deferChooserSlotPayment: flag },
                19, playerStats, CAMPAIGN,
            );
            expect(out.result.automationPopup.payload.deferSlotPayment).toBe(expected);
            expect(out.result.automationPopup.payload)
                .toStrictEqual({ ...basePayload, deferSlotPayment: expected });
        }
    });

    it('slot-payment arithmetic byte: spell.slotLevel upcast beats disk level, disk level inherited, last-resort defaults are the rules-known lv6/Action bytes', () => {
        // Heightened/upcast lane: confirm consumes slotLevel, not level.
        const upcast = handleMassSuggestion(
            { ...diskRow5e, _deferChooserSlotPayment: true, slotLevel: 7 },
            19, playerStats, CAMPAIGN,
        );
        expect(upcast.result.automationPopup.payload.slotLevel).toBe(7);

        // No explicit slotLevel: inherits the REAL disk level (6).
        const inherited = handleMassSuggestion(
            { ...diskRow5e, _deferChooserSlotPayment: true },
            19, playerStats, CAMPAIGN,
        );
        expect(inherited.result.automationPopup.payload.slotLevel).toBe(6);

        // Minimal row lacking level + casting_time: fallback chain lands on
        // the known-rules defaults for Mass Suggestion (lv6, Action) — the
        // exact bytes the consumer re-defaults at modal :311-312.
        const bare = handleMassSuggestion(
            { name: 'Mass Suggestion' }, 19, playerStats, CAMPAIGN,
        );
        expect(bare.result.automationPopup.payload.slotLevel).toBe(6);
        expect(bare.result.automationPopup.payload.castingTime).toBe('Action');
        expect(bare.result.automationPopup.payload.deferSlotPayment).toBe(false);
    });

    it('rejects the cast with exactly { handled: false } on every gate failure — name mismatch, missing name, falsy saveDc — and the :42 deref on a missing spell object is a golden TypeError', () => {
        const rejected = (spell, dc) => {
            expect(handleMassSuggestion(spell, dc, playerStats, CAMPAIGN)).toStrictEqual({ handled: false });
        };

        // Name gates: near-miss and foreign REAL disk rows never arm the popup.
        rejected({ ...diskRow5e, name: 'Suggestion' }, 19);
        rejected({ ...diskRow5e, name: 'Mass Instruction' }, 19);
        const foreignRow = spells5e.find(s => s.name === 'Hypnotic Pattern');
        if (!foreignRow) throw new Error('Hypnotic Pattern disk row missing');
        rejected(foreignRow, 19);
        rejected({ ...diskRow5e, name: undefined }, 19);

        // Falsy saveDc triples (#1352): never emit a popup with an
        // un-numbered DC even though computeSpellStats promises ≥8 (#1473).
        for (const dc of [0, null, undefined, '']) {
            rejected({ ...diskRow5e, _deferChooserSlotPayment: true }, dc);
        }

        // Case trail (#1457): lowercase gate arms, but action.name stays the
        // hardcoded literal — the caller's casing NEVER echoes into the payload.
        const lowered = handleMassSuggestion(
            { ...diskRow5e, name: 'mass suggestion' }, 19, playerStats, CAMPAIGN,
        );
        expect(lowered.handled).toBe(true);
        expect(lowered.result.automationPopup.payload.action).toStrictEqual({
            name: 'Mass Suggestion',
            automation: { type: 'mass_suggestion' },
        });

        // Golden unguarded deref (#1360): :42 reads spell.name with no
        // optional-chain — a missing spell object throws, loudly, untouched.
        expect(() => handleMassSuggestion(undefined, 19, playerStats, CAMPAIGN)).toThrow(TypeError);
        expect(() => handleMassSuggestion(null, 19, playerStats, CAMPAIGN)).toThrow(TypeError);
    });
});
