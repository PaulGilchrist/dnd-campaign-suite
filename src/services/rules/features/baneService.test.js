// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
    automation: { type: 'bane', maxTargets: 3, ...overrides },
    ...overrides,
});

describe('triggerBaneSpell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when spell name is not "Bane"', async () => {
        const spell = { name: 'Bless', level: 1 };
        const result = await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('returns null for case variations that do not match exactly', async () => {
        // Bane is exact match; other words won't match
        const spell = { name: 'Banishment', level: 4 };
        const result = await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('calls executeHandler with correct action for Bane spell', async () => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

        const spell = makeSpell();
        const result = await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Bane',
                automation: {
                    type: 'bane',
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
        await triggerBaneSpell(spell, { slotLevel: 3 }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

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
        await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ spellSlotLevel: 2 }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('uses auto.maxTargets from spell automation', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell({ automation: { type: 'bane', maxTargets: 6 } });
        await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ maxTargets: 6 }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('uses spell.range for action range', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = makeSpell({ range: '60 feet' });
        await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ range: '60 feet' }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });

    it('returns null on executeHandler error', async () => {
        executeHandler.mockRejectedValue(new Error('Handler failed'));
        const spell = makeSpell();
        const result = await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);
        expect(result).toBeNull();
    });

    it('defaults maxTargets to 3 when no automation defined', async () => {
        executeHandler.mockResolvedValue(null);
        const spell = { name: 'Bane', level: 1, casting_time: '1 action', range: '30 feet' };
        await triggerBaneSpell(spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ maxTargets: 3 }),
            }),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
    });
});

