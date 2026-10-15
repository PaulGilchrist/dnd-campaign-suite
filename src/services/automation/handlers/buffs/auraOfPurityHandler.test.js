// @maintained-by-ai: 2026-10-15
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

// registerTargetEffect update/append semantics are covered directly in
// targetEffectDefinitions.test.js — here we only pin the handler's call shape.
vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
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
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';
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
        it('returns popup with all creature targets and automation config', async () => {
            combatData.getCombatSummary.mockReturnValue(
                makeCombatSummary(['Cleric', 'Ally1', 'Ally2', 'Enemy1'])
            );

            const automation = {
                type: 'aura_of_purity',
                resistanceTypes: ['Poison'],
                saveAdvantageConditions: ['blinded', 'charmed'],
            };
            const result = await handle(
                { name: 'Aura of Purity', automation },
                makePlayerStats(),
                campaignName,
                null
            );

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Purity',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2', 'Enemy1'],
                    maxTargets: 5,
                    automation,
                }),
            });
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);

            const result = await handle(
                { name: 'Aura of Purity', automation: { type: 'aura_of_purity' } },
                makePlayerStats(),
                campaignName,
                null
            );

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
        it('returns null for invalid targetNames (empty, null, non-array)', async () => {
            const action = { name: 'Aura of Purity', automation: { type: 'aura_of_purity' } };

            for (const targetNames of [[], null, 'Ally1']) {
                expect(await applyAuraOfPurity(action, makePlayerStats(), campaignName, null, targetNames)).toBeNull();
            }
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('applies aura buff to target and returns popup describing the effect', async () => {
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
            expect(result.payload.description).toContain('1 target(s)');
            expect(result.payload.description).toContain('resistance to Poison damage');
            expect(result.payload.description).toContain('Advantage on saving throws');
            expect(result.payload.description).toContain('Aura of Purity');
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

            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {}, automation: { type: 'aura_of_purity' } },
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
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Aura of Purity', effect: 'aura_of_purity', sourceCharacter: 'OtherCleric' },
            ]);

            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {}, automation: { type: 'aura_of_purity' } },
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

        it('registers an aura_of_purity targetEffect for each target', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1', 'Ally2']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {}, automation: { type: 'aura_of_purity' } },
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1', 'Ally2']
            );

            expect(registerTargetEffect).toHaveBeenCalledTimes(2);
            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally1', 'aura_of_purity', casterName);
            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally2', 'aura_of_purity', casterName);
        });

        it('stores saveAdvantageConditions array for each target', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1', 'Ally2']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const conditions = ['blinded', 'charmed', 'deafened', 'frightened', 'paralyzed', 'poisoned', 'stunned'];
            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {}, automation: { type: 'aura_of_purity', saveAdvantageConditions: conditions } },
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1', 'Ally2']
            );

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'auraOfPuritySaveAdvantageConditions', conditions, campaignName);
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'auraOfPuritySaveAdvantageConditions', conditions, campaignName);
        });

        it('applies defaults (Poison resistance, empty save advantage conditions) when automation omits them', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1', 'Ally2']));
            useRuntimeState.getRuntimeValue.mockImplementation(() => []);

            // automation present but fields missing
            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {}, automation: { type: 'aura_of_purity' } },
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );
            // automation entirely missing
            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {} },
                makePlayerStats(),
                campaignName,
                null,
                ['Ally2']
            );

            const buffWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeBuffs'
            );
            expect(buffWrites).toHaveLength(2);
            expect(buffWrites.map((call) => call[0])).toEqual(['Ally1', 'Ally2']);
            for (const call of buffWrites) {
                expect(call[2]).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ resistanceTypes: ['Poison'] }),
                    ])
                );
            }
            const saveAdvWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'auraOfPuritySaveAdvantageConditions'
            );
            expect(saveAdvWrites).toHaveLength(2);
            for (const call of saveAdvWrites) {
                expect(call[2]).toEqual([]);
            }
        });

        it('registers expiration for buff removal per target', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            await applyAuraOfPurity(
                {
                    name: 'Aura of Purity',
                    spell: {},
                    automation: {
                        type: 'aura_of_purity',
                        resistanceTypes: ['Poison'],
                        saveAdvantageConditions: ['blinded'],
                    },
                },
                makePlayerStats(),
                campaignName,
                null,
                ['Ally1']
            );

            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: 'Ally1', effects: [{ type: 'remove_active_buff', buffName: 'Aura of Purity' }], campaignName, rounds: undefined, expireOnCreatureName: casterName });
        });

        it('adds concentration for each target with the caster concentration bonus', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Ally1']));
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {}, automation: { type: 'aura_of_purity' } },
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

            await applyAuraOfPurity(
                { name: 'Aura of Purity', spell: {}, automation: { type: 'aura_of_purity' } },
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

            await applyAuraOfPurity(
                {
                    name: 'Aura of Purity',
                    spell: {},
                    automation: {
                        type: 'aura_of_purity',
                        resistanceTypes: ['Poison'],
                        saveAdvantageConditions: ['blinded', 'charmed'],
                    },
                },
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
    });

    describe('isAuraOfPurityActive', () => {
        it('returns true when buffs include a matching name and effect', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Shield', effect: 'shield' },
                { name: 'Aura of Purity', effect: 'aura_of_purity' },
            ]);

            expect(isAuraOfPurityActive(casterName, campaignName)).toBe(true);
            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
                casterName,
                'activeBuffs',
                campaignName
            );
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
    });
});
