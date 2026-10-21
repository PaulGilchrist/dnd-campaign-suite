// @maintained-by-ai
// Producer lane for holyAuraService.js:4-28 (sole export triggerHolyAura; LIVE —
// called by spells/spellCastService/execution/triggerSpells.js:407 handleHolyAura).
// Honors reciprocal cite from holyAuraDamageService.test.js:15 ("The PRODUCER write
// of holyAuraSaveDc and the aura trigger belong to features/holyAuraService.test.js").
// This lane pins: the saveDc PRODUCER chain (:5 composed spellAbilities.saveDc ??
// 8+prof, upstream canon core/spellCalc.js:161/:165 — composed values embed the CHA
// modifier, the fallback does NOT), the exact fire-and-forget store write tuple
// (:19, key bytes 'holyAuraSaveDc' camelCase — the SAME key #1375 reads 3-arg at
// holyAuraDamageService.js:30), the action envelope routed to executeHandler with
// automation.type 'holy_aura' (registry key, targetEffectDefinitions.js:627; te
// stamp bytes owned by automation/handlers/buffs/holyAuraHandler.test.js), the
// spellSlotLevel ||-chain (:16), and the catch/log contract (:24-26).
// CASING VERDICT vs #1375 RED: this producer writes NO ability_score_modifiers key
// at all — its only persisted artifact is a NUMBER under 'holyAuraSaveDc'
// (byte-pinned below). #1375's uppercase ability_score_modifiers.CON read (its :33)
// consults the attacker creature from loadCombatSummary/disk, not this lane's output;
// disk monsters.json is byte-verified lowercase ['cha','con','dex','int','str','wis']
// — that RED is fully consumer-side, this lane is its innocent twin producer.
// NO-CLOCK audit: CLEAN — only runtime write is the numeric DC; duration strings are
// transient passthrough on the action object (removal owned by concentration/clear
// lanes: combat/concentration/concentrationService + hpMaxReduceService.aura-of-life
// #1289); no minutes arithmetic, no Date.now, no countdown stored.
// Quirks pinned honestly: :5 NaN when proficiency missing (same unguarded formula as
// spellCalc.js:161; neighbors baneService.js:74/animalFriendshipService.js:47 coerce
// '|| 2' — this lane does not; JSON round-trip of NaN stores null, consumer falsy
// gate at holyAuraDamageService.js:31 then bails); :5/:19 sit OUTSIDE the try at
// :21 (unguarded-deref class #1360); :16 ||-chain treats slotLevel 0 as absent;
// fallback duration 'Concentration, up to 1 minute' is never executed on disk-canon
// input (both disk ruleset rows carry duration) — declared rules-internal default,
// 1+ never-executed guard found, not zero-clean.
// Mocked at seams only: executeHandler (handler/router internals owned by automation
// lanes) and setRuntimeValue (server transport owned elsewhere); real 5e+2024 disk
// spell rows fed verbatim as inputs (parity: passthrough, so both rows pinned).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHolyAura } from './holyAuraService.js';
import { executeHandler } from '../../automation/index.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../automation/index.js', () => ({ executeHandler: vi.fn() }));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({ setRuntimeValue: vi.fn() }));

const CAMPAIGN = 'TestCampaign';
const MAP = 'testMap';
const STORE_KEY = 'holyAuraSaveDc'; // byte-identical to consumer read #1375 (:30)
const SENTINEL = { type: 'popup', payload: { automation: 'holy_aura' } };

function paladin({ saveDc, modifier, proficiency } = {}) {
    const stats = { name: 'Paladin' };
    if (proficiency !== undefined) stats.proficiency = proficiency;
    if (saveDc !== undefined || modifier !== undefined) {
        stats.spellAbilities = { spellCastingAbility: 'Charisma' };
        if (saveDc !== undefined) stats.spellAbilities.saveDc = saveDc;
        if (modifier !== undefined) stats.spellAbilities.modifier = modifier;
    }
    return stats;
}

// Real disk rows — public/data/spells.json and public/data/2024/spells.json.
const DISK_5E = { name: 'Holy Aura', level: 8, duration: 'Up to 1 minute', casting_time: '1 action', concentration: true };
const DISK_2024 = { name: 'Holy Aura', level: 8, duration: 'Concentration, up to 1 minute', casting_time: 'Action', concentration: true, dc: { dc_type: 'CON', dc_success: 'none' } };

let writes; // exact setRuntimeValue tuples, budget-enforced
let consoleSpy;

beforeEach(() => {
    vi.resetAllMocks(); // vitest-4 #1312: reset + explicit re-seed, never bare clear
    writes = [];
    setRuntimeValue.mockImplementation((name, key, value, campaign) => {
        if (campaign !== CAMPAIGN) throw new Error(`wrong-campaign write: ${campaign}`);
        if (key !== STORE_KEY) throw new Error(`unexpected store key: ${key}`);
        writes.push([name, key, value, campaign]);
    });
    executeHandler.mockResolvedValue(SENTINEL);
    consoleSpy = vi.spyOn(console, 'error');
});

afterEach(() => {
    consoleSpy.mockRestore();
});

const lastAction = () => executeHandler.mock.calls[0][0];

