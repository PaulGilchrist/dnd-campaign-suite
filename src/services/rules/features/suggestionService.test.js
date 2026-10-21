// @maintained-by-ai
// suggestionService lane — lv2 enchantment mind-affecting FORWARDER (single-target Suggestion).
// triggerSuggestion is the cast seam invoked LIVE by triggerSpells.js handleSuggestion (:177-182),
// which spreads { ...metaCtx, spellSaveDc } where spellSaveDc comes from computeSpellStats
// (execution/index.js:190-221) — ALWAYS a resolved number on the live path (card saveDc or
// 8+prof, throws upstream if prof missing). So the metaCtx.spellSaveDc tier is LIVE and the
// card-saveDc / 8+(prof||2) tiers below are DEFENSIVE-only (#1386 caller-boundary method).
// Result is swallowed at that seam (:294 swallow(await handleSuggestion(...))) but the
// by-reference return contract is still pinned (T5) for direct callers.
// Export census: triggerSuggestion is the module's ONLY export (source :3) — caller evidence
// above; no dead exports (#1370).
//
// TWIN DISCRIMINATION (massSuggestionService, #1386): SEPARATE service per tier — this lane
// fronts disk lv2 'Suggestion' (automation.type 'suggestion'), the twin fronts lv6 'Mass
// Suggestion' ('mass_suggestion'). Gates are strict lowercase EXACT equality: this :4
// `=== 'suggestion'` vs twin :4 `=== 'mass suggestion'` — neither captures the other's bytes;
// 'Mass Suggestion' is the sharpest real-disk refusal here (T1). automation.type 'suggestion'
// is held by EXACTLY ONE row in BOTH rulesets (disk census, T2) — no hypnoticPattern #1378
// shared-type collision.
//
// DC COERCION CENSUS (#1374 six-way): THIS copy is the '||'-COERCION side — :7
// `metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2)`.
// NOT the twin's '== null'-THROW form (massSuggestionService.js:8-20): 0/NaN/falsy are
// COERCED DOWN at every tier here (the twin honors 0 and passes NaN through), and a missing
// proficiency SILENTLY floors at 8+2=10 instead of throwing. Mutually-distinguishable values
// per #1348: metaCtx(18) > card(15) > floor(12) > prof-coerced(10). Zero-throw, zero-log
// copy — the guards the twin has, this copy does not have (honest pin, console untouched).
//
// DISK DETERMINATION (#1365 GOLD, both rulesets read programmatically in T2): exactly one
// 'Suggestion' row each; lv2 Enchantment; dc.dc_type WIS; concentration TRUE in BOTH (the
// 'concentration 5e vs until-dispelled 2024' hypothesis is FALSE on disk — automation.duration
// is byte-identical 'Concentration, up to 8 hours' in both; 5e top-level duration string drops
// the word 'Concentration' while the boolean flag carries it). NO-CLOCK POLICY: 8h is ≥1 min
// hence combat-scoped — service stamps NO duration/round/expiry keys (scan in T2); expiry,
// concentration tracking, selection, saves and the campaign log are owned downstream by
// automation/handlers/spells/suggestionHandler.js (registered automation/index.js:576).
// SLOT CHAIN (:8 `metaCtx?.slotLevel || spell.level || 2`): :0-swallow BOTH sides (#1345) —
// slotLevel 0 AND spell.level 0 are coerced; with both gone the literal `|| 2` emits the disk
// lv2 default (NOT the twin's undefined-emission quirk — different byte-form, pinned T4).
// UNGUARDED-DEREF-OUTSIDE-TRY (#1360 class) PRESENT: spell.name :4 and playerStats deref :7
// sit outside the try (:21-27 wraps ONLY executeHandler) — native TypeError, console untouched (T7).
//
// STANDARDS: store fake N/A — import census shows executeHandler is the ONLY collaborator
// (mocked here); no getRuntimeValue/POST bytes in this module (grep-verified). Dice N/A —
// dice N/A — zero roll/d20 bytes here; the WIS save roll is downstream suggestionHandler-owned (#1380).
// No write-budget (zero store writes). vi.resetAllMocks + explicit re-seed beforeEach (#1312);
// exact envelope toEqual + exact key-set + toBe identities (#1341); REAL disk near-miss refusals
// only, none invented (#1352); console spy afterEach-restored; identical-Error + exact prefix in
// catch (#1385); no bare counters/objectContaining/expect.any on mutation claims (#1419/#1421);
// input-purity probe folded into T2 (#1395); marker exactly line 1 (#1361).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';
import { triggerSuggestion } from './suggestionService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const SPELL = { name: 'Suggestion', level: 2 };
const card = { name: 'Wizard', spellAbilities: { saveDc: 15 }, proficiency: 4 };

