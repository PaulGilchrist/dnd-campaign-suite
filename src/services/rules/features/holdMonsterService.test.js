// @maintained-by-ai
// hold monster/monster-person TWIN lane, PRODUCER-side envelope builder (there is NO separate
// holdPersonService.js — grep-confirmed 2026-10-20: one service serves both twins, so this
// single lane owns BOTH name-gate halves; #1344 family verdict 'each charm service keeps its own
// copy' does not split here because the copies are ONE copy). This file is the ONLY lane that
// exercises the real triggerHoldMonster — every hook consumer (useComplexSpellHandlers.js:70/75,
// useSimpleSpellHandlers.js:332-333, triggerSpells.js:4) MOCKS the service, and the target
// resolution / save execution / paralysis live in holdMonsterHandler.test.js.
// LOCAL chain copies, pin them mutually-distinguishable (#1348 method):
//   DC   : metaCtx.spellSaveDc || stats.spellAbilities.saveDc || 8+(proficiency || 2)  :9
//          NOTE the coercion quirk `|| 2` (charm family CLA-219 uses `|| 0`): prof=0 => DC 10,
//          a 4th data point for the prof-coercion family scan.
//   SLOT : metaCtx.slotLevel || spell.level || 5  :10
// Disk canon BOTH rulesets (public/data/spells.json + public/data/2024/spells.json, read
// 2026-10-20): hold-monster level 5 (NOT 6 — steering guess corrected, disk decides), dc_type
// 'WIS', concentration true, duration 'up to 1 minute' => combat-scoped, no clock stamped here
// (the service stores no expiry; re-save cadence is the handler's). 2024 row carries
// automation { type: 'hold_monster', saveType: 'WIS' } — the service's hardcoded saveType 'WIS'
// is parity-verified (#1365 GOLD class), and the slot default || 5 matches disk level 5.
// hold-person twin is lv2 on disk yet routes through THIS service with the SAME hold_monster
// automation type by design (metamagic flow distinguishes twins ONLY via metaCtx key
// holdMonsterTargets vs holdPersonTargets) — so metaCtx identity-forwarding is pinned here.
// quirk-class scan: advantage-undefined-leak ABSENT (service never emits advantage), injury
// proxy ABSENT (handler's lane), refund-lie ABSENT (no runtime-store import, zero writes, so
// skipSync audit is N/A), :0-chains ABSENT, never-executed guards: none found — zero-clean
// beyond the golden pins below. UNGUARDED-DEREF-OUTSIDE-TRY (#1360/:1362 class) PRESENT:
// lines 6/9 deref spell.name and playerStats outside the try at :24 — undefined args throw
// TypeError to the caller (they do NOT return null). Pinned as-is below.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

import { executeHandler } from '../../automation/index.js';
import { triggerHoldMonster } from './holdMonsterService.js';

const campaignName = 'TestCampaign';
const mapName = 'testMap';
// Distinguishable tiers: metaCtx 18 > card 15 > composed 8+3=11 > floor 8+2=10.
const playerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
    proficiency: 4,
};

const okResult = { type: 'popup', payload: { type: 'automation_info' } };

