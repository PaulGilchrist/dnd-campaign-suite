// @maintained-by-ai
// tashasHideousLaughterService lane — lv2 enchantment MODAL-FRONT (Tasha's Hideous Laughter).
// IDENTITY (#1360/88 method): source is 18 lines, exports exactly ONE symbol
// triggerTashasHideousLaughter (source :1); live-caller evidence: triggerSpells.js:388 is the ONLY
// production caller (spread `{ ...metaCtx, spellSaveDc }` where spellSaveDc comes from computeSpellStats
// execution/index.js:193-221 — ALWAYS a resolved number on the live seam, so the metaCtx.spellSaveDc
// tier is LIVE and card/floor tiers below are DEFENSIVE-only, #1386 caller-boundary method).
// No dead exports (#1370). This copy performs NO name gate — gating is fully owned by the caller at
// triggerSpells.js:387 (`spell.name && spell.name.toLowerCase() === "tasha's hideous laughter"`);
// the service name-echoes bytes verbatim (T2), never lowercasing, never stripping the apostrophe.
//
// REPEAT-SAVE DETERMINATION: BESPOKE, NOT the generic #1405 repeatSaveService engine. The service
// stamps NO te and NO te.repeatSave descriptor — its envelope is consumed by useSpellCastExecutor.js:137
// ('tashasLaughter' → 'tashasLaughterModal') and rendered by TashasLaughterModal.jsx (saveType/saveDc/
// spellSlotLevel:91 maxTargets/metamagicHeighten:82 are the LIVE consumers of every payload key pinned
// here). Downstream automation lanes: automationRouter.js:192 → automation/index.js:590
// tashas_laughter → tashasLaughterHandler.js which stamps te effect 'tashas_hideous_laughter'
// (registered: targetEffectDefinitions.js:555 — #1373 clean) + prone/incapacitated activeConditionMeta
// with {dc, ability:'wis'} repeatability metadata, NOT the generic {saveType, dc, condition}
// repeatSave shape. 'ENDS on ends-its-turn-or-takes-damage' is modeled by the bespoke damage-trigger
// lane: tashas_laughter_<target>_damageTrigger runtime key, cleared by clearExpirationEffects.js:454
// via 'tashas_laughter_expiration'. All of that is covered by OWNED SIBLING SUITES
// (tashasLaughterHandler.test.js, TashasLaughterModal.player/npc-saves.test.jsx,
// clearExpirationEffects.test.js:428-440) — this file owns ONLY the envelope bytes it stamps.
//
// DISK/NAME FIDELITY (#1362, both rulesets read programmatically): 2024 spells.json name
// "Tasha's Hideous Laughter" (straight apostrophe U+0027) with mangled index 'tashas-hIDEOUS-LAUGHTER';
// 5e spells.json name 'Hideous Laughter' lv1 — its bytes FAIL the caller gate at triggerSpells.js:387
// even though SERVICE_HANDLED_SPELLS :53 lists 'hideous laughter' (source-side report, this lane pins
// the echo only, T2). dc_type WIS on disk in BOTH — saveType:'WIS' byte pin is disk-faithful (T1).
//
// COERCION CENSUS (#1374 six-way): '||'-COERCION member, identical family to suggestion #1422:
// :2 `metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2)`
// and :3 `metaCtx?.slotLevel || spell.level || 1`. 0/NaN coerced down at every tier (0 spellSaveDc,
// 0 slotLevel, 0 proficiency all fall through — pinned T3/T4); missing proficiency silently floors at
// 8+2=10 instead of throwing. metamagicHeighten (:15) is the ONE non-coerced field: `metaCtx?.x`
// passes false through as false (T5) — the sole field where 0/false survives.
// UNGUARDED-DEREF QUIRK (#1360 class): playerStats is NOT optional-chained (:2) and spell is not
// (:3 spell.level, :9 spell.name). Golden behavior pinned T6: undefined playerStats THROWS unless
// metaCtx.spellSaveDc short-circuits the :2 deref (truthy tier skips playerStats entirely).
//
// STANDARDS: zero-store/zero-dice/zero-log/zero-clock copy — grep evidence: the service file has NO
// import statements at all (`grep -c 'import ' tashasHideousLaughterService.js` = 0; no
// getRuntimeValue/addEntry/Math.random/Date.now/setTimeout/setInterval/localStorage), so stateful-store
// fakes, dice stubs, log-byte pins and NO-CLOCK policy scans are N/A here (policy PASS by absence —
// minutes×N countdown for the disk 'Concentration, up to 1 minute' lives downstream, combat-scoped).
// No mocks in this file → vi.resetAllMocks N/A. Full-set toEqual + exact key-set arrays + playerStats
// toBe identity (T1); no objectContaining/expect.any/toHaveBeenCalled anywhere below. Input purity
// (#1395) folded into T1. Argument-keyed arity: service takes (spell, metaCtx, playerStats,
// campaignName, _mapName) — _mapName is inert passthrough (never read in source), pinned by value
// variation in T1.

