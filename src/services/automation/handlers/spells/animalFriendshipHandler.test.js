// @maintained-by-ai
// animalFriendshipHandler lane (#1858). DISTINCT spell from animalShapes (#1859-#1861) —
// charm/friend here, polymorph family there; no shared coverage.
// Pins this handler's delegation contract only: savePrompt, damageRollback, expirations,
// logService and runtime-store internals are owned by their own suites.
// Lanes:
//   handle — config guards (no targets / no automation), storeSpellLastAttack aoe pin,
//     NPC auto-roll (positional args → sendSaveResult + save_result log), player listener
//     lane (never auto-rolled), failed-save writes (charmed state, addTargetResult,
//     SP-002 24h rounds expiration, condition + save_result logs, campaign tracking key),
//     slot-level target cap (lv2 caps at 2 and never touches Snake; lv3 scales to 3),
//     SP-002 multi-Beast adjudication, all-saved no-side-effect guard.
//   endEarly — charmed strip preserving others, tracking-key clear, inactive no-op, log.
//   isActive — exact tracking-key boolean read.
//   resilience — targeted addEntry rejections (once-queue at real call sites) never block
//     state writes, later logs, or the popup.
// Deterministic: all deps mocked, saves resolve via prebuilt promises, no timers.
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
import { addTargetResult, storeSpellLastAttack } from '../../common/damageRollback.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';

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

function makeAction(automation = {}, actionOverrides = {}) {
  return {
    name: 'Animal Friendship',
    automation: { type: 'animal_friendship', saveType: 'WIS', saveDc: 15, targetNames: ['Wolf'], ...automation },
    ...actionOverrides,
  };
}

function setupBaseMocks(saveResult = { success: true }) {
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

// Auto-rolling Beast Wolf that succeeds via the listener promise.
function autoRollWolfSucceeds(roll = { roll: 15, total: 17, bonus: 2, success: true, rawRolls: [15] }) {
  setupBaseMocks({ success: true });
  getCombatContext.mockResolvedValue({ creatures: [{ name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } }] });
  rollSaveForCreature.mockReturnValue(roll);
}

// Failed save against an empty stored-conditions list.
function castFailedSave(action = makeAction()) {
  setupBaseMocks({ success: false });
  getRuntimeValue.mockReturnValue([]);
  return handle(action, makePlayerStats(), campaignName, null);
}

