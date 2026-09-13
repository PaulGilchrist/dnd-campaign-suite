// @improved-by-ai
// @cleaned-by-ai
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
    getCombatSummary: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, applyAuraOfLife, isAuraOfLifeActive } from './auraOfLifeHandler.js';

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

describe('auraOfLifeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup with all creature targets including caster', async () => {
            combatData.getCombatSummary.mockResolvedValue(
                makeCombatSummary(['Cleric', 'Ally1', 'Ally2', 'Enemy1'])
            );

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2', 'Enemy1'],
                    maxTargets: 5,
                    automation: { type: 'aura_of_life' },
                }),
            });
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockResolvedValue(null);

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    description: expect.stringContaining('No combat context found'),
                }),
            });
        });

        it('returns popup with empty creature list when combat has no creatures', async () => {
            combatData.getCombatSummary.mockResolvedValue(makeCombatSummary([]));

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    creatureTargets: [],
                    maxTargets: 5,
                }),
            });
        });

        it('includes automation object in popup payload', async () => {
            combatData.getCombatSummary.mockResolvedValue(
                makeCombatSummary(['Cleric'])
            );

            const customAutomation = { type: 'aura_of_life', duration: '1 minute' };
            const action = {
                name: 'Aura of Life',
                automation: customAutomation,
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual(customAutomation);
        });

        it('uses empty object when action has no automation property', async () => {
            combatData.getCombatSummary.mockResolvedValue(
                makeCombatSummary(['Cleric'])
            );

            const action = { name: 'Aura of Life' };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual({});
        });
    });

    describe('applyAuraOfLife', () => {
        it('applies buffs, HP protection, targetEffects, and expirations for each target', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1', 'Ally2']);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Life',
                    description: expect.stringContaining('2 target(s)'),
                }),
            });

            // Verify activeBuffs were set for each target
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Aura of Life',
                        effect: 'aura_of_life',
                        resistanceTypes: ['Necrotic'],
                        sourceCharacter: 'Cleric',
                    }),
                ]), campaignName);

            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally2', 'activeBuffs', expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Aura of Life',
                        effect: 'aura_of_life',
                        resistanceTypes: ['Necrotic'],
                        sourceCharacter: 'Cleric',
                    }),
                ]), campaignName);

            // Verify HP max protection flag
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally1', 'auraOfLifeHpMaxProtected', true, campaignName);
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally2', 'auraOfLifeHpMaxProtected', true, campaignName);

            // Verify turnStartEffects were updated for each target
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally1', 'turnStartEffects', expect.arrayContaining([
                    expect.objectContaining({ type: 'aura_of_life_turn_start_heal' }),
                ]), campaignName);
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally2', 'turnStartEffects', expect.arrayContaining([
                    expect.objectContaining({ type: 'aura_of_life_turn_start_heal' }),
                ]), campaignName);

            // Verify targetEffects were set on campaign entity
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Ally1',
                        effect: 'aura_of_life',
                        source: 'Cleric',
                        duration: 'concentration',
                    }),
                ]), campaignName, true);

            // Verify expirations were registered for each target
            expect(vi.mocked(expirations.addExpiration)).toHaveBeenCalledTimes(2);
            expect(vi.mocked(expirations.addExpiration))
                .toHaveBeenCalledWith({ attackerName: 'Cleric', targetName: 'Ally1', effects: expect.arrayContaining([
                    { type: 'remove_active_buff', buffName: 'Aura of Life' },
                    { type: 'aura_of_life_hp_protection_end' },
                ]), campaignName, rounds: undefined, expireOnCreatureName: 'Cleric' });

            // Verify concentration was set with correct parameters
            // Note: handler passes getCombatSummary result directly (Promise) without await
            expect(vi.mocked(concentrationService.addConcentration))
                .toHaveBeenCalledWith(
                    expect.any(Promise),
                    'Cleric',
                    'Aura of Life',
                    12
                );

            // Verify logging for each target
            expect(vi.mocked(logService.addEntry)).toHaveBeenCalledTimes(2);
            expect(vi.mocked(logService.addEntry))
                .toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'spell_effect',
                    characterName: 'Cleric',
                    spellName: 'Aura of Life',
                    targetName: 'Ally1',
                }));
        });

        it('does not duplicate buff if already active', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Aura of Life', effect: 'aura_of_life', sourceCharacter: 'Cleric' }];
                }
                return null;
            });

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1']);

            // Verify setRuntimeValue was NOT called for activeBuffs (dedup check)
            const buffSetCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(
                call => call[0] === 'Ally1' && call[1] === 'activeBuffs'
            );
            expect(buffSetCalls).toHaveLength(0);
        });

        it('does not duplicate turnStartEffect if already present', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [];
                }
                if (entity === 'Ally1' && key === 'turnStartEffects') {
                    return [{ type: 'aura_of_life_turn_start_heal', name: 'Aura of Life' }];
                }
                return null;
            });

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1']);

            // Verify turnStartEffects was NOT updated (dedup check)
            const turnEffectCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(
                call => call[0] === 'Ally1' && call[1] === 'turnStartEffects'
            );
            expect(turnEffectCalls).toHaveLength(0);
        });

        it('replaces existing targetEffect entry instead of duplicating', async () => {
            const existingEffect = {
                target: 'Ally1',
                effect: 'aura_of_life',
                source: 'Cleric',
                duration: 'concentration',
            };
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') return [];
                if (entity === 'Ally1' && key === 'turnStartEffects') return [];
                if (entity === 'campaign' && key === 'targetEffects') return [existingEffect];
                return null;
            });

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, makePlayerStats(), campaignName, null, ['Ally1']);

            // Verify targetEffects was set (replacing the existing entry)
            const teCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(
                call => call[0] === 'campaign' && call[1] === 'targetEffects'
            );
            expect(teCalls).toHaveLength(1);
            // The replacement should contain the same effect (not a duplicate)
            expect(teCalls[0][2]).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    target: 'Ally1',
                    effect: 'aura_of_life',
                    source: 'Cleric',
                }),
            ]));
        });

        it('returns null for empty target list', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, []);
            expect(result).toBeNull();
        });

        it('returns null for undefined target list', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, null);
            expect(result).toBeNull();
        });

        it('returns null for non-array target list', async () => {
            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            const result = await applyAuraOfLife(action, makePlayerStats(), campaignName, null, 'Ally1');
            expect(result).toBeNull();
        });

        it('uses playerStats.name as caster and source', async () => {
            const customStats = makePlayerStats({ name: 'HighPriest' });
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(() => null);

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, customStats, campaignName, null, ['Ally1']);

            // Verify caster name used in buff sourceCharacter
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.arrayContaining([
                    expect.objectContaining({ sourceCharacter: 'HighPriest' }),
                ]), campaignName);

            // Verify caster name used in targetEffects source
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                    expect.objectContaining({ source: 'HighPriest' }),
                ]), campaignName, true);
        });

        it('calculates concentration DC from concentrationBonus', async () => {
            const statsWithBonus = makePlayerStats({ name: 'Cleric', concentrationBonus: 5 });
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(() => null);

            const action = {
                name: 'Aura of Life',
                automation: { type: 'aura_of_life' },
            };
            await applyAuraOfLife(action, statsWithBonus, campaignName, null, ['Ally1']);

            // DC = 10 + floor(concentrationBonus) = 10 + 5 = 15
            expect(vi.mocked(concentrationService.addConcentration))
                .toHaveBeenCalledWith(
                    expect.any(Promise),
                    expect.anything(),
                    expect.anything(),
                    15
                );
        });
    });

    describe('isAuraOfLifeActive', () => {
        it('returns true when aura buff is active', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Aura of Life', effect: 'aura_of_life', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(true);
        });

        it('returns false when aura buff is not active', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Haste', effect: 'haste', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when no buffs', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when activeBuffs is null', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((_entity, key) => {
                if (key === 'activeBuffs') return null;
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when activeBuffs is undefined', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((_entity, key) => {
                if (key === 'activeBuffs') return undefined;
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when buff has different effect', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Aura of Life', effect: 'some_other_effect', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when buff has different name', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'activeBuffs') {
                    return [{ name: 'Circle of Power', effect: 'aura_of_life', sourceCharacter: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfLifeActive('Ally1', campaignName)).toBe(false);
        });
    });
});
