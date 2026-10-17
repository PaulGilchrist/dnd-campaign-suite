// @maintained-by-ai
// ── Registry QUINTET lane #1999 index.webDispatch.test.js — web_area_save row/dispatch family ──
// (seam map: index.mistyWanderer.test.js header #1995, closed KEEP law; siblings
// #1996 psychic route / #1997 index.test.js MAIN mechanics / #1998 implosion
// fingerprint. Registry-thin lane: dispatch + registration identity ONLY — ALL
// handler internals live in the closed webAreaSaveHandler quintet, 48 tests:
// .areaSave #1989 (19) / .edgeCases #1990 (7) / .errors #1991 (5) /
// .test main #1992 (11) / .zone #1993 (6).)
//
// SP-126 regression: the Web live confirmer (useSimpleSpellHandlers) stamped
// type 'web', which has NO HANDLER_MAP entry — executeHandler returned null and
// the whole effect body (DEX saves, Restrained, logs) never ran although the
// slot + concentration were already paid. 'web_area_save' must dispatch to
// handleWebAreaSave (index.js L557).
//
// THIS lane owns EXCLUSIVELY (seam verified against index.js 2026-10-16):
//   • registration row L557 'web_area_save': handleWebAreaSave — HANDLER_MAP is
//     module-internal (L299), so registration identity pins through dispatch:
//     the vi.mock'd module handle IS the function executeHandler invokes
//     (import at index.js:271). Importers of webAreaSaveHandler.js are ONLY
//     index.js:271 (handle) and expireStaleEffects.js:7 (processWebAreaSave) —
//     expireStaleEffects is NOT in this test's import graph (grep index.js:
//     zero hits), so the mock factory carries `handle` alone.
//   • LIVE caller-shape fidelity: useSimpleSpellHandlers.js:345
//     { name: 'web', key: 'Web', run: areaExecute('web_area_save', 'DEX') }
//     → areaExecute L78-80 calls executeHandler 4-ARG (action, playerStats,
//     campaignName, null) → registry forwards 5-arg at L743 → handler receives
//     characters===undefined (arity benign; handler consumes 4 params).
//     areaAction L69-76 stamps automation as EXACTLY { type, saveDc, saveType }
//     — the verbatim data row's shape/size/duration/conditionInflicted fields
//     do NOT cross this seam (handler re-derives them from the `_web_<caster>`
//     tracking store, .zone quintet #1993).
//   • verbatim prod row verified on disk BOTH rulesets 2026-10-16:
//     public/data/spells.json (Web, :10517) and public/data/2024/spells.json
//     (Web, :14532) automation[1] — byte-identical six-key object, pinned
//     below and dispatched intact (full-string pass-through pins).
//     Registration-symmetry HONESTY: key MATCHED — live producers are the
//     areaExecute stamp (:345) + both spells.json rows; no orphan key here.
//   • family discrimination vs the trio rows L556-558 (grease_area_save /
//     web_area_save / sleet_storm_area_save, cf. #1998 fingerprint-control
//     pattern): exact-key table lookup — sleet/grease rows resolve to their
//     OWN handlers and never enter the web lane. Grease registration content
//     lives at greaseAreaSaveHandler.handle.test.js (#1922)/.areaSave (#1921),
//     cited by #1997 — discriminated here, not re-pinned.
//   • SP-126 fingerprint control: bare type 'web' (the broken pre-fix stamp)
//     has no table row → null (L699 miss → L738-740, mechanics canonical
//     #1997), web handler untouched, zero family fallback.
// CONSUMER-PIN AUDIT (quintet citation check, honest resolution): the handler
// quintet's "consumer routing pinned … :76 (exact 4-arg call + negative legs)"
// citation resolves to expireStaleEffects.web.test.js:76 (processZoneTurnStart
// Saves→processWebAreaSave 4-arg), VERIFIED PRESENT there — it does not live
// in this file; nothing added here (no duplication).
// Shed: generic null early-outs L703-705/L738-740, error-catch popup L745-748,
// auto-array scan L716-734, 5-arg-forward mechanics L743 → #1997 index.test.js
// MAIN exact-names canon; auto_effect route → #1996; save_attack fingerprint →
// #1998; misty prefer → #1995. All handler behavior (saves, Restrained, zone
// te, logs, tracking store) → the webAreaSaveHandler quintet above.
// All three area handlers mocked → zero side effects; fetch spy guards.
// No timers; turn-based row-click dispatch only; test-campaign only.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { executeHandler } from './index.js';
import spells5e from '../../../public/data/spells.json';
import spells2024 from '../../../public/data/2024/spells.json';

vi.mock('./handlers/spells/webAreaSaveHandler.js', () => ({
    handle: vi.fn(async () => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Web',
            description: 'WEB handler dispatch sentinel',
        },
    })),
}));

vi.mock('./handlers/spells/sleetStormHandler.js', () => ({
    handle: vi.fn(async () => ({ type: 'popup', payload: { type: 'automation_info', name: 'SLEET' } })),
}));

vi.mock('./handlers/spells/greaseAreaSaveHandler.js', () => ({
    handle: vi.fn(async () => ({ type: 'popup', payload: { type: 'automation_info', name: 'GREASE' } })),
}));

