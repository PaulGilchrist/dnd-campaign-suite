// @maintained-by-ai
// seeInvisibilityService lane contract — triggerSeeInvisibility is the ONLY export
// and the SOLE production producer of the 'see_invisibility' temp_buff action row
// (grep "effect: 'see_invisibility'" non-test src => this file only; thirdEyeHandler.js
// :55/:82 is a SEPARATE producer of its own buff rows, owned by thirdEyeHandler.test.js).
// PRODUCER-vs-forwarder verdict (#1335): PRODUCER — it stamps the full automation
// envelope bytes, so the exact envelope is owned HERE. Downstream is cited-not-re-owned:
// buff write + toggle log copy -> buffHandler.js:287/:546-547 (pinned by
// buffHandler.advanced-effects.test.js:317-348); initiative-roll clear seam ->
// useInitiativeEffects.js:398-399 (pinned by useInitiativeEffects.buffClearing.test.js:202);
// detection/consumer math (seeInvisibilityActive flags) -> attackCalc/contextBuilder lanes
// #1233-#1244 closed, charSummaryCalc.js:319, CharSheet.conditionEffects.js:88,
// conditionEffects.js:189 (invisible-suppression owned by conditionEffects.test.js:119).
// Stealth family delegation (verbatim headers): invisibilityService.test.js #1382
// "owns the REMOVE side of the invisibility-adjacent family"; blurService.test.js #1341
// "blur has no removal export, so no overlap"; mageArmorService.test.js #1383 donning-strip;
// passWithoutTraceService.test.js #1391 group fan-out — none consume this lane's exports.
// Caller boundary: triggerSpells.js handleSeeInvisibility (:70-76) PRE-GATES the same
// lowercase name, spreads the full 5 args, and DISCARDS the result ({ handled: true }) —
// caller result-discard already pinned by earlyReturns-noDamage.test.js:318; the
// spellCastService.* specs mock this module away (dispatch only). Our negative/case rows
// are therefore drift-detector pins for the double-gate (#1391 form).
// DISK IDENTITY, both rulesets, read programmatically (#1365/#1362 — nothing invented):
// 'See Invisibility' lv2 Divination, range Self, duration '1 hour' with concentration:false
// in BOTH rulesets (steering-note 'Concentration, up to 1 minute' refuted by disk), save key
// ABSENT (absence-census: envelope owns no save/DC bytes), casting_time '1 action' (5e) vs 'Action' (2024) — #1391 class split:
// this lane stamps the 5e-form '1 action' byte for BOTH rulesets, pinned honestly.
// NO-CLOCK: zero Date.now/setTimeout/setInterval in this source (grep-clean); '1_hour' is
// a token resolved by buffHandler; combat-scope clearing rides the initiative seam (above).
// Quirk census: `(spell.name || '')` is a ||'' string-default member (#1404 family);
// `spell.level || 2` is the ||2 bane-class member (#1374) — level 0 silently becomes 2,
// pinned below; golden unguarded-deref-outside-try (#1360): spell.name at :4 and spell.level
// at :17 sit OUTSIDE the try — undefined spell rejects TypeError with console untouched.
// Silent-null guard (#1401 form): name-gate return at :5 logs ZERO bytes — negatives assert
// console untouched. Never-executed guard found: the negative branch of the gate has ZERO
// production callers (caller pre-lowercases and exact-matches first, triggerSpells.js:71) —
// kept as drift pin, not deleted. Registry verdict: 'see_invisibility' is ABSENT from
// targetEffectDefinitions.js BY DESIGN — this lane emits a buff-effect byte (temp_buff),
// not a te.effect; no #1373 GM-adder leak applies. Zero dice here — declared.
// Write budget: ZERO runtime-store calls in this source (no useRuntimeState import) — the
// only collaborator is the heavy automation engine, correctly mocked. Strict fake below
// records full arg tuples and THROWS on any unqueued invocation; console spy afterEach-restored;
// no bare toHaveBeenCalled()/objectContaining/expect.any on mutation claims (vitest-4
// #1312: clearAllMocks RETAINS implementations — implementation is installed once, arrays
// re-seeded each test).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';
import { triggerSeeInvisibility } from './seeInvisibilityService.js';
// NOTE: no direct executeHandler import — reaching the fake is proven behaviorally
// when the golden path returns the queued envelope by identity (mock-boundary audit).

let handlerCalls;
let handlerQueue;

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(async (...args) => {
        handlerCalls.push(args);
        if (handlerQueue.length === 0) {
            throw new Error('unexpected executeHandler invocation: queue empty');
        }
        const outcome = handlerQueue.shift();
        if (outcome instanceof Error) throw outcome;
        return outcome;
    }),
}));

const CAMPAIGN = 'TestCampaign';
const MAP = 'testMap';

// Disk rows are the canonical cast payload (#1339): name byte-exact 'See Invisibility'
// in both rulesets — the near-miss gate neighbour is 'Invisibility' (lv2 Illusion, Touch).
const DISK_SEE_5E = spells5e.find((s) => s.name === 'See Invisibility');
const DISK_SEE_2024 = spells2024.find((s) => s.name === 'See Invisibility');

const EXPECTED_AUTOMATION = {
    type: 'temp_buff',
    effect: 'see_invisibility',
    duration: '1_hour',
    action: 'action',
    casting_time: '1 action',
};