const diskRows = (arr) => arr.filter(s => (s.name || '').toLowerCase() === 'suggestion');
const automationRows = (arr) => arr.filter(s => (s.automation || {}).type === 'suggestion');

describe('triggerSuggestion', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks(); // #1312: reset drops factory impls — re-seed explicitly
        executeHandler.mockResolvedValue({ type: 'popup' });
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    // T1 name gate (:4-5): strict lowercase EXACT equality. Refuses the lv6 mass twin and every
    // real-disk near-miss (guard-real-tables #1352 — each refused name verified present on the
    // 5e disk, never invented), falsy names via the `|| ''` fallback, and byte-drift probes
    // (plural/padded/truncated — gate is exact equality, not includes/trim): silent null,
    // zero dispatch.
    it('refuses the mass twin, real disk near-misses, falsy and byte-drift names with zero dispatch', async () => {
        const diskNames = spells5e.map(s => s.name);
        const nearMiss = ['Mass Suggestion', 'Command', 'Dominate Person', 'Geas', 'Hold Monster', 'Fire Bolt'];
        for (const name of nearMiss) {
            expect(diskNames).toContain(name); // REAL-name gate — names come from disk
            expect(await triggerSuggestion({ name, level: 2 }, {}, card, campaignName, mapName)).toBeNull();
        }
        for (const spell of [{ name: '', level: 2 }, { level: 2 }, { name: null, level: 2 }]) {
            expect(await triggerSuggestion(spell, {}, card, campaignName, mapName)).toBeNull();
        }
        for (const name of ['Suggestions', ' suggestion', 'Suggest']) {
            expect(await triggerSuggestion({ name, level: 2 }, {}, card, campaignName, mapName)).toBeNull();
        }
        expect(executeHandler).toHaveBeenCalledTimes(0);
        expect(consoleSpy).toHaveBeenCalledTimes(0); // refusals are silent-null, not the catch path
    });

    // T2 golden envelope from the REAL disk row: exact key-set, exact automation (saveDc 15 from
    // the card tier), by-reference spell forward, positional 4-arity, case-insensitive gate with
    // case-PRESERVING passthrough bytes. Plus disk canon parity BOTH rulesets (#1365): exactly
    // ONE 'Suggestion' row and exactly ONE automation.type 'suggestion' holder each, lv2
    // Enchantment, WIS, concentration TRUE in both, automation.duration identical between
    // rulesets. Input purity (#1395): metaCtx unmutated. NO-CLOCK scan: service-stamped keys
    // carry no duration/round/expiry bytes.
    it('stamps the exact envelope from disk, forwards by-reference and positionally; disk parity both rulesets', async () => {
        expect(diskRows(spells5e).length).toBe(1);
        expect(diskRows(spells2024).length).toBe(1);
        const diskRow = diskRows(spells5e)[0];

        const metaCtx = { slotLevel: 3 };
        await triggerSuggestion(diskRow, metaCtx, card, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, statsArg, campaignArg, mapArg] = executeHandler.mock.calls[0];
        expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
        expect(action.name).toBe('Suggestion');
        expect(action.automation).toEqual({ type: 'suggestion', saveDc: 15, saveType: 'WIS' });
        expect(action.spell).toBe(diskRow); // by-reference spell forward pin
        expect(action.spellSlotLevel).toBe(3);
        expect(statsArg).toBe(card);
        expect(campaignArg).toBe(campaignName);
        expect(mapArg).toBe(mapName);
        expect(metaCtx).toEqual({ slotLevel: 3 }); // #1395 input-purity: unmutated

        // case-insensitive gate, case-preserving passthrough
        for (const name of ['Suggestion', 'SUGGESTION', 'SuGgEsTiOn']) {
            executeHandler.mockClear();
            const spell = { name, level: 2 };
            await triggerSuggestion(spell, {}, card, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            const fwd = executeHandler.mock.calls[0][0];
            expect(fwd.name).toBe(name);
            expect(fwd.automation).toEqual({ type: 'suggestion', saveDc: 15, saveType: 'WIS' });
            expect(fwd.spell).toBe(spell);
        }

        // disk canon parity, both rulesets, read programmatically (#1365)
        for (const arr of [spells5e, spells2024]) {
            const rows = diskRows(arr);
            expect(rows.length).toBe(1);
            expect(rows[0].level).toBe(2);
            expect(rows[0].school).toBe('Enchantment');
            expect(rows[0].concentration).toBe(true); // TRUE in BOTH rulesets
            expect(rows[0].dc.dc_type).toBe('WIS');
            expect(rows[0].automation.type).toBe('suggestion');
            expect(rows[0].automation.saveType).toBe('WIS');
            expect(rows[0].automation.duration).toBe('Concentration, up to 8 hours'); // byte-identical across rulesets
            expect(automationRows(arr).length).toBe(1); // type not shared (unlike hypnoticPattern #1378)
        }
        // no-clock purity: SERVICE-stamped keys carry no duration/round/expiry bytes
        expect(JSON.stringify({ name: action.name, automation: action.automation, spellSlotLevel: action.spellSlotLevel }))
            .not.toMatch(/duration|minute|round|expir/i);
        expect(consoleSpy).toHaveBeenCalledTimes(0);
    });

    // T3 DC chain (:7) — '||'-COERCION form (discriminated from the twin's == null-THROW form,
    // massSuggestionService.js:8-20 which honors 0 and passes NaN). Mutually-distinguishable
    // tiers (#1348): metaCtx(18) > card(15) > 8+prof(12) > coerced-prof(10). 0 AND NaN are
    // coerced DOWN at every tier; missing/nullish proficiency SILENTLY floors at 8+2=10 with
    // NO throw and NO log (this copy has no guard — honest zero-guard pin); prof NaN coerces
    // via `NaN || 2`. metaCtx tier is the LIVE path (caller passes a number, see header); the
    // lower tiers are defensive-only.
    it('coerces saveDc through ||-tiers: 0/NaN drop down, missing proficiency silently floors at 10', async () => {
        const tiers = [
            [{ spellSaveDc: 18 }, card, 18], // LIVE tier (triggerSpells spreads the resolved number)
            [{ spellSaveDc: undefined }, card, 15], // falsy drops a tier
            [{ spellSaveDc: null }, card, 15],
            [{ spellSaveDc: 0 }, card, 15], // 0 COERCED (twin HONORS 0 — this is the discriminator)
            [{ spellSaveDc: NaN }, card, 15], // NaN coerced (twin passes NaN through)
            [{}, card, 15],
            [{}, { spellAbilities: { saveDc: 0 }, proficiency: 4 }, 12], // card 0 coerced to floor
            [{}, { spellAbilities: { saveDc: NaN }, proficiency: 4 }, 12],
            [{}, { spellAbilities: undefined, proficiency: 4 }, 12], // absent card (or null via ?. — never throws) floors at 12
            [{}, { proficiency: 4 }, 12],
            [{}, { proficiency: 0 }, 10], // prof||2 → 8+2 (twin floors prof 0 at 8)
            [{}, { proficiency: NaN }, 10], // NaN||2 → 8+2
            [{}, {}, 10], // missing proficiency: silent default, NO throw, NO log
        ];
        for (const [metaCtx, stats, expectedDc] of tiers) {
            executeHandler.mockClear();
            await triggerSuggestion(SPELL, metaCtx, stats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].automation).toEqual({ type: 'suggestion', saveDc: expectedDc, saveType: 'WIS' });
        }
        expect(consoleSpy).toHaveBeenCalledTimes(0); // zero-guard copy: no tier fires a log
    });

    // T4 slot compose (:8 `metaCtx?.slotLevel || spell.level || 2`) — :0-swallow BOTH sides
    // (#1345): metaCtx slotLevel 0 AND spell.level 0 are coerced DOWN; when both fall the
    // literal `|| 2` emits the disk lv2 default (NOT the twin's undefined-emission — distinct
    // byte-form). metaCtx undefined/null tolerated via `?.`.
    it('composes spellSlotLevel metaCtx > spell.level > literal 2; :0-swallow on both sides', async () => {
        const rows = [
            [{ slotLevel: 5 }, SPELL, 5], // metaCtx priority
            [{ slotLevel: 0 }, SPELL, 2], // :0 swallowed into spell.level
            [{ slotLevel: 0 }, { name: 'Suggestion' }, 2], // :0 with spell.level absent → default 2, never undefined
            [{}, { name: 'Suggestion', level: 0 }, 2], // spell.level 0 swallowed into the default
            [{}, SPELL, 2], // spell.level fallback
            [{}, { name: 'Suggestion', level: 7 }, 7],
            [undefined, SPELL, 2], // metaCtx undefined
            [null, SPELL, 2], // metaCtx null
        ];
        for (const [metaCtx, spell, expected] of rows) {
            executeHandler.mockClear();
            await triggerSuggestion(spell, metaCtx, card, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(expected);
        }
        expect(consoleSpy).toHaveBeenCalledTimes(0);
    });

    // T5 forwarder purity: executeHandler result returned BY REFERENCE (object and null);
    // resolve(null) is NOT the catch path.
    it('returns the executeHandler result by reference', async () => {
        const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Suggestion' } };
        executeHandler.mockResolvedValue(sentinel);
        expect(await triggerSuggestion(SPELL, {}, card, campaignName, mapName)).toBe(sentinel);

        executeHandler.mockResolvedValue(null);
        expect(await triggerSuggestion(SPELL, {}, card, campaignName, mapName)).toBeNull();
        expect(consoleSpy).toHaveBeenCalledTimes(0);
    });

    // T6 catch lane (:21-27, the ONLY try): rejection swallowed to null, logged EXACTLY once
    // with the full interpolated prefix (name bytes preserved, colon terminator) and the IDENTICAL
    // Error instance (#1385).
    it('returns null and logs the exact prefix with the identical error when executeHandler rejects', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);

        const result = await triggerSuggestion(SPELL, {}, card, campaignName, mapName);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0]).toEqual(['[suggestionService] Failed to execute Suggestion handler:', err]);
        expect(consoleSpy.mock.calls[0][1]).toBe(err);

        // name interpolation preserves RAW bytes (gate lowercases, log does not)
        consoleSpy.mockClear();
        executeHandler.mockRejectedValue(err);
        await triggerSuggestion({ name: 'SUGGESTION', level: 2 }, {}, card, campaignName, mapName);
        expect(consoleSpy.mock.calls[0][0]).toBe('[suggestionService] Failed to execute SUGGESTION handler:');
    });

    // T7 unguarded-deref-outside-try (#1360 class): spell.name :4 and the playerStats.derefs
    // :7 sit OUTSIDE the try (:21-27 wraps ONLY executeHandler) — null spell/playerStats reject
    // with a native TypeError, console untouched (proves NOT the gate, NOT the catch-swallow),
    // zero dispatch.
    it('rejects with native TypeError (console untouched) when spell or playerStats is null', async () => {
        await expect(triggerSuggestion(null, {}, card, campaignName, mapName)).rejects.toBeInstanceOf(TypeError);
        await expect(triggerSuggestion(SPELL, {}, null, campaignName, mapName)).rejects.toBeInstanceOf(TypeError);
        expect(consoleSpy).toHaveBeenCalledTimes(0);
        expect(executeHandler).toHaveBeenCalledTimes(0);
    });
});
