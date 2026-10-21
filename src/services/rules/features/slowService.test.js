// @maintained-by-ai
// ── slowService lane map (subject: slowService.js — spellCast producer lane) ──
// Lane (this): triggerSlow() ONLY — case-insensitive exact-name gate, save-DC
//   resolution chain, slot-level chain, exact action envelope, delegation to
//   executeHandler, reject-swallow to null. Single production caller (grep
//   verified): spellCastService/execution/triggerSpells.js:139 handleSlow
//   spreads { ...metaCtx, spellSaveDc } — tier-1 (metaCtx.spellSaveDc) is the
//   LIVE prod path; tiers 2-3 are defensive fallbacks (pinned, compact).
// OWNED ELSEWHERE (not retested here):
//   • WIS save prompt, 'slow' activeCondition writes, activeConditionMeta,
//     targetEffects (no_reactions/dex_save_disadvantage/action_limit/
//     single_attack_limit/somatic_failure_chance), addExpiration, caster
//     concentration, condition/save_result logs → slowHandler.js, pinned by
//     slowHandler.test.js (its seam map cites slowService.js:19 envelope).
//   • metamagic target-confirm lane runSlow (useSimpleSpellHandlers.js:82)
//     builds its OWN envelope (type:'slow' + metaCtx.targets + range) and
//     BYPASSES this lane — twin discrimination: automation type 'haste'
//     (useSimpleSpellHandlers.js:292) vs 'slow' here; disk twin Haste
//     (30ft) vs Slow (120ft), both lv3 transmutation, concentration
//     'up to 1 minute' in public/data/spells.json AND data/2024/spells.json
//     → combat-scoped by the no-clock mandate; this lane stores no clock,
//     no rounds, no Date.now (zero-timer module, declared clean).
// Golden pins (quirks, reported not fixed):
//   • envelope has NO metaCtx key — triggerSpells' { targets } selection is
//     dropped here, so the spellCast lane always hits the handler all-
//     non-caster branch (documented at slowHandler.test.js header). Key-set
//     assertion is the drift detector.
//   • all-falsy `||` chains: spellSaveDc:0 and spell.level:0 are swallowed
//     to the next tier; proficiency:0 swallows to default 2 (DC 10, not 8).
//   • unguarded derefs OUTSIDE try: undefined spell / undefined playerStats
//     throw TypeError and the console stays untouched.
// No dice in this lane (save d20 rolls live in the handler/save-prompt lane):
//   zero-dice declared.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerSlow } from './slowService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const defaultPlayerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
    proficiency: 4,
};

let consoleSpy;

beforeEach(() => {
    vi.resetAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleSpy.mockRestore();
});

// Seed a strict delegate: exact 4-arg call, returns sentinel, captures action.
async function castAndCapture(spell, metaCtx, playerStats = defaultPlayerStats) {
    const sentinel = { type: 'popup' };
    executeHandler.mockClear();
    executeHandler.mockImplementation((...args) => {
        if (args.length !== 4) throw new Error(`executeHandler arity drift: ${args.length}`);
        return sentinel;
    });
    const result = await triggerSlow(spell, metaCtx, playerStats, campaignName, mapName);
    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(executeHandler.mock.calls[0][0]).toBeDefined();
    return { action: executeHandler.mock.calls[0][0], result, sentinel };
}

