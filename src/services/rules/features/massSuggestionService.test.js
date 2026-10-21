// @maintained-by-ai
// massSuggestionService lane — AoE compulsion FORWARDER (enchantment family #1343-#1348/#1374/
// #1378). triggerMassSuggestion is the cast seam invoked LIVE by triggerSpells.js
// handleMassSuggestion (:169-175), which spreads { ...metaCtx, spellSaveDc } — spellSaveDc may
// be undefined there, so the '== null' fallback tiers below are live paths, not theoretical.
// Export map: triggerMassSuggestion is the module's ONLY export; caller evidence above; no dead
// exports. Target selection, saves, pay-at-confirm and duration scaling (5e disk higher_level:
// 10 days/30 days/1 year) are massSuggestionHandler lanes (massSuggestionHandler.test.js /
// .rejections.test.js cite massSuggestionService.js) — NOT duplicated here. Charm twins
// charmMonster/charmPerson (#1343/#1344) and hypnoticPattern (#1378) own their own local
// resolveDC copies (#1344 house pattern); THIS copy's chain is pinned here.
//
// TWIN DISCRIMINATION (single-suggestion): SEPARATE service per tier — suggestionService.js
// fronts disk lv2 'Suggestion' (automation.type 'suggestion'), this lane fronts lv6 'Mass
// Suggestion' (automation.type 'mass_suggestion'). Gates are strict lowercase EXACT equality:
// :4 `=== 'mass suggestion'` vs twin :4 `=== 'suggestion'` — neither can capture the other's
// name; 'Suggestion' is the sharpest real-disk refusal (T1). Unlike hypnoticPattern #1378
// there is NO shared automation.type here: disk census shows 'mass_suggestion' held by exactly
// ONE row in BOTH rulesets.
//
// DC COERCION CENSUS (#1374 six-way): THIS copy is the '== null'-THROW form — NOT the twin's
// `|| 8 + (proficiency || 2)` coercion (suggestionService.js:7), NOT ||0, NOT clamp:
// metaCtx.spellSaveDc(18) > card saveDc(15) > floor 8+prof(12); 0 is HONORED at every
// spellSaveDc/card tier (== null passes 0 through), prof 0 floors at 8, NaN passes through
// uncoerced (#1376 honest pin). Mutually-distinguishable values per #1348.
//
// SLOT CHAIN QUIRK pinned honestly (guard :21 '== null' vs compose :25 '||'): slotLevel 0
// survives the guard then is SWALLOWED into spell.level; with spell.level ABSENT the compose
// emits spellSlotLevel undefined — flag for the owner (source fix out of lane; same class as
// holyAuraService :16 / hypnoticPatternService :70). spell.level 0 with no metaCtx survives.
//
// UNGUARDED-DEREF-OUTSIDE-TRY (#1360 class) PRESENT and pinned: spell.name :4 and
// playerStats.spellAbilities :9 sit OUTSIDE the try (:38-44 wraps ONLY executeHandler) — null
// spell/playerStats reject with native TypeError, console untouched.
// NO-CLOCK SCAN: zero Date.now/setTimeout/round/expiry bytes in this module (grep-verified);
// disk duration '24 hours' non-concentration in BOTH rulesets is combat-irrelevant transport —
// service stamps no duration (#1365 disk-decides; the notes' 'concentration 5e vs until
// dispelled 2024' hypothesis is FALSE on disk — both rows agree). Case-gate scan: strict
// lowercase-exact gate; byte-drift refusals pinned in T1. Selection/range lanes: ABSENT here
// (isWithinRange owned downstream); store fake N/A — service touches no runtime store, no dice,
// no logging outside the guard/catch console.error calls (all pinned with exact prefixes,
// identical-Error instance in catch; #1380 unstubbed-dice N/A).
//
// STANDARDS: vi.resetAllMocks + explicit re-seed beforeEach (#1312); exact envelope toEqual +
// toBe identities (#1341); REAL disk near-miss refusals, none invented (#1352); console spy
// afterEach-restored; no bare counters on mutations; marker exactly line 1 (#1361).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';
import { triggerMassSuggestion } from './massSuggestionService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const SPELL = { name: 'Mass Suggestion', level: 6 };
const card = { name: 'Wizard', spellAbilities: { saveDc: 15 }, proficiency: 4 };

