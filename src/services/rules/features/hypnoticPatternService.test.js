// @maintained-by-ai
// hypnoticPatternService lane — PRODUCER + damage-break lane (enchantment family #1343-#1348/
// #1354-#1356/#1374). triggerHypnoticPattern is the cast seam invoked live by
// spellCastService/execution/triggerSpells.js handleHypnoticPattern (:130-132), which spreads
// { ...metaCtx, spellSaveDc } — spellSaveDc may be undefined there, so the '== null' fallback
// tiers below are live paths, not theoretical. Per family verdict #1344 ('each charm service
// keeps its own LOCAL resolveDC copy') this service keeps its own chain and it is pinned here,
// mutually-distinguishable per #1348 method: metaCtx(18) > card spellAbilities.saveDc(15) >
// floor 8+prof(12/8); no adjacent-clash. DC coercion VERDICT: NEITHER prof||2 coercion
// (baneService.js:74 / animalFriendshipService.js:47) NOR clamp — guard is '== null' THROW on
// nullish proficiency (T4), prof 0 honored (floor 8), NaN passes through to saveDc NaN, the
// honest holyAuraService #1376 NaN-absence sibling behavior.
//
// Slot chain quirk (byte :70 `metaCtx?.slotLevel || spell.level`): the guard at :66 is
// '== null' but the compose is '||' — slotLevel 0 is swallowed into spell.level. Same class
// as holyAuraService :16 (flagged there, pinned here honestly; source fix is out of lane).
//
// UNGUARDED-DEREF-OUTSIDE-TRY (#1360/#1362 class) PRESENT and pinned: spell.name deref at :49
// and playerStats.spellAbilities/:proficiency at :54-55 sit OUTSIDE the try (:83-89, which
// wraps ONLY executeHandler) — null spell/playerStats reject with native TypeError, console
// untouched, no catch-swallow.
//
// ZONE BOUNDARY (this spell is AREA 30-ft cube): this service stamps NO zone, NO te, NO
// duration/round/minute bytes — envelope key-set is pinned exactly (no-clock policy respected;
// disk 'up to 1 minute' is combat-scoped). Round-counter zone maturation (roundToSet/
// appliedRound+expiryRounds) is owned by zoneDurationClock #1332; trio WRITE + addExpiration +
// concentration by hypnoticPatternHandler.test.js (its header: 'we are the trio producer');
// multi-target AoE picker lanes by the HypnoticPatternModal.* lanes (save-parity GOLD
// precedent #1365; picker boundary precedent cockatrice #1345). Expiry clears: shake lane is
// hypnotic_pattern_shake (SEPARATE module, sibling #1926 map); damage-break owns per-creature
// clear — tested HERE (internals) per applyDamage.hypnotic-break.test.js:15 and
// createCreatureHandlers.sp069.test.js:7 which cite this file as the break-internals owner.
// holdMonster #1374 twin-set gate N/A: this service fronts exactly ONE disk name.
//
// QUIRK SCAN (byte evidence, this copy): advantage undefined-leak ABSENT (no 'advantage'
// token); injury-proxy ABSENT; refund-lie ABSENT — spellSlotLevel is transport-only, the
// service consumes no slot resource. Latch writers/readers (#1358 class) ZERO: runtime touch
// is only activeConditions read+write inside the break lane. Chokepoint inline-dup
// (#1357/#1358 GOLD method): triggerSpells.js:131 re-checks the name-gate bytes before
// calling — the house pattern of EVERY handle* there (handlePowerWordStun/Slow/Bane are the
// same shape) and the consumer still calls the export, so not a bypass defect;
// applyDamage.js:545-551 strips generic charmed AFTER the break call (header there: 'single
// owner per fact'). Un-executed guards: NONE found — every guard pinned (:49-50 by T1 incl
// falsy names exercising the `|| ''` fallback, :55-58 by T4, :66-69 by T6, :86-89 by T9,
// break :16-21 by B1/B2 incl null/undefined/string stores). Zero-clean declared with map.
//
// DISK CANON (read programmatically, BOTH rulesets, 2026-10-20): each spells.json holds
// exactly ONE name row 'Hypnotic Pattern': level 3, Illusion, concentration true, duration up
// to 1 minute (combat-scoped, NO CLOCK stamped by this lane), dc.dc_type WIS == stamped
// saveType 'WIS' (#1365 save-parity). FOUND FACT: automation.type 'hypnotic_pattern' is
// SHARED with lv7 'Symbol' in BOTH rulesets — so disk name (== this service's name gate),
// NOT automation.type, is the producer discriminator. REAL near-miss disk names gate-refused
// (read from disk, never invented): 'Charm Person','Confusion','Dominate Monster','Hold
// Person','Sleep','Suggestion','Fear','Symbol'. NOTE: disk has NO 'Cause Fear' row in either
// ruleset (#1362 precedent) — 'Fear' is the real adjacent name; none invented here.
//
// STANDARDS: argument-keyed strict store fake throws unknown reads + wrong campaign (#1372);
// exact write-budget tuples full-set incl arity — setRuntimeValue is 4-positional, no
// setRuntimeObject/skipSync touch in this lane (#1341 audit method); guards-real-tables with
// REAL disk near-misses + falsy triples (#1352); vi.resetAllMocks + explicit re-seed every
// beforeEach (#1312, vitest-4 clears factory impls — addEntry MUST be re-seedable or the
// fire-and-forget '.catch' in break derefs undefined); identical-instance console.error in the
// catch lane; console spy restored in afterEach; Date.now stubbed for log envelopes; marker
// exactly line 1 (#1361).
//
// EXPORT MAP / caller evidence: triggerHypnoticPattern LIVE (triggerSpells.js:9,130);
// breakHypnoticPatternOnDamage LIVE (applyDamage.js:17,550 + createCreatureHandlers.js:10,41).
// Dead exports: none.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';
import { triggerHypnoticPattern, breakHypnoticPatternOnDamage } from './hypnoticPatternService.js';
import { executeHandler } from '../../automation/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';

