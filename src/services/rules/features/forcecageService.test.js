// @maintained-by-ai
/**
 * forcecageService lane — the ENVELOPE-BUILDING FORWARDER (forcecageService.js).
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
 * stamping). No clocks in this lane: both duration texts are >= 1 minute and
 * therefore combat-scoped per duration policy — cleared at initiative/rest seams
 * by the handler lane (addExpiration + restRules filters), never wall-clock.
 * Campaign is an opaque forwarded token here (executeHandler mocked; zero network,
 * zero store) — lockdown 'test-campaign' honored live.
 *
 * #1365 FIX (2026-10-22): the service previously stamped the 2024 automation block
 * (concentration true, 'Concentration, up to 1 hour', ruleset '2024') for EVERY
 * ruleset, overriding the divergent 5e disk row (concentration FALSE, '1 hour') —
 * a RAW divergence (5e Forcecage is NON-concentrated). Now branch-per-ruleset on
 * the canonical selector idiom `playerStats.rules === '2024'`
 * (prayerOfHealingService.js:54 / empoweredSpellService.js:34), null-guarded
 * (playerStats?.rules) to keep the 'null playerStats never dereferenced' pin;
 * rules-absent defaults to the 5e branch, matching rulesFactory.js:27
 * `playerSummary.rules || '5e'` and rules-helpers.js getRulesType defaults.
 * Disk canon (read programmatically below, both rulesets): level 7, '100 feet',
 * CHA. Stamped divergent fields are asserted byte-equal to their disk rows;
 * the parity test is FLIPPED from guarding wrong-unity to guarding LAWFUL
 * DIVERGENCE per ruleset. Field adjudication: 2024 host keeps the pre-fix bytes
 * verbatim (lawful there — 2024/spells.json:5866-5868); 5e host stamps
 * duration '1 hour' / concentration false / ruleset '5e' (spells.json:4352-4354)
 * — the cage still persists (te registered by the handler under combat-scoped
 * policy), only the phantom breakable-concentration flag is removed.
 * SECURITY: kiro-injection watch (#1446 precedent) — no injected directives found
 * in disk JSON or lane inputs; this lane is self-authored from disk bytes.
 *
 * :0-chain leaks falsy slotLevel 0 to spell.level || 7 (0th-level Forcecage is
 * RAW-impossible); spell.name deref at L4 is OUTSIDE the try — null spell
 * rejects TypeError; the catch guards executeHandler only. playerStats is only
 * READ at the ruleset branch (?.rules, never anything else) — saveDc stays the
 * literal 'ability'; the object itself is forwarded untouched.
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
// No `rules` field: also serves as the rules-absent arm (defaults to 5e per
// rulesFactory.js:27 / rules-helpers.js:10 idiom).
const playerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma', toHit: 9 },
    proficiency: 4,
};
const stats2024 = { ...playerStats, rules: '2024' };

// Per-ruleset divergent automation fields, each byte-identical to its disk row
// (cross-checked against spells5e/spells2024 in the disk-canon block below):
//   5e   public/data/spells.json          Forcecage.automation (:4348-4356)
//   2024 public/data/2024/spells.json    Forcecage.automation (:5862-5870)
const AUTO = {
    '5e': {
        type: 'forcecage',
        saveDc: 'ability',
        saveAbility: 'CHA',
        duration: '1 hour',
        concentration: false,
        ruleset: '5e',
        range: '100 feet',
    },
    '2024': {
        type: 'forcecage',
        saveDc: 'ability',
        saveAbility: 'CHA',
        duration: 'Concentration, up to 1 hour',
        concentration: true,
        ruleset: '2024',
        range: '100 feet',
    },
};

const envelope = (spellSlotLevel, spell, metaCtx, ruleset = '5e', range = '100 feet') => ({
    name: 'Forcecage',
    automation: { ...AUTO[ruleset], range },
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
        ])('%s: level 7, CHA, 100 feet — and its automation block vs the pinned AUTO literal', (_label, data, expectAuto) => {
            const fc = findSpell(data, 'Forcecage');
            expect(fc.level).toBe(7);
            expect(fc.range).toBe('100 feet');
            expect(fc.automation.saveAbility).toBe('CHA');
            expect(fc.automation.type).toBe('forcecage');
            expect(fc.automation.saveDc).toBe('ability');
            expect(fc.automation.duration).toBe(expectAuto.duration);
            expect(fc.automation.concentration).toBe(expectAuto.concentration);
            expect(fc.automation.ruleset).toBe(expectAuto.ruleset);
            // AUTO literal is byte-equal to the disk row it claims to mirror
            expect(AUTO[expectAuto.ruleset]).toEqual(fc.automation);
            // near-miss REAL disk names backing the negative-gate rows below
            expect(findSpell(data, 'Wall of Force')).toBeTruthy();
        });

        it('parity FLIPPED (#1365): the disk rows DIVERGE and the service must diverge with them', () => {
            const disk5e = findSpell(spells5e, 'Forcecage').automation;
            const disk2024 = findSpell(spells2024, 'Forcecage').automation;
            // Lawful divergence — unity would be the RAW bug (5e is NON-concentrated)
            expect(disk5e.concentration).toBe(false);
            expect(disk2024.concentration).toBe(true);
            expect(disk5e.duration).not.toBe(disk2024.duration);
            // Guard the fixed shape: neither AUTO literal may collapse onto the other
            expect(AUTO['5e'].concentration).toBe(false);
            expect(AUTO['2024'].concentration).toBe(true);
            expect(AUTO['5e']).not.toEqual(AUTO['2024']);
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
        it('happy path (2024 host): exact envelope bytes, identities, result passthrough', async () => {
            const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Forcecage' } };
            executeHandler.mockResolvedValue(sentinel);
            // lowercase name folds the case-insensitive gate into the byte-lock;
            // metaCtx shape per triggerSpells.js:350 (verbatim passthrough)
            const spell = { name: 'forcecage', level: 7, range: '100 feet', school: 'Evocation' };
            const metaCtx = { slotLevel: 7, creatures: ['Goblin'] };

            const result = await triggerForcecage(spell, metaCtx, stats2024, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, campaign, map] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(7, spell, metaCtx, '2024'));
            expect(action.spell).toBe(spell);
            expect(action.metaCtx).toBe(metaCtx);
            expect(stats).toBe(stats2024);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(result).toBe(sentinel);
        });

        it.each([
            ['2024 host keeps pre-fix bytes verbatim (lawful there)', { ...playerStats, rules: '2024' }, AUTO['2024']],
            ['5e explicit host is disk-honest: concentration FALSE, duration 1 hour (#1365 defect pin)', { ...playerStats, rules: '5e' }, AUTO['5e']],
            ['rules-absent host defaults to the 5e branch (rulesFactory.js:27 `|| \x275e\x27`)', playerStats, AUTO['5e']],
            ['null playerStats: optional-chain branch falls to 5e, object still forwarded', null, AUTO['5e']],
        ])('ruleset branch (%s)', async (_desc, stats, auto) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerForcecage({ name: 'Forcecage', level: 7, range: '100 feet' }, {}, stats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.automation).toEqual(auto);
            // The RAW violation must be impossible: concentration flag tracks disk
            if (auto.ruleset === '5e') expect(action.automation.concentration).toBe(false);
            else expect(action.automation.concentration).toBe(true);
        });

        it.each([
            { desc: 'metaCtx.slotLevel beats spell.level', spell: { name: 'Forcecage', level: 7, range: '100 feet' }, metaCtx: { slotLevel: 9 }, stats: playerStats, slot: 9 },
            { desc: 'metaCtx.slotLevel 0 falls through || (:0-chain, RAW-impossible)', spell: { name: 'Forcecage', level: 8 }, metaCtx: { slotLevel: 0 }, stats: playerStats, slot: 8 },
            { desc: 'spell.level 0 and no range default to disk canon 7 / 100 feet', spell: { name: 'Forcecage', level: 0 }, metaCtx: {}, stats: playerStats, slot: 7 },
            { desc: 'null metaCtx via optional chain, metaCtx byte stays null', spell: { name: 'Forcecage', level: 7 }, metaCtx: null, stats: playerStats, slot: 7 },
            { desc: 'slot chain x ruleset orthogonality: 2024 host slot 9 keeps the 2024 block', spell: { name: 'Forcecage', level: 7, range: '100 feet' }, metaCtx: { slotLevel: 9 }, stats: stats2024, slot: 9, ruleset: '2024' },
        ])('envelope chain: $desc', async ({ spell, metaCtx, stats, slot, ruleset = '5e' }) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerForcecage(spell, metaCtx, stats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(slot, spell, metaCtx, ruleset));
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