describe('slowService.triggerSlow', () => {
    it('delegates only for case-insensitive exact "slow" names and preserves raw name bytes', async () => {
        for (const name of ['Slow', 'slow', 'SLOW', 'sLoW']) {
            executeHandler.mockClear();
            executeHandler.mockResolvedValue({ type: 'popup' });
            const result = await triggerSlow(
                { name, level: 3 }, {}, defaultPlayerStats, campaignName, mapName,
            );
            expect(executeHandler, `spell name: ${name}`).toHaveBeenCalledTimes(1);
            const action = executeHandler.mock.calls[0][0];
            expect(action.name, `raw name bytes for ${name}`).toBe(name);
            expect(result).toEqual({ type: 'popup' });
        }
    });

    it('returns null and never delegates for every other spell name (real-disk near-misses)', async () => {
        executeHandler.mockImplementation(() => {
            throw new Error('gate drift: non-Slow spell delegated');
        });
        const names = [
            'Haste',            // disk twin (spells.json + 2024/spells.json)
            'Time Stop',        // real disk time-spell, must NOT route here
            'Silence',          // real disk, near-spelling
            'Fire Bolt',
            'fears',
            'slow ',           // trailing space fails strict equality
            ' slowed',
            'Slow Ray',
            '',
            undefined,
            null,
        ];
        for (const name of names) {
            const result = await triggerSlow(
                { name, level: 3 }, {}, defaultPlayerStats, campaignName, mapName,
            );
            expect(result, `spell name: ${JSON.stringify(name)}`).toBeNull();
        }
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('builds the exact envelope, forwards args by identity, returns handler result by identity', async () => {
        const spell = { name: 'Slow', level: 3, school: 'Transmutation' };
        const metaCtx = { spellSaveDc: 13, targets: ['Goblin'] };
        executeHandler.mockResolvedValue({ type: 'popup' });

        const { result } = await castAndCapture(spell, metaCtx);
        const sent = executeHandler.mock.calls[0];
        expect(sent[0]).toEqual({
            name: 'Slow',
            automation: { type: 'slow', saveDc: 13, saveType: 'WIS' },
            spell,
            spellSlotLevel: 3,
        });
        // Drift detector: no metaCtx key (spellCast target selection is
        // dropped by design — handler takes the all-non-caster branch).
        expect(Object.keys(sent[0])).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
        expect(sent[0]).not.toHaveProperty('metaCtx');
        expect(JSON.stringify(sent[0])).not.toContain('Goblin');
        // spell forwarded by identity, args exact.
        expect(sent[0].spell).toBe(spell);
        expect(sent.length).toBe(4);
        expect(sent[1]).toBe(defaultPlayerStats);
        expect(sent[2]).toBe(campaignName);
        expect(sent[3]).toBe(mapName);
        expect(result).toEqual({ type: 'popup' });

        executeHandler.mockResolvedValue(null);
        expect(await triggerSlow(spell, metaCtx, defaultPlayerStats, campaignName, mapName)).toBeNull();
    });

    it('resolves saveDc through the exact priority chain (:0-swallow census)', async () => {
        const rows = [
            { label: 'metaCtx.spellSaveDc live tier wins', metaCtx: { spellSaveDc: 18 }, stats: { name: 'W', spellAbilities: { saveDc: 15 }, proficiency: 2 }, dc: 18 },
            { label: 'spellSaveDc:0 swallowed to spellAbilities.saveDc', metaCtx: { spellSaveDc: 0 }, stats: { name: 'W', spellAbilities: { saveDc: 15 }, proficiency: 2 }, dc: 15 },
            { label: 'null spellSaveDc falls to spellAbilities.saveDc', metaCtx: { spellSaveDc: null }, stats: { name: 'W', spellAbilities: { saveDc: 16 }, proficiency: 2 }, dc: 16 },
            { label: 'missing spellSaveDc / empty or undefined metaCtx falls to spellAbilities.saveDc', metaCtx: {}, stats: { name: 'W', spellAbilities: { saveDc: 15 }, proficiency: 2 }, dc: 15 },
            { label: 'null spellAbilities falls to 8 + proficiency', metaCtx: undefined, stats: { name: 'W', spellAbilities: null, proficiency: 3 }, dc: 11 },
            { label: 'missing spellAbilities falls to 8 + proficiency', metaCtx: {}, stats: { name: 'W', proficiency: 5 }, dc: 13 },
            { label: 'proficiency:0 swallowed to default 2 (quirk: DC 10 not 8)', metaCtx: {}, stats: { name: 'W', proficiency: 0 }, dc: 10 },
            { label: 'missing proficiency defaults to 2', metaCtx: {}, stats: { name: 'W' }, dc: 10 },
        ];
        for (const { label, metaCtx, stats, dc } of rows) {
            const { action } = await castAndCapture({ name: 'Slow', level: 3 }, metaCtx, stats);
            expect(action.automation, label).toEqual({ type: 'slow', saveDc: dc, saveType: 'WIS' });
        }
    });

    it('resolves spellSlotLevel through metaCtx > spell.level > default 3 (= disk row level)', async () => {
        const rows = [
            { label: 'metaCtx.slotLevel wins over spell.level', spell: { name: 'Slow', level: 3 }, metaCtx: { slotLevel: 5 }, slot: 5 },
            { label: 'metaCtx.slotLevel:0 swallowed to spell.level', spell: { name: 'Slow', level: 4 }, metaCtx: { slotLevel: 0 }, slot: 4 },
            { label: 'null slotLevel falls to spell.level', spell: { name: 'Slow', level: 6 }, metaCtx: { slotLevel: null }, slot: 6 },
            { label: 'missing/undefined metaCtx falls to spell.level', spell: { name: 'Slow', level: 7 }, metaCtx: undefined, slot: 7 },
            { label: 'spell.level:0 swallowed to default 3 (cantrip-shape)', spell: { name: 'Slow', level: 0 }, metaCtx: {}, slot: 3 },
            { label: 'missing spell.level defaults 3', spell: { name: 'Slow' }, metaCtx: {}, slot: 3 },
        ];
        for (const { label, spell, metaCtx, slot } of rows) {
            const { action } = await castAndCapture(spell, metaCtx);
            expect(action.spellSlotLevel, label).toBe(slot);
        }
    });

    it('throws unguarded-deref TypeErrors OUTSIDE the try and leaves console untouched', async () => {
        await expect(
            triggerSlow(undefined, {}, defaultPlayerStats, campaignName, mapName),
        ).rejects.toThrow(TypeError); // spell.name deref, slowService.js:4
        await expect(
            triggerSlow({ name: 'Slow', level: 3 }, {}, undefined, campaignName, mapName),
        ).rejects.toThrow(TypeError); // playerStats.spellAbilities deref, :7
        expect(executeHandler).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('returns null and logs exact prefix when executeHandler rejects', async () => {
        const errors = [new Error('Handler failed'), new TypeError('boom')];
        for (const error of errors) {
            executeHandler.mockRejectedValueOnce(error);
            const result = await triggerSlow(
                { name: 'Slow', level: 3 }, {}, defaultPlayerStats, campaignName, mapName,
            );
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[slowService] Failed to execute Slow handler:',
                error,
            );
        }
        expect(executeHandler).toHaveBeenCalledTimes(errors.length);
        expect(consoleSpy).toHaveBeenCalledTimes(errors.length);
    });
});