const diskRows = (arr) => arr.filter(s => (s.name || '').toLowerCase() === 'hypnotic pattern');

describe('triggerHypnoticPattern (PRODUCER)', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks(); // #1312: reset (vitest-4 drops factory impls) + explicit re-seed
        addEntry.mockResolvedValue(undefined);
        executeHandler.mockResolvedValue({ type: 'popup' });
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    // T1 name gate: refuses REAL disk near-misses (guard-real-tables #1352 — each refused
    // name is first verified to exist on disk, never invented), tolerates falsy names via
    // the `|| ''` fallback (:49, un-executed-guard audit), and accepts case variants.
    it('refuses real disk near-miss and falsy spell names; accepts case variants', async () => {
        const diskNames = spells5e.map(s => s.name);
        // REAL disk near-misses. 'Symbol' is the sharpest: BOTH rulesets stamp it with the
        // SAME automation.type 'hypnotic_pattern' (lv7 Abjuration, verified in T2 below), so
        // automation.type is NOT the producer discriminator — this service's NAME gate is.
        const nearMiss = ['Charm Person', 'Confusion', 'Dominate Monster', 'Hold Person', 'Sleep', 'Suggestion', 'Fear', 'Symbol'];
        for (const name of nearMiss) {
            expect(diskNames).toContain(name); // REAL-name gate (#1362 precedent: never invent)
            const result = await triggerHypnoticPattern({ name, level: 3 }, {}, { spellAbilities: { saveDc: 15 }, proficiency: 4 }, campaignName, mapName);
            expect(result).toBeNull();
        }
        for (const spell of [{ name: '', level: 3 }, { level: 3 }]) {
            expect(await triggerHypnoticPattern(spell, {}, { proficiency: 4 }, campaignName, mapName)).toBeNull();
        }
        expect(executeHandler).toHaveBeenCalledTimes(0);

        const result = await triggerHypnoticPattern({ name: 'HYPNOTIC PATTERN', level: 3 }, {}, { spellAbilities: { saveDc: 15 }, proficiency: 4 }, campaignName, mapName);
        expect(result).toEqual({ type: 'popup' });
        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler.mock.calls[0][0].name).toBe('HYPNOTIC PATTERN'); // passthrough bytes
    });

    // T2 golden envelope + disk parity + forwarder purity, built from the REAL 5e disk row.
    it('stamps the exact envelope from the disk row and delegates positionally (identity pins)', async () => {
        const rows5e = diskRows(spells5e);
        expect(rows5e.length).toBe(1);
        const diskRow = rows5e[0];
        expect(diskRow.name).toBe('Hypnotic Pattern');
        expect(diskRow.level).toBe(3);

        const playerStats = { name: 'Wizard', spellAbilities: { saveDc: 15 }, proficiency: 4 };
        const result = await triggerHypnoticPattern(diskRow, {}, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, statsArg, campaignArg, mapArg] = executeHandler.mock.calls[0];
        expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
        expect(action.name).toBe(diskRow.name);
        expect(action.automation).toEqual({ type: 'hypnotic_pattern', saveDc: 15, saveType: 'WIS' });
        expect(action.spell).toBe(diskRow); // by-reference identity
        expect(action.spellSlotLevel).toBe(diskRow.level); // slot default == disk level 3
        expect(statsArg).toBe(playerStats);
        expect(campaignArg).toBe(campaignName);
        expect(mapArg).toBe(mapName);
        expect(result).toEqual({ type: 'popup' }); // pass-through of the resolved popup

        // no-clock purity: the SERVICE-stamped keys (everything except the by-reference
        // disk spell passthrough) contain no duration/zone/time bytes — expiry/round
        // stamps are downstream-owned (see header).
        expect(JSON.stringify({ name: action.name, automation: action.automation, spellSlotLevel: action.spellSlotLevel })).not.toMatch(/duration|minute|round|expir|zone/i);
        expect(setRuntimeValue).toHaveBeenCalledTimes(0);
        expect(addEntry).toHaveBeenCalledTimes(0);

        // disk canon parity BOTH rulesets (#1365 GOLD class): exactly ONE 'Hypnotic Pattern'
        // name row each, WIS save, lv3, concentration up to 1 minute => combat-scoped, NO
        // CLOCK stamped by this lane. ALSO pinned: automation.type 'hypnotic_pattern' is
        // SHARED with lv7 'Symbol' in BOTH rulesets — the name gate (T1) is the only
        // discriminator keeping Symbol out of this producer lane.
        for (const arr of [spells5e, spells2024]) {
            const rows = diskRows(arr);
            expect(rows.length).toBe(1);
            expect(rows[0].level).toBe(3);
            expect(rows[0].concentration).toBe(true);
            expect(/up to 1 minute/i.test(rows[0].duration)).toBe(true);
            expect(rows[0].dc.dc_type).toBe('WIS');
            expect(rows[0].automation.type).toBe('hypnotic_pattern');
            expect(rows[0].automation.saveType).toBe('WIS');
            const symbol = arr.find(s => s.name === 'Symbol');
            expect(symbol.automation.type).toBe('hypnotic_pattern'); // shared-type fact
            expect(symbol.level).toBe(7);
        }
    });

    // T3 DC tier chain (local resolveDC copy #1344), values mutually-distinguishable (#1348):
    // metaCtx(18) > card(15) > floor(8+prof: 12, 8); '== null' catches undefined AND null.
    // NaN proficiency passes through un-coerced (#1376 honest pin — no ||2 coercion here).
    it('resolves saveDc metaCtx > card > 8+prof floor, honors 0, passes NaN through uncoerced', async () => {
        const card = { spellAbilities: { saveDc: 15 }, proficiency: 4 };
        const spell = { name: 'Hypnotic Pattern', level: 3 };
        const tiers = [
            [{ spellSaveDc: 18, slotLevel: 3 }, card, 18],
            [{ slotLevel: 3 }, card, 15],
            [{ spellSaveDc: undefined, slotLevel: 3 }, card, 15],
            [{ spellSaveDc: null, slotLevel: 3 }, card, 15],
            [{ slotLevel: 3 }, { proficiency: 4 }, 12],
            [{ slotLevel: 3 }, { proficiency: 0 }, 8],
            [{ slotLevel: 3 }, { proficiency: NaN }, NaN],
        ];
        for (const [metaCtx, stats, expectedDc] of tiers) {
            executeHandler.mockClear();
            await triggerHypnoticPattern(spell, metaCtx, stats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].automation).toEqual({ type: 'hypnotic_pattern', saveDc: expectedDc, saveType: 'WIS' });
        }
    });

    // T4 proficiency guard (:55-58): '== null' THROW with exact console bytes, no dispatch.
    it('throws (and logs exact prefix) when proficiency is nullish', async () => {
        for (const stats of [{ name: 'Wizard' }, { name: 'Wizard', proficiency: null }]) {
            await expect(triggerHypnoticPattern({ name: 'Hypnotic Pattern', level: 3 }, {}, stats, campaignName, mapName))
                .rejects.toThrow('playerStats.proficiency is required for hypnotic pattern');
        }
        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenCalledWith('[hypnoticPatternService] triggerHypnoticPattern: playerStats.proficiency is missing');
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });

    // T5 slot composition (:66-70): metaCtx > spell.level; :0-chain quirk pinned honestly
    // (guard says 0 is present, '||' then swallows it — holyAuraService :16 same class).
    it('resolves spellSlotLevel metaCtx > spell.level, quirk: metaCtx 0 falls to spell.level', async () => {
        const stats = { spellAbilities: { saveDc: 15 }, proficiency: 4 };
        const meta = { spellSaveDc: 13 }; // sentinel DC, no clash with slot values below
        const rows = [
            [{ ...meta, slotLevel: 5 }, { name: 'Hypnotic Pattern', level: 3 }, 5],
            [meta, { name: 'Hypnotic Pattern', level: 3 }, 3],
            [{ ...meta, slotLevel: 0 }, { name: 'Hypnotic Pattern', level: 3 }, 3], // :0 quirk
            [{ ...meta, slotLevel: 4 }, { name: 'Hypnotic Pattern' }, 4],
            [undefined, { name: 'Hypnotic Pattern', level: 2 }, 2], // metaCtx undefined tolerated (?.)
        ];
        for (const [metaCtx, spell, expected] of rows) {
            executeHandler.mockClear();
            await triggerHypnoticPattern(spell, metaCtx, stats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(expected);
        }
        expect(consoleSpy).toHaveBeenCalledTimes(0); // no guard fired on any row
    });

    // T6 slot guard (:66-69): both sources absent -> exact message + console bytes, no dispatch.
    it('throws (and logs exact prefix) when slot level is absent everywhere', async () => {
        const stats = { spellAbilities: { saveDc: 15 }, proficiency: 4 };
        await expect(triggerHypnoticPattern({ name: 'Hypnotic Pattern' }, {}, stats, campaignName, mapName))
            .rejects.toThrow('slot level is required for hypnotic pattern');
        await expect(triggerHypnoticPattern({ name: 'Hypnotic Pattern' }, { slotLevel: null }, stats, campaignName, mapName))
            .rejects.toThrow('slot level is required for hypnotic pattern');
        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenCalledWith('[hypnoticPatternService] triggerHypnoticPattern: slot level is missing (metaCtx.slotLevel and spell.level)');
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });

    // T7 golden pin, #1360/#1362 class: spell/playerStats derefs live OUTSIDE the try
    // (:49/:54-55; try wraps only executeHandler at :83) -> native TypeError escapes,
    // console untouched (proves it is NOT the guard path and NOT caught).
    it('rejects with native TypeError (console untouched) when spell or playerStats is null', async () => {
        await expect(triggerHypnoticPattern(null, {}, { proficiency: 4 }, campaignName, mapName))
            .rejects.toThrow("Cannot read properties of null (reading 'name')");
        await expect(triggerHypnoticPattern({ name: 'Hypnotic Pattern' }, { spellSaveDc: null, slotLevel: 3 }, null, campaignName, mapName))
            .rejects.toThrow("Cannot read properties of null (reading 'spellAbilities')");
        expect(consoleSpy).toHaveBeenCalledTimes(0);
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });

    // T8 handler result returned BY REFERENCE (forwarder identity; null is the same case).
    it('returns the executeHandler result by reference', async () => {
        const sentinel = { type: 'popup', payload: { automation_info: true } };
        executeHandler.mockResolvedValue(sentinel);
        const result = await triggerHypnoticPattern({ name: 'Hypnotic Pattern', level: 3 }, {}, { spellAbilities: { saveDc: 15 }, proficiency: 4 }, campaignName, mapName);
        expect(result).toBe(sentinel);
    });

    // T9 catch lane (:83-89, the ONLY try in the module): rejection swallowed to null, but
    // logged with exact prefix and the IDENTICAL Error instance.
    it('returns null and logs the identical error when executeHandler rejects', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);

        const result = await triggerHypnoticPattern({ name: 'Hypnotic Pattern', level: 3 }, {}, { spellAbilities: { saveDc: 15 }, proficiency: 4 }, campaignName, mapName);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0]).toEqual(['[hypnoticPatternService] Failed to execute Hypnotic Pattern handler:', err]);
        expect(consoleSpy.mock.calls[0][1]).toBe(err);
    });
});

