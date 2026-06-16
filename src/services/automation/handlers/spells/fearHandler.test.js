import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './fearHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Fear',
    automation: {
      type: 'fear',
      saveType: 'WIS',
      saveDc: 13,
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  placedItems: [],
};

// ── Tests ──────────────────────────────────────────────────────

describe('fearHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Fear');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Fear has no effect');
    });

    it('should return popup when combat context has no creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Fear has no effect');
    });
  });

  describe('target processing', () => {
    it('should skip the caster itself and only target other creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      // Only 2 targets (Goblin and Orc, not TestCaster)
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(addEntry).toHaveBeenCalledTimes(2);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Fear affects 2 creature(s)');
    });

    it('should handle all targets saving successfully', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures affected by Fear');
      expect(result.payload.description).toContain('2 creature(s) saved');
    });

    it('should handle mixed save results', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(14);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        // First target fails, second target succeeds
        const success = callCount === 1 ? false : true;
        return {
          promptId: `fear-prompt-${callCount}`,
          promise: Promise.resolve({ success }),
        };
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Fear affects 1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });

    it('should call buildSaveDc with action automation and playerStats', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 15 });

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-dc',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });

    it('should call createSaveListener with correct config for each target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-config',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      // Called twice for Goblin and Orc
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 13,
        dcSuccess: 'none',
      });
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Orc',
        saveType: 'WIS',
        saveDc: 13,
        dcSuccess: 'none',
      });
    });

    it('should call addEntry with ability_use type for each target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-log',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Fear',
        description: 'TestCaster casts Fear! Goblin must make a WIS save (DC 13) or drop what it\'s holding and become Frightened.',
        promptId: 'fear-prompt-log',
      });
    });

    it('should use action.name in log entries', async () => {
      const ps = makePlayerStats();
      const action = { name: 'My Fear', automation: { type: 'fear', saveType: 'WIS', saveDc: 13 } };

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-name',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'My Fear',
        description: 'TestCaster casts Fear! Goblin must make a WIS save (DC 13) or drop what it\'s holding and become Frightened.',
        promptId: 'fear-prompt-name',
      });
    });
  });

  describe('failed save handling', () => {
    it('should add Frightened condition to target that fails save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['Stunned']);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-cond',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['Stunned', 'frightened'],
        campaignName,
      );
    });

    it('should remove existing Frightened condition before re-adding', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['frightened', 'Stunned']);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-dedup',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      // Should only have one 'frightened' in the array
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['Stunned', 'frightened'],
        campaignName,
      );
    });

    it('should call postLogEntry on failed save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-log-entry',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Frightened',
        reason: 'Fear spell',
        note: expect.stringContaining('Goblin drops what it was holding'),
        timestamp: expect.any(Number),
      });
    });

    it('should call addExpiration on failed save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-exp',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        [{ type: 'condition', condition: 'frightened' }],
        campaignName,
        10,
      );
    });

    it('should track fear effect in targetEffects runtime store', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue
        .mockReturnValueOnce([]) // activeConditions
        .mockReturnValueOnce([]); // targetEffects
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-effects',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'fear_end_on_los',
            source: 'TestCaster',
            condition: 'frightened',
            dc: 10,
            duration: 'concentration',
          }),
        ]),
        campaignName,
      );
    });

    it('should update existing fear effect instead of duplicating', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue
        .mockReturnValueOnce([]) // activeConditions
        .mockReturnValueOnce([
          { target: 'Goblin', effect: 'fear_end_on_los', source: 'OldCaster' },
        ]);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-update',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      // Should update the existing entry, not add a new one
      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBe(1);
      const effects = targetEffectsCalls[0][2];
      expect(effects.length).toBe(1);
      expect(effects[0].source).toBe('TestCaster');
    });

    it('should call addEntry with save_result on successful save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-save-result',
        promise: Promise.resolve({ success: true }),
      });

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-fear',
        targetName: 'Goblin',
        saveDc: 20,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Fear.',
      });
    });
  });

  describe('popup payload', () => {
    it('should return popup type with automation_info payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-type',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Fear');
    });

    it('should include affected creature descriptions in summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-summary',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Goblin drops what it\'s holding and is Frightened');
    });

    it('should mention repeat save on line of sight loss in summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-los',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('repeat the save');
      expect(result.payload.description).toContain('line of sight');
    });
  });

  describe('edge cases', () => {
    it('should handle campaignName being undefined gracefully in no-combat case', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, null, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should handle empty automation object', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Fear', automation: {} };

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-empty-auto',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Fear');
    });

    it('should handle playerStats with no proficiency', async () => {
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-no-prof',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });

    it('should handle single target in combat', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const singleCreatureCombat = {
        creatures: [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(singleCreatureCombat);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-single',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Fear affects 1 creature(s)');
    });

    it('should handle all targets being the caster (no enemies)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const onlyPlayerCombat = {
        creatures: [
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(onlyPlayerCombat);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'fear-prompt-only-player',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected by Fear');
    });
  });
});