describe('triggerHolyAura', () => {
    describe('saveDc producer chain (:5) + store write tuple (:19)', () => {
        it.each([
            // composed upstream (spellCalc.js:165 8+CHA5+prof4); fallback 8+prof=12 clashes with nothing here
            ['composed spellAbilities.saveDc passthrough', paladin({ saveDc: 17, proficiency: 4 }), 17],
            ['fallback 8+prof (prof 3), no spellAbilities', paladin({ proficiency: 3 }), 11],
            ['fallback ignores CHA modifier (prof 5 +5 -> 13, mirrors spellCalc.js:161)', paladin({ modifier: 5, proficiency: 5 }), 13],
            ['missing proficiency -> NaN (no ||0/||2 coercion; JSON round-trip -> null, consumer gate #1375)', paladin(), NaN],
        ])('%s', async (_label, stats, expectedDc) => {
            await triggerHolyAura(DISK_5E, {}, stats, CAMPAIGN, MAP);
            // write budget: exactly one, exact tuple, value numeric-where-real
            expect(writes).toEqual([[stats.name, STORE_KEY, expectedDc, CAMPAIGN]]);
            expect(typeof writes[0][2]).toBe('number');
            const [action, statsArg, campaignArg, mapArg] = executeHandler.mock.calls[0];
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(action.dc).toBe(expectedDc);
            expect(statsArg).toBe(stats);
            expect(campaignArg).toBe(CAMPAIGN);
            expect(mapArg).toBe(MAP);
        });
    });

    describe('action envelope — disk-canon passthrough, both rulesets', () => {
        it.each([
            ['5e disk row', DISK_5E, { type: 'holy_aura', duration: 'Up to 1 minute', auraRange: 30, casting_time: '1 action' }],
            ['2024 disk row intact ("Action" not normalized)', DISK_2024, { type: 'holy_aura', duration: 'Concentration, up to 1 minute', auraRange: 30, casting_time: 'Action' }],
            ['bare spell -> rules-internal fallbacks (never hit by disk rows)', { name: 'Holy Aura' }, { type: 'holy_aura', duration: 'Concentration, up to 1 minute', auraRange: 30, casting_time: '1 action' }],
        ])('%s', async (_label, spell, expectedAutomation) => {
            const stats = paladin({ saveDc: 17, proficiency: 4 });
            const result = await triggerHolyAura(spell, {}, stats, CAMPAIGN, MAP);
            expect(lastAction()).toEqual({
                name: 'Holy Aura',
                automation: expectedAutomation, // exact — no extra/missing automation keys
                spell,
                dc: 17,
                spellSlotLevel: spell.level ?? 8,
            });
            expect(lastAction().spell).toBe(spell); // passthrough identity, no clone/mutate
            expect(consoleSpy).not.toHaveBeenCalled(); // envelope rows are happy paths
            expect(result).toBe(SENTINEL);
        });
    });

    describe('spellSlotLevel ||-chain (:16)', () => {
        it.each([
            ['metaCtx.slotLevel overrides spell.level', { slotLevel: 9 }, { ...DISK_5E, level: 8 }, 9],
            ['slotLevel 0 is falsy -> falls through to spell.level 7', { slotLevel: 0 }, { ...DISK_5E, level: 7 }, 7],
            ['no metaCtx, no spell.level -> literal 8 (Holy Aura canonical)', undefined, { name: 'Holy Aura' }, 8],
        ])('%s', async (_label, metaCtx, spell, expectedSlot) => {
            await triggerHolyAura(spell, metaCtx, paladin({ saveDc: 17, proficiency: 4 }), CAMPAIGN, MAP);
            expect(lastAction().spellSlotLevel).toBe(expectedSlot);
        });
    });

    it('writes the DC once BEFORE executeHandler and returns its result unchanged (:19-:23)', async () => {
        const stats = paladin({ saveDc: 17, proficiency: 4 });
        const result = await triggerHolyAura(DISK_5E, {}, stats, CAMPAIGN, MAP);
        expect(result).toBe(SENTINEL); // identity passthrough
        expect(writes.length).toBe(1);
        expect(executeHandler.mock.invocationCallOrder[0]).toBeGreaterThan(setRuntimeValue.mock.invocationCallOrder[0]);
    });

    it('resolves null from handler: null out, no error log; handler throw: null out, one exact log (:21-:27)', async () => {
        executeHandler.mockResolvedValue(null);
        expect(await triggerHolyAura(DISK_5E, {}, paladin({ saveDc: 17, proficiency: 4 }), CAMPAIGN, MAP)).toBeNull();
        expect(consoleSpy).not.toHaveBeenCalled(); // null result is not an error path

        const err = new Error('Holy Aura handler failed');
        executeHandler.mockRejectedValue(err);
        const stats = paladin({ saveDc: 17, proficiency: 4 });
        expect(await triggerHolyAura(DISK_5E, {}, stats, CAMPAIGN, MAP)).toBeNull();
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('[holyAura] Trigger failed:', err); // identical instance, exact prefix
        // One DC write per invocation (budget 2 over 2 calls); each write landed
        // BEFORE its executeHandler call because :19 sits outside the try — consumer
        // #1375 gates on targetEffects first, so a stale DC alone is inert.
        expect(writes).toEqual([
            ['Paladin', STORE_KEY, 17, CAMPAIGN],
            ['Paladin', STORE_KEY, 17, CAMPAIGN],
        ]);
        expect(executeHandler).toHaveBeenCalledTimes(2);
    });
});