const { handle: handleWebAreaSave } = await import('./handlers/spells/webAreaSaveHandler.js');
const { handle: handleSleetStorm } = await import('./handlers/spells/sleetStormHandler.js');
const { handle: handleGreaseAreaSave } = await import('./handlers/spells/greaseAreaSaveHandler.js');

const playerStats = { name: 'DivinationWizard', level: 20, proficiency: 6, spellAbilities: { saveDc: 19 } };

// verbatim public/data/spells.json + public/data/2024/spells.json Web automation[1]
const WEB_ROW_VERBATIM = {
    type: 'web_area_save',
    saveType: 'DEX',
    shape: 'cube',
    size: '20-foot',
    conditionInflicted: 'Restrained',
    duration: 'Concentration, up to 1 hour',
};

describe('executeHandler — web_area_save dispatch family (index.js L557, SP-126)', () => {
    let fetchSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        // registry-thin lane: table lookup + mocked-invocation only, zero I/O
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('routes the areaExecute-stamped web_area_save action to handleWebAreaSave (live caller shape, 4-arg call → 5-arg forward)', async () => {
        // exact shape of useSimpleSpellHandlers.js areaAction L69-76 output
        const action = {
            name: 'Web',
            spell: { name: 'Web', level: 6 },
            automation: { type: 'web_area_save', saveDc: 19, saveType: 'DEX' },
            metaCtx: { targets: ['Zombie 1'] },
        };
        // areaExecute L79-80 calls executeHandler 4-ARG → characters forwards undefined
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(handleWebAreaSave).toHaveBeenCalledTimes(1);
        expect(handleWebAreaSave).toHaveBeenCalledWith(action, playerStats, 'test-campaign', null, undefined);
        // caller stamp is EXACTLY three keys — data-row fields never cross this seam
        expect(handleWebAreaSave.mock.calls[0][0].automation).toEqual({
            type: 'web_area_save',
            saveDc: 19,
            saveType: 'DEX',
        });
        expect(result).not.toBeNull();
        expect(result.payload.description).toBe('WEB handler dispatch sentinel');
    });

    it('dispatches the verbatim spells.json web_area_save row intact — both rulesets identical, full strings pass through', async () => {
        const web5e = spells5e.find(s => s.name === 'Web');
        const web2024 = spells2024.find(s => s.name === 'Web');
        expect(web5e.automation[1]).toEqual(WEB_ROW_VERBATIM);
        expect(web2024.automation[1]).toEqual(WEB_ROW_VERBATIM);
        expect(web2024.automation).toEqual(web5e.automation);

        const action = { name: 'Web', automation: web2024.automation[1], metaCtx: { targets: ['Zombie 1'] } };
        const dispatched = await executeHandler(action, playerStats, 'test-campaign', null);
        expect(handleWebAreaSave).toHaveBeenCalledTimes(1);
        const [row, stats, campaign, mapName, characters] = handleWebAreaSave.mock.calls[0];
        expect(row).toBe(action); // L744 pass-through: the verbatim row reaches the handler unchanged
        expect(row.automation).toEqual(WEB_ROW_VERBATIM);
        expect(row.automation.duration).toBe('Concentration, up to 1 hour');
        expect(row.automation.conditionInflicted).toBe('Restrained');
        expect([stats, campaign, mapName, characters]).toEqual([playerStats, 'test-campaign', null, undefined]);
        expect(dispatched.payload.name).toBe('Web');
    });

    it('discriminates the area_save trio L556-558 by exact key — sleet/grease never enter the web lane', async () => {
        await executeHandler(
            { name: 'Sleet Storm', automation: { type: 'sleet_storm_area_save', saveDc: 15, saveType: 'DEX' } },
            playerStats, 'test-campaign', null,
        );
        expect(handleSleetStorm).toHaveBeenCalledTimes(1);
        expect(handleWebAreaSave).not.toHaveBeenCalled();

        vi.clearAllMocks();
        await executeHandler(
            { name: 'Grease', automation: { type: 'grease_area_save', saveDc: 15, saveType: 'DEX' } },
            playerStats, 'test-campaign', null,
        );
        expect(handleGreaseAreaSave).toHaveBeenCalledTimes(1);
        expect(handleWebAreaSave).not.toHaveBeenCalled();
    });

    it('control: bare type web (the broken pre-fix stamp) has no HANDLER_MAP row — null, no handler, no family fallback', async () => {
        const action = {
            name: 'Web',
            automation: { type: 'web', saveType: 'DEX', saveDc: 19 },
            metaCtx: { targets: ['Zombie 1'] },
        };
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(result).toBeNull();
        expect(handleWebAreaSave).not.toHaveBeenCalled();
        expect(handleSleetStorm).not.toHaveBeenCalled();
        expect(handleGreaseAreaSave).not.toHaveBeenCalled();
    });

    it('caller liveness: useSimpleSpellHandlers still stamps web_area_save/DEX through areaExecute → executeHandler', () => {
        const src = readFileSync(
            resolve(process.cwd(), 'src/hooks/combat/useSpellMetamagicFlow/useSimpleSpellHandlers.js'),
            'utf8',
        );
        expect(src).toContain("{ name: 'web', key: 'Web', run: areaExecute('web_area_save', 'DEX') }");
        expect(src).toContain('automation: { type, saveDc: computeSaveDc(d, pending), saveType },');
        expect(src).toContain('await executeHandler(areaAction(d, pending, type, saveType, { targets: result }), d.playerStats, d.campaignName, null)');
    });
});
