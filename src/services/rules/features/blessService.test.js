// @maintained-by-ai
// blessService lane contract — two live lanes, one file, no duplication elsewhere:
// 1) triggerBlessSpell: gate + envelope forwarder. Live dispatch:
//    spellCastService/execution/triggerSpells.js handleBless (:153) spreads
//    { ...metaCtx, spellSaveDc } in, then DISCARDS the return (:155-156);
//    the live picker is spellGates.gateBless (own lane). blessHandler.test.js
//    owns the executeHandler→handle popup side — this file mocks executeHandler
//    and pins only the envelope it receives. Bless has NO saving throw
//    (disk row: no save field, 2024 attack_type null) — the spellSaveDc
//    sentinel is pinned NOT-read (#1338 determination).
// 2) applyBlessEffect: SOLE owner of the apply-side writes. Called directly by
//    useSimpleSpellHandlers.js:288 (metamagic confirm), never via blessHandler
//    (blessHandler.test.js:5-8). One full-set write per cast, skipSync=true in
//    the 5th position; effect key from the targetEffectDefinitions registry
//    (:699 bless_bonus); replace per target+source; duration 'concentration'
//    mirrors the disk row (concentration: true, #1290 boundary).
// Live cross-lane note (reported, not fixed here): the bane spec
// (useSimpleSpellHandlers.js:287) forwards the paid slot as level: per SP-011;
// the bless spec (:288) does not, so metamagic-upcast bless stamps slotLevel 1
// in this lane's row — the trigger lane's metaCtx.slotLevel precedence below
// pins the seam awaiting that wiring fix.
// Weapon-row gap #1238 verdict: blessService composes NO weapon rows (te write
// only) — gap does not live in this lane.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../public/data/spells.json';
import { getEffectDefinition } from '../../combat/conditions/targetEffectDefinitions.js';