describe('breakHypnoticPatternOnDamage (SP-069 damage-break internals)', () => {
    const CAMPAIGN = 'test-campaign';
    const FIXED_TS = 1735689600000;

    // #1372 form: argument-keyed strict store fake — unknown key/target or wrong-campaign
    // reads THROW instead of silently returning fixtures.
    const armStore = (targetName, stored) => {
        getRuntimeValue.mockImplementation((key, storeKey, campaign) => {
            if (campaign !== CAMPAIGN) throw new Error(`test-guard: unexpected campaign read '${campaign}'`);
            if (key !== targetName || storeKey !== 'activeConditions') throw new Error(`test-guard: unexpected store read '${key}.${storeKey}'`);
            return stored;
        });
    };

    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks(); // #1312: reset + explicit re-seed so addEntry STILL returns a
        addEntry.mockResolvedValue(undefined); // Promise (the service .catch-es each result)
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        Date.now.mockRestore();
    });

    // B1 full break: trio fingerprint (case-insensitive read, originals preserved byte-exact),
    // exact write-budget tuple (4-positional setRuntimeValue, arity incl.), and the EXACT
    // 4-entry addEntry budget (3 condition-removed in registry order + 1 automation row),
    // each entry deep-equal with fixed timestamp (#1341 audit method).
    it('strips exactly the hypno trio, preserves others, writes and logs exact budget', () => {
        armStore('Bandit 1', ['prone', 'Charmed', 'incapacitated', 'Poisoned', 'speed_zero']);

        const broke = breakHypnoticPatternOnDamage('Bandit 1', CAMPAIGN);

        expect(broke).toBe(true);
        expect(getRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Bandit 1', 'activeConditions', ['prone', 'Poisoned'], CAMPAIGN);
        expect(addEntry).toHaveBeenCalledTimes(4);
        expect(addEntry.mock.calls).toEqual([
            [CAMPAIGN, { type: 'condition', action: 'removed', characterName: 'Bandit 1', condition: 'Charmed', reason: 'Took damage (Hypnotic Pattern)', timestamp: FIXED_TS }],
            [CAMPAIGN, { type: 'condition', action: 'removed', characterName: 'Bandit 1', condition: 'Incapacitated', reason: 'Took damage (Hypnotic Pattern)', timestamp: FIXED_TS }],
            [CAMPAIGN, { type: 'condition', action: 'removed', characterName: 'Bandit 1', condition: 'Speed_zero', reason: 'Took damage (Hypnotic Pattern)', timestamp: FIXED_TS }],
            [CAMPAIGN, { type: 'automation', automation: 'hypnotic_pattern_broken', characterName: 'Bandit 1', description: 'Bandit 1 took damage — Hypnotic Pattern ends for it.', timestamp: FIXED_TS }],
        ]);
        expect(consoleSpy).toHaveBeenCalledTimes(0);
    });

    // B2 fingerprint refusal + store-shape guards (:16-21): partial trios (Confusion charms
    // WITHOUT incapacitated — its own repeat-save lane owns those; domination rides its own
    // lane), empty/non-array stores, and unshakeable case variants return false with a
    // ZERO write/log budget.
    it('refuses non-hypno shapes and guards null/undefined/non-array stores with zero writes', () => {
        const refusals = [
            ['charmed', 'speed_zero'],      // Confusion shape (no incapacitated)
            ['charmed'],                    // plain Charm Person
            ['incapacitated', 'speed_zero'], // trio minus charmed
            [],                             // empty store
            null,                           // `|| []` fallback (:16)
            undefined,
            'charmed',                      // non-array store (Array.isArray guard :17)
            ['PRONE'],                      // unrelated, untouched
        ];
        for (const stored of refusals) {
            armStore('Goblin', stored);
            expect(breakHypnoticPatternOnDamage('Goblin', CAMPAIGN)).toBe(false);
        }
        expect(setRuntimeValue).toHaveBeenCalledTimes(0);
        expect(addEntry).toHaveBeenCalledTimes(0);
    });

    // B3 fire-and-forget logging: addEntry rejection never corrupts the break — the
    // condition write stands and every failed log is console.error'd with exact bytes.
    it('still breaks and writes once when every log rejects', async () => {
        armStore('Bandit 1', ['charmed', 'incapacitated', 'speed_zero']);
        addEntry.mockRejectedValue(new Error('log down'));

        const broke = breakHypnoticPatternOnDamage('Bandit 1', CAMPAIGN);
        await new Promise((resolve) => setTimeout(resolve, 0)); // flush the .catch microtasks (harness-only, not a game timer)

        expect(broke).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Bandit 1', 'activeConditions', [], CAMPAIGN);
        expect(consoleSpy).toHaveBeenCalledTimes(4);
        expect(consoleSpy.mock.calls.map(c => c[0])).toEqual([
            '[hypnoticPatternService:log-error]',
            '[hypnoticPatternService:log-error]',
            '[hypnoticPatternService:log-error]',
            '[hypnoticPatternService:log-error]',
        ]);
    });
});
