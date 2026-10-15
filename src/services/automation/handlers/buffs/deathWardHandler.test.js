// @maintained-by-ai
// Unit tests for the Death Ward automation handler (popup builder, buff applier, active-check).
// Deterministic: only stable service boundaries are mocked (runtime store, log, combat summary,
// range parser, map resolver) and the handler is pure over them. Other suites (contextBuilder-sync,
// CharSummary, handlePlayerSaveDamage) mock this module — this file is the only direct coverage of
// its exports, so it stays self-contained and needs no churn when consumers change.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyDeathWard, isDeathWardActive } from './deathWardHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../../services/ui/logService.js';
import * as rangeValidation from '../../../../services/rules/combat/rangeValidation.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as combatData from '../../../../services/encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

const PLAYER_NAME = 'Cleric1';
const CAMPAIGN_NAME = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return { name: PLAYER_NAME, ...overrides };
}

function makeAction(overrides = {}) {
    return {
        name: 'Death Ward',
        spell: {
            name: 'Death Ward',
            range: 'Touch',
            duration: '8 hours',
            ...overrides.spell,
        },
        automation: {
            type: 'death_ward',
            target: 'willing_creature',
            duration: '8 hours',
            casting_time: '1 action',
            range: 'Touch',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function emptyBuffs() {
    runtimeState.getRuntimeValue.mockImplementation((_charName, key) =>
        key === 'activeBuffs' ? [] : undefined);
}

// ─── handle ───

describe('deathWardHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Distinct non-zero value so the payload assertion proves rangeFt is plumbed
        // through from rangeToFeet, not a coincidental default.
        rangeValidation.rangeToFeet.mockReturnValue(5);
        targetResolver.resolveMapPositions.mockResolvedValue(null);
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });
    });

    it('returns death_ward_target_selection popup with full payload', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Cleric1' }, { name: 'Fighter1' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload).toEqual(expect.objectContaining({
            type: 'death_ward_target_selection',
            name: 'Death Ward',
            creatureTargets: ['Cleric1', 'Fighter1'],
            range: 'Touch',
            rangeFt: 5,
            duration: '8 hours',
            attackerPos: null,
        }));
        // No map supplied → positions are never resolved.
        expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });

    it('reads range and duration from the spell, defaulting to Touch / 8 hours', async () => {
        const withSpell = await handle(
            makeAction({ spell: { range: '60 feet', duration: '1 minute' } }),
            makePlayerStats(), CAMPAIGN_NAME, null, [],
        );
        expect(withSpell.payload.range).toBe('60 feet');
        expect(withSpell.payload.duration).toBe('1 minute');

        // Missing or null spell falls back to defaults.
        for (const action of [{ name: 'Death Ward' }, { name: 'Death Ward', spell: null }]) {
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null, []);
            expect(result.payload.range).toBe('Touch');
            expect(result.payload.duration).toBe('8 hours');
        }
    });

    it('returns empty creatureTargets when combat summary is missing or has no creatures', async () => {
        for (const summary of [null, undefined, {}]) {
            combatData.getCombatSummary.mockReturnValue(summary);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []);

            expect(result.payload.creatureTargets).toEqual([]);
        }
    });

    it('resolves and forwards attacker position when a map is supplied', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);

        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(CAMPAIGN_NAME, 'test-map', PLAYER_NAME);
        expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });

        // Resolver finding no position must not break the popup.
        targetResolver.resolveMapPositions.mockResolvedValue(null);

        const withoutPos = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map', []);

        expect(withoutPos.payload.attackerPos).toBeNull();
    });
});

// ─── applyDeathWard ───

