// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../ui/storage.js', () => {
    const mockStorage = {
        set: vi.fn(),
    };
    return { default: mockStorage };
});

import {
    handle,
    applyAuraOfPurity,
    getAuraOfPuritySaveAdvantageConditions,
    isAuraOfPurityActive,
} from './auraOfPurityHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';

const campaignName = 'TestCampaign';
const casterName = 'Cleric';

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

describe('auraOfPurityHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup with all creature targets including caster', async () => {
            combatData.getCombatSummary.mockReturnValue(
                makeCombatSummary(['Cleric', 'Ally1', 'Ally2', 'Enemy1'])
            );

            const action = {
                name: 'Aura of Purity',
                automation: { type: 'aura_of_purity' },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Purity',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2', 'Enemy1'],
                    maxTargets: 5,
                }),
            });
        });

        it('includes automation config in popup payload', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric']));

            const action = {
                name: 'Aura of Purity',
                automation: {
                    type: 'aura_of_purity',
                    resistanceTypes: ['Poison'],
                    saveAdvantageConditions: ['blinded', 'charmed'],
                },
            };
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual({
                type: 'aura_of_purity',
                resistanceTypes: ['Poison'],
                saveAdvantageConditions: ['blinded', 'charmed'],
            });
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);

            const action = {
                name: 'Aura of Purity',
                automation: { type: 'aura_of_purity' },
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
    });

    describe('applyAuraOfPurity', () => {
        it('returns null when targetNames is empty', async () => {
            const result = await applyAuraOfPurity(
                { name: 'Aura of Purity', automation: { type: 'aura_of_purity' } },
                makePlayerStats(),
                campaignName,
                null,
                []
            );

            expect(result).toBeNull();
        });

        it('returns null when targetNames is null', async () => {
            const result = await applyAuraOfPurity(
                { name: 'Aura of Purity', automation: { type: 'aura_of_purity' } },
                makePlayerStats(),
                campaignName,
                null,
                null
            );

            expect(result).toBeNull();
        });

        it('returns null when targetNames is not an array', async () => {
            const result = await applyAuraOfPurity(
                { name: 'Aura of Purity', automation: { type: 'aura_of_purity' } },
                makePlayerStats(),
                campaignName,
                null,
                'Ally1'
            );

            expect(result).toBeNull();
        });

        it('applies aura to a single target with correct buff and side effects', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: {
                    type: 'aura_of_purity',
                    resistanceTypes: ['Poison', 'Psychic'],
                    saveAdvantageConditions: ['blinded', 'charmed'],
                },
            };

            const result = await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.automationType).toBe('aura_of_purity');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Aura of Purity',
                        effect: 'aura_of_purity',
                        sourceCharacter: casterName,
                        resistanceTypes: ['Poison', 'Psychic'],
                    }),
                ]),
                campaignName
            );
        });

        it('preserves existing buffs when adding aura to a target', async () => {
            const existingBuffs = [
                { name: 'Shield', effect: 'shield' },
                { name: 'Mage Armor', effect: 'mage_armor' },
            ];
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue(existingBuffs);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: { type: 'aura_of_purity' },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining(
                    existingBuffs.map((b) => expect.objectContaining(b))
                ),
                campaignName
            );
        });

        it('does not duplicate aura buff when target already has it', async () => {
            const existingBuffs = [
                { name: 'Aura of Purity', effect: 'aura_of_purity', sourceCharacter: 'OtherCleric' },
            ];
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue(existingBuffs);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: { type: 'aura_of_purity' },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            const buffsCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeBuffs'
            );
            expect(buffsCalls).toHaveLength(0);
        });

        it('updates existing targetEffect entry instead of creating a duplicate', async () => {
            const existingTargetEffects = [
                { target: 'Ally1', effect: 'aura_of_purity', source: casterName, duration: 'concentration' },
            ];
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce(existingTargetEffects);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: { type: 'aura_of_purity' },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'targetEffects'
            );
            expect(effectsCall[2]).toHaveLength(1);
            expect(effectsCall[2][0].source).toBe(casterName);
            expect(effectsCall[2][0].target).toBe('Ally1');
            expect(effectsCall[2][0].effect).toBe('aura_of_purity');
        });

        it('appends new targetEffect when no existing entry for target+effect+source', async () => {
            const existingTargetEffects = [
                { target: 'Enemy1', effect: 'frightened', source: 'Cleric', duration: 'instant' },
            ];
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce(existingTargetEffects);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: { type: 'aura_of_purity' },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'targetEffects'
            );
            expect(effectsCall[2]).toHaveLength(2);
        });

        it('registers save advantage conditions for each target', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: {
                    type: 'aura_of_purity',
                    resistanceTypes: ['Poison'],
                    saveAdvantageConditions: ['blinded', 'charmed', 'deafened', 'frightened', 'paralyzed', 'poisoned', 'stunned'],
                },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'auraOfPuritySaveAdvantageConditions',
                ['blinded', 'charmed', 'deafened', 'frightened', 'paralyzed', 'poisoned', 'stunned'],
                campaignName
            );
        });

        it('sets empty save advantage conditions array when not provided in automation', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: { type: 'aura_of_purity' },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'auraOfPuritySaveAdvantageConditions',
                [],
                campaignName
            );
        });

        it('registers expiration for buff removal', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: {
                    type: 'aura_of_purity',
                    resistanceTypes: ['Poison'],
                    saveAdvantageConditions: ['blinded'],
                },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: 'Ally1', effects: [{ type: 'remove_active_buff', buffName: 'Aura of Purity' }], campaignName, rounds: undefined, expireOnCreatureName: casterName });
        });

        it('adds concentration for each target', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: { type: 'aura_of_purity' },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Cleric', 'Ally1']
            );

            expect(concentrationService.addConcentration).toHaveBeenCalledTimes(2);
            expect(concentrationService.addConcentration).toHaveBeenCalledWith(
                expect.any(Object),
                casterName,
                'Aura of Purity',
                10 + 2
            );
        });

        it('persists combatSummary to storage after adding concentration', async () => {
            const mockCombatSummary = makeCombatSummary(['Cleric', 'Ally1']);
            combatData.getCombatSummary.mockReturnValue(mockCombatSummary);
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: { type: 'aura_of_purity' },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, campaignName);
        });

        it('logs to campaign for each target', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1', 'Ally2']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: {
                    type: 'aura_of_purity',
                    resistanceTypes: ['Poison'],
                    saveAdvantageConditions: ['blinded', 'charmed'],
                },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1', 'Ally2']
            );

            expect(logService.addEntry).toHaveBeenCalledTimes(2);
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'spell_effect',
                    characterName: casterName,
                    spellName: 'Aura of Purity',
                    targetName: 'Ally1',
                })
            );
        });

        it('uses default resistanceTypes ["Poison"] when not provided', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: {
                    type: 'aura_of_purity',
                },
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        resistanceTypes: ['Poison'],
                    }),
                ]),
                campaignName
            );
        });

        it('uses default empty saveAdvantageConditions when automation is missing', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
            };

            await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        resistanceTypes: ['Poison'],
                    }),
                ]),
                campaignName
            );
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'auraOfPuritySaveAdvantageConditions',
                [],
                campaignName
            );
        });

        it('returns popup with description showing target count and hardcoded resistance/advantage text', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = {
                name: 'Aura of Purity',
                spell: {},
                automation: {
                    type: 'aura_of_purity',
                    resistanceTypes: ['Poison'],
                    saveAdvantageConditions: ['blinded', 'charmed', 'deafened', 'frightened', 'paralyzed', 'poisoned', 'stunned'],
                },
            };

            const result = await applyAuraOfPurity(
                action,
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(result.payload.description).toContain('1 target(s)');
            expect(result.payload.description).toContain('resistance to Poison damage');
            expect(result.payload.description).toContain('Advantage on saving throws');
            expect(result.payload.description).toContain('Aura of Purity');
        });
    });

    describe('getAuraOfPuritySaveAdvantageConditions', () => {
        it('returns the stored array when it is a valid array', () => {
            const conditions = ['frightened', 'poisoned'];
            useRuntimeState.getRuntimeValue.mockReturnValue(conditions);

            const result = getAuraOfPuritySaveAdvantageConditions(casterName, campaignName);

            expect(result).toBe(conditions);
            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
                casterName,
                'auraOfPuritySaveAdvantageConditions',
                campaignName
            );
        });

        it('returns an empty array for any non-array stored value', () => {
            const nonArrays = [null, undefined, 'not-an-array', 0, {}, { condition: 'frightened' }, '', true];

            for (const value of nonArrays) {
                useRuntimeState.getRuntimeValue.mockReturnValue(value);
                expect(getAuraOfPuritySaveAdvantageConditions(casterName, campaignName)).toEqual([]);
            }
        });

        it('returns an empty array when the stored value is an empty array', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([]);
            expect(getAuraOfPuritySaveAdvantageConditions(casterName, campaignName)).toEqual([]);
        });
    });

    describe('isAuraOfPurityActive', () => {
        it('returns true when activeBuffs contains a buff with matching name and effect', () => {
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Aura of Purity', effect: 'aura_of_purity' }];
                return null;
            });

            expect(isAuraOfPurityActive(casterName, campaignName)).toBe(true);
        });

        it('returns false when activeBuffs is null, undefined, non-array, empty, or has wrong name/effect', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);
            expect(isAuraOfPurityActive(casterName, campaignName)).toBe(false);

            useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
            expect(isAuraOfPurityActive(casterName, campaignName)).toBe(false);

            useRuntimeState.getRuntimeValue.mockReturnValue([]);
            expect(isAuraOfPurityActive(casterName, campaignName)).toBe(false);

            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Fire Shield', effect: 'fire_resistance' },
                { name: 'Aura of Purity', effect: 'fire_shield' },
                { name: 'Other Aura', effect: 'aura_of_purity' },
            ]);
            expect(isAuraOfPurityActive(casterName, campaignName)).toBe(false);
        });

        it('returns true when multiple buffs include the matching Aura of Purity buff', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Shield', effect: 'shield' },
                { name: 'Aura of Purity', effect: 'aura_of_purity' },
                { name: 'mage_armor', effect: 'mage_armor' },
            ]);

            expect(isAuraOfPurityActive(casterName, campaignName)).toBe(true);
        });
    });
});
