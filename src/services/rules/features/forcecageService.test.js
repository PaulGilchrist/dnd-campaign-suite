// @maintained-by-ai
/**
 * forcecageService lane — the ENVELOPE-BUILDING FORWARDER (forcecageService.js L3-32).
 * Sole export triggerForcecage; sole production caller spellCastService/execution/
 * triggerSpells.js:348-350 handleForcecage (re-gates the same lowercase exact name
 * upstream and passes metaCtx VERBATIM — no spellSaveDc spread; dispatched from
 * execution/index.js:309). Defense-in-depth re-gate inside this service is pinned
 * here anyway. The CharSpells modal-confirm lane (useAreaEffectHandlers.js:37+)
 * builds its own forcecage action straight against executeHandler — it does NOT
 * route through this service, so it is not this lane's contract. Every other
 * forcecage mention in tests vi.mock's this module (caller-evidence grep,
 * 2026-10-20) — this is the sole lane exercising its internals.
 * Downstream owned by forcecageHandler.test.js (dispatch automation/index.js:587
 * forcecage → handle, :588 forcecage_escape), targetEffectDefinitions.js:564
 * 'forcecage' te, and rest purge restRules-longRest.js:92 / restRules-shortRest.js:334
 * — those filters consume te rows PRODUCED by the handler, NOT here:
 * triggerForcecage performs ZERO store writes (no skipSync surface, no expiry
 * stamping). No clocks in this lane: 'Concentration, up to 1 hour' is >= 1 minute
 * and therefore combat-scoped per duration policy — cleared at initiative/rest
 * seams by the handler lane, never wall-clock.
 * Disk canon (read 2026-10-20, both rulesets): level 7, range "100 feet", CHA.
 * QUIRK pinned honestly: this service hardcodes the 2024 automation block
 * (concentration true, "Concentration, up to 1 hour", ruleset '2024') for EVERY
 * ruleset, overriding the divergent 5e disk canon (concentration false,
 * "1 hour", ruleset '5e'). Reported upstream; tests pin current bytes.
 * :0-chain leaks falsy slotLevel 0 to spell.level || 7 (0th-level Forcecage is
 * RAW-impossible); spell.name deref at L4 is OUTSIDE the try — null spell
 * rejects TypeError; the catch guards executeHandler only. playerStats is never
 * dereferenced (saveDc is the literal 'ability'), only forwarded.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerForcecage } from './forcecageService.js';
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
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma', toHit: 9 },
    proficiency: 4,
};

// Exact envelope: automation is byte-identical to public/data/2024/spells.json
// Forcecage.automation (cross-checked in the disk-canon block below).
const envelope = (spellSlotLevel, spell, metaCtx, range = '100 feet') => ({
    name: 'Forcecage',
    automation: {
        type: 'forcecage',
        saveDc: 'ability',
        saveAbility: 'CHA',
        duration: 'Concentration, up to 1 hour',
        concentration: true,
        ruleset: '2024',
        range,
    },
    spell,
    spellSlotLevel,
    metaCtx,
});

const findSpell = (data, name) => (data.spells || data).find(s => s.name === name);

describe('forcecageService', () => {
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
            ['5e', spells5e, { duration: '1 hour', concentration: false, ruleset: '5e' }],
            ['2024', spells2024, { duration: 'Concentration, up to 1 hour', concentration: true, ruleset: '2024' }],
        ])('%s: level 7, CHA, 100 feet — and its automation block vs the hardcoded one', (_label, data, expectAuto) => {
            const fc = findSpell(data, 'Forcecage');
            expect(fc.level).toBe(7);
            expect(fc.range).toBe('100 feet');
            expect(fc.automation.saveAbility).toBe('CHA');
            expect(fc.automation.type).toBe('forcecage');
            expect(fc.automation.saveDc).toBe('ability');
            expect(fc.automation.duration).toBe(expectAuto.duration);
            expect(fc.automation.concentration).toBe(expectAuto.concentration);
            expect(fc.automation.ruleset).toBe(expectAuto.ruleset);
            // near-miss REAL disk names backing the negative-gate rows below
            expect(findSpell(data, 'Wall of Force')).toBeTruthy();
        });

        it('hardcoded block equals 2024 disk byte-for-byte; overrides divergent 5e disk canon (quirk)', () => {
            const auto = envelope(7, {}, {}).automation;
            expect(auto).toEqual(findSpell(spells2024, 'Forcecage').automation);
            const disk5e = findSpell(spells5e, 'Forcecage').automation;
            expect(disk5e.concentration).toBe(false);
            expect(disk5e.duration).toBe('1 hour');
            expect(disk5e.ruleset).toBe('5e');
        });
    });

    describe('name gate closed — null, handler untouched, nothing logged', () => {
        it.each([
            { desc: 'real DISK near-miss Wall of Force', spell: { name: 'Wall of Force', level: 5 } },
            { desc: 'real DISK near-miss Phantasmal Force', spell: { name: 'Phantasmal Force', level: 2 } },
            { desc: 'trailing space not trimmed (exact match)', spell: { name: 'Forcecage ', level: 7 } },
            { desc: 'missing name', spell: {} },
            { desc: 'null name', spell: { name: null, level: 7 } },
            { desc: 'empty name', spell: { name: '', level: 7 } },
        ])('$desc', async ({ spell }) => {
            const result = await triggerForcecage(spell, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('triggerForcecage', () => {
        it('happy path: exact envelope bytes, identities, result passthrough', async () => {
            const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Forcecage' } };
            executeHandler.mockResolvedValue(sentinel);
            // lowercase name folds the case-insensitive gate into the byte-lock;
            // metaCtx shape per triggerSpells.js:350 (verbatim passthrough)
            const spell = { name: 'forcecage', level: 7, range: '100 feet', school: 'Evocation' };
            const metaCtx = { slotLevel: 7, creatures: ['Goblin'] };

            const result = await triggerForcecage(spell, metaCtx, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, campaign, map] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(7, spell, metaCtx));
            expect(action.spell).toBe(spell);
            expect(action.metaCtx).toBe(metaCtx);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(result).toBe(sentinel);
        });

        it.each([
            { desc: 'metaCtx.slotLevel beats spell.level', spell: { name: 'Forcecage', level: 7, range: '100 feet' }, metaCtx: { slotLevel: 9 }, stats: playerStats, slot: 9 },
            { desc: 'metaCtx.slotLevel 0 falls through || (:0-chain, RAW-impossible)', spell: { name: 'Forcecage', level: 8 }, metaCtx: { slotLevel: 0 }, stats: playerStats, slot: 8 },
            { desc: 'spell.level 0 and no range default to disk canon 7 / 100 feet', spell: { name: 'Forcecage', level: 0 }, metaCtx: {}, stats: playerStats, slot: 7 },
            { desc: 'null metaCtx via optional chain, metaCtx byte stays null', spell: { name: 'Forcecage', level: 7 }, metaCtx: null, stats: playerStats, slot: 7 },
            { desc: 'null playerStats forwarded untouched (never dereferenced)', spell: { name: 'Forcecage', level: 7 }, metaCtx: {}, stats: null, slot: 7 },
        ])('envelope chain: $desc', async ({ spell, metaCtx, stats, slot }) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerForcecage(spell, metaCtx, stats, campaignName, mapName);

            const [action, argStats] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(slot, spell, metaCtx));
            expect(argStats).toBe(stats);
            expect(result).toEqual({ type: 'popup' });
        });

        it('executeHandler resolving null passes through null without logging', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerForcecage({ name: 'Forcecage', level: 7 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('executeHandler rejection: identical Error + exact prefix logged, null returned', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);

            const result = await triggerForcecage({ name: 'Forcecage', level: 7 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[forcecage] Failed to execute handler:', err);
            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it('null spell rejects — the gate deref at L4 is OUTSIDE the try (catch guards executeHandler only)', async () => {
            await expect(
                triggerForcecage(null, {}, playerStats, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });
});
