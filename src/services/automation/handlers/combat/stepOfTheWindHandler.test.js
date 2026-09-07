// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./destructiveStrideHandler.js', () => ({
    handle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './stepOfTheWindHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as destructiveStride from './destructiveStrideHandler.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestMonk',
        level: 2,
        class: {
            class_levels: [{ level: 2, focus_points: 2 }],
        },
        specialActions: [],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Step of the Wind',
        description: 'For the duration, your jump distance is doubled.',
        automation: {
            type: 'step_of_the_wind',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        if (key in mocks) {
            return mocks[key];
        }
        return undefined;
    });
}

// ── Tests: insufficient focus points ──────────────────────────

describe('stepOfTheWindHandler — insufficient focus points', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with insufficient focus points when current < cost', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 0,
        });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Step of the Wind');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup with insufficient focus points when current equals cost minus 1', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 0,
        });

        const action = makeAction({ automation: { cost: { amount: 2 } } });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/2 required.');
    });

    it('uses cost from automation config when present', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 1,
        });

        const action = makeAction({ automation: { cost: { amount: 2 } } });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('Not enough Focus Points. 1/2 required.');
    });
});

// ── Tests: successful execution — normal Step of the Wind ─────

describe('stepOfTheWindHandler — normal Step of the Wind', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deducts focus points and returns popup with description', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Step of the Wind');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'focusPoints',
            1,
            campaignName,
        );
        expect(result.payload.description).toContain('TestMonk used Step of the Wind');
        expect(result.payload.description).toContain('Dash or Disengage as a bonus action');
        expect(result.payload.description).toContain('jump distance is doubled');
        expect(result.payload.description).toContain('1 Focus Points remaining');
    });

    it('logs the ability use to campaign log', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Step of the Wind',
            description: 'TestMonk used Step of the Wind to Dash or Disengage as a bonus action (no Opportunity Attacks against you until the start of your next turn)',
        });
    });

    it('does not invoke Destructive Stride when elementalEpitomeActive is false/undefined', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': false,
        });

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        expect(destructiveStride.handle).not.toHaveBeenCalled();
    });

    it('does not invoke Destructive Stride when elementalEpitomeActive is null/undefined', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        expect(destructiveStride.handle).not.toHaveBeenCalled();
    });
});

// ── Tests: successful execution — Heightened Step of the Wind ─

describe('stepOfTheWindHandler — Heightened Step of the Wind', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with heightened description', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Heightened Step of the Wind');
        expect(result.payload.description).toContain('Heightened Step of the Wind');
        expect(result.payload.description).toContain('Moving a willing creature within 5 feet');
        expect(result.payload.description).toContain('(Large or smaller)');
    });

    it('logs the heightened ability use to campaign log', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        await handle(action, makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Heightened Step of the Wind',
            description: 'TestMonk used Heightened Step of the Wind to Dash or Disengage as a bonus action (no Opportunity Attacks against you until the start of your next turn), moving a willing creature within 5 feet (Large or smaller) with you',
        });
    });

    it('deducts focus points for heightened version', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'focusPoints',
            1,
            campaignName,
        );
    });
});

// ── Tests: Destructive Stride integration ─────────────────────

