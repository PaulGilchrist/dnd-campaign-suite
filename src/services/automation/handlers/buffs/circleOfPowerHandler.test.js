// @maintained-by-ai: 2026-10-15 — deterministic unit tests for the circleOfPowerHandler
// public contract (handle popup, applyCircleOfPower writes/registrations, isCircleOfPowerActive).
// registerTargetEffect update/append semantics are covered directly in
// targetEffectDefinitions.test.js — here we only pin the handler's call shape.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, applyCircleOfPower, isCircleOfPowerActive } from './circleOfPowerHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'Cleric';

const action = {
    name: 'Circle of Power',
    automation: { type: 'circle_of_power' },
};

const EFFECT_TEXTS = [
    'Advantage on saving throws against spells and other magical effects',
    'No damage on a successful save vs half-damage effects',
];

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
        concentrationBonus: 2,
        ...overrides,
    };
}

function makeCombatSummary(creatureNames = []) {
    return {
        creatures: creatureNames.map((name) => ({ name })),
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('circleOfPowerHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup with all creature targets including caster, maxTargets 5', async () => {
            combatData.getCombatSummary.mockReturnValue(
                makeCombatSummary(['Cleric', 'Ally1', 'Ally2', 'Enemy1'])
            );

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Circle of Power',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2', 'Enemy1'],
                    maxTargets: 5,
                    automation: { type: 'circle_of_power' },
                }),
            });
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('No combat context found'),
                }),
            });
        });

        it('returns popup with empty creatureTargets when combat has no creatures', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([]));

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.creatureTargets).toEqual([]);
            expect(result.payload.maxTargets).toBe(5);
        });
    });

    describe('applyCircleOfPower', () => {
        beforeEach(() => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1', 'Ally2']));
            // fresh array per read — the handler mutates the returned activeBuffs array in place
            useRuntimeState.getRuntimeValue.mockImplementation(() => []);
        });

        it('returns null for invalid targetNames (empty, null, non-array) with no side effects', async () => {
            for (const targetNames of [[], null, 'Ally1']) {
                expect(await applyCircleOfPower(action, makePlayerStats(), campaignName, null, targetNames)).toBeNull();
            }
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(registerTargetEffect).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('applies the Circle of Power buff to each target and returns success popup', async () => {
            const result = await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Circle of Power',
                    automationType: 'circle_of_power',
                    description: expect.stringContaining('2 target(s)'),
                }),
            });

            for (const target of ['Ally1', 'Ally2']) {
                expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(target, 'activeBuffs', expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Circle of Power',
                        effect: 'circle_of_power',
                        duration: 'Concentration, up to 10 minutes',
                        sourceCharacter: casterName,
                    }),
                ]), campaignName);
            }
        });

        it('does not rewrite activeBuffs when the target already has the buff, but still registers the targetEffect', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((entity, key) => {
                if (key === 'activeBuffs') {
                    return [{ name: 'Circle of Power', effect: 'circle_of_power', sourceCharacter: casterName }];
                }
                return [];
            });

            await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1']);

            const buffWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeBuffs',
            );
            expect(buffWrites).toHaveLength(0);
            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally1', 'circle_of_power', casterName);
        });

        it('registers a circle_of_power targetEffect for each target', async () => {
            await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

            expect(registerTargetEffect).toHaveBeenCalledTimes(2);
            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally1', 'circle_of_power', casterName);
            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally2', 'circle_of_power', casterName);
        });

        it('registers a buff-removal expiration for each target anchored on the caster', async () => {
            await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

            expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
            for (const target of ['Ally1', 'Ally2']) {
                expect(expirations.addExpiration).toHaveBeenCalledWith({
                    attackerName: casterName,
                    targetName: target,
                    effects: [expect.objectContaining({ type: 'remove_active_buff', buffName: 'Circle of Power' })],
                    campaignName,
                    rounds: undefined,
                    expireOnCreatureName: casterName,
                });
            }
        });

        it('adds concentration for the caster with duration 10 + concentrationBonus (min 10)', async () => {
            await applyCircleOfPower(action, makePlayerStats({ concentrationBonus: 2 }), campaignName, null, ['Ally1']);
            expect(concentrationService.addConcentration).toHaveBeenCalledWith(
                expect.any(Object), casterName, 'Circle of Power', 12,
            );

            await applyCircleOfPower(action, { name: casterName }, campaignName, null, ['Ally1']);
            expect(concentrationService.addConcentration).toHaveBeenLastCalledWith(
                expect.any(Object), casterName, 'Circle of Power', 10,
            );
        });

        it('logs a spell_effect entry for each target with both effect clauses', async () => {
            await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

            expect(logService.addEntry).toHaveBeenCalledTimes(2);
            for (const target of ['Ally1', 'Ally2']) {
                expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'spell_effect',
                    characterName: casterName,
                    spellName: 'Circle of Power',
                    targetName: target,
                    effects: EFFECT_TEXTS,
                    timestamp: expect.any(Number),
                }));
            }
        });
    });

    describe('isCircleOfPowerActive', () => {
        it('returns true when a circle_of_power targetEffect exists for the target', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { effect: 'circle_of_power', target: 'Ally1', source: casterName },
                { effect: 'haste', target: 'Ally2', source: 'Wizard' },
            ]);
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(true);
            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', campaignName);
        });

        it('returns false when the target has only other effects', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { effect: 'haste', target: 'Ally1', source: 'Wizard' },
                { effect: 'foresight', target: 'Ally2', source: 'Wizard' },
            ]);
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when the circle_of_power te belongs to a different target', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { effect: 'circle_of_power', target: 'OtherPlayer', source: casterName },
            ]);
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when the targetEffects store is empty or missing', () => {
            for (const stored of [[], null, undefined]) {
                useRuntimeState.getRuntimeValue.mockReturnValue(stored);
                expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(false);
            }
        });
    });
});
