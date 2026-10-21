// @maintained-by-ai
/**
 * powerWordStunService lane — ZERO-STORE ENVELOPE FORWARDER (powerWordStunService.js L3-28).
 * Sole export triggerPowerWordStun, LIVE: sole production caller
 * spellCastService/execution/triggerSpells.js:118-126 handlePowerWordStun re-gates the same
 * lowercase exact name and spreads { ...metaCtx, spellSaveDc } (spellSaveDc may be falsy there,
 * so the '||' DC-chain tiers are live paths); it consumes truthiness of the result into
 * { automationPopup }. Every other test mention vi.mock's this module (aoeSpells.test.js:109,
 * aoeHealingSpecial.test.js:109, spellCastService.{healingEdgeCases:155,powerWordHeal:141,
 * featureTriggers:141,hexEffects:141}.test.js, noformula-services.test.js:82/282-290 pins the
 * triggerSpells wiring only, noformula-{modals:86,utility:82}.test.js) — this is the sole lane
 * exercising its internals.
 * DISK CANON (both rulesets read 2026-10-21): lv8 Enchantment, concentration FALSE, duration
 * 'Instantaneous', save CON both rulesets (2024 dc.dc_type 'CON'; 5e description 'constitution
 * saving throw' — steering's 'WIS' guess rejected by disk). HP threshold is 150, NOT 60
 * (steering rejected): 'If the target has 150 Hit Points or fewer' appears in BOTH descriptions
 * and NO '60 hit points' byte exists on disk. Threshold is DOWNSTREAM-owned, cited verbatim:
 * automation/handlers/spells/powerWordStunHandler.js:123 'const targetCurrentHp =
 * targetCreature?.currentHp ?? targetCreature?.hit_points?.current ?? null;' and :128
 * 'if (targetCurrentHp !== null && targetCurrentHp <= 150) {' — this service reads/writes ZERO
 * HP bytes and forwards no HP; the <=60-vs-<60 boundary census belongs to the handler lane.
 * 'stunned'/'speed_zero' condition writes and the end-of-turn CON-save expiry are owned by
 * powerWordStunHandler.js (applyPowerWordStun L10-48, addExpiration call for speed_zero L69)
 * and the condition lanes — cited, not re-owned. NO-CLOCK: this service stamps zero rounds,
 * expiry, or Date.now and touches no runtime store (no store import at all — the executeHandler
 * mock is the single honest seam, not over-mocking). Neither disk carries an 'automation'
 * block, so this service (L13) is the SOLE producer of automation.type 'power_word_stun'
 * (consumers keyed by it: automationRouter.js:190 save-style route, automation/index.js
 * dispatch, automationInfoBuilder/save.js:206-209). Type prefix is shared with disk siblings
 * 'power_word_heal'/'power_word_fortify' (2024 disk) but full strings are distinct — the
 * exact-lowercase name gate on L4 is the sole discriminator against REAL disk near-misses
 * Power Word Kill (lv9, both disks) / Power Word Heal (lv9) / Power Word Fortify (lv7).
 * QUIRKS pinned: hardcoded saveType 'CON' and default slot 8 match disk parity (no #1365
 * ruleset divergence); ':0'-chains swallow spellSaveDc 0 (falls to stats tier), slotLevel 0
 * (falls to spell.level), spell.level falsy (falls to hard 8 = disk lv8); proficiency 0 vs
 * missing both yield 8+2=10 and level 0 vs missing both yield slot 8 — output-indistinguishable
 * falsy tiers, pinned once each. ENVELOPE has exactly 4 keys (no metaCtx byte — metaCtx is
 * observable only via resolved saveDc/slot): name, automation{type,saveDc,saveType}, spell,
 * spellSlotLevel. Unguarded derefs OUTSIDE the try (catch guards executeHandler only, L21-27):
 * null spell rejects TypeError at L4 gate deref; null playerStats rejects TypeError at L7 when
 * the DC chain reaches it — but truthy metaCtx.spellSaveDc short-circuits '||' and rescues
 * null playerStats (mutually-distinguishable reject-vs-forward pair). Never-executed guards:
 * none found — zero-clean.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerPowerWordStun } from './powerWordStunService.js';
import { executeHandler } from '../../automation/index.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const baseStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
    proficiency: 4,
};

// Exact 4-key envelope — the ONLY shape this lane may hand the router.
const envelope = (name, saveDc, spellSlotLevel, spell) => ({
    name,
    automation: { type: 'power_word_stun', saveDc, saveType: 'CON' },
    spell,
    spellSlotLevel,
});

const findSpell = (data, name) => data.find(s => s.name === name);
const descOf = s => (s.description || []).join(' ');

describe('powerWordStunService', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks();
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('disk canon (both rulesets) — why the hardcoded bytes', () => {
        it.each([
            { label: '5e', data: spells5e },
            { label: '2024', data: spells2024 },
        ])('$label: lv8 enchantment, CON, no concentration, Instantaneous, 150-not-60 threshold, no automation block', ({ label, data }) => {
            const pws = findSpell(data, 'Power Word Stun');
            expect([pws.level, pws.school, pws.concentration, pws.duration]).toEqual([8, 'Enchantment', false, 'Instantaneous']);
            const desc = descOf(pws);
            // Threshold text is 150 on both disks; the steering '60 hit points' byte does not exist here.
            expect(desc).toMatch(/150 Hit Points or fewer/i);
            expect(/60\s+hit points/i.test(desc)).toBe(false);
            // CON parity: 2024 stamps dc_type, 5e spells it in prose — service hardcodes 'CON' to match.
            if (label === '2024') {
                expect(pws.dc).toEqual({ dc_type: 'CON', dc_success: 'none' });
            } else {
                expect(pws.dc).toBeUndefined();
                expect(desc).toMatch(/constitution saving throw/i);
            }
            expect(envelope('Power Word Stun', 15, 8, pws).automation.saveType).toBe('CON');
            // Neither disk carries automation — L13 is the sole producer of the type.
            expect(pws.automation).toBeUndefined();
            // Default-slot parity: the '|| 8' hard default equals disk level on both rulesets.
            expect(pws.level).toBe(8);
            // REAL near-miss names backing the gate rows below.
            expect(findSpell(data, 'Power Word Kill').level).toBe(9);
            if (label === '2024') {
                expect(findSpell(data, 'Power Word Heal').level).toBe(9);
                expect(findSpell(data, 'Power Word Fortify').level).toBe(7);
            }
        });
    });

    describe('name gate closed — null, handler untouched, nothing logged', () => {
        it.each([
            { desc: 'real DISK near-miss Power Word Kill', spell: { name: 'Power Word Kill', level: 9 } },
            { desc: 'real DISK near-miss Power Word Heal', spell: { name: 'Power Word Heal', level: 9 } },
            { desc: 'real DISK near-miss Power Word Fortify', spell: { name: 'Power Word Fortify', level: 7 } },
            { desc: 'prefix near-miss Power Word', spell: { name: 'Power Word', level: 8 } },
            { desc: 'suffix near-miss Power Word Stunned', spell: { name: 'Power Word Stunned', level: 8 } },
            { desc: 'substring word stun', spell: { name: 'word stun', level: 8 } },
            { desc: 'trailing space not trimmed (exact match)', spell: { name: 'Power Word Stun ', level: 8 } },
        ])('$desc', async ({ spell }) => {
            const result = await triggerPowerWordStun(spell, {}, baseStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('falsy name triple (empty/null/missing) all hit the L4 "|| \'\\"" guard and return null', async () => {
            for (const spell of [{ name: '', level: 8 }, { name: null, level: 8 }, { level: 8 }]) {
                const result = await triggerPowerWordStun(spell, {}, baseStats, campaignName, mapName);
                expect(result).toBeNull();
            }
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('envelope chain — exact 4-key shape, identities, DC/slot tiers mutually distinguishable', () => {
        it.each([
            { desc: 'metaCtx.spellSaveDc 20 beats stats 15; metaCtx.slotLevel 9 beats spell.level 8', spell: { name: 'Power Word Stun', level: 8 }, metaCtx: { spellSaveDc: 20, slotLevel: 9 }, stats: baseStats, dc: 20, slot: 9 },
            { desc: 'mixed-case gate fold, name byte stays exact; null metaCtx via optional chain; stats tier 15; spell.level slot fallback', spell: { name: 'PoWeR wOrD StUn', level: 8 }, metaCtx: null, stats: baseStats, dc: 15, slot: 8 },
            { desc: 'proficiency formula tier 8+3=11 when no spellAbilities', spell: { name: 'Power Word Stun', level: 8 }, metaCtx: {}, stats: { name: 'Wizard', proficiency: 3 }, dc: 11, slot: 8 },
            { desc: 'missing proficiency defaults 8+2=10; missing spell.level defaults hard 8 (= disk lv8)', spell: { name: 'power word stun' }, metaCtx: {}, stats: { name: 'Wizard' }, dc: 10, slot: 8 },
            { desc: ':0-chain: spellSaveDc 0 swallowed to stats tier, slotLevel 0 swallowed to spell.level 7', spell: { name: 'Power Word Stun', level: 7 }, metaCtx: { spellSaveDc: 0, slotLevel: 0 }, stats: baseStats, dc: 15, slot: 7 },
        ])('envelope: $desc', async ({ spell, metaCtx, stats, dc, slot }) => {
            const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Power Word Stun' } };
            executeHandler.mockResolvedValue(sentinel);

            const result = await triggerPowerWordStun(spell, metaCtx, stats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, argStats, argCampaign, argMap] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(spell.name, dc, slot, spell));
            expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
            expect(Object.keys(action.automation)).toEqual(['type', 'saveDc', 'saveType']);
            expect(action.spell).toBe(spell);
            expect(argStats).toBe(stats);
            expect(argCampaign).toBe(campaignName);
            expect(argMap).toBe(mapName);
            expect(result).toBe(sentinel);
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('handler pass-through contract (caller truthiness feeds automationPopup)', () => {
        it('executeHandler resolving null passes through null without logging', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerPowerWordStun({ name: 'Power Word Stun', level: 8 }, {}, baseStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('executeHandler rejection: identical Error + exact prefix logged once, null returned', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);

            const result = await triggerPowerWordStun({ name: 'Power Word Stun', level: 8 }, {}, baseStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[powerWordStunService] Failed to execute Power Word Stun handler:', err);
            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('unguarded derefs outside the try — golden TypeErrors', () => {
        it('null spell rejects at L4 gate deref; catch guards executeHandler only', async () => {
            await expect(
                triggerPowerWordStun(null, {}, baseStats, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('null playerStats rejects at L7 when the DC chain reaches it; unlogged', async () => {
            await expect(
                triggerPowerWordStun({ name: 'Power Word Stun', level: 8 }, {}, null, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('null playerStats RESCUED by truthy metaCtx.spellSaveDc short-circuit — forwards, never throws', async () => {
            const sentinel = { type: 'popup' };
            executeHandler.mockResolvedValue(sentinel);
            const spell = { name: 'Power Word Stun', level: 8 };

            const result = await triggerPowerWordStun(spell, { spellSaveDc: 20 }, null, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, argStats] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope('Power Word Stun', 20, 8, spell));
            expect(argStats).toBeNull();
            expect(result).toBe(sentinel);
        });
    });
});
