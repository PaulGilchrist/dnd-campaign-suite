// @maintained-by-ai
// Bane base lane: trigger spell-envelope construction + save-prompt wiring for
// applyBaneEffect. buildSaveDc stays MOCKED here as the isolation boundary — the
// composed caster DC producer, explicit-numeric merge order, and lv2 wrapper level
// are owned by baneService.sp011-save-dc.test.js (real buildSaveDc lane, disk-canonical
// Bane row + maxTargets ladder owned by spellGates.bane.test.js). Sentinel 42 pins
// pass-through IDENTITY only (#1334): whatever buildSaveDc returned must reach every
// prompt and log — never re-derive the value here. Falsy-fallback is unique to this
// lane (only reachable with buildSaveDc stubbed). Live dispatch: triggerSpells.handleBane.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerBaneSpell, applyBaneEffect } from './baneService.js';

vi.mock('../../../services/automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
    buildSaveDc: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { executeHandler } from '../../../services/automation/index.js';
import { createSaveListener, buildSaveDc } from '../../../services/automation/common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';

const PLAYER_STATS = {
    name: 'Bard',
    spellAbilities: { modifier: 3, saveDc: 13 },
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    computedStats: { saveBonuses: { CHA: 3 } },
};

const makeSpell = (overrides = {}) => ({
    name: 'Bane',
    level: 1,
    casting_time: '1 action',
    range: '30 feet',
    automation: { type: 'bane', maxTargets: 3 },
    ...overrides,
});

const FAILED_SAVE = { success: false, roll: 2, total: 2 };

describe('triggerBaneSpell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(['Bless', 'Banishment'])(
        'ignores non-Bane spells (%s): null, handler never reached',
        async (name) => {
            const result = await triggerBaneSpell({ name, level: 1 }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        }
    );

    it.each([
        ['standard spell', makeSpell(), {
            name: 'Bane',
            automation: { type: 'bane', range: '30 feet', maxTargets: 3 },
            spellSlotLevel: 1,
        }],
        ['automation overrides flow (maxTargets, range)', makeSpell({
            range: '60 feet',
            automation: { type: 'bane', maxTargets: 6 },
        }), {
            name: 'Bane',
            automation: { type: 'bane', range: '60 feet', maxTargets: 6 },
            spellSlotLevel: 1,
        }],
        ['sparse spell defaults (no automation/range/level)', { name: 'Bane' }, {
            name: 'Bane',
            automation: { type: 'bane', range: '30 feet', maxTargets: 3 },
            spellSlotLevel: 1,
        }],
    ])('builds the exact executeHandler envelope: %s', async (_label, spell, expectedAction) => {
        const handlerResult = { type: 'popup', payload: { marker: 'passthrough' } };
        executeHandler.mockResolvedValue(handlerResult);

        const result = await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            { ...expectedAction, spell },
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
        expect(result).toBe(handlerResult);
    });

    it('metaCtx.slotLevel takes precedence over spell.level', async () => {
        executeHandler.mockResolvedValue(null);
        await triggerBaneSpell(makeSpell({ level: 1 }), { slotLevel: 3 }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ spellSlotLevel: 3 }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('returns null (not throws) when executeHandler rejects', async () => {
        executeHandler.mockRejectedValue(new Error('Handler failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

        const result = await triggerBaneSpell(makeSpell(), {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

describe('applyBaneEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // clears calls/results only — re-seed implementations explicitly below
        addEntry.mockImplementation(() => Promise.resolve());
        getRuntimeValue.mockReturnValue([]);
        // undefined buildSaveDc → caster save-DC fallback lane (13) by default, so no
        // sentinel/stub value set by one test can leak into another if order changes.
        buildSaveDc.mockReturnValue(undefined);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve(FAILED_SAVE),
            promptId: 'test-prompt-id',
        });
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty array', []],
        ['non-array string', 'not-an-array'],
    ])('returns null for invalid targetNames (%s) with zero side effects', async (_label, targetNames) => {
        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, targetNames);

        expect(result).toBeNull();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('forwards the buildSaveDc sentinel into every prompt config and cast log (once-per-cast DC, one prompt per target)', async () => {
        // Sentinel pin (#1334): stub returns 42 (not derivable from PLAYER_STATS —
        // caster DC is 13); asserts the SAME value reaches both targets' prompts and
        // logs. Composition of the real DC is the sp011 twin's producer lane.
        buildSaveDc.mockReturnValue(42);

        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin', 'Orc']);

        expect(buildSaveDc).toHaveBeenCalledTimes(1);

        const configs = createSaveListener.mock.calls.map(c => c[1]);
        expect(configs).toEqual([
            { targetName: 'Goblin', saveType: 'CHA', saveDc: 42, dcSuccess: 'none', advantage: false, disadvantage: false },
            { targetName: 'Orc', saveType: 'CHA', saveDc: 42, dcSuccess: 'none', advantage: false, disadvantage: false },
        ]);
        expect(createSaveListener.mock.calls.map(c => c[0])).toEqual([CAMPAIGN_NAME, CAMPAIGN_NAME]);

        const castLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'spell' && c[1]?.promptId);
        expect(castLogs.map(c => c[1].description)).toEqual([
            'Bard casts Bane on Goblin (DC 42 CHA save).',
            'Bard casts Bane on Orc (DC 42 CHA save).',
        ]);
        expect(castLogs.every(c => c[1].promptId === 'test-prompt-id')).toBe(true);

        expect(result.payload.description).toBe('2 of 2 target(s) affected by Bane.');
    });

    it.each([
        ['caster spellAbilities.saveDc when buildSaveDc returns falsy', PLAYER_STATS, 13],
        ['8 + proficiency when spellAbilities is absent', { name: 'Bard', proficiency: 3 }, 11],
    ])('falls back to %s', async (_label, stats, expectedDc) => {
        buildSaveDc.mockReturnValue(null);

        await applyBaneEffect(makeSpell(), stats, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(createSaveListener).toHaveBeenCalledWith(
            CAMPAIGN_NAME,
            expect.objectContaining({ saveDc: expectedDc }),
        );
    });

    it('failed save: writes the exact concentration te (skipSync) and logs the -1d4 automation', async () => {
        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [{ target: 'Goblin', effect: 'bane_penalty', source: 'Bard', slotLevel: 1, duration: 'concentration' }],
            CAMPAIGN_NAME,
            true,
        );

        const autoLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'automation');
        expect(autoLogs).toHaveLength(1);
        expect(autoLogs[0][1].description).toContain('Goblin fails CHA save against Bane');
        expect(autoLogs[0][1].description).toContain('-1d4 penalty');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Bane',
                description: '1 of 1 target(s) affected by Bane.',
            },
        });
    });

    it('save success: no effect write, no automation log, zero affected', async () => {
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: true, roll: 12, total: 12 }),
            promptId: 'test-prompt-id',
        });

        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.filter(c => c[1]?.type === 'automation')).toHaveLength(0);
        expect(result.payload.description).toBe('0 of 1 target(s) affected by Bane.');
    });

    it('mixed saves: only the failed target gets a te; summary log and popup agree on the split', async () => {
        createSaveListener.mockImplementation((campaign, config) => ({
            promise: Promise.resolve(
                config.targetName === 'Goblin' ? FAILED_SAVE : { success: true, roll: 12, total: 12 }
            ),
            promptId: 'test-prompt-id',
        }));

        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin', 'Orc']);

        const teWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
        expect(teWrites).toHaveLength(1);
        expect(teWrites[0][2]).toEqual([
            { target: 'Goblin', effect: 'bane_penalty', source: 'Bard', slotLevel: 1, duration: 'concentration' },
        ]);

        const summary = addEntry.mock.calls.find(c => c[1]?.targets);
        expect(summary[1].targets).toEqual(['Goblin', 'Orc']);
        expect(summary[1].description).toContain('1 target(s) affected, 1 succeeded');

        expect(result.payload.description).toBe('1 of 2 target(s) affected by Bane.');
    });

    it('re-cast replaces the same-source te in place and preserves unrelated effects', async () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'bane_penalty', source: 'Bard', slotLevel: 1, duration: 'concentration' },
            { target: 'Goblin', effect: 'bless_bonus', source: 'Bard', slotLevel: 1 },
            { target: 'Goblin', effect: 'bane_penalty', source: 'OldCaster', slotLevel: 1, duration: 'concentration' },
        ]);

        await applyBaneEffect(makeSpell({ level: 2 }), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        // Exact array: same-source te replaced at its index (lv2), everything else untouched.
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [
                { target: 'Goblin', effect: 'bane_penalty', source: 'Bard', slotLevel: 2, duration: 'concentration' },
                { target: 'Goblin', effect: 'bless_bonus', source: 'Bard', slotLevel: 1 },
                { target: 'Goblin', effect: 'bane_penalty', source: 'OldCaster', slotLevel: 1, duration: 'concentration' },
            ],
            CAMPAIGN_NAME,
            true,
        );
    });

    it('logs save verdict passthrough (roll, total, dc, success) for the target', async () => {
        buildSaveDc.mockReturnValue(null);
        // SP-011: with buildSaveDc stubbed falsy the caster save-DC lane must bake
        // PLAYER_STATS.spellAbilities.saveDc (13) into the save log — never DC 10/11.
        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const saves = addEntry.mock.calls.filter(c => c[1]?.type === 'save_result');
        expect(saves).toHaveLength(1);
        expect(saves[0][1]).toMatchObject({
            targetName: 'Goblin',
            saveType: 'CHA',
            saveDc: PLAYER_STATS.spellAbilities.saveDc,
            success: false,
            roll: 2,
            total: 2,
        });
    });

    it.each([
        ['missing level and casting_time default (slotLevel 1, "1 action")', { name: 'Bane', range: '30 feet' }],
        ['casting_time flows through verbatim', { name: 'Bane', level: 1, casting_time: 'Bonus Action', range: '30 feet' }],
    ])('spell metadata in cast log: %s', async (_label, spell) => {
        await applyBaneEffect(spell, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const castLog = addEntry.mock.calls.find(c => c[1]?.type === 'spell' && c[1]?.targetName);
        expect(castLog[1].spellLevel).toBe(1);
        expect(castLog[1].castingTime).toBe(spell.casting_time || '1 action');

        const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(teWrite[2][0].slotLevel).toBe(1);
    });

    it('survives log-backend rejections: effect still applied, result returned, error surfaced', async () => {
        addEntry.mockImplementation(() => Promise.reject(new Error('Log failed')));
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);
        await Promise.resolve(); // flush fire-and-forget rejections

        expect(result.payload.description).toBe('1 of 1 target(s) affected by Bane.');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ target: 'Goblin', effect: 'bane_penalty' }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
