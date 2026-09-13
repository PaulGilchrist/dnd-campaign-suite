// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './patientDefenseHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(level, focusPoints, martialArtsDie = 4) {
    return {
        name: 'TestMonk',
        level,
        class: {
            class_levels: [{ level, focus_points: focusPoints, martial_arts_die: martialArtsDie }],
        },
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Patient Defense',
        description: 'Take Disengage as Bonus Action, or expend 1 Focus Point for Disengage + Dodge.',
        automation: {
            type: 'patient_defense',
            cost: { amount: 1 },
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

describe('patientDefenseHandler — insufficient focus points', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with disengage only when focus points are 0', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 0,
        });

        const action = makeAction();
        const playerStats = makePlayerStats(2, 0);
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Patient Defense');
        expect(result.payload.description).toContain('Disengage');
        expect(result.payload.description).toContain('0/1 Focus Points');
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('returns popup with disengage only for heightened version when focus points are 0', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 0,
        });

        const action = makeAction({ name: 'Heightened Patient Defense' });
        const playerStats = makePlayerStats(10, 0, 6);
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Heightened Patient Defense');
        expect(result.payload.description).toContain('Disengage');
        expect(result.payload.description).toContain('0/1 Focus Points');
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
});

// ── Tests: successful execution — base Patient Defense ────────

describe('patientDefenseHandler — base Patient Defense', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deducts focus, activates Dodge, and returns popup with remaining focus', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });

        const action = makeAction();
        const playerStats = makePlayerStats(2, 2);
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Patient Defense');
        expect(result.payload.description).toContain('Disengage and Dodge');
        expect(result.payload.description).toContain('1 Focus Points remaining');
        expect(result.payload.automation).toEqual({
            type: 'patient_defense',
            cost: { amount: 1 },
        });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
        expect(buffToggle.toggleBuff).toHaveBeenCalledWith('TestMonk', 'Dodge', {
            effect: 'dodge',
            duration: 'until_start_of_next_turn',
        }, campaignName, 'TestMonk');
        expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestMonk', targetName: 'TestMonk', effects: [
            { type: 'remove_active_buff', buffName: 'Dodge' }
        ], campaignName, rounds: undefined, expireOnCreatureName: 'TestMonk' });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Patient Defense',
            description: 'TestMonk used Patient Defense to Disengage and Dodge',
        });
    });

    it('does not toggle Dodge or add expiration if Dodge is already active', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });
        buffToggle.isBuffActive.mockReturnValue(true);

        const action = makeAction();
        const playerStats = makePlayerStats(2, 2);

        await handle(action, playerStats, campaignName);

        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);

        // Reset mock to default for subsequent tests
        buffToggle.isBuffActive.mockReset();
    });

    it('falls back to maxFocusPoints when runtime value is undefined', async () => {
        setupRuntimeMocks({});

        const action = makeAction();
        const playerStats = makePlayerStats(2, 3);
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Disengage and Dodge');
        expect(result.payload.description).toContain('2 Focus Points remaining');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 2, campaignName);
    });
});

// ── Tests: successful execution — Heightened Patient Defense ──

describe('patientDefenseHandler — heightened Patient Defense', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deducts focus, grants temp HP, and returns popup with details', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
            'TestMonk:tempHp:test-campaign': 0,
        });

        const action = makeAction({ name: 'Heightened Patient Defense' });
        const playerStats = makePlayerStats(10, 2, 6);
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Heightened Patient Defense');
        expect(result.payload.description).toContain('Disengage and Dodge');
        expect(result.payload.description).toContain('temporary hit points');
        expect(result.payload.description).toContain('1 Focus Points remaining');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'tempHp', expect.any(Number), campaignName);
        expect(buffToggle.toggleBuff).toHaveBeenCalled();
        expect(expirations.addExpiration).toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Heightened Patient Defense',
            description: expect.stringContaining('temporary hit points'),
        });
    });

    it('preserves existing temp HP when new roll is lower', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
            'TestMonk:tempHp:test-campaign': 10,
        });
        buffToggle.isBuffActive.mockReturnValue(true);

        const action = makeAction({ name: 'Heightened Patient Defense' });
        const playerStats = makePlayerStats(10, 2, 6);

        await handle(action, playerStats, campaignName);

        // Verify setRuntimeValue was called for tempHp with a value >= existing (10)
        const tempHpCalls = runtimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'tempHp',
        );
        expect(tempHpCalls.length).toBe(1);
        expect(tempHpCalls[0][2]).toBeGreaterThanOrEqual(10);

        // Reset mock to default for subsequent tests
        buffToggle.isBuffActive.mockReset();
    });
});

// ── Tests: popup payload structure ────────────────────────────

describe('patientDefenseHandler — popup payload structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes automationType in popup payload', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });

        const action = makeAction();
        const playerStats = makePlayerStats(2, 2);
        const result = await handle(action, playerStats, campaignName);

        expect(result.payload.automationType).toBe('patient_defense');
    });
});

// ── Tests: error handling ─────────────────────────────────────

describe('patientDefenseHandler — error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not throw when addEntry rejects', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });

        logService.addEntry.mockRejectedValue(new Error('log error'));

        const action = makeAction();
        const playerStats = makePlayerStats(2, 2);
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('1 Focus Points remaining');
    });
});

// ── Tests: automation config variations ───────────────────────

describe('patientDefenseHandler — automation config variations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles action without automation property', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });

        const action = { name: 'Patient Defense' };
        const playerStats = makePlayerStats(2, 2);

        await expect(handle(action, playerStats, campaignName)).rejects.toThrow();
    });

    it('handles automation without cost property (defaults to 1)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });

        const action = makeAction({ automation: {} });
        const playerStats = makePlayerStats(2, 2);
        const result = await handle(action, playerStats, campaignName);

        expect(result.payload.description).toContain('1 Focus Points remaining');
    });
});

// ── Tests: CLA-247 single FP writer ─────────────────────────────

describe('patientDefenseHandler — CLA-247 single FP writer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('focus mode spends exactly 1 FP once and popup arithmetic matches (17 → 16)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 17,
            'TestMonk:tempHp:test-campaign': 0,
        });

        const action = makeAction({ name: 'Heightened Patient Defense' });
        const playerStats = makePlayerStats(17, 17, 12);

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
            'TestMonk:focusPoints:test-campaign': 5,
        });
        const listener = vi.fn();
        window.addEventListener('focus-points-updated', listener);

        const action = makeAction();
        const playerStats = makePlayerStats(2, 5);

        await handle(action, playerStats, campaignName);

        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener('focus-points-updated', listener);
    });

    it('FP=0 reaches plain Disengage branch: logs Disengage, spends no FP, no Dodge', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 0,
        });

        const action = makeAction({ name: 'Heightened Patient Defense' });
        const playerStats = makePlayerStats(17, 17);

        const result = await handle(action, playerStats, campaignName);

        const focusWrites = runtimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'focusPoints',
        );
        expect(focusWrites).toHaveLength(0);
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        expect(result.payload.description).toContain('Disengage as a bonus action');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Heightened Patient Defense',
            description: expect.stringContaining('Disengage as a bonus action'),
        }));
    });
});
