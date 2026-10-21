// @maintained-by-ai
/**
 * removeCurseService lane — FORWARDER-CONTRACT ONLY (thin wrapper, 33 lines).
 *
 * Both exports LIVE (caller evidence, grep src):
 *  - triggerRemoveCurse: triggerSpells.js:447 handleRemoveCurse — awaited,
 *    args (spell, metaCtx, playerStats, campaignName, mapName) verbatim.
 *  - confirmRemoveCurse: useSimpleSpellHandlers.js:313 applySpell — the LIVE
 *    UX lane: applySpell forwards (caller-built action, playerStats,
 *    campaignName, NULL mapName, result) and showPopupIfPayload consumes the
 *    returned envelope's payload (useSimpleSpellHandlers.js:52-56), so the
 *    result identity pin below is production-consumed, not decorative.
 *
 * PRODUCER-vs-FORWARDER verdict: FORWARDER. This lane produces ZERO numbers,
 * ZERO store writes, ZERO log entries. te selection (cursed-buff filter,
 * 'Cursed' condition strip, attunement clear, Date.now stamps, addEntry log
 * bytes) is owned VERBATIM by automation/handlers/spells/removeCurseHandler.test.js
 * (barrel map automation/index.js:233,562: remove_curse → handle /
 * applyRemoveCurseEffect = applyRemoveCurse) — cited, NOT re-pinned here.
 * skipSync: N/A — no setRuntimeObject writes in this lane at all.
 * Zero-dice: this service never rolls; no dice stubs needed (declared).
 *
 * Blessing-vs-curse selection verdict: NONE here to own. Disk text BOTH
 * rulesets: "all curses affecting one creature or object end" + attunement
 * break — no 'blessing' clause (pinned below); handler strips only
 * cursed-type buffs / Cursed condition / attunement. Order-dependent
 * one-blessing quirk class (#1384/85): NOT APPLICABLE — no blessing strip
 * exists on disk for this spell, so no first-match selection to pin.
 * Twin-set gate (#1374): NO twin — features/ has no bestowCurseService or
 * removeBlessingService (ls); single service fronts single strict name.
 * Registry scan: targetEffectDefinitions.js has ZERO 'curse'/'blessing' te
 * keys (grep) — removal here is activeBuffs/activeConditions/attunement
 * based, owned by the handler lane above.
 *
 * Coercion census member (#1374 spectrum): `spell.range || 'Touch'` is a
 * ||string-default member — falsy triple ('', null, undefined) folds to
 * 'Touch' (NOT ||0, NOT NaN-pass, NOT ==null-throw). Default has disk
 * PARITY: range 'Touch' on both rulesets' rows; spellGates.js:247 uses the
 * identical `spell.range || 'Touch'`; handler payload echoes `auto.range ||
 * 'Touch'` (removeCurseHandler.js). Non-falsy range passes through verbatim
 * (no casefold of range — byte-pinned).
 *
 * Case gate (#1388/89 class): gate is `(spell.name || '').toLowerCase() ===
 * 'remove curse'` — lowercase-exact: any casefold fold passes, near-miss
 * disk names reject; trailing space NOT trimmed (exact-match quirk row).
 * ENVELOPE QUIRK: input folds lowercase, but envelope name is the hardcoded
 * canonical literal 'Remove Curse' (service L8) — the handler renders
 * action.name into popups (removeCurseHandler.js), so canonicalization IS
 * behavioral; byte-pinned in the happy row.
 *
 * Never-executed guard scan: FOUND ONE — triggerRemoveCurse's `metaCtx`
 * parameter is received (caller triggerSpells.js:447 spreads it in) but
 * NEVER referenced in the body; envelope attaches NO metaCtx key (exact
 * 3-key toEqual proves the drop). Harmless this lane: neither handler entry
 * reads metaCtx (handle reads action.automation/action.name/playerStats.name;
 * applyRemoveCurse reads result.targetName). Same class as #1370 dormant
 * seam / #1397 never-attached structural find. Report-only.
 *
 * :0-swallow chain (structural, cross-file — REPORT ONLY, not fixed):
 * triggerSpells.js:447-448 awaits triggerRemoveCurse then returns
 * `{ handled: true }` — the selection popup from executeHandler is DISCARDED,
 * unlike sibling lanes (e.g. triggerSpells.js:341/352
 * `{ handled: true, result: { automationPopup: result } }` and
 * handleGenericAutomation :464). Target UX actually flows via the two-stage
 * gate spellGates.js:244-251 gateRemoveCurse (makePending builds its own
 * creatureTargets + `range: spell.range || 'Touch'`) → confirm lane at
 * useSimpleSpellHandlers.js:313. The trigger's popup result survives only
 * in service-contract form (identity pin below) — source note filed.
 *
 * NO-CLOCK: service file has ZERO Date/setTimeout/setInterval bytes
 * (grep -c = 0); disk duration Instantaneous both rulesets. Zero-clean.
 * Gate deref of spell itself is OUTSIDE the try (service L4) — null spell
 * rejects TypeError, catch guards executeHandler only (golden #1360 class,
 * same row as greaterRestorationService.test.js — the cited GOLD model).
 *
 * Over-mock check: vi.mock of the automation barrel is the correct boundary
 * — the barrel re-exports 200+ handlers; this lane's contract IS the exact
 * call tuple into its two dependencies. No store/log fakes needed (lane
 * touches neither). No localStorage; pure pass-through.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerRemoveCurse, confirmRemoveCurse } from './removeCurseService.js';
import { executeHandler, applyRemoveCurseEffect } from '../../automation/index.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyRemoveCurseEffect: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = { name: 'Ranger', proficiency: 4 };

// Exact envelope the handler consumes — 3 keys, nothing more (byte-lock):
// service L7-14; name is the canonical literal regardless of input case.
const envelope = (spell, range = 'Touch') => ({
    name: 'Remove Curse',
    automation: { type: 'remove_curse', range },
    spell,
});

describe('removeCurseService', () => {
    let errorSpy;
    beforeEach(() => {
        vi.resetAllMocks();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('disk canon (both rulesets) — why the literals', () => {
        it.each([
            ['5e', spells5e],
            ['2024', spells2024],
        ])('%s spells.json: lv3 Abjuration / Touch / Instantaneous justify gate + range default', (_label, data) => {
            const list = data.spells || data;
            const rc = list.find(s => s.name === 'Remove Curse');
            expect(rc.level).toBe(3);
            expect(rc.school).toBe('Abjuration');
            expect(rc.range).toBe('Touch');           // hardcoded 'Touch' default = disk parity
            expect(rc.duration).toBe('Instantaneous'); // no clock, no concentration
            expect(rc.concentration).toBe(false);
            expect(rc.components).toEqual(['V', 'S']);
            expect(rc.material ?? null).toBeNull();    // no material consumption
            expect(rc.dc).toBeUndefined();             // no save — RAW, nothing to compose here
            // hardcoded automation.type + gate literals match disk bytes
            expect(rc.automation.type).toBe('remove_curse');
            expect(rc.name.toLowerCase()).toBe('remove curse');
            // blessing-vs-curse verdict, verbatim: disk text ends CURSES + attunement
            // only — NO 'blessing' clause, so no blessing-selection behavior exists
            // for this lane to own (handler lane strips cursed buffs only).
            const text = rc.description.join(' ');
            expect(/all curses affecting one creature or object end/i.test(text)).toBe(true);
            expect(/attunement/i.test(text)).toBe(true);
            expect(/blessing/i.test(text)).toBe(false);
            // near-miss REAL disk names backing the negative-gate rows below
            expect(list.some(s => s.name === 'Bestow Curse')).toBe(true);
            expect(list.some(s => s.name === 'Bless')).toBe(true);
            expect(list.some(s => s.name === 'Lesser Restoration')).toBe(true);
        });
    });

    describe('triggerRemoveCurse — name gate (lowercase-exact, #1388 class)', () => {
        it.each([
            ['invert twin on disk Bestow Curse', 'Bestow Curse'],
            ['blessing-family disk spell', 'Bless'],
            ['real disk near-miss Lesser Restoration', 'Lesser Restoration'],
            ['plural of the gate name', 'remove curses'],
            ['trailing space not trimmed (exact-match quirk)', 'Remove Curse '],
        ])('%s → null, handler untouched', async (_label, name) => {
            const result = await triggerRemoveCurse({ name, level: 3 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each([undefined, null, ''])('falsy name %s → null, handler untouched', async (name) => {
            const result = await triggerRemoveCurse({ name, level: 3 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('triggerRemoveCurse — envelope + passthrough', () => {
        it('happy: lowercase input folds gate, exact envelope bytes (metaCtx dropped), arg identities, result identity, input pure', async () => {
            const sentinel = { type: 'popup', payload: { type: 'automation_info', targets: [{ name: 'Goblin', hasCurse: true }] } };
            executeHandler.mockResolvedValue(sentinel);
            const spell = { name: 'remove curse', level: 3 }; // lowercase folds gate into canonical-name byte-lock
            const spellPurity = JSON.parse(JSON.stringify(spell));

            const result = await triggerRemoveCurse(spell, { targetName: 'Goblin', spellSaveDc: 15, slotLevel: 3 }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, campaign, map] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(spell)); // exactly 3 keys — no metaCtx key re-attached (dormant-param pin)
            expect(action.name).toBe('Remove Curse'); // canonical literal despite lowercase input
            expect(action.automation).toEqual({ type: 'remove_curse', range: 'Touch' });
            expect(action.spell).toBe(spell);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(result).toBe(sentinel);
            expect(spell).toEqual(spellPurity); // input purity #1395 — envelope wraps, never mutates
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it.each([
            ['spell.range passthrough (case preserved — no range fold)', 'Self', 'Self'],
            ['disk range verbatim', '60 feet', '60 feet'],
            ['falsy range ""', '', 'Touch'],
            ['null range', null, 'Touch'],
            ['undefined range', undefined, 'Touch'],
        ])('range ||Touch-chain: %s → %s', async (_label, range, expected) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerRemoveCurse({ name: 'Remove Curse', level: 3, range }, {}, playerStats, campaignName, mapName);

            expect(executeHandler.mock.calls[0][0]).toEqual(envelope(expect.anything(), expected));
            expect(executeHandler.mock.calls[0][0].range).toBeUndefined(); // range lives on automation only
        });

        it('executeHandler resolving null passes through null without logging', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerRemoveCurse({ name: 'Remove Curse', level: 3 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('executeHandler rejection: identical Error + exact prefix logged, null returned', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);

            const result = await triggerRemoveCurse({ name: 'Remove Curse', level: 3 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(errorSpy).toHaveBeenCalledWith('[removeCurse] Failed to execute Remove Curse handler:', err);
        });

        it('null spell rejects TypeError — gate/range deref is OUTSIDE the try (catch guards executeHandler only)', async () => {
            await expect(
                triggerRemoveCurse(null, {}, playerStats, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('confirmRemoveCurse — passthrough to applyRemoveCurseEffect (live UX lane)', () => {
        it('exact 5-arg identities (ungated name, null mapName per applySpell), result identity feeds showPopupIfPayload; handler null passes through unlogged', async () => {
            // caller-built shape, useSimpleSpellHandlers.js:313 (applySpell L52-56
            // passes mapName=null and name=pending.spellName); lowercase name proves
            // confirm has NO name gate — unconditional passthrough.
            const action = { name: 'remove curse', spell: { name: 'remove curse', level: 3 }, automation: { type: 'remove_curse', range: 'Touch' } };
            const result = { targetName: 'Goblin' };
            const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'remove curse', description: 'Goblin: Curse (removed 1 cursed effect(s))' } };
            applyRemoveCurseEffect.mockResolvedValue(sentinel);

            const applied = await confirmRemoveCurse(action, playerStats, campaignName, null, result);

            expect(applyRemoveCurseEffect).toHaveBeenCalledTimes(1);
            const [a, stats, campaign, map, res] = applyRemoveCurseEffect.mock.calls[0];
            expect(a).toBe(action);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(campaignName);
            expect(map).toBeNull(); // production mapName is null at this seam
            expect(res).toBe(result);
            expect(applied).toBe(sentinel); // identity survives — popup.payload consumer would break on a wrap

            applyRemoveCurseEffect.mockResolvedValue(null); // handler nulls on missing targetName (removeCurseHandler.js applyRemoveCurse L64-66)
            const nullPass = await confirmRemoveCurse(action, playerStats, campaignName, mapName, null);
            expect(nullPass).toBeNull();
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('applyRemoveCurseEffect rejection: identical Error + exact prefix logged, null returned', async () => {
            const err = new Error('Store write failed');
            applyRemoveCurseEffect.mockRejectedValue(err);

            const result = await confirmRemoveCurse(envelope({ name: 'Remove Curse', level: 3 }), playerStats, campaignName, mapName, { targetName: 'Goblin' });

            expect(result).toBeNull();
            expect(errorSpy).toHaveBeenCalledWith('[removeCurse] Failed to apply Remove Curse effect:', err);
        });
    });
});