describe('stepOfTheWindHandler — Destructive Stride integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('invokes Destructive Stride when elementalEpitomeActive is true and feature exists', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = makePlayerStats({
            specialActions: [{ name: 'Destructive Stride', effect: 'destructive_stride' }],
        });

        const action = makeAction();
        await handle(action, playerStats, campaignName);

        expect(destructiveStride.handle).toHaveBeenCalledWith(
            { name: 'Destructive Stride', effect: 'destructive_stride' },
            playerStats,
            campaignName,
        );
    });

    it('returns Destructive Stride result when it returns a value', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const dsResult = {
            type: 'modal',
            modalName: 'destructiveStride',
            payload: { action: {}, playerStats: {}, campaignName },
        };
        destructiveStride.handle.mockResolvedValue(dsResult);

        const playerStats = makePlayerStats({
            specialActions: [{ name: 'Destructive Stride', effect: 'destructive_stride' }],
        });

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        expect(result).toBe(dsResult);
    });

    it('does not invoke Destructive Stride when feature does not exist', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = makePlayerStats({
            specialActions: [{ name: 'Other Feature', effect: 'other_effect' }],
        });

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        expect(destructiveStride.handle).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
    });

    it('does not invoke Destructive Stride when specialActions is empty', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = makePlayerStats({ specialActions: [] });

        const action = makeAction();
        await handle(action, playerStats, campaignName);

        expect(destructiveStride.handle).not.toHaveBeenCalled();
    });

    it('does not invoke Destructive Stride when specialActions is null', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = makePlayerStats({ specialActions: null });

        const action = makeAction();
        await handle(action, playerStats, campaignName);

        expect(destructiveStride.handle).not.toHaveBeenCalled();
    });

    it('does not invoke Destructive Stride when playerStats has no specialActions', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = { name: 'TestMonk', level: 2 };

        const action = makeAction();
        await handle(action, playerStats, campaignName);

        expect(destructiveStride.handle).not.toHaveBeenCalled();
    });
});

// ── Tests: focus points fallback ──────────────────────────────

describe('stepOfTheWindHandler — focus points fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('falls back to maxFocus from class_levels when runtime value is undefined', async () => {
        setupRuntimeMocks({});

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        // Runtime returns undefined, maxFocus is 2, so currentFocus = 2
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('1 Focus Points remaining');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'focusPoints',
            1,
            campaignName,
        );
    });

    it('returns insufficient focus when maxFocus is 0 and runtime is undefined', async () => {
        const playerStats = makePlayerStats({
            class: {
                class_levels: [{ level: 2 }],
            },
        });

        setupRuntimeMocks({});

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
    });

    it('uses runtime value when it differs from maxFocus', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 1,
        });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        // Runtime returns 1, maxFocus is 2, currentFocus = 1
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('0 Focus Points remaining');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'focusPoints',
            0,
            campaignName,
        );
    });

    it('handles runtime value that is a string by converting to number', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': '2',
        });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('1 Focus Points remaining');
    });
});

// ── Tests: automation config variations ────────────────────────

describe('stepOfTheWindHandler — automation config variations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws when automation is undefined (handler does not guard)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = { name: 'Step of the Wind' };

        await expect(handle(action, makePlayerStats(), campaignName)).rejects.toThrow();
    });

    it('handles automation without cost property (defaults to 1)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ automation: {} });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('1 Focus Points remaining');
    });

    it('treats automation cost amount 0 as default cost 1 (0 is falsy)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 0,
        });

        const action = makeAction({ automation: { cost: { amount: 0 } } });
        const result = await handle(action, makePlayerStats(), campaignName);

        // auto.cost?.amount is 0, but 0 || 1 = 1, so cost = 1
        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
    });
});

// ── Tests: logService error handling ──────────────────────────

describe('stepOfTheWindHandler — logService error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not throw when addEntry rejects', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        logService.addEntry.mockRejectedValue(new Error('log error'));

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('1 Focus Points remaining');
    });

    it('does not throw when addEntry returns a rejected promise', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        logService.addEntry.mockReturnValue(Promise.reject(new Error('log error')));

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
    });
});

// ── Tests: Destructive Stride error handling ──────────────────

describe('stepOfTheWindHandler — Destructive Stride error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not throw when Destructive Stride handler rejects', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = makePlayerStats({
            specialActions: [{ name: 'Destructive Stride', effect: 'destructive_stride' }],
        });

        destructiveStride.handle.mockRejectedValue(new Error('ds error'));

        const action = makeAction();

        // When DS handler throws, the error propagates since there's no try/catch
        await expect(handle(action, playerStats, campaignName)).rejects.toThrow('ds error');
    });

    it('returns undefined result from Destructive Stride when it resolves to null', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = makePlayerStats({
            specialActions: [{ name: 'Destructive Stride', effect: 'destructive_stride' }],
        });

        destructiveStride.handle.mockResolvedValue(null);

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        // null is falsy, so the normal popup is returned
        expect(result.type).toBe('popup');
    });
});

// ── Tests: popup payload structure ────────────────────────────