vi.mock('../../../services/automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { executeHandler } from '../../../services/automation/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { triggerBlessSpell, applyBlessEffect } from './blessService.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';

// Disk-derived fixtures — never hand-transcribed (#1339).
const DISK_BLESS = spells5e.find(s => s.name === 'Bless');
const BLESS_TE = getEffectDefinition('bless_bonus').effect;
const NEAR_MISS_NAMES = spells5e
    .map(s => s.name)
    .filter(n => /bless|bane|blade/i.test(n) && n !== 'Bless');

const PLAYER_STATS = { name: 'Cleric' };

describe('triggerBlessSpell — gate + envelope forwarder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ...NEAR_MISS_NAMES.map(n => [n]),
        ['bless (trailing space)'],
        [''],
        [undefined],
        [null],
    ])('spell name %j does not open the gate — null, zero dispatch', async (name) => {
        const result = await triggerBlessSpell({ name }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('matches the gate case-insensitively and forwards the exact envelope positionally', async () => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: { forwarded: true } });
        const spell = { ...DISK_BLESS };

        for (const name of ['BLESS', 'bless', 'BlEsS']) {
            executeHandler.mockClear();
            const result = await triggerBlessSpell({ ...spell, name }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            // Exact envelope: no extra keys may leak in (e.g. a future {...metaCtx} spread).
            expect(executeHandler.mock.calls[0][0]).toEqual({
                name: 'Bless',
                automation: { type: 'bless', range: DISK_BLESS.range, maxTargets: 3 },
                spell: { ...spell, name },
                spellSlotLevel: DISK_BLESS.level,
            });
            expect(executeHandler.mock.calls[0][1]).toBe(PLAYER_STATS);
            expect(executeHandler.mock.calls[0][2]).toBe(CAMPAIGN_NAME);
            expect(executeHandler.mock.calls[0][3]).toBe(MAP_NAME);
            expect(result).toEqual({ type: 'popup', payload: { forwarded: true } });
        }
    });

    it.each([
        ['metaCtx.slotLevel outranks spell.level (paid-slot upcast)', { slotLevel: 4 }, { ...DISK_BLESS, level: 2 }, 4],
        ['spell.level used when metaCtx.slotLevel absent', {}, { ...DISK_BLESS, level: 2 }, 2],
        ['defaults to 1 when neither carries a level', {}, { name: 'Bless' }, 1],
    ])('slotLevel precedence: %s', async (_label, metaCtx, spell, expected) => {
        executeHandler.mockResolvedValue(null);

        await triggerBlessSpell(spell, { spellSaveDc: 99, ...metaCtx }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        const action = executeHandler.mock.calls[0][0];
        expect(action.spellSlotLevel).toBe(expected);
        // Bless has no save — the triggerSpells-spread spellSaveDc must NOT
        // reach the envelope (#1338 determination).
        expect(action).not.toHaveProperty('spellSaveDc');
        expect(action.automation).not.toHaveProperty('saveDc');
    });

    it('uses spell.range and automation.maxTargets, defaulting to disk values 30 feet / 3', async () => {
        executeHandler.mockResolvedValue(null);

        await triggerBlessSpell({ ...DISK_BLESS, range: '60 feet', automation: { maxTargets: 6 } }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(executeHandler.mock.calls[0][0].automation).toEqual({ type: 'bless', range: '60 feet', maxTargets: 6 });

        await triggerBlessSpell({ name: 'Bless' }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(executeHandler.mock.calls[1][0].automation).toEqual({ type: 'bless', range: '30 feet', maxTargets: 3 });
    });

    it('returns the handler result unchanged; on throw returns null with the exact console.error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Handler failed');

        const forwarded = { type: 'popup', payload: { name: 'Bless' } };
        executeHandler.mockResolvedValue(forwarded);
        await expect(triggerBlessSpell({ ...DISK_BLESS }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME))
            .resolves.toBe(forwarded);

        executeHandler.mockRejectedValue(error);
        const result = await triggerBlessSpell({ ...DISK_BLESS }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('[blessSpell] Failed to execute Bless handler:', error);
        consoleSpy.mockRestore();
    });
});

describe('applyBlessEffect — apply-side targetEffects writer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty array', []],
        ['string', 'Goblin'],
        ['number', 5],
        ['object', { name: 'Goblin' }],
    ])('rejects invalid targetNames (%s): null, zero reads, zero writes, zero logs', async (_label, targets) => {
        const result = await applyBlessEffect({ ...DISK_BLESS }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, targets);

        expect(result).toBeNull();
        expect(getRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        ['disk level', { ...DISK_BLESS }, DISK_BLESS.level],
        ['level-less spell defaults to slot 1', { name: 'Bless' }, 1],
    ])('one full-set write (skipSync pos 5): %s — exact bless row and popup envelope', async (_label, spell, expectedSlot) => {
        getRuntimeValue.mockReturnValue([]);

        const result = await applyBlessEffect(spell, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        const [scope, key, effects, campaign, skipSync] = setRuntimeValue.mock.calls[0];
        expect(scope).toBe('campaign');
        expect(key).toBe('targetEffects');
        expect(campaign).toBe(CAMPAIGN_NAME);
        expect(skipSync).toBe(true);
        expect(effects).toEqual([{
            target: 'Goblin',
            effect: BLESS_TE,
            source: 'Cleric',
            slotLevel: expectedSlot,
            duration: 'concentration',
        }]);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Bless',
                description: '1 of 1 target(s) blessed by Bless.',
            },
        });
    });

    it('replaces own bless row in place, upgrades the paid slot, scopes one row per target, preserves all others by identity', async () => {
        const existing = [
            { target: 'Goblin', effect: BLESS_TE, source: 'Cleric', slotLevel: 1, duration: 'concentration' },      // own row — replace idx 0
            { target: 'Goblin', effect: BLESS_TE, source: 'OtherCleric', slotLevel: 1, duration: 'concentration' },  // other caster — keep
            { target: 'Orc', effect: BLESS_TE, source: 'Cleric', slotLevel: 1, duration: 'concentration' },           // not re-targeted — keep
            { target: 'Goblin', effect: 'bane_penalty', source: 'Hag', slotLevel: 1 },                                 // unrelated effect — keep
        ];
        getRuntimeValue.mockReturnValue(existing);

        const result = await applyBlessEffect({ ...DISK_BLESS, level: 3 }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin', 'Skeleton']);

        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        const effects = setRuntimeValue.mock.calls[0][2];
        expect(effects).toEqual([
            { target: 'Goblin', effect: BLESS_TE, source: 'Cleric', slotLevel: 3, duration: 'concentration' },
            existing[1],
            existing[2],
            existing[3],
            { target: 'Skeleton', effect: BLESS_TE, source: 'Cleric', slotLevel: 3, duration: 'concentration' },
        ]);
        // Untouched rows are carried by reference, and each target holds exactly one own bless row.
        expect(effects[1]).toBe(existing[1]);
        expect(effects.filter(te => te.effect === BLESS_TE && te.source === 'Cleric' && te.target === 'Goblin')).toHaveLength(1);
        expect(result.payload.description).toBe('2 of 2 target(s) blessed by Bless.');
    });

    it.each([
        ['explicit casting_time passthrough', { ...DISK_BLESS, casting_time: 'Bonus Action', level: 2 }, 'Bonus Action', 2],
        ['5e disk defaults', { name: 'Bless' }, '1 action', 1],
    ])('logs the cast entry then the summary entry, both exact: %s', async (_label, spell, expectedCastingTime, expectedLevel) => {
        getRuntimeValue.mockReturnValue([]);
        const targets = ['Goblin', 'Orc'];

        await applyBlessEffect(spell, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, targets);

        expect(addEntry).toHaveBeenCalledTimes(2);
        const [castEntry, summaryEntry] = addEntry.mock.calls.map(c => c[1]);
        expect(addEntry.mock.calls[0][0]).toBe(CAMPAIGN_NAME);
        expect(addEntry.mock.calls[1][0]).toBe(CAMPAIGN_NAME);
        expect(castEntry).toEqual({
            type: 'spell',
            characterName: 'Cleric',
            targetName: 'Goblin',
            targets,
            spellName: 'Bless',
            spellLevel: expectedLevel,
            castingTime: expectedCastingTime,
            description: 'Cleric casts Bless on Goblin, Orc.',
            timestamp: expect.any(Number),
        });
        expect(summaryEntry).toEqual({
            type: 'spell',
            characterName: 'Cleric',
            targetName: 'Goblin',
            targets,
            spellName: 'Bless',
            spellLevel: expectedLevel,
            castingTime: expectedCastingTime,
            description: 'Bless cast: 2 creature(s) blessed.',
            timestamp: expect.any(Number),
        });
        // Targets reach the log verbatim, special characters included.
        expect(castEntry.targets).toBe(targets);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['string', 'corrupt'],
        ['object', { 0: 'corrupt' }],
    ])('coerces non-array storedEffects (%s) to a fresh list holding only this cast', async (_label, stored) => {
        getRuntimeValue.mockReturnValue(stored);

        await applyBlessEffect({ ...DISK_BLESS }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin', 'Orc']);

        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue.mock.calls[0][2]).toEqual([
            { target: 'Goblin', effect: BLESS_TE, source: 'Cleric', slotLevel: DISK_BLESS.level, duration: 'concentration' },
            { target: 'Orc', effect: BLESS_TE, source: 'Cleric', slotLevel: DISK_BLESS.level, duration: 'concentration' },
        ]);
    });

    it('swallows log rejections: cast still writes state, returns popup, and both catches console.error', async () => {
        getRuntimeValue.mockReturnValue([]);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Log failed');
        addEntry.mockRejectedValue(error);

        const result = await applyBlessEffect({ ...DISK_BLESS }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(result.payload.description).toBe('1 of 1 target(s) blessed by Bless.');
        for (let i = 0; i < 5; i++) await Promise.resolve(); // flush the two .catch microtasks
        expect(consoleSpy).toHaveBeenNthCalledWith(1, '[blessSpell] Error logging cast:', error);
        expect(consoleSpy).toHaveBeenNthCalledWith(2, '[blessSpell] Error logging summary:', error);
        consoleSpy.mockRestore();
    });
});