describe('applyBaneEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns null when targetNames is null', async () => {
        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, null);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is undefined', async () => {
        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, undefined);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is empty array', async () => {
        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, []);
        expect(result).toBeNull();
    });

    it('returns null when targetNames is not an array', async () => {
        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, 'not-an-array');
        expect(result).toBeNull();
    });

    it('builds save DC from spell automation when available', async () => {
        buildSaveDc.mockReturnValue(15);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell({ automation: { type: 'bane', saveDc: 'spell_save_dc' } }), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(buildSaveDc).toHaveBeenCalled();
        expect(createSaveListener).toHaveBeenCalledWith(
            CAMPAIGN_NAME,
            expect.objectContaining({
                saveDc: 15,
                saveType: 'CHA',
                dcSuccess: 'none',
                advantage: false,
                disadvantage: false,
            }),
        );
    });

    it('SP-011: stamps the spell_save_dc token when automation has no saveDc', async () => {
        buildSaveDc.mockImplementation((auto) => (auto.saveDc === 'spell_save_dc' ? 17 : 10));
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(buildSaveDc).toHaveBeenCalledWith(
            expect.objectContaining({ saveDc: 'spell_save_dc' }),
            PLAYER_STATS,
        );
        expect(createSaveListener).toHaveBeenCalledWith(
            CAMPAIGN_NAME,
            expect.objectContaining({ saveDc: 17 }),
        );
    });

    it('falls back to the caster spell save DC when buildSaveDc returns nothing', async () => {
        buildSaveDc.mockReturnValue(null);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(createSaveListener).toHaveBeenCalledWith(
            CAMPAIGN_NAME,
            expect.objectContaining({
                saveDc: PLAYER_STATS.spellAbilities.saveDc,
            }),
        );
    });

    it('applies bane_penalty effect when target fails save', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'bane_penalty',
                    source: 'Bard',
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
                name: 'Bane',
                description: '1 of 1 target(s) affected by Bane.',
            },
        });
    });

    it('does not apply effect when target succeeds save', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: true, roll: 12, total: 12 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.any(Array),
            CAMPAIGN_NAME,
            true,
        );
    });

    it('replaces existing bane_penalty effect on re-cast', async () => {
        const existingEffects = [
            { target: 'Goblin', effect: 'bane_penalty', source: 'OldCaster', slotLevel: 1, duration: 'concentration' },
            { target: 'Goblin', effect: 'bless_bonus', source: 'Bard', slotLevel: 1 },
        ];
        getRuntimeValue.mockReturnValue(existingEffects);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 3, total: 3 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'bane_penalty',
                    source: 'Bard',
                }),
                expect.objectContaining({
                    effect: 'bless_bonus',
                }),
            ]),
            CAMPAIGN_NAME,
            true,
        );
    });

    it('handles multiple targets with mixed results', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        const result = await applyBaneEffect(
            makeSpell(),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
            ['Goblin', 'Orc', 'Skeleton'],
        );

        // Should create 3 save prompts (one per target)
        expect(createSaveListener).toHaveBeenCalledTimes(3);

        // Each call to setRuntimeValue for targetEffects should contain the bane_penalty for that target
        const effectCalls = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'targetEffects',
        );
        expect(effectCalls.length).toBe(3);

        // Check that each target got its bane_penalty effect
        for (const call of effectCalls) {
            expect(call[0]).toBe('campaign');
            expect(call[1]).toBe('targetEffects');
            expect(call[3]).toBe(CAMPAIGN_NAME);
            expect(call[4]).toBe(true);
        }

        expect(result.payload.description).toContain('3 of 3');
    });

    it('logs spell cast entry for each target', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bane' && call[1]?.targetName,
        );
        expect(spellEntries.length).toBeGreaterThanOrEqual(1);
        expect(spellEntries[0][1].description).toContain('Bard casts Bane on Goblin');
        expect(spellEntries[0][1].promptId).toBe('test-prompt-id');
    });

    it('logs save result entry for each target', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const saveEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'save_result',
        );
        expect(saveEntries.length).toBeGreaterThanOrEqual(1);
        expect(saveEntries[0][1].targetName).toBe('Goblin');
        expect(saveEntries[0][1].saveType).toBe('CHA');
        // SP-011: unstubbed buildSaveDc (cleared mock) falls back to the caster
        // spell-save-DC lane (PLAYER_STATS.spellAbilities.saveDc), never DC 10/11.
        expect(saveEntries[0][1].saveDc).toBe(PLAYER_STATS.spellAbilities.saveDc);
        expect(saveEntries[0][1].success).toBe(false);
    });

    it('logs automation entry when effect is applied', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const autoEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'automation',
        );
        expect(autoEntries.length).toBeGreaterThanOrEqual(1);
        expect(autoEntries[0][1].description).toContain('Goblin fails CHA save against Bane');
        expect(autoEntries[0][1].description).toContain('-1d4 penalty');
    });

    it('logs summary entry after all targets processed', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(
            makeSpell(),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
            ['Goblin', 'Orc'],
        );

        const summaryEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bane' && call[1]?.targets,
        );
        expect(summaryEntries.length).toBeGreaterThanOrEqual(1);
        expect(summaryEntries[0][1].targets).toEqual(['Goblin', 'Orc']);
        expect(summaryEntries[0][1].description).toContain('2 target(s) affected');
    });

    it('uses spell.level for slotLevel in effect', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell({ level: 3 }), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

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
        const spellNoLevel = { name: 'Bane', casting_time: '1 action', range: '30 feet', automation: { type: 'bane' } };
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(spellNoLevel, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

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

    it('handles mixed success/failure across multiple targets', async () => {
        getRuntimeValue.mockReturnValue([]);

        // First call (Goblin) fails, second call (Orc) succeeds
        createSaveListener.mockImplementation((campaignName, config) => {
            const saveResult = Promise.resolve(
                config.targetName === 'Goblin' ? { success: false, roll: 2, total: 2 } : { success: true, roll: 12, total: 12 }
            );
            return { promise: saveResult, promptId: 'test-prompt-id' };
        });

        const result = await applyBaneEffect(
            makeSpell(),
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
            ['Goblin', 'Orc'],
        );

        // Only Goblin should have bane_penalty
        const effectCalls = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'targetEffects',
        );
        expect(effectCalls.length).toBe(1); // Only one target failed

        const effects = effectCalls[0][2];
        expect(effects).toContainEqual(
            expect.objectContaining({ target: 'Goblin', effect: 'bane_penalty' }),
        );

        // Orc should NOT have bane_penalty
        const orcBane = effects.find(
            te => te.target === 'Orc' && te.effect === 'bane_penalty',
        );
        expect(orcBane).toBeUndefined();

        expect(result.payload.description).toContain('1 of 2');
    });

    it('logs with casting_time from spell when available', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        const spellWithCastingTime = makeSpell({ casting_time: 'Bonus Action' });
        await applyBaneEffect(spellWithCastingTime, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bane' && call[1]?.targetName,
        );
        expect(spellEntries[0][1].castingTime).toBe('Bonus Action');
    });

    it('defaults casting_time to "1 action" when not on spell', async () => {
        getRuntimeValue.mockReturnValue([]);
        const spellNoCastingTime = { name: 'Bane', level: 1, range: '30 feet', automation: { type: 'bane' } };
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(spellNoCastingTime, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bane' && call[1]?.targetName,
        );
        expect(spellEntries[0][1].castingTime).toBe('1 action');
    });

    it('handles log entry promise rejections gracefully', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        // Make addEntry reject
        addEntry.mockImplementation(() => Promise.reject(new Error('Log failed')));

        // Should not throw, just log errors
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
        const result = await applyBaneEffect(makeSpell(), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);
        consoleSpy.mockRestore();

        // Function should still return result despite log failures
        expect(result).toBeDefined();
        expect(result.payload.description).toContain('1 of 1');
    });

    it('uses slotLevel from spell for log entries', async () => {
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'test-prompt-id',
        });

        await applyBaneEffect(makeSpell({ level: 2 }), PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME, ['Goblin']);

        const spellEntries = addEntry.mock.calls.filter(
            call => call[1]?.type === 'spell' && call[1]?.spellName === 'Bane' && call[1]?.spellLevel != null,
        );
        expect(spellEntries[0][1].spellLevel).toBe(2);
    });
});