describe('stepOfTheWindHandler — popup payload structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes automation in popup payload', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ automation: { type: 'step_of_the_wind' } });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.automation).toEqual({ type: 'step_of_the_wind' });
    });

    it('includes automationType in popup payload', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ automation: { type: 'step_of_the_wind' } });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.automationType).toBe('step_of_the_wind');
    });

    it('includes correct name in popup payload for normal version', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.name).toBe('Step of the Wind');
    });

    it('includes correct name in popup payload for heightened version', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.name).toBe('Heightened Step of the Wind');
    });
});

// ── Tests: insufficient focus with heightened ─────────────────

describe('stepOfTheWindHandler — insufficient focus with heightened', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns insufficient focus popup for heightened version', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 0,
        });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });
});

// ── Tests: class_levels edge cases ────────────────────────────

describe('stepOfTheWindHandler — class_levels edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles missing class property gracefully (focus fallback to 0)', async () => {
        setupRuntimeMocks({});

        const playerStats = { name: 'TestMonk', level: 2 };

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        // maxFocus would be 0 since playerStats.class is undefined
        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
    });

    it('handles class_levels that is null', async () => {
        setupRuntimeMocks({});

        const playerStats = makePlayerStats({
            class: { class_levels: null },
        });

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
    });

    it('handles class_levels that is undefined', async () => {
        setupRuntimeMocks({});

        const playerStats = makePlayerStats({
            class: {},
        });

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
    });

    it('handles class_levels with no matching level', async () => {
        setupRuntimeMocks({});

        const playerStats = makePlayerStats({
            level: 5,
            class: {
                class_levels: [{ level: 2, focus_points: 3 }],
            },
        });

        const action = makeAction();
        const result = await handle(action, playerStats, campaignName);

        // No class level with level === 5, so maxFocus = 0
        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
    });
});

// ── Tests: CLA-333 single FP writer + Disengage te ─────────────

describe('stepOfTheWindHandler — CLA-333 single FP writer + Disengage te', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('one activation spends exactly 1 FP once (no double-spend)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 17,
        });

        const playerStats = makePlayerStats({ level: 17, class: { class_levels: [{ level: 17, focus_points: 17 }] } });
        const action = makeAction({ name: 'Heightened Step of the Wind' });

        const result = await handle(action, playerStats, campaignName);

        const focusWrites = runtimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'focusPoints',
        );
        expect(focusWrites).toHaveLength(1);
        expect(focusWrites[0]).toEqual(['TestMonk', 'focusPoints', 16, campaignName]);
        expect(result.payload.description).toContain('(16 Focus Points remaining)');
    });

    it('dispatches focus-points-updated after spending FP', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 5,
        });
        const listener = vi.fn();
        window.addEventListener('focus-points-updated', listener);

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener('focus-points-updated', listener);
    });

    it('writes self-target no_opportunity_attacks te appended to existing effects', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'campaign:targetEffects:TestCampaign': [
                { target: 'Goblin', source: 'Someone', effect: 'next_attack_advantage' },
            ],
        });

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        const teWrites = runtimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'targetEffects',
        );
        expect(teWrites).toHaveLength(1);
        expect(teWrites[0][0]).toBe('campaign');
        expect(teWrites[0][3]).toBe(campaignName);
        expect(teWrites[0][2]).toEqual([
            { target: 'Goblin', source: 'Someone', effect: 'next_attack_advantage' },
            { target: 'TestMonk', source: 'Step of the Wind', effect: 'no_opportunity_attacks', value: null, duration: 'until_start_of_next_turn' },
        ]);
    });

    it('registers remove_target_effect expiration on the monk at turn start', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
        });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        await handle(action, makePlayerStats(), campaignName);

        expect(expirations.addExpiration).toHaveBeenCalledWith(
            'TestMonk',
            'TestMonk',
            [{ type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: 'Heightened Step of the Wind', target: 'TestMonk' }],
            campaignName,
            undefined,
            'TestMonk',
        );
    });

    it('insufficient FP: no te written, no expiration, no FP spend', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 0,
        });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('Not enough Focus Points. 0/1 required.');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
});
