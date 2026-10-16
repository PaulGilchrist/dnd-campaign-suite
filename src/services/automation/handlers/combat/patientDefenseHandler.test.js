// @maintained-by-ai — deterministic pins over the patient_defense handler contract (sole FP writer,
// CLA-247): branch wording, exact FP arithmetic, Dodge toggle/expiration delegation, tempHp max-merge
// with dice stubbed, popup/log payload composition. Stable unless the handler's own composition changes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
            cost: { resource: 'focus_points', amount: 1 },
            ...overrides.automation,
        },
        ...overrides,
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        return mocks[key];
    });
}

// Handler rolls temp HP as rollDie(die) twice: floor(rand * die) + 1.
// Raw values below sit well away from roll boundaries (raw 0.9 → d6 6, 0.8 → 5, etc.).
let randomSpy = null;
function stubRolls(rawValues) {
    let i = 0;
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => rawValues[i++] ?? 0.5);
}

beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.isBuffActive.mockReturnValue(false);
});

afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
});

// ── Refuse branch: FP < cost → plain Disengage, no spend ─────

describe('patientDefenseHandler — insufficient focus (plain Disengage refusal)', () => {

    it('FP=0 base: popup Disengage-only, no FP write, no Dodge buff', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 0,
        });

        const result = await handle(makeAction(), makePlayerStats(2, 0), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Patient Defense');
        expect(result.payload.description).toBe(
            'TestMonk used Patient Defense: Disengage as a bonus action. (No Focus Points available for Dodge. 0/1 Focus Points)'
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Patient Defense',
            description: 'TestMonk used Patient Defense to Disengage as a bonus action (no Focus Points available for Dodge).',
        });
    });

    it('FP=0 heightened: refusal wording flags temp HP too, zero FP writes (CLA-247)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 0,
        });

        const result = await handle(
            makeAction({ name: 'Heightened Patient Defense' }),
            makePlayerStats(10, 0, 6),
            campaignName
        );

        expect(result.payload.name).toBe('Heightened Patient Defense');
        expect(result.payload.description).toBe(
            'TestMonk used Heightened Patient Defense: Disengage as a bonus action. (No Focus Points available for Dodge + Temporary Hit Points. 0/1 Focus Points)'
        );
        const focusWrites = runtimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'focusPoints',
        );
        expect(focusWrites).toHaveLength(0);
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Heightened Patient Defense',
            description: 'TestMonk used Heightened Patient Defense to Disengage as a bonus action (no Focus Points available for Dodge).',
        }));
    });
});

// ── Spend branch: base Patient Defense ─────────────────────────

describe('patientDefenseHandler — base Patient Defense (spend 1 FP)', () => {

    it('spends 1 FP, toggles Dodge + expiration, exact popup and log, no dice rolled', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });
        stubRolls([]);

        const result = await handle(makeAction(), makePlayerStats(2, 2), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Patient Defense');
        expect(result.payload.automationType).toBe('patient_defense');
        expect(result.payload.automation).toEqual({
            type: 'patient_defense',
            cost: { resource: 'focus_points', amount: 1 },
        });
        expect(result.payload.description).toBe(
            'TestMonk used Patient Defense: Disengage and Dodge as a bonus action. (1 Focus Points remaining).'
        );
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
        // Base branch grants no temp HP — must not roll dice.
        expect(randomSpy).not.toHaveBeenCalled();
    });

    it('does not toggle Dodge or add expiration if Dodge is already active (still spends FP)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });
        buffToggle.isBuffActive.mockReturnValue(true);

        await handle(makeAction(), makePlayerStats(2, 2), campaignName);

        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
    });

    it('falls back to class-table maxFocus when runtime focusPoints is undefined', async () => {
        setupRuntimeMocks({});

        const result = await handle(makeAction(), makePlayerStats(2, 3), campaignName);

        expect(result.payload.description).toBe(
            'TestMonk used Patient Defense: Disengage and Dodge as a bonus action. (2 Focus Points remaining).'
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 2, campaignName);
    });
});

// ── Spend branch: heightened (temp HP = 2 × martial arts die) ─

describe('patientDefenseHandler — heightened Patient Defense (temp HP)', () => {

    it('spends FP, rolls 2d6 for temp HP, exact popup + log', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
            'TestMonk:tempHp:test-campaign': 0,
        });
        stubRolls([0.9, 0.8]); // d6 rolls: 6 + 5 = 11

        const result = await handle(
            makeAction({ name: 'Heightened Patient Defense' }),
            makePlayerStats(10, 2, 6),
            campaignName
        );

        expect(result.payload.automationType).toBe('patient_defense');
        expect(result.payload.description).toBe(
            'TestMonk used Heightened Patient Defense: Disengage and Dodge as a bonus action. Gained 11 temporary hit points (2 × 6-sided die). (1 Focus Points remaining).'
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 1, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'tempHp', 11, campaignName);
        expect(buffToggle.toggleBuff).toHaveBeenCalled();
        expect(expirations.addExpiration).toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Heightened Patient Defense',
            description: 'TestMonk used Heightened Patient Defense to Disengage and Dodge with 11 temporary hit points',
        });
    });

    it('keeps higher existing temp HP when new roll is lower', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
            'TestMonk:tempHp:test-campaign': 10,
        });
        stubRolls([0.55, 0.4]); // d6 rolls: 4 + 3 = 7 < 10

        await handle(
            makeAction({ name: 'Heightened Patient Defense' }),
            makePlayerStats(10, 2, 6),
            campaignName
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'tempHp', 10, campaignName);
    });

    it('replaces existing temp HP when new roll is higher', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
            'TestMonk:tempHp:test-campaign': 10,
        });
        stubRolls([0.99, 0.99]); // d6 rolls: 6 + 6 = 12 > 10

        await handle(
            makeAction({ name: 'Heightened Patient Defense' }),
            makePlayerStats(10, 2, 6),
            campaignName
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'tempHp', 12, campaignName);
    });
});

// ── CLA-247: handler is the sole FP writer ─────────────────────

describe('patientDefenseHandler — CLA-247 single FP writer', () => {

    it('heightened spends exactly 1 FP once, popup arithmetic matches (17 → 16)', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 17,
            'TestMonk:tempHp:test-campaign': 0,
        });
        stubRolls([0.99, 0.99]); // d12 rolls: 12 + 12 = 24

        const result = await handle(
            makeAction({ name: 'Heightened Patient Defense' }),
            makePlayerStats(17, 17, 12),
            campaignName
        );

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

        await handle(makeAction(), makePlayerStats(2, 5), campaignName);

        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener('focus-points-updated', listener);
    });
});

// ── Resilience ─────────────────────────────────────────────────

describe('patientDefenseHandler — resilience', () => {

    it('does not throw when addEntry rejects — popup still returned', async () => {
        setupRuntimeMocks({
            'TestMonk:focusPoints:test-campaign': 2,
        });
        logService.addEntry.mockRejectedValueOnce(new Error('log error'));

        const result = await handle(makeAction(), makePlayerStats(2, 2), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('1 Focus Points remaining');
    });
});