describe('holdMonsterService.triggerHoldMonster', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Name gate for BOTH twins (one Set: 'hold monster','hold person'). Refusal table uses
    // REAL disk near-miss rows (Command lv1, Charm Person lv1, Dominate Monster lv8, Sleep
    // lv1 — all read from public/data/spells.json) plus string-shape probes; trailing-space
    // refusal pins the no-trim exact-match ('Hold Monster ' does NOT match).
    it.each([
        ['Hold Monster', true],
        ['hold monster', true],
        ['HOLD MONSTER', true],
        ['Hold Person', true],
        ['hold person', true],
        ['HOLD PERSON', true],
        ['hold monsters', false],
        ['Hold Monster ', false],
        ['hold', false],
        ['Command', false],
        ['Charm Person', false],
        ['Dominate Monster', false],
        ['Sleep', false],
        ['', false],
        [undefined, false],
        [null, false],
    ])('gate %s executes=%s', async (name, executes) => {
        executeHandler.mockResolvedValue(okResult);

        const result = await triggerHoldMonster(
            { name, level: 5 },
            { holdMonsterTargets: ['Goblin A'] },
            playerStats,
            campaignName,
            mapName,
        );

        if (executes) {
            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, campaign, map] = executeHandler.mock.calls[0];
            // Twin fold: hold person routes through the SAME hold_monster automation type.
            expect(action.automation).toEqual({ type: 'hold_monster', saveDc: 15, saveType: 'WIS' });
            expect([stats, campaign, map]).toEqual([playerStats, campaignName, mapName]);
            expect(result).toBe(okResult);
        } else {
            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(0);
        }
    });

    // DC chain tiers, mutually distinguishable (card 15 vs composed 8+3=11 vs floor 8+2=10);
    // prof=0 row pins the `|| 2` coercion quirk (`|| 0` would give 8).
    it.each([
        ['metaCtx beats card+composed', { spellSaveDc: 18 }, playerStats, 18],
        ['card beats composed', {}, playerStats, 15],
        ['null metaCtx falls to card', null, playerStats, 15],
        ['composed when no card saveDc', {}, { name: 'Wizard', proficiency: 3 }, 11],
        ['floor: no saveDc no prof', {}, {}, 10],
        ['quirk || 2: prof=0 => 10 not 8', {}, { name: 'Zero', proficiency: 0 }, 10],
    ])('DC tier: %s', async (_label, metaCtx, stats, expectedDc) => {
        executeHandler.mockResolvedValue(okResult);

        await triggerHoldMonster({ name: 'Hold Monster', level: 5 }, metaCtx, stats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler.mock.calls[0][0].automation.saveDc).toBe(expectedDc);
    });

    // Slot chain; default 5 mirrors the disk level-5 row of BOTH rulesets.
    it.each([
        ['metaCtx.slotLevel beats spell.level', { slotLevel: 7 }, { name: 'Hold Monster', level: 3 }, 7],
        ['spell.level fallback', {}, { name: 'Hold Monster', level: 3 }, 3],
        ['default = disk lv5', {}, { name: 'Hold Monster' }, 5],
    ])('slot tier: %s', async (_label, metaCtx, spell, expectedSlot) => {
        executeHandler.mockResolvedValue(okResult);

        await triggerHoldMonster(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(expectedSlot);
    });

    it('builds the exact envelope and identity-forwards spell, metaCtx targets, and args', async () => {
        const spell = { name: 'Hold Monster', level: 5, school: 'Enchantment' };
        const metaCtx = { holdMonsterTargets: ['Goblin A', 'Goblin B'], slotLevel: 7, spellSaveDc: 18 };
        executeHandler.mockResolvedValue(okResult);

        const result = await triggerHoldMonster(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, stats, campaign, map] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'Hold Monster',
            automation: { type: 'hold_monster', saveDc: 18, saveType: 'WIS' },
            spell,
            spellSlotLevel: 7,
            metaCtx,
        });
        // Identity: the handler must see the SAME metaCtx object so holdMonsterTargets /
        // holdPersonTargets (the ONLY twin discriminator from the metamagic flow) survive.
        expect(action.spell).toBe(spell);
        expect(action.metaCtx).toBe(metaCtx);
        expect(stats).toBe(playerStats);
        expect(campaign).toBe(campaignName);
        expect(map).toBe(mapName);
        expect(result).toBe(okResult);
    });

    it('returns handler null and swallows handler rejection with exact console.error', async () => {
        executeHandler.mockResolvedValue(null);
        await expect(
            triggerHoldMonster({ name: 'Hold Monster', level: 5 }, {}, playerStats, campaignName, mapName),
        ).resolves.toBeNull();

        const err = new Error('Handler failed');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        executeHandler.mockRejectedValue(err);

        const result = await triggerHoldMonster(
            { name: 'Hold Monster', level: 5 },
            {},
            playerStats,
            campaignName,
            mapName,
        );

        expect(result).toBeNull();
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('[holdMonsterService] Failed to execute Hold Monster handler:', err);
        expect(errorSpy.mock.calls[0][1]).toBe(err);
    });

    // Golden pin, #1360/:1362 class: spell/playerStats are derefed OUTSIDE the try (:6/:9),
    // so undefined args THROW TypeError to the caller (they do not return null).
    it('undefined spell or playerStats throws TypeError to caller (unguarded deref outside try)', async () => {
        await expect(
            triggerHoldMonster(undefined, {}, playerStats, campaignName, mapName),
        ).rejects.toThrow(TypeError);

        await expect(
            triggerHoldMonster({ name: 'Hold Monster', level: 5 }, {}, undefined, campaignName, mapName),
        ).rejects.toThrow(TypeError);

        expect(executeHandler).toHaveBeenCalledTimes(0);
    });
});