describe('animalFriendshipHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Neutral defaults: mockClear keeps mockReturnValue impls, so reset the
    // stateful mocks explicitly to prevent cross-lane leakage.
    buildSaveDc.mockReturnValue(15);
    getRuntimeValue.mockReturnValue(undefined);
    getCombatContext.mockResolvedValue(undefined);
    rollSaveForCreature.mockReset();
    addEntry.mockResolvedValue({});
    addTargetResult.mockResolvedValue({});
  });

  describe('handle', () => {
    it('returns popup when no targetNames provided', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction({ targetNames: [] }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No creatures affected by Animal Friendship. 0 creature(s) saved.');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('handles action without automation property (no crash, popup returned)', async () => {
      setupBaseMocks({ success: true });

      const result = await handle({ name: 'Animal Friendship', automation: undefined }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, expect.objectContaining({ name: 'TestCaster' }));
    });

    it('stores spell last attack with aoe scope', async () => {
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

    it('NPC lane: auto-rolls the save, dispatches the result, logs save_result', async () => {
      autoRollWolfSucceeds();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith({ name: 'Wolf', type: 'npc', saveBonuses: { WIS: 2 } }, 'WIS', 15, false, false);
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Wolf', {
        promptId: 'test-prompt-id',
        success: true,
        roll: 15,
        total: 17,
        saveBonus: 2,
        rawRolls: [15],
      });
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

    it('player lane: resolves via save listener, never auto-rolls', async () => {
      setupBaseMocks({ success: true });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Wolf', type: 'player' }] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Wolf',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        condition: 'charmed',
      }));
      expect(rollSaveForCreature).not.toHaveBeenCalled();
      expect(result.type).toBe('popup');
    });

    it('failed save: writes charmed condition to target store', async () => {
      await castFailedSave();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Wolf',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
    });

    it('failed save: handles null activeConditions (|| [] guard)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Wolf',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('failed save: records addTargetResult delegation with zero damage', async () => {
      await castFailedSave();

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Wolf',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['charmed'],
        appliedDamage: 0,
      });
    });

    it('failed save: adds SP-002 24h expiration on the hours×600 rounds clock', async () => {
      await castFailedSave();

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Wolf',
        effects: expect.arrayContaining([expect.objectContaining({ type: 'charmed', condition: 'charmed' })]),
        campaignName,
        rounds: 24 * 60 * 10,
      });
    });

    it('failed save: logs condition entry', async () => {
      await castFailedSave();

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Wolf',
          condition: 'Charmed',
          reason: 'Animal Friendship spell',
        }),
      );
    });

    it('failed save: logs save_result entry', async () => {
      await castFailedSave();

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          rollType: 'save-animal-friendship',
          targetName: 'Wolf',
          saveDc: 15,
          success: false,
        }),
      );
    });

    it('failed save: tracks target for early end under exact campaign key', async () => {
      await castFailedSave();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        '_animalFriendship_TestCaster_Wolf',
        true,
        campaignName,
      );
    });

    it('lv2 slot caps targets at 2 and never processes Snake', async () => {
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

      const action = makeAction(
        { targetNames: ['Wolf', 'Hawk', 'Snake'], saveDc: 15 },
        { spellSlotLevel: 2 },
      );

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(rollSaveForCreature).toHaveBeenCalledTimes(2);
      expect(addEntry.mock.calls.some(c => c[1]?.targetName === 'Snake')).toBe(false);
    });

    it('lv3 slot lifts the cap and charms all three targets', async () => {
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

      const action = makeAction(
        { targetNames: ['Wolf', 'Hawk', 'Snake'], saveDc: 15 },
        { spellSlotLevel: 3 },
      );

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(3);
      expect(rollSaveForCreature).toHaveBeenCalledTimes(3);
      expect(result.payload.description).toContain('affects 3 creature');
    });

    it('SP-002: lv2 slot adjudicates two Beasts with own saves and charms on fails', async () => {
      setupBaseMocks({ success: false });
      buildSaveDc.mockReturnValue(17);
      getRuntimeValue.mockReturnValue([]);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Wolf 1', type: 'npc', saveBonuses: { WIS: 2 } },
          { name: 'Wolf 2', type: 'npc', saveBonuses: { WIS: 1 } },
        ],
      });
      rollSaveForCreature
        .mockReturnValueOnce({ roll: 5, total: 7, bonus: 2, success: false, rawRolls: [5] })
        .mockReturnValueOnce({ roll: 8, total: 9, bonus: 1, success: false, rawRolls: [8] });

      const action = makeAction(
        { targetNames: ['Wolf 1', 'Wolf 2'], saveDc: 17 },
        { spellSlotLevel: 2 },
      );

      const result = await handle(action, makePlayerStats(), campaignName, null);

      // One save listener + one NPC auto-roll + one ability_use per Beast
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(rollSaveForCreature).toHaveBeenCalledTimes(2);
      const abilityUses = addEntry.mock.calls.filter(c => c[1]?.type === 'ability_use');
      expect(abilityUses.length).toBe(2);
      const saveResults = addEntry.mock.calls.filter(c => c[1]?.type === 'save_result');
      expect(saveResults.length).toBe(2);
      expect(saveResults.map(c => c[1].targetName).sort()).toEqual(['Wolf 1', 'Wolf 2']);
      expect(saveResults.every(c => c[1].saveDc === 17 && c[1].success === false)).toBe(true);
      expect(result.payload.description).toContain('affects 2 creature');
    });

    it('all saves succeed: no charmed state, records success addResult', async () => {
      autoRollWolfSucceeds({ roll: 20, total: 22, bonus: 2, success: true, rawRolls: [20] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('saved');
      expect(addExpiration).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Wolf', 'activeConditions', expect.anything(), campaignName);
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Wolf',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });
  });

  describe('endAnimalFriendshipEarly', () => {
    it('removes charmed condition when ending early', () => {
      getRuntimeValue.mockImplementation((store, key) => {
        if (key === '_animalFriendship_TestCaster_Wolf') return true;
        if (key === 'activeConditions') return ['charmed', 'poisoned'];
        return null;
      });

      endAnimalFriendshipEarly('TestCaster', 'Wolf', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('Wolf', 'activeConditions', ['poisoned'], campaignName);
    });

    it('clears tracking key', () => {
      getRuntimeValue.mockImplementation((store, key) => {
        if (key === '_animalFriendship_TestCaster_Wolf') return true;
        return null;
      });

      endAnimalFriendshipEarly('TestCaster', 'Wolf', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_animalFriendship_TestCaster_Wolf', null, campaignName);
    });

    it('does nothing when spell is not active', () => {
      getRuntimeValue.mockReturnValue(false);

      endAnimalFriendshipEarly('TestCaster', 'Wolf', campaignName);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('logs ability_use entry when ending early', () => {
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
    it('returns true only when the exact tracking key is strictly true', () => {
      getRuntimeValue.mockReturnValue(true);

      expect(isAnimalFriendshipActive('TestCaster', 'Wolf', campaignName)).toBe(true);
      expect(getRuntimeValue).toHaveBeenCalledWith('campaign', '_animalFriendship_TestCaster_Wolf', campaignName);
    });

    it('returns false when tracking key is not strictly true', () => {
      getRuntimeValue.mockReturnValue(null);

      expect(isAnimalFriendshipActive('TestCaster', 'Wolf', campaignName)).toBe(false);
    });
  });

  describe('log rejection resilience', () => {
    it('ability_use rejection mid-success-path still returns popup and logs save_result', async () => {
      autoRollWolfSucceeds();
      addEntry.mockRejectedValueOnce(new Error('log error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ type: 'save_result', success: true }),
      );
    });

    it('condition-log rejection mid-failure-path still writes state and logs save_result', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      // Call order: ability_use (resolve), condition (reject), save_result (resolve).
      addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('log error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('Wolf', 'activeConditions', ['charmed'], campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_animalFriendship_TestCaster_Wolf', true, campaignName);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ type: 'save_result', success: false }),
      );
    });
  });
});