import { describe, it, expect } from 'vitest';
import { cloneDeep } from 'lodash';
import { triggerTashasHideousLaughter } from './tashasHideousLaughterService.js';

describe('tashasHideousLaughterService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('full-set envelope bytes', () => {
        it('stamps the exact envelope key-sets and byte values, leaving every input pristine (#1395)', async () => {
            const spell = { name: "Tasha's Hideous Laughter", level: 2, school: 'Enchantment' };
            const metaCtx = { spellSaveDc: 17 };
            const inputs = { spell, metaCtx, playerStats };
            const pristine = cloneDeep(inputs);

            const result = await triggerTashasHideousLaughter(spell, metaCtx, playerStats, campaignName, mapName);

            // toEqual ignores undefined-valued keys, so the exact key-set arrays below pin
            // metamagicHeighten's presence-with-undefined and the inert mapName passthrough.
            expect(result).toEqual({
                type: 'modal',
                modalName: 'tashasLaughter',
                payload: {
                    action: { name: "Tasha's Hideous Laughter", automation: { type: 'tashas_laughter' } },
                    playerStats,
                    campaignName,
                    saveType: 'WIS',
                    saveDc: 17,
                    spellSlotLevel: 2,
                    metamagicHeighten: undefined,
                },
            });
            expect(Object.keys(result)).toEqual(['type', 'modalName', 'payload']);
            expect(Object.keys(result.payload)).toEqual([
                'action', 'playerStats', 'campaignName', 'saveType', 'saveDc', 'spellSlotLevel', 'metamagicHeighten',
            ]);
            expect(Object.keys(result.payload.action)).toEqual(['name', 'automation']);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(spell).toEqual(pristine.spell);
            expect(metaCtx).toEqual(pristine.metaCtx);
            expect(playerStats).toEqual(pristine.playerStats);
        });
    });

    describe('name echo (no gate here — gate owner is triggerSpells.js:387)', () => {
        it.each([
            ["Tasha's Hideous Laughter", 'real 2024 disk name, straight apostrophe'],
            ['Hideous Laughter', 'real 5e disk name — would FAIL the caller gate; this copy still echoes'],
            ['tasha’s hideous laughter', 'curly-apostrophe variant — punctuation class survives untouched'],
        ])('echoes "%s" into action.name byte-identical with the automation stamp constant (%s)', async (inputName) => {
            const result = await triggerTashasHideousLaughter({ name: inputName, level: 1 }, {}, playerStats, campaignName, mapName);

            expect(result.payload.action.name).toBe(inputName);
            expect(result.payload.action.automation).toEqual({ type: 'tashas_laughter' });
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('tashasLaughter');
        });
    });

    describe('saveDc || tier chain (source :2, #1374 coercion member)', () => {
        it.each([
            // [metaCtx, stats, expected, why]
            [{ spellSaveDc: 18 }, playerStats, 18, 'LIVE tier: caller-computed spellSaveDc beats card DC'],
            [{}, playerStats, 15, 'defensive: card spellAbilities.saveDc'],
            [{ spellSaveDc: 0 }, playerStats, 15, 'quirk: metaCtx.spellSaveDc 0 is falsy-coerced down'],
            [{}, { ...playerStats, spellAbilities: { saveDc: null } }, 12, 'card saveDc null falls to 8 + proficiency(4)'],
            [{}, { name: 'Wizard', proficiency: 3 }, 11, 'no spellAbilities: 8 + proficiency'],
            [{}, { name: 'Wizard' }, 10, 'missing proficiency silently floors at 8 + 2 (no throw)'],
            [{}, { name: 'Wizard', proficiency: 0 }, 10, 'quirk: proficiency 0 coerced to 2 by ||'],
            [undefined, playerStats, 15, 'undefined metaCtx via ?. falls to card tier'],
        ])('saveDc tier: metaCtx=%j stats=%j → %i (%s)', async (metaCtx, stats, expected) => {
            const result = await triggerTashasHideousLaughter(
                { name: "tasha's hideous laughter", level: 1 }, metaCtx, stats, campaignName, mapName,
            );
            expect(result.payload.saveDc).toBe(expected);
        });
    });

    describe('spellSlotLevel || tier chain (source :3; live consumer TashasLaughterModal.jsx:91 maxTargets)', () => {
        it.each([
            [{ slotLevel: 5 }, 3, 5, 'metaCtx.slotLevel beats spell.level'],
            [{}, 3, 3, 'falls back to spell.level'],
            [{ slotLevel: 0 }, 3, 3, 'quirk: slotLevel 0 falsy-coerced to spell.level'],
            [{}, 0, 1, 'quirk: spell.level 0 coerced to literal 1 (equals disk lv1 bytes)'],
            [undefined, 2, 2, 'undefined metaCtx via ?. falls to spell.level'],
        ])('metaCtx=%j spell.level=%s → spellSlotLevel=%i (%s)', async (metaCtx, level, expected) => {
            const result = await triggerTashasHideousLaughter(
                { name: "tasha's hideous laughter", level }, metaCtx, playerStats, campaignName, mapName,
            );
            expect(result.payload.spellSlotLevel).toBe(expected);
        });
    });

    describe('metamagicHeighten passthrough (source :15 — the only non-coerced field)', () => {
        it.each([true, false])(
            'passes metamagicHeighten=%s through untouched (false survives, not coerced)',
            async (heighten) => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    { metamagicHeighten: heighten },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.metamagicHeighten).toBe(heighten);
                expect(Object.keys(result.payload)).toContain('metamagicHeighten');
            },
        );
    });

    describe('unguarded derefs (#1360 class, source :2/:3/:9)', () => {
        it('undefined playerStats throws TypeError when the || chain reaches its deref at :2', async () => {
            await expect(triggerTashasHideousLaughter(
                { name: "tasha's hideous laughter", level: 1 }, {}, undefined, campaignName, mapName,
            )).rejects.toThrow(TypeError);
        });

        it('undefined spell throws TypeError at spell.name/:3 (no spell?. guard exists)', async () => {
            await expect(triggerTashasHideousLaughter(
                undefined, { spellSaveDc: 18 }, playerStats, campaignName, mapName,
            )).rejects.toThrow(TypeError);
        });

        it('truthy metaCtx.spellSaveDc short-circuits the chain so undefined playerStats never derefs', async () => {
            const result = await triggerTashasHideousLaughter(
                { name: "tasha's hideous laughter", level: 1 }, { spellSaveDc: 18 }, undefined, campaignName, mapName,
            );

            expect(result.payload.saveDc).toBe(18);
            expect(result.payload.playerStats).toBeUndefined();
        });
    });
});
