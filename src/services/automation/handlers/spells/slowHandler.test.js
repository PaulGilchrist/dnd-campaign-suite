import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

import { processSlowRepeatSave, handle } from './slowHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';
const casterName = 'Wizard1';
const targetName = 'Goblin';
const saveDc = 15;

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Slow',
        automation: { type: 'slow', ...automation },
    };
}

// ─── processSlowRepeatSave ───

describe('processSlowRepeatSave', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when no tracking data exists', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

        expect(result).toBeNull();
    });

    it('returns success popup when save succeeds', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getRuntimeValue
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(['slow'])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const result = await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('clears slow condition on successful save', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getRuntimeValue
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(['slow', 'poisoned'])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            targetName,
            'activeConditions',
            ['poisoned'],
            campaignName,
        );
    });

    it('clears tracking key on successful save', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getRuntimeValue
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(['slow'])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            casterName,
            expect.stringContaining('_slow_'),
            null,
            campaignName,
        );
    });

    it('removes slow-related target effects on successful save', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getRuntimeValue
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(['slow'])
            .mockReturnValueOnce([
                { target: targetName, effect: 'speed_halved', source: casterName },
                { target: targetName, effect: 'no_reactions', source: casterName },
                { target: targetName, effect: 'ac_penalty', source: casterName },
                { target: targetName, effect: 'dex_save_disadvantage', source: casterName },
                { target: targetName, effect: 'other_effect', source: 'OtherCaster' },
            ])
            .mockReturnValueOnce([]);

        await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            campaignName,
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ effect: 'other_effect' }),
            ]),
            campaignName,
        );
    });

    it('returns failure popup when save fails', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getRuntimeValue.mockReturnValueOnce(true);

        const result = await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('failed WIS save');
    });

    it('posts condition log entry on successful save', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getRuntimeValue
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(['slow'])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Slow',
            }),
        );
    });
});

// ─── handle ───

describe('handle - Slow spell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with no creatures message when no combat context', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context is null', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No creatures in combat');
    });

    it('excludes caster from targets', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: casterName, type: 'player' },
                { name: targetName, type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('saved');
    });

    it('applies slow condition when save fails', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('is slowed');
    });

    it('adds slow tracking key for failed save', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            casterName,
            expect.stringContaining('_slow_'),
            true,
            campaignName,
        );
    });

    it('adds expiration for slow condition', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(addExpiration).toHaveBeenCalledWith(
            casterName,
            targetName,
            expect.arrayContaining([expect.objectContaining({ type: 'condition', condition: 'slow' })]),
            campaignName,
            10,
        );
    });

    it('stores target effects for slow debuffs', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const targetEffectsCall = setRuntimeValue.mock.calls.find(
            (c) => c[1] === 'targetEffects' && Array.isArray(c[2]),
        );
        expect(targetEffectsCall).toBeDefined();
        const effects = targetEffectsCall[2];
        const effectTypes = effects.map((e) => e.effect);
        expect(effectTypes).toContain('speed_halved');
        expect(effectTypes).toContain('no_reactions');
        expect(effectTypes).toContain('ac_penalty');
        expect(effectTypes).toContain('slow_repeat_save');
    });

    it('posts condition log entry when slow is applied', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Slow',
            }),
        );
    });

    it('handles target that succeeds save', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'save-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: targetName, type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('saved');
    });
});