describe('deathWardHandler.applyDeathWard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        logService.addEntry.mockResolvedValue(undefined);
        emptyBuffs();
    });

    it('returns null for missing, empty, or non-array targetNames', async () => {
        for (const targetNames of [null, undefined, [], 'Fighter1']) {
            const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, targetNames);

            expect(result).toBeNull();
        }
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('adds a death_ward buff to the target and returns automation_info popup', async () => {
        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter1', 'activeBuffs', CAMPAIGN_NAME);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Fighter1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Death Ward',
                    effect: 'death_ward',
                    duration: '8 hours',
                    sourceCharacter: PLAYER_NAME,
                }),
            ]),
            CAMPAIGN_NAME,
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Death Ward');
        expect(result.payload.description).toBe('Fighter1 gained Death Ward protection from Death Ward.');
    });

    it('logs an ability_use entry with exact description per target', async () => {
        await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1', 'Ranger1']);

        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        const logCalls = logService.addEntry.mock.calls;
        expect(logCalls[0][0]).toBe(CAMPAIGN_NAME);
        expect(logCalls[0][1]).toEqual({
            type: 'ability_use',
            characterName: PLAYER_NAME,
            abilityName: 'Death Ward',
            description: `${PLAYER_NAME} cast Death Ward on Fighter1. Target is protected from death.`,
        });
        expect(logCalls[1][1].description).toBe(`${PLAYER_NAME} cast Death Ward on Ranger1. Target is protected from death.`);
    });

    it('skips targets that already have Death Ward but still logs the cast', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'Fighter1' && key === 'activeBuffs') {
                return [{ name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'OtherCleric' }];
            }
            return key === 'activeBuffs' ? [] : undefined;
        });

        const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1', 'Ranger1']);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ranger1', 'activeBuffs', expect.any(Array), CAMPAIGN_NAME);
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(result.payload.description).toContain('2 targets');
        expect(result.payload.description).toContain('Fighter1, Ranger1');
    });

    it('coerces null or non-array activeBuffs to a list before appending', async () => {
        for (const corrupt of [null, 'invalid', 0]) {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) =>
                key === 'activeBuffs' ? corrupt : undefined);

            const result = await applyDeathWard(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1']);

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Fighter1',
                'activeBuffs',
                [expect.objectContaining({ name: 'Death Ward', effect: 'death_ward' })],
                CAMPAIGN_NAME,
            );
            runtimeState.setRuntimeValue.mockClear();
        }
    });

    it('uses spell duration when present and defaults to 8 hours without a spell', async () => {
        await applyDeathWard(
            makeAction({ spell: { duration: '1 hour' } }),
            makePlayerStats(), CAMPAIGN_NAME, null, ['Fighter1'],
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Fighter1',
            'activeBuffs',
            expect.arrayContaining([expect.objectContaining({ duration: '1 hour' })]),
            CAMPAIGN_NAME,
        );

        const result = await applyDeathWard({ name: 'Death Ward' }, makePlayerStats(), CAMPAIGN_NAME, null, ['Ranger1']);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ranger1',
            'activeBuffs',
            expect.arrayContaining([expect.objectContaining({ duration: '8 hours' })]),
            CAMPAIGN_NAME,
        );
        expect(result.payload.name).toBe('Death Ward');
    });
});

// ─── isDeathWardActive ───

describe('deathWardHandler.isDeathWardActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when a Death Ward / death_ward buff is active', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Mage Armor', effect: 'mage_armor' },
            { name: 'Death Ward', effect: 'death_ward', duration: '8 hours' },
        ]);

        expect(isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(PLAYER_NAME, 'activeBuffs', CAMPAIGN_NAME);
    });

    it('requires both name AND effect to match', () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { name: 'Death Ward', effect: 'shield_of_faith' },
            { name: 'Some Other Buff', effect: 'death_ward' },
        ]);

        expect(isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false for empty, missing, or malformed buff lists', () => {
        for (const stored of [[], null, undefined, 'invalid', [{ name: 'Mage Armor', effect: 'mage_armor' }]]) {
            runtimeState.getRuntimeValue.mockReturnValue(stored);

            expect(isDeathWardActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
        }
    });
});
