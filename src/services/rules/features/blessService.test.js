import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerBlessSpell, applyBlessEffect } from './blessService.js';

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

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';

const PLAYER_STATS = {
    name: 'Cleric',
    spellAbilities: { modifier: 3, saveDc: 15 },
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    computedStats: { saveBonuses: { WIS: 3 } },
};

const makeSpell = (overrides = {}) => ({
    name: 'Bless',
    level: 1,
    casting_time: '1 action',
    range: '30 feet',
    ...overrides,
});

describe('triggerBlessSpell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when spell name is not "Bless"', async () => {
        const spell = { name: 'Bane', level: 1 };
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('returns null for case variations that do not match exactly', async () => {
        const spell = { name: 'Blessing', level: 1 };
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('matches "bless" case-insensitively', async () => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

        const spell = { name: 'BLESS', level: 1 };
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalled();
        expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('matches "bless" lowercase', async () => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

        const spell = { name: 'bless', level: 1 };
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalled();
        expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('returns null when spell name is empty string', async () => {
        const spell = { name: '', level: 1 };
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('returns null when spell name is null', async () => {
        const spell = { name: null, level: 1 };
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('returns null when spell name is undefined', async () => {
        const spell = { level: 1 };
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('calls executeHandler with correct action for Bless spell', async () => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

        const spell = makeSpell();
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Bless',
                automation: {
                    type: 'bless',
                    range: '30 feet',
                    maxTargets: 3,
                },
                spell,
                spellSlotLevel: 1,
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
        expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('uses slotLevel from metaCtx when available', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell();
        await triggerBlessSpell(spell, { slotLevel: 3 }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ spellSlotLevel: 3 }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('uses spell.level when metaCtx slotLevel is missing', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell({ level: 2 });
        await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ spellSlotLevel: 2 }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('defaults slotLevel to 1 when neither metaCtx nor spell.level available', async () => {
        executeHandler.mockResolvedValue(null);
        const spellNoLevel = { name: 'Bless', casting_time: '1 action', range: '30 feet' };
        await triggerBlessSpell(spellNoLevel, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ spellSlotLevel: 1 }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('uses spell.range for action range', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell({ range: '60 feet' });
        await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ range: '60 feet' }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('defaults range to "30 feet" when not on spell', async () => {
        executeHandler.mockResolvedValue(null);
        const spellNoRange = { name: 'Bless', level: 1, casting_time: '1 action' };
        await triggerBlessSpell(spellNoRange, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ range: '30 feet' }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('uses auto.maxTargets from spell automation', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell({ automation: { maxTargets: 6 } });
        await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ maxTargets: 6 }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('defaults maxTargets to 3 when no automation defined', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = { name: 'Bless', level: 1, casting_time: '1 action', range: '30 feet' };
        await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ maxTargets: 3 }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('returns result from executeHandler on success', async () => {
        const expectedResult = { type: 'popup', payload: { name: 'Bless', description: '3 creatures selected' } };
        executeHandler.mockResolvedValue(expectedResult);

        const spell = makeSpell();
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result).toEqual(expectedResult);
    });

    it('returns null and logs error on executeHandler throw', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        executeHandler.mockRejectedValue(new Error('Handler failed'));

        const spell = makeSpell();
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
            '[blessSpell] Failed to execute Bless handler:',
            expect.any(Error),
        );
        consoleSpy.mockRestore();
    });

    it('returns null when executeHandler returns null', async () => {
        executeHandler.mockResolvedValue(null);

        const spell = makeSpell();
        const result = await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result).toBeNull();
    });

    it('passes metaCtx slotLevel even when spell has level', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell({ level: 2 });
        await triggerBlessSpell(spell, { slotLevel: 4 }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ spellSlotLevel: 4 }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('passes spell object in action', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell({ level: 1, casting_time: '1 action', range: '30 feet' });
        await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ spell: spell }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('includes automation.type: "bless" in action', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell();
        await triggerBlessSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ type: 'bless' }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });
});

describe('applyBlessEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns null when targetNames is null', async () => {
        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, null);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is undefined', async () => {
        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, undefined);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is empty array', async () => {
        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, []);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is not an array', async () => {
        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, 'not-an-array');
        expect(result).toBeNull();
    });

    it('returns null when targetNames is a number', async () => {
        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, 5);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is an object', async () => {
        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, { name: 'Goblin' });
        expect(result).toBeNull();
    });

    it('applies bless_bonus effect for a single target', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'bless_bonus',
                    source: 'Cleric',
                    slotLevel: 1,
                    duration: 'concentration',
                }),
            ]),
            CAMPAIGN_NAME,
            true,
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Bless',
                description: '1 of 1 target(s) blessed by Bless.',
            },
        });
    });

    it('applies bless_bonus effect for multiple targets', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await applyBlessEffect(
            makeSpell(),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
            ['Goblin', 'Orc', 'Skeleton'],
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ target: 'Goblin', effect: 'bless_bonus', source: 'Cleric' }),
                expect.objectContaining({ target: 'Orc', effect: 'bless_bonus', source: 'Cleric' }),
                expect.objectContaining({ target: 'Skeleton', effect: 'bless_bonus', source: 'Cleric' }),
            ]),
            CAMPAIGN_NAME,
            true,
        );

        expect(result.payload.description).toContain('3 of 3');
    });

    it('replaces existing bless_bonus effect from same caster on re-cast', async () => {
        const existingEffects = [
            { target: 'Goblin', effect: 'bless_bonus', source: 'OldCleric', slotLevel: 1, duration: 'concentration' },
            { target: 'Goblin', effect: 'bane_penalty', source: 'Cleric', slotLevel: 1 },
        ];
        getRuntimeValue.mockReturnValue(existingEffects);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'bless_bonus',
                    source: 'Cleric',
                    slotLevel: 1,
                }),
                expect.objectContaining({
                    effect: 'bane_penalty',
                }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
    });

    it('does not replace bless_bonus from a different caster', async () => {
        const existingEffects = [
            { target: 'Goblin', effect: 'bless_bonus', source: 'OtherCleric', slotLevel: 1, duration: 'concentration' },
        ];
        getRuntimeValue.mockReturnValue(existingEffects);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        // Should push a new entry since source differs
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'OtherCleric', effect: 'bless_bonus' }),
                expect.objectContaining({ source: 'Cleric', effect: 'bless_bonus' }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
    });

    it('uses spell.level for slotLevel in effect', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(makeSpell({ level: 3 }), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ slotLevel: 3 }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
    });

    it('defaults slotLevel to 1 when spell.level is missing', async () => {
        getRuntimeValue.mockReturnValue([]);
        const spellNoLevel = { name: 'Bless', casting_time: '1 action', range: '30 feet' };

        await applyBlessEffect(spellNoLevel, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ slotLevel: 1 }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
    });

    it('uses playerStats.name as source in effect', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.any(Array),
            CAMPAIGN_NAME,
            true,
        );

        const effectCalls = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'targetEffects',
        );
        expect(effectCalls.length).toBe(1);
        const effects = effectCalls[0][2];
        expect(effects[0].source).toBe('Cleric');
    });

    it('sets duration to "concentration" in effect', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const effectCalls = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'targetEffects',
        );
        const effects = effectCalls[0][2];
        expect(effects[0].duration).toBe('concentration');
    });

    it('logs spell cast entry for each target', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless' && call[1]?.targetName,
        );
        expect(spellEntries.length).toBeGreaterThanOrEqual(1);
        expect(spellEntries[0][1].description).toContain('Cleric casts Bless on Goblin');
        expect(spellEntries[0][1].characterName).toBe('Cleric');
        expect(spellEntries[0][1].spellName).toBe('Bless');
        expect(spellEntries[0][1].targetName).toBe('Goblin');
        expect(spellEntries[0][1].targets).toEqual(['Goblin']);
    });

    it('logs summary entry after all targets processed', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(
            makeSpell(),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
            ['Goblin', 'Orc'],
        );

        const summaryEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless' && call[1]?.targets,
        );
        expect(summaryEntries.length).toBeGreaterThanOrEqual(1);
        expect(summaryEntries[0][1].targets).toEqual(['Goblin', 'Orc']);
    });

    it('logs with casting_time from spell when available', async () => {
        getRuntimeValue.mockReturnValue([]);

        const spellWithCastingTime = makeSpell({ casting_time: 'Bonus Action' });
        await applyBlessEffect(spellWithCastingTime, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless' && call[1]?.targetName,
        );
        expect(spellEntries[0][1].castingTime).toBe('Bonus Action');
    });

    it('defaults casting_time to "1 action" when not on spell', async () => {
        getRuntimeValue.mockReturnValue([]);
        const spellNoCastingTime = { name: 'Bless', level: 1, range: '30 feet' };

        await applyBlessEffect(spellNoCastingTime, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless' && call[1]?.targetName,
        );
        expect(spellEntries[0][1].castingTime).toBe('1 action');
    });

    it('uses spell.level for spellLevel in log entries', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(makeSpell({ level: 2 }), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless' && call[1]?.spellLevel != null,
        );
        expect(spellEntries[0][1].spellLevel).toBe(2);
    });

    it('defaults spellLevel to 1 when spell.level is missing', async () => {
        getRuntimeValue.mockReturnValue([]);
        const spellNoLevel = { name: 'Bless', casting_time: '1 action', range: '30 feet' };

        await applyBlessEffect(spellNoLevel, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless' && call[1]?.spellLevel != null,
        );
        expect(spellEntries[0][1].spellLevel).toBe(1);
    });

    it('sets timestamp in log entries', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless',
        );
        for (const call of spellEntries) {
            expect(call[1].timestamp).toBeDefined();
            expect(typeof call[1].timestamp).toBe('number');
        }
    });

    it('handles log entry promise rejections gracefully', async () => {
        getRuntimeValue.mockReturnValue([]);

        addEntry.mockImplementation(() => Promise.reject(new Error('Log failed')));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);
        consoleSpy.mockRestore();

        expect(result).toBeDefined();
        expect(result.payload.description).toContain('1 of 1');
    });

    it('handles storedEffects that are not an array (converts to empty array)', async () => {
        getRuntimeValue.mockReturnValue(null);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.any(Array),
            CAMPAIGN_NAME,
            true,
        );
        const effects = setRuntimeValue.mock.calls[0][2];
        expect(effects).toContainEqual(
            expect.objectContaining({ target: 'Goblin', effect: 'bless_bonus' }),
        );
    });

    it('preserves unrelated effects when updating', async () => {
        const existingEffects = [
            { target: 'Goblin', effect: 'bane_penalty', source: 'Wizard', slotLevel: 1 },
            { target: 'Orc', effect: 'frightened', source: 'Dragon', duration: '1 minute' },
        ];
        getRuntimeValue.mockReturnValue(existingEffects);

        await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Orc']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ effect: 'bane_penalty', source: 'Wizard' }),
                expect.objectContaining({ target: 'Orc', effect: 'frightened' }),
                expect.objectContaining({ target: 'Orc', effect: 'bless_bonus', source: 'Cleric' }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
    });

    it('returns popup with correct description format', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await applyBlessEffect(
            makeSpell(),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
            ['Goblin', 'Orc', 'Skeleton', 'Troll', 'Ghoul'],
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Bless');
        expect(result.payload.description).toBe('5 of 5 target(s) blessed by Bless.');
    });

    it('works with single target in array', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await applyBlessEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(result.payload.description).toBe('1 of 1 target(s) blessed by Bless.');
    });

    it('handles targets with special characters in names', async () => {
        getRuntimeValue.mockReturnValue([]);

        await applyBlessEffect(
            makeSpell(),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
            ["Goblin's Ally", 'Orc#2', 'Dragon (Young)'],
        );

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bless' && call[1]?.targetName,
        );
        expect(spellEntries[0][1].targets).toEqual(["Goblin's Ally", 'Orc#2', 'Dragon (Young)']);
    });

    it('preserves existing effects from same target/source combo when replacing', async () => {
        const existingEffects = [
            { target: 'Goblin', effect: 'bless_bonus', source: 'Cleric', slotLevel: 1, duration: 'concentration' },
            { target: 'Other', effect: 'bane_penalty', source: 'Cleric', slotLevel: 1 },
        ];
        getRuntimeValue.mockReturnValue(existingEffects);

        await applyBlessEffect(makeSpell({ level: 2 }), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'bless_bonus',
                    source: 'Cleric',
                    slotLevel: 2,
                }),
                expect.objectContaining({
                    target: 'Other',
                    effect: 'bane_penalty',
                }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
    });
});
