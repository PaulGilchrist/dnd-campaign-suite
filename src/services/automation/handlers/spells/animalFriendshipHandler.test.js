// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

import { handle, endAnimalFriendshipEarly, isAnimalFriendshipActive } from './animalFriendshipHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Animal Friendship',
    automation: { type: 'animal_friendship', saveType: 'WIS', saveDc: 15, targetNames: ['Wolf'], ...automation },
  };
}

function setupBaseMocks(saveResult = { success: true }) {
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('animalFriendshipHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addEntry.mockResolvedValue({});
        addTargetResult.mockResolvedValue({});
    });

    describe('handle', () => {
        it('builds DC from automation config', async () => {
            setupBaseMocks({ success: true });

            await handle(makeAction({ saveDc: 18 }), makePlayerStats(), campaignName, null);

            expect(buildSaveDc).toHaveBeenCalled();
        });

        it('stores spell last attack with aoe scope', async () => {
            const { storeSpellLastAttack } = await import('../../common/damageRollback.js');
            setupBaseMocks({ success: true });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(storeSpellLastAttack).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    casterName: 'TestCaster',
                    spellName: 'Animal Friendship',
                    saveType: 'WIS',
                    saveDc: 15,
                    attackScope: 'aoe',
                }),
            );
        });

        it('returns popup when no targetNames provided', async () => {
            const result = await handle(
                makeAction({ targetNames: [] }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No creatures affected');
        });

        it('handles NPC auto-save and success', async () => {
            setupBaseMocks({ success: true });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                ],
            });
            rollSaveForCreature.mockReturnValue({
                roll: 15,
                total: 17,
                bonus: 2,
                success: true,
                rawRolls: [15],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(rollSaveForCreature).toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-animal-friendship',
                    targetName: 'Wolf',
                    success: true,
                }),
            );
        });

        it('handles player save via listener and success', async () => {
            setupBaseMocks({ success: true });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'player' },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });

        it('handles failed save: applies charmed condition', async () => {
            const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Wolf',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName,
            );
        });

        it('handles failed save: adds expiration', async () => {
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Wolf', effects: expect.arrayContaining([
                    expect.objectContaining({ type: 'charmed', condition: 'charmed' }),
                ]), campaignName });
        });

        it('handles failed save: logs condition entry', async () => {
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'condition',
                    action: 'applied',
                    condition: 'Charmed',
                    reason: 'Animal Friendship spell',
                }),
            );
        });

        it('handles failed save: logs save_result entry', async () => {
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-animal-friendship',
                    targetName: 'Wolf',
                    success: false,
                }),
            );
        });

        it('handles failed save: tracks target for early end', async () => {
            const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_animalFriendship_TestCaster_Wolf',
                true,
                campaignName,
            );
        });

        it('handles multi-target with upcast', async () => {
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                    { name: 'Hawk', type: 'npc', saveBonuses: { WIS: 1 } },
                    { name: 'Snake', type: 'npc', saveBonuses: { WIS: 0 } },
                ],
            });
            rollSaveForCreature
                .mockReturnValueOnce({ roll: 5, total: 7, bonus: 2, success: false, rawRolls: [5] })
                .mockReturnValueOnce({ roll: 8, total: 9, bonus: 1, success: false, rawRolls: [8] })
                .mockReturnValueOnce({ roll: 3, total: 3, bonus: 0, success: false, rawRolls: [3] });

            const action = makeAction({
                targetNames: ['Wolf', 'Hawk', 'Snake'],
                saveDc: 15,
            });
            action.spellSlotLevel = 3;

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('affects 3 creature');
        });

        it('limits targets to slot level (maxTargets)', async () => {
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                    { name: 'Hawk', type: 'npc', saveBonuses: { WIS: 1 } },
                    { name: 'Snake', type: 'npc', saveBonuses: { WIS: 0 } },
                ],
            });
            rollSaveForCreature
                .mockReturnValueOnce({ roll: 5, total: 7, bonus: 2, success: false, rawRolls: [5] })
                .mockReturnValueOnce({ roll: 8, total: 9, bonus: 1, success: false, rawRolls: [8] });

            const action = makeAction({
                targetNames: ['Wolf', 'Hawk', 'Snake'],
                saveDc: 15,
            });
            action.spellSlotLevel = 2;

            await handle(action, makePlayerStats(), campaignName, null);

            // Should only process 2 targets (Wolf and Hawk), not Snake
            expect(createSaveListener).toHaveBeenCalledTimes(2);
        });

        it('returns popup with summary for mixed results', async () => {
            setupBaseMocks({ success: true });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                ],
            });
            rollSaveForCreature.mockReturnValue({
                roll: 15,
                total: 17,
                bonus: 2,
                success: true,
                rawRolls: [15],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('saved');
        });

        it('handles all targets succeeding', async () => {
            setupBaseMocks({ success: true });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                ],
            });
            rollSaveForCreature.mockReturnValue({
                roll: 20,
                total: 22,
                bonus: 2,
                success: true,
                rawRolls: [20],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('saved');
            expect(addExpiration).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Wolf', 'activeConditions', expect.anything(), campaignName);
        });
    });

    describe('endAnimalFriendshipEarly', () => {
        it('removes charmed condition when ending early', async () => {
            const { setRuntimeValue, getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            getRuntimeValue.mockImplementation((store, key) => {
                if (key === '_animalFriendship_TestCaster_Wolf') return true;
                if (key === 'activeConditions') return ['charmed', 'poisoned'];
                return null;
            });

            endAnimalFriendshipEarly('TestCaster', 'Wolf', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Wolf',
                'activeConditions',
                ['poisoned'],
                campaignName,
            );
        });

        it('clears tracking key', async () => {
            const { setRuntimeValue, getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            getRuntimeValue.mockImplementation((store, key) => {
                if (key === '_animalFriendship_TestCaster_Wolf') return true;
                return null;
            });

            endAnimalFriendshipEarly('TestCaster', 'Wolf', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_animalFriendship_TestCaster_Wolf',
                null,
                campaignName,
            );
        });

        it('does nothing when spell is not active', async () => {
            const { setRuntimeValue, getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(false);

            endAnimalFriendshipEarly('TestCaster', 'Wolf', campaignName);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('logs ability_use entry when ending early', async () => {
            const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            getRuntimeValue.mockImplementation((store, key) => {
                if (key === '_animalFriendship_TestCaster_Wolf') return true;
                return null;
            });

            endAnimalFriendshipEarly('TestCaster', 'Wolf', campaignName);

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    abilityName: 'Animal Friendship',
                    description: expect.stringContaining('ends early'),
                }),
            );
        });
    });

    describe('isAnimalFriendshipActive', () => {
        it('returns true when tracking key is true', async () => {
            const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(true);

            const result = isAnimalFriendshipActive('TestCaster', 'Wolf', campaignName);

            expect(result).toBe(true);
        });

        it('returns false when tracking key is not true', async () => {
            const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(null);

            const result = isAnimalFriendshipActive('TestCaster', 'Wolf', campaignName);

            expect(result).toBe(false);
        });
    });

    describe('error handling', () => {
        it('handles addEntry rejection on ability_use log (success path)', async () => {
            setupBaseMocks({ success: true });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                ],
            });
            rollSaveForCreature.mockReturnValue({
                roll: 15,
                total: 17,
                bonus: 2,
                success: true,
                rawRolls: [15],
            });
            addEntry.mockRejectedValue(new Error('log error'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
        });

        it('handles addEntry rejection on save_result log (success path)', async () => {
            setupBaseMocks({ success: true });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                ],
            });
            rollSaveForCreature.mockReturnValue({
                roll: 15,
                total: 17,
                bonus: 2,
                success: true,
                rawRolls: [15],
            });
            addEntry.mockRejectedValue(new Error('log error'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
        });

        it('handles addEntry rejection on condition log (failure path)', async () => {
            const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);
            addEntry.mockRejectedValue(new Error('log error'));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Wolf',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName,
            );
        });

        it('handles addEntry rejection on save_result log (failure path)', async () => {
            const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            setupBaseMocks({ success: false });
            getRuntimeValue.mockReturnValue([]);
            addEntry.mockRejectedValue(new Error('log error'));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_animalFriendship_TestCaster_Wolf',
                true,
                campaignName,
            );
        });

        it('handles action without automation property', async () => {
            setupBaseMocks({ success: true });

            const action = {
                name: 'Animal Friendship',
                automation: undefined,
            };

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(buildSaveDc).toHaveBeenCalled();
        });

        it('handles targetNames without automation property', async () => {
            setupBaseMocks({ success: true });

            const action = {
                name: 'Animal Friendship',
                automation: undefined,
                targetNames: ['Wolf'],
            };

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
        });

        it('handles null activeConditions on failed save', async () => {
            const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
            setupBaseMocks({ success: false });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } },
                ],
            });
            rollSaveForCreature.mockReturnValue({
                roll: 5,
                total: 7,
                bonus: 2,
                success: false,
                rawRolls: [5],
            });
            getRuntimeValue.mockImplementation((store, key) => {
                if (key === 'activeConditions') return null;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Wolf',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName,
            );
        });
    });
});