const diskRows = (arr) => arr.filter(s => (s.name || '').toLowerCase() === 'mass suggestion');

describe('triggerMassSuggestion', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks(); // #1312: reset drops factory impls — re-seed explicitly
        executeHandler.mockResolvedValue({ type: 'popup' });
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    // T1 name gate (:4-5): strict lowercase EXACT equality refuses the single-suggestion twin
    // and every real disk near-miss (guard-real-tables #1352 — each refused name verified on
    // disk, never invented), falsy names via the `|| ''` fallback, and case-drift bytes
    // (#1384/#1385 class: near-hits with a plural/space/jam are silent-null, by design).
    it('refuses twin, real disk near-misses, falsy and byte-drift names with zero dispatch', async () => {
        const diskNames = spells5e.map(s => s.name);
        const nearMiss = ['Suggestion', 'Command', 'Hold Monster', 'Dominate Monster', 'Hypnotic Pattern', 'Fire Bolt'];
        for (const name of nearMiss) {
            expect(diskNames).toContain(name); // REAL-name gate
            expect(await triggerMassSuggestion({ name, level: 6 }, {}, card, campaignName, mapName)).toBeNull();
        }
        for (const spell of [{ name: '', level: 6 }, { level: 6 }, { name: null, level: 6 }]) {
            expect(await triggerMassSuggestion(spell, {}, card, campaignName, mapName)).toBeNull();
        }
        // byte-drift probes (gate is exact-equality, NOT includes/trim): plural, padded, jammed.
        for (const name of ['Mass Suggestions', ' Mass suggestion', 'Masssuggestion']) {
            expect(await triggerMassSuggestion({ name, level: 6 }, {}, card, campaignName, mapName)).toBeNull();
        }
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });

    // T2 golden envelope from the REAL disk row: exact key-set, exact automation, by-reference
    // spell + positional forward, result pass-through — repeated across case variants with
    // name bytes preserved. Plus disk canon parity BOTH rulesets (#1365): exactly one row,
    // lv6 enchantment, WIS == stamped saveType, duration '24 hours' non-concentration in
    // BOTH (no RAW divergence on disk), automation.type 'mass_suggestion' held by EXACTLY
    // ONE row each (no Symbol-style shared-type GOLD here), higher_level scaling 5e-only
    // (2024 row omits the key entirely) — slot-number transport stays here, duration scaling
    // is handler-owned.
    it('stamps the exact envelope from disk, forwards positionally across case variants; disk parity both rulesets', async () => {
        const diskRow = diskRows(spells5e)[0];
        expect(diskRows(spells5e).length).toBe(1);

        const result = await triggerMassSuggestion(diskRow, {}, card, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, statsArg, campaignArg, mapArg] = executeHandler.mock.calls[0];
        expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
        expect(action.name).toBe('Mass Suggestion');
        expect(action.automation).toEqual({ type: 'mass_suggestion', saveDc: 15, saveType: 'WIS' });
        expect(action.spell).toBe(diskRow);
        expect(action.spellSlotLevel).toBe(6);
        expect(statsArg).toBe(card);
        expect(campaignArg).toBe(campaignName);
        expect(mapArg).toBe(mapName);
        expect(result).toEqual({ type: 'popup' });

        // case-insensitive gate, case-preserving passthrough bytes
        for (const name of ['MASS SUGGESTION', 'mass suggestion', 'MaSs SuGgEsTiOn']) {
            executeHandler.mockClear();
            const spell = { name, level: 6 };
            await triggerMassSuggestion(spell, {}, card, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            const fwd = executeHandler.mock.calls[0][0];
            expect(fwd.name).toBe(name);
            expect(fwd.automation).toEqual({ type: 'mass_suggestion', saveDc: 15, saveType: 'WIS' });
            expect(fwd.spell).toBe(spell);
        }

        for (const arr of [spells5e, spells2024]) {
            const rows = diskRows(arr);
            expect(rows.length).toBe(1);
            expect(rows[0].level).toBe(6);
            expect(rows[0].school).toBe('Enchantment');
            expect(rows[0].concentration).toBe(false);
            expect(rows[0].duration).toBe('24 hours');
            expect(rows[0].dc.dc_type).toBe('WIS');
            expect(rows[0].automation.type).toBe('mass_suggestion');
            expect(rows[0].automation.saveType).toBe('WIS');
            expect(arr.filter(s => (s.automation || {}).type === 'mass_suggestion').length).toBe(1);
        }
        expect(Array.isArray(spells5e.find(s => s.name === 'Mass Suggestion').higher_level)).toBe(true);
        expect('higher_level' in spells2024.find(s => s.name === 'Mass Suggestion')).toBe(false); // key ABSENT in 2024 disk
        // no-clock purity: SERVICE-stamped keys carry no duration/round/expiry bytes.
        expect(JSON.stringify({ name: action.name, automation: action.automation, spellSlotLevel: action.spellSlotLevel }))
            .not.toMatch(/duration|minute|round|expir|hour|day/i);
    });

    // T3 DC tier chain (:8-20), mutually-distinguishable (#1348), == null form: metaCtx(18) >
    // card(15) > floor 8+prof(12); undefined AND null drop one tier; 0 HONORED at metaCtx and
    // card tiers (this is what separates the THROW form from suggestionService.js:7's ||-form);
    // prof 0 floors 8; NaN passes through uncoerced (#1376).
    it('resolves saveDc metaCtx > card > 8+prof floor, honors 0, passes NaN through uncoerced', async () => {
        const tiers = [
            [{ spellSaveDc: 18 }, card, 18],
            [{ spellSaveDc: undefined }, card, 15],
            [{ spellSaveDc: null }, card, 15],
            [{ spellSaveDc: 0 }, card, 0],
            [{}, card, 15],
            [{}, { spellAbilities: { saveDc: 0 }, proficiency: 4 }, 0],
            [{}, { spellAbilities: undefined, proficiency: 4 }, 12],
            [{}, { proficiency: 4 }, 12],
            [{}, { proficiency: 0 }, 8],
            [{}, { proficiency: NaN }, NaN],
            [{ spellSaveDc: NaN }, card, NaN],
        ];
        for (const [metaCtx, stats, expectedDc] of tiers) {
            executeHandler.mockClear();
            await triggerMassSuggestion(SPELL, metaCtx, stats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].automation).toEqual({ type: 'mass_suggestion', saveDc: expectedDc, saveType: 'WIS' });
        }
        expect(consoleSpy).toHaveBeenCalledTimes(0); // no guard fired on any tier row
    });

    // T4 proficiency guard (:10-13): '== null' THROW + exact console bytes, zero dispatch;
    // guard ORDER pinned — DC guard fires before the slot guard (:8-20 precedes :21-24).
    it('throws (and logs exact prefix) when proficiency is nullish, before the slot guard', async () => {
        for (const stats of [{ name: 'Wizard' }, { name: 'Wizard', proficiency: null }]) {
            await expect(triggerMassSuggestion(SPELL, {}, stats, campaignName, mapName))
                .rejects.toThrow('playerStats.proficiency is required for mass suggestion');
        }
        // both missing: proficiency message first (proves :10 evaluated before :21)
        await expect(triggerMassSuggestion({ name: 'Mass Suggestion' }, {}, { name: 'Wizard' }, campaignName, mapName))
            .rejects.toThrow('playerStats.proficiency is required for mass suggestion');
        expect(consoleSpy).toHaveBeenCalledTimes(3);
        expect(consoleSpy).toHaveBeenCalledWith('[massSuggestionService] triggerMassSuggestion: playerStats.proficiency is missing');
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });

    // T5 slot compose (:21-25) + :0-swallow QUIRK honestly: guard '== null' admits slotLevel 0
    // but '||' swallows it into spell.level, and emits spellSlotLevel UNDEFINED when
    // spell.level is absent (flag upstream; fix out of lane). spell.level 0 survives the
    // compose when metaCtx has no slot; metaCtx undefined tolerated via ?..
    it('composes spellSlotLevel metaCtx > spell.level; :0 quirk swallows slotLevel 0 honestly', async () => {
        const rows = [
            [{ slotLevel: 7 }, SPELL, 7], // metaCtx priority
            [{}, SPELL, 6], // spell.level fallback
            [{ slotLevel: 0 }, SPELL, 6], // :0 quirk — swallowed into spell.level
            [{ slotLevel: 0 }, { name: 'Mass Suggestion' }, undefined], // :0 quirk — undefined emitted
            [{}, { name: 'Mass Suggestion', level: 0 }, 0], // spell.level 0 survives
            [undefined, SPELL, 6], // metaCtx undefined
            [null, SPELL, 6], // metaCtx null (?. guards)
        ];
        for (const [metaCtx, spell, expected] of rows) {
            executeHandler.mockClear();
            await triggerMassSuggestion(spell, metaCtx, card, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(expected);
        }
        expect(consoleSpy).toHaveBeenCalledTimes(0);
    });

    // T6 slot guard (:21-24): both sources nullish -> exact message + console bytes, no dispatch.
    it('throws (and logs exact prefix) when slot level is absent everywhere', async () => {
        await expect(triggerMassSuggestion({ name: 'Mass Suggestion' }, {}, card, campaignName, mapName))
            .rejects.toThrow('slot level is required for mass suggestion');
        await expect(triggerMassSuggestion({ name: 'Mass Suggestion' }, { slotLevel: null }, card, campaignName, mapName))
            .rejects.toThrow('slot level is required for mass suggestion');
        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenCalledWith('[massSuggestionService] triggerMassSuggestion: slot level is missing (metaCtx.slotLevel and spell.level)');
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });

    // T7 forwarder purity: executeHandler result returned BY REFERENCE (object and null).
    it('returns the executeHandler result by reference', async () => {
        const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Mass Suggestion' } };
        executeHandler.mockResolvedValue(sentinel);
        expect(await triggerMassSuggestion(SPELL, {}, card, campaignName, mapName)).toBe(sentinel);

        executeHandler.mockResolvedValue(null);
        expect(await triggerMassSuggestion(SPELL, {}, card, campaignName, mapName)).toBeNull();
        expect(consoleSpy).toHaveBeenCalledTimes(0); // resolve(null) is NOT the catch path
    });

    // T8 catch lane (:41-44, the ONLY try): rejection swallowed to null, logged once with the
    // exact prefix and the IDENTICAL Error instance.
    it('returns null and logs the identical error when executeHandler rejects', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);

        const result = await triggerMassSuggestion(SPELL, {}, card, campaignName, mapName);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0]).toEqual(['[massSuggestionService] Failed to execute Mass Suggestion handler:', err]);
        expect(consoleSpy.mock.calls[0][1]).toBe(err);
    });

    // T9 unguarded-deref-outside-try (#1360/#1362 class): :4/:9 derefs sit outside the try
    // (:38-44) — null spell/playerStats reject with native TypeError, console untouched
    // (proves NOT guard path, NOT catch-swallow), zero dispatch.
    it('rejects with native TypeError (console untouched) when spell or playerStats is null', async () => {
        await expect(triggerMassSuggestion(null, {}, card, campaignName, mapName))
            .rejects.toThrow("Cannot read properties of null (reading 'name')");
        await expect(triggerMassSuggestion(SPELL, {}, null, campaignName, mapName))
            .rejects.toThrow("Cannot read properties of null (reading 'spellAbilities')");
        expect(consoleSpy).toHaveBeenCalledTimes(0);
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });
});
