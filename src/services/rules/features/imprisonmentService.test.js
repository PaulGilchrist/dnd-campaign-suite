// @maintained-by-ai
/**
 * imprisonmentService lane — ENVELOPE-BUILDING FORWARDER and NUMERIC-DC PRODUCER
 * (imprisonmentService.js L5-32). Sole export triggerImprisonment; sole production
 * caller spellCastService/execution/triggerSpells.js:395-399 handleImprisonment,
 * which re-gates the same lowercase exact name upstream and spreads
 * { ...metaCtx, spellSaveDc } — spellSaveDc may be undefined there, so the '||'
 * DC-chain tiers below are live paths, not theoretical. Every other test mention of
 * this module vi.mock's it (aoeSpells.test.js:117, aoeHealingSpecial.test.js:117,
 * spellCastService.noformula-{services:88,modals:92,utility:88}.test.js) — this is
 * the sole lane exercising its internals.
 * Downstream owned elsewhere (cite-skip): automationRouter.js:192 routes type
 * 'imprisonment' save-style, automationInfoBuilder/save.js:282-294 consumes the
 * envelope and stamps duration 'Until dispelled' itself, imprisonmentHandler.js:87-108
 * writes/removes the te, targetEffectDefinitions.js:1114 registers the 'imprisonment'
 * te, and 'restrained' condition writes belong to condition lanes (cited verbatim:
 * beholderEyeRayService.js:107, cockatricePetrifyService.js:119). triggerImprisonment
 * performs ZERO store writes and stamps ZERO expiry/round/Date.now bytes — no-clock
 * policy clean in this lane; lv9 'Until dispelled' stays a flag/te, never a countdown.
 * Ruleset parity (disks read 2026-10-21, both): level 9, abjuration, concentration
 * FALSE, duration 'Until dispelled', save WIS both rulesets (dc.dc_type) — the
 * forcecage #1365 concentration-override does NOT recur here; service never stamps
 * concentration at all. saveType 'WIS' matches disk (steering 'STR' guess rejected).
 * automation.type 'imprisonment' is stamped by NO other producer (grep: only this
 * service + the save.js consumer builder keyed by it) — name gate is the sole
 * discriminator (#1378 class clean). Divergence pinned honestly: 2024 disk automation
 * carries saveDc 'ability'; THIS lane resolves the numeric DC itself (producer verdict
 * for the number) and omits duration/concentration bytes; save.js:288 tolerates both.
 * QUIRKS pinned: '||' :0-chains swallow spellSaveDc 0 and slotLevel 0 / spell.level
 * 0 (0th-level Imprisonment RAW-impossible); spell.name deref L6 and playerStats deref
 * L9 are OUTSIDE the try — null spell OR null playerStats (when the DC chain reaches
 * L9) rejects TypeError, unlogged; a truthy metaCtx.spellSaveDc short-circuits L9 and
 * rescues null playerStats. Never-executed guards: none found (zero-clean).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerImprisonment } from './imprisonmentService.js';
import { executeHandler } from '../../automation/index.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 17, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 11 },
    proficiency: 6,
};

// Exact 5-key envelope — automation options/saveType byte-locked to disk below.
const envelope = (name, saveDc, spellSlotLevel, spell, metaCtx) => ({
    name,
    automation: {
        type: 'imprisonment',
        saveDc,
        saveType: 'WIS',
        options: ['Burial', 'Chaining', 'Hedged Prison', 'Minimus Containment', 'Slumber'],
    },
    spell,
    spellSlotLevel,
    metaCtx,
});

const findSpell = (data, name) => (data.spells || data).find(s => s.name === name);

describe('imprisonmentService', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks();
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('disk canon (both rulesets) — why the literals', () => {
        it.each([
            ['5e', spells5e, undefined],
            ['2024', spells2024, { type: 'imprisonment', saveDc: 'ability', saveType: 'WIS', options: ['Burial', 'Chaining', 'Hedged Prison', 'Minimus Containment', 'Slumber'], duration: 'Until dispelled' }],
        ])('%s: lv9 abjuration, WIS, no concentration — and automation block vs hardcoded bytes', (_label, data, diskAuto) => {
            const imp = findSpell(data, 'Imprisonment');
            expect(imp.level).toBe(9);
            expect(imp.school).toBe('Abjuration');
            expect(imp.concentration).toBe(false);
            expect(imp.duration).toBe('Until dispelled');
            expect(imp.dc.dc_type).toBe('WIS');
            // service omits the disk's duration byte entirely (downstream save.js:289 stamps it)
            expect(envelope('Imprisonment', 17, 9, {}, {}).automation.duration).toBeUndefined();
            if (diskAuto) {
                expect(imp.automation).toEqual(diskAuto);
                // lane-produces a numeric DC where disk says 'ability' (divergence pinned)
                expect(envelope('Imprisonment', 17, 9, {}, {}).automation.saveDc).toBe(17);
            } else {
                expect(imp.automation).toBeUndefined();
            }
            // near-miss REAL disk names backing the negative-gate rows below
            expect(findSpell(data, 'Forcecage').level).toBe(7);
            expect(findSpell(data, 'Sequester').level).toBe(7);
        });
    });

    describe('name gate closed — null, handler untouched, nothing logged', () => {
        it.each([
            { desc: 'real DISK near-miss Forcecage', spell: { name: 'Forcecage', level: 7 } },
            { desc: 'real DISK near-miss Sequester', spell: { name: 'Sequester', level: 7 } },
            { desc: 'prefix near-miss imprison', spell: { name: 'imprison', level: 9 } },
            { desc: 'suffix near-miss imprisonments', spell: { name: 'imprisonments', level: 9 } },
            { desc: 'trailing space not trimmed (exact match)', spell: { name: 'Imprisonment ', level: 9 } },
            { desc: 'empty name', spell: { name: '', level: 9 } },
            { desc: 'null name', spell: { name: null, level: 9 } },
            { desc: 'missing name', spell: {} },
        ])('$desc', async ({ spell }) => {
            const result = await triggerImprisonment(spell, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('envelope chain — exact bytes, identities, tiers mutually distinguishable', () => {
        it.each([
            { desc: 'metaCtx.spellSaveDc 20 beats stats 17; disk-case name passthrough', spell: { name: 'Imprisonment', level: 9 }, metaCtx: { spellSaveDc: 20, slotLevel: 8 }, stats: playerStats, dc: 20, slot: 8 },
            { desc: 'lowercase gate fold, name byte stays lowercase; stats tier 17; spell.level fallback slot', spell: { name: 'imprisonment', level: 9 }, metaCtx: {}, stats: playerStats, dc: 17, slot: 9 },
            { desc: 'proficiency formula tier 8+5=13 when no spellAbilities', spell: { name: 'Imprisonment', level: 9 }, metaCtx: {}, stats: { name: 'Wizard', proficiency: 5 }, dc: 13, slot: 9 },
            { desc: 'missing proficiency defaults 8+2=10; spell.level missing defaults hard 9', spell: { name: 'Imprisonment' }, metaCtx: {}, stats: { name: 'Wizard' }, dc: 10, slot: 9 },
            { desc: ':0-chain: spellSaveDc 0 and slotLevel 0 / spell.level 0 swallowed by || (RAW-impossible), fall through to 17 / hard 9', spell: { name: 'Imprisonment', level: 0 }, metaCtx: { spellSaveDc: 0, slotLevel: 0 }, stats: playerStats, dc: 17, slot: 9 },
            { desc: 'null metaCtx via optional chain, metaCtx byte stays null', spell: { name: 'Imprisonment', level: 9 }, metaCtx: null, stats: playerStats, dc: 17, slot: 9 },
            { desc: 'null playerStats rescued by truthy spellSaveDc short-circuit (L9 never dereferenced)', spell: { name: 'Imprisonment', level: 9 }, metaCtx: { spellSaveDc: 20 }, stats: null, dc: 20, slot: 9 },
        ])('envelope chain: $desc', async ({ spell, metaCtx, stats, dc, slot }) => {
            const sentinel = { type: 'popup', payload: { type: 'automation_info' } };
            executeHandler.mockResolvedValue(sentinel);

            const result = await triggerImprisonment(spell, metaCtx, stats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, argStats, argCampaign, argMap] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(spell.name, dc, slot, spell, metaCtx));
            expect(action.spell).toBe(spell);
            expect(action.metaCtx).toBe(metaCtx);
            expect(argStats).toBe(stats);
            expect(argCampaign).toBe(campaignName);
            expect(argMap).toBe(mapName);
            expect(result).toBe(sentinel);
        });

        it('executeHandler resolving null passes through null without logging', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerImprisonment({ name: 'Imprisonment', level: 9 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('executeHandler rejection: identical Error + exact prefix logged, null returned', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);

            const result = await triggerImprisonment({ name: 'Imprisonment', level: 9 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[imprisonmentService] Failed to execute Imprisonment handler:', err);
            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('unguarded derefs outside the try — golden TypeErrors', () => {
        it('null spell rejects at L6 gate deref; catch guards executeHandler only', async () => {
            await expect(
                triggerImprisonment(null, {}, playerStats, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('null playerStats rejects at L9 when the DC chain reaches it; unlogged', async () => {
            await expect(
                triggerImprisonment({ name: 'Imprisonment', level: 9 }, {}, null, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });
});
