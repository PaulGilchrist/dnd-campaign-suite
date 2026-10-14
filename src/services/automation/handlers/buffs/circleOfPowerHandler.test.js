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

// ── Imports ──────────────────────────────────────────────────────

import { handle, applyCircleOfPower, isCircleOfPowerActive } from './circleOfPowerHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Cleric',
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
        it('returns popup with all creature targets including caster', async () => {
            combatData.getCombatSummary.mockResolvedValue(
                makeCombatSummary(['Cleric', 'Ally1', 'Ally2', 'Enemy1'])
            );

            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Circle of Power',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2', 'Enemy1'],
                    maxTargets: 5,
                }),
            });
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockResolvedValue(null);

            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
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
            combatData.getCombatSummary.mockResolvedValue(makeCombatSummary([]));

            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    creatureTargets: [],
                    maxTargets: 5,
                }),
            });
        });
    });

    describe('applyCircleOfPower', () => {
        it('applies buffs, targetEffects, and expirations for each target', async () => {
            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Circle of Power',
                    description: expect.stringContaining('2 target(s)'),
                }),
            });

            // Verify activeBuffs were set for each target
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Circle of Power',
                        effect: 'circle_of_power',
                        sourceCharacter: 'Cleric',
                    }),
                ]), campaignName);

            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally2', 'activeBuffs', expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Circle of Power',
                        effect: 'circle_of_power',
                        sourceCharacter: 'Cleric',
                    }),
                ]), campaignName);

            // Verify targetEffects were registered
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Ally1',
                        effect: 'circle_of_power',
                        source: 'Cleric',
                        duration: 'concentration',
                    }),
                ]), campaignName, true);

            // Verify expirations were registered
            expect(vi.mocked(expirations.addExpiration)).toHaveBeenCalledTimes(2);

            // Verify concentration was set
            expect(vi.mocked(concentrationService.addConcentration)).toHaveBeenCalled();

            // Verify logging for both targets
            expect(vi.mocked(logService.addEntry)).toHaveBeenCalledTimes(2);

            // Verify both log entries contain the correct effects
            const logCalls = vi.mocked(logService.addEntry).mock.calls;
            expect(logCalls[0][1].type).toBe('spell_effect');
            expect(logCalls[0][1].effects).toContain('Advantage on saving throws against spells and other magical effects');
            expect(logCalls[0][1].effects).toContain('No damage on a successful save vs half-damage effects');
            expect(logCalls[1][1].type).toBe('spell_effect');
            expect(logCalls[1][1].targetName).toBe('Ally2');
        });

        it('does not call setRuntimeValue for activeBuffs when buff already exists', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Circle of Power', effect: 'circle_of_power', sourceCharacter: 'Cleric' }];
                }
                return null;
            });

            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1']);

            // setRuntimeValue should NOT have been called for Ally1's activeBuffs since the buff already exists
            const buffSetCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(
                (call) => call[0] === 'Ally1' && call[1] === 'activeBuffs',
            );
            expect(buffSetCalls).toHaveLength(0);
        });

        it('returns null for empty target list', async () => {
            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await applyCircleOfPower(action, makePlayerStats(), campaignName, null, []);
            expect(result).toBeNull();
        });

        it('returns null for null target list', async () => {
            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await applyCircleOfPower(action, makePlayerStats(), campaignName, null, null);
            expect(result).toBeNull();
        });

        it('returns null for non-array target list', async () => {
            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await applyCircleOfPower(action, makePlayerStats(), campaignName, null, 'Ally1');
            expect(result).toBeNull();
        });

        it('handles single target correctly', async () => {
            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1']);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    description: expect.stringContaining('1 target(s)'),
                }),
            });

            expect(vi.mocked(expirations.addExpiration)).toHaveBeenCalledTimes(1);
            expect(vi.mocked(logService.addEntry)).toHaveBeenCalledTimes(1);
        });

        it('updates existing targetEffect instead of duplicating', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [
                        { target: 'Ally1', effect: 'circle_of_power', source: 'Cleric', duration: 'concentration' },
                    ];
                }
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [];
                }
                return null;
            });

            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            await applyCircleOfPower(action, makePlayerStats(), campaignName, null, ['Ally1']);

            // Only one targetEffects set call should exist
            const teSetCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(
                (call) => call[0] === 'campaign' && call[1] === 'targetEffects',
            );
            expect(teSetCalls).toHaveLength(1);
            expect(teSetCalls[0][2]).toHaveLength(1);
        });

        it('handles missing concentrationBonus gracefully', async () => {
            const action = {
                name: 'Circle of Power',
                automation: { type: 'circle_of_power' },
            };
            const result = await applyCircleOfPower(action, { name: 'Cleric' }, campaignName, null, ['Ally1']);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    description: expect.stringContaining('1 target(s)'),
                }),
            });

            expect(vi.mocked(concentrationService.addConcentration)).toHaveBeenCalled();
        });
    });

    describe('isCircleOfPowerActive', () => {
        it('returns true when targetEffect is active', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [
                        { effect: 'circle_of_power', target: 'Ally1', source: 'Cleric' },
                        { effect: 'haste', target: 'Ally2', source: 'Wizard' },
                    ];
                }
                return null;
            });
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(true);
        });

        it('returns false when targetEffect is not active', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [
                        { effect: 'haste', target: 'Ally1', source: 'Wizard' },
                        { effect: 'foresight', target: 'Ally2', source: 'Wizard' },
                    ];
                }
                return null;
            });
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when no target effects', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [];
                }
                return null;
            });
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when targetEffects is null', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return null;
                }
                return null;
            });
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(false);
        });

        it('checks both effect and target fields', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [
                        { effect: 'circle_of_power', target: 'OtherPlayer', source: 'Cleric' },
                    ];
                }
                return null;
            });
            expect(isCircleOfPowerActive('Ally1', campaignName)).toBe(false);
        });
    });
});