describe('seeInvisibilityService', () => {
    let consoleSpy;
    let playerStats;

    beforeEach(() => {
        handlerCalls = [];
        handlerQueue = [];
        consoleSpy = vi.spyOn(console, 'error');
        playerStats = { name: 'Wizard' };
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('disk identity (both rulesets, read programmatically)', () => {
        it('See Invisibility is lv2 Divination Self 1 hour no-save in both rulesets, casting_time split #1391', () => {
            for (const [label, row] of [['5e', DISK_SEE_5E], ['2024', DISK_SEE_2024]]) {
                expect(row, `${label} disk row must exist`).toBeTruthy();
                expect(row.level).toBe(2);
                expect(row.school).toBe('Divination');
                expect(row.range).toBe('Self');
                expect(row.duration).toBe('1 hour'); // plain, NOT concentration — disk-derived
                expect(row.save).toBeUndefined(); // disk carries NO save key — no-save absence census: envelope owns no DC
                expect(row.concentration).toBe(false); // plain, NOT concentration — disk-derived
            }
            expect(DISK_SEE_5E.casting_time).toBe('1 action');
            expect(DISK_SEE_2024.casting_time).toBe('Action');
        });
    });

    describe('triggerSeeInvisibility', () => {
        it('golden path stamps the exact 5-key envelope and forwards it 4-arg by identity, returning the handler result by identity', async () => {
            const spell = { ...DISK_SEE_5E };
            const resultEnvelope = { type: 'popup', payload: { type: 'automation_info' } };
            handlerQueue.push(resultEnvelope);

            const result = await triggerSeeInvisibility(spell, {}, playerStats, CAMPAIGN, MAP);

            expect(handlerCalls).toHaveLength(1);
            const [action, statsArg, campaignArg, mapArg] = handlerCalls[0];
            expect(handlerCalls[0]).toHaveLength(4); // arity: 5-arg inert pattern absent here (#1405)
            expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
            expect(Object.keys(action.automation)).toEqual(['type', 'effect', 'duration', 'action', 'casting_time']);
            expect(action.automation).toEqual(EXPECTED_AUTOMATION); // '1 action' stamped for BOTH rulesets (#1391 honest pin)
            expect(action.name).toBe('See Invisibility');
            expect(action.spellSlotLevel).toBe(2); // disk lv2 via spell.level||2
            expect(action.spell).toBe(spell); // passthrough by identity
            expect(statsArg).toBe(playerStats);
            expect(campaignArg).toBe(CAMPAIGN);
            expect(mapArg).toBe(MAP);
            expect(result).toBe(resultEnvelope); // passthrough identity (caller discards, triggerSpells.js:72)
            expect(spell).toEqual(DISK_SEE_5E); // input purity (#1395)
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it.each(['SEE INVISIBILITY', 'sEe iNvIsIbIlItY'])('normalizes %s to the canonical stamped name byte', async (name) => {
            handlerQueue.push({ type: 'popup' });

            await triggerSeeInvisibility({ name, level: 2 }, {}, playerStats, CAMPAIGN, MAP);

            expect(handlerCalls).toHaveLength(1);
            const [action] = handlerCalls[0];
            expect(action.name).toBe('See Invisibility');
            expect(action.automation).toEqual(EXPECTED_AUTOMATION);
        });

        it.each([
            ['Invisibility', 'near-miss disk name (lv2 Illusion, Touch)'],
            ['Fire Bolt', 'unrelated cantrip'],
            ['see invis', 'truncated prefix'],
            [' See Invisibility ', 'no-trim gate: padded exact name rejected'],
            [undefined, 'undefined name'],
            [null, 'null name'],
            ['', 'empty-string name'],
            [0, 'falsy 0 name (||"" swallow member, #1404 family)'],
        ])('name-gate rejects %s silently: null result, zero handler calls, zero console bytes', async (name) => {
            const result = await triggerSeeInvisibility({ name, level: 2 }, {}, playerStats, CAMPAIGN, MAP);

            expect(result).toBeNull();
            expect(handlerCalls).toHaveLength(0);
            expect(consoleSpy).not.toHaveBeenCalled(); // silent-null guard (#1401 form)
        });

        it.each([
            ['level 0 falls to 2 via ||2 bane-class (#1374)', { level: 0 }, 2],
            ['absent level defaults to disk level 2', {}, 2],
            ['level 4 passes through (upcast)', { level: 4 }, 4],
        ])('spellSlotLevel: %s', async (_label, spellOverrides, expected) => {
            handlerQueue.push({ type: 'popup' });

            await triggerSeeInvisibility({ name: 'See Invisibility', ...spellOverrides }, {}, playerStats, CAMPAIGN, MAP);

            expect(handlerCalls).toHaveLength(1);
            const [action] = handlerCalls[0];
            expect(action.spellSlotLevel).toBe(expected);
            expect(Object.keys(action.automation)).toEqual(['type', 'effect', 'duration', 'action', 'casting_time']);
        });

        it('undefined spell: unguarded deref outside the try rejects TypeError, console untouched (#1360 golden)', async () => {
            await expect(
                triggerSeeInvisibility(undefined, {}, playerStats, CAMPAIGN, MAP),
            ).rejects.toThrow(TypeError);

            expect(handlerCalls).toHaveLength(0);
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('handler rejection: returns null and logs the exact prefix bytes with the identical Error instance (#1385)', async () => {
            const err = new Error('Handler failed: see-invisibility-token');
            handlerQueue.push(err);

            const result = await triggerSeeInvisibility({ ...DISK_SEE_2024 }, {}, playerStats, CAMPAIGN, MAP);

            expect(result).toBeNull();
            expect(handlerCalls).toHaveLength(1);
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy.mock.calls[0][0]).toBe('[seeInvisibility] Failed to execute See Invisibility handler:');
            expect(consoleSpy.mock.calls[0][1]).toBe(err);
        });
    });
});
