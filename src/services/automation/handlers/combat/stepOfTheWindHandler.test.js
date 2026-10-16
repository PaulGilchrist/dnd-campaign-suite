// @maintained-by-ai
// CLA-333 Option A: base Dash is a free Bonus Action, always available. Expending 1
// Focus Point is the opt-in upgrade to Disengage + Dash + doubled jump. The handler
// auto-upgrades when FP are available and falls back to the free Dash at FP<cost — it
// NEVER refuses (a Monk always gets the base free Dash).
//
// Lane: stepOfTheWind-specific gate/resources/telemetry at the source. Destructive
// Stride internals are canon in destructiveStrideHandler's own lanes — this file pins
// the DELEGATION ONLY (call args + result pass-through + epitome gate).
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
        description: 'Take Dash as Bonus Action, or expend 1 Focus Point for Disengage + Dash with doubled jump distance.',
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

// ── Tests: FP upgrade branch (FP >= cost → spend + Disengage) ─

describe('stepOfTheWindHandler — FP upgrade (spend 1 FP → Disengage + Dash)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('spends 1 FP and returns popup naming the Disengage upgrade', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 2 });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Step of the Wind');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
        expect(result.payload.description).toBe('TestMonk expended 1 Focus Point on Step of the Wind: Disengage + Dash as a bonus action, doubled jump distance. (1 Focus Points remaining).');
    });

    it('writes the self no_opportunity_attacks te on the upgrade', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'campaign:targetEffects:TestCampaign': [
                { target: 'Goblin', source: 'Someone', effect: 'next_attack_advantage' },
            ],
        });

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        const teWrites = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
        expect(teWrites).toHaveLength(1);
        expect(teWrites[0][0]).toBe('campaign');
        expect(teWrites[0][3]).toBe(campaignName);
        expect(teWrites[0][2]).toEqual([
            { target: 'Goblin', source: 'Someone', effect: 'next_attack_advantage' },
            { target: 'TestMonk', source: 'Step of the Wind', effect: 'no_opportunity_attacks', value: null, duration: 'until_start_of_next_turn' },
        ]);
    });

    it('registers remove_target_effect expiration on the monk at turn start', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 2 });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        await handle(action, makePlayerStats(), campaignName);

        expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestMonk', targetName: 'TestMonk', effects: [{ type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: 'Heightened Step of the Wind', target: 'TestMonk' }], campaignName, rounds: undefined, expireOnCreatureName: 'TestMonk' });
    });

    it('dispatches focus-points-updated after spending FP', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 5 });
        const listener = vi.fn();
        window.addEventListener('focus-points-updated', listener);

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener('focus-points-updated', listener);
    });

    it('logs the FP-spend upgrade to the campaign log', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 2 });

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Step of the Wind',
            description: 'TestMonk spent 1 Focus Point on Step of the Wind: Disengage + Dash as a bonus action (no Opportunity Attacks against you until the start of your next turn); jump distance doubled',
        });
    });
});

// ── Tests: free Dash branch (FP < cost → NEVER refused) ───────

describe('stepOfTheWindHandler — free Dash (FP < cost, Option A: never refused)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('FP=0 gives a free Dash with no FP spend and no Disengage te', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 0 });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('TestMonk used Step of the Wind: Dash as a Bonus Action (free — no Focus Point available to expend for Disengage + doubled jump).');
        expect(result.payload.description).not.toContain('Not enough Focus Points');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('FP=0 still logs the free Dash ability use', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 0 });

        const action = makeAction();
        await handle(action, makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Step of the Wind',
            description: 'TestMonk used Step of the Wind to Dash as a bonus action (free; no Focus Point available, so no Disengage or doubled jump)',
        });
    });

    it('FP below cost does not spend the available FP', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 1 });

        const action = makeAction({ automation: { cost: { amount: 2 } } });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('Dash as a Bonus Action (free');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('cost amount 0 defaults to cost 1; FP=0 → free Dash', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 0 });

        const action = makeAction({ automation: { cost: { amount: 0 } } });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('Dash as a Bonus Action (free');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('missing class / null class_levels / no matching level → maxFocus 0 → free Dash', async () => {
        setupRuntimeMocks({});
        const cases = [
            { name: 'TestMonk', level: 2 },                       // no class object
            makePlayerStats({ class: { class_levels: null } }),   // null class_levels
            makePlayerStats({ class: {} }),                       // no class_levels key
            makePlayerStats({ level: 5, class: { class_levels: [{ level: 99, focus_points: 3 }] } }), // no matching level
        ];
        for (const stats of cases) {
            const result = await handle(makeAction(), stats, campaignName);
            expect(result.payload.description).toContain('Dash as a Bonus Action (free');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        }
    });
});

// ── Tests: focus points fallback (?? maxFocus, runtime precedence) ──

describe('stepOfTheWindHandler — focus points fallback (upgrade branch)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('falls back to maxFocus from class_levels when runtime value is undefined', async () => {
        setupRuntimeMocks({});

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('(1 Focus Points remaining)');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
    });

    it('uses runtime value when it differs from maxFocus', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 1 });

        const action = makeAction();
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('(0 Focus Points remaining)');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 0, campaignName);
    });
});

// ── Tests: Heightened Step of the Wind ─────────────────────────

describe('stepOfTheWindHandler — Heightened Step of the Wind (FP upgrade)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('includes the willing-creature clause in popup and log', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 2 });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.name).toBe('Heightened Step of the Wind');
        expect(result.payload.description).toBe('TestMonk expended 1 Focus Point on Heightened Step of the Wind: Disengage + Dash as a bonus action, doubled jump distance. Moving a willing creature within 5 feet (Large or smaller) with you. (1 Focus Points remaining).');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            abilityName: 'Heightened Step of the Wind',
            description: expect.stringContaining('moving a willing creature within 5 feet (Large or smaller) with you'),
        }));
    });
});

// ── Tests: CLA-333 single FP writer ────────────────────────────

describe('stepOfTheWindHandler — CLA-333 single FP writer', () => {
    beforeEach(() => vi.clearAllMocks());

    it('one upgrade activation spends exactly 1 FP once (no double-spend)', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 17 });
        const playerStats = makePlayerStats({ level: 17, class: { class_levels: [{ level: 17, focus_points: 17 }] } });

        const action = makeAction({ name: 'Heightened Step of the Wind' });
        const result = await handle(action, playerStats, campaignName);

        const focusWrites = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'focusPoints');
        expect(focusWrites).toHaveLength(1);
        expect(focusWrites[0]).toEqual(['TestMonk', 'focusPoints', 16, campaignName]);
        expect(result.payload.description).toContain('(16 Focus Points remaining)');
    });
});

// ── Tests: Destructive Stride delegation (pin delegation only) ──
// Destructive Stride internals (epitome-gate/modal opener inside its own handle)
// are canon in destructiveStrideHandler.* lanes. These pins cover only that this
// handler reads its own epitome key, finds the feature, forwards exact args, and
// passes the result through.

describe('stepOfTheWindHandler — Destructive Stride delegation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('invokes Destructive Stride when elementalEpitomeActive is true and feature exists', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        const playerStats = makePlayerStats({
            specialActions: [{ name: 'Destructive Stride', effect: 'destructive_stride' }],
        });

        await handle(makeAction(), playerStats, campaignName);

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

        const dsResult = { type: 'modal', modalName: 'destructiveStride', payload: { action: {}, playerStats: {}, campaignName } };
        destructiveStride.handle.mockResolvedValueOnce(dsResult);

        const playerStats = makePlayerStats({
            specialActions: [{ name: 'Destructive Stride', effect: 'destructive_stride' }],
        });

        const result = await handle(makeAction(), playerStats, campaignName);
        expect(result).toBe(dsResult);
    });

    it('does not invoke Destructive Stride when epitome is false', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': false,
        });

        await handle(makeAction(), makePlayerStats(), campaignName);
        expect(destructiveStride.handle).not.toHaveBeenCalled();
    });

    it('does not invoke Destructive Stride when feature / specialActions missing or empty', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:TestCampaign': 2,
            'TestMonk:elementalEpitomeActive:TestCampaign': true,
        });

        await handle(makeAction(), makePlayerStats({ specialActions: [{ name: 'Other' }] }), campaignName);
        await handle(makeAction(), makePlayerStats({ specialActions: [] }), campaignName);
        await handle(makeAction(), makePlayerStats({ specialActions: null }), campaignName);
        expect(destructiveStride.handle).not.toHaveBeenCalled();
    });
});

// ── Tests: error handling + payload shape ──────────────────────

describe('stepOfTheWindHandler — error handling + payload shape', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not throw when addEntry rejects', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 2 });
        logService.addEntry.mockRejectedValueOnce(new Error('log error'));

        const result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('(1 Focus Points remaining)');
    });

    it('throws when automation is undefined (handler does not guard)', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 2 });
        await expect(handle({ name: 'Step of the Wind' }, makePlayerStats(), campaignName)).rejects.toThrow();
    });

    it('includes automation + automationType in popup payload', async () => {
        setupRuntimeMocks({ 'TestMonk:focusPoints:TestCampaign': 2 });
        const action = makeAction({ automation: { type: 'step_of_the_wind' } });

        const result = await handle(action, makePlayerStats(), campaignName);
        expect(result.payload.automation).toEqual({ type: 'step_of_the_wind' });
        expect(result.payload.automationType).toBe('step_of_the_wind');
    });
});
