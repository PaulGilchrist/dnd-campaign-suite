// @improved-by-ai
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

import { handle } from './massSuggestionHandler.js';
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
    level: 15,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 5 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Mass Suggestion',
    automation: {
      type: 'mass_suggestion',
      saveType: 'WIS',
      saveDc: 'spell_save_dc',
      range: '60 feet',
      duration: '24 hours',
      maxTargets: 12,
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'Bugbear', type: 'monster', currentHp: 12, maxHp: 15 },
    { name: 'Kobold', type: 'monster', currentHp: 4, maxHp: 5 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  placedItems: [],
};

function makeFailedSaveMock() {
  return { promptId: 'ms-prompt', promise: Promise.resolve({ success: false }) };
}

function makeSuccessSaveMock() {
  return { promptId: 'ms-prompt', promise: Promise.resolve({ success: true }) };
}

// ── Tests ──────────────────────────────────────────────────────

describe('massSuggestionHandler.handle', () => {
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
      expect(result.payload.name).toBe('Mass Suggestion');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Mass Suggestion has no effect');
    });

    it('should return popup when creatures list is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Mass Suggestion');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Mass Suggestion has no effect');
    });

    it('should return popup when combat context is nullish', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('save prompt creation', () => {
    it('should call buildSaveDc with action automation and playerStats', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(17);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });

    it('should create save prompts for all non-caster creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      // 5 creatures total, caster excluded = 4 targets
      expect(createSaveListener).toHaveBeenCalledTimes(4);
    });

    it('should exclude the caster from save prompts', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      const calledWithTargetNames = createSaveListener.mock.calls.map(
        call => call[1].targetName,
      );
      expect(calledWithTargetNames).not.toContain('TestCaster');
      expect(calledWithTargetNames).toContain('Goblin');
      expect(calledWithTargetNames).toContain('Orc');
      expect(calledWithTargetNames).toContain('Bugbear');
      expect(calledWithTargetNames).toContain('Kobold');
    });

    it('should call createSaveListener with correct config for each target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 16,
        dcSuccess: 'none',
      });
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Orc',
        saveType: 'WIS',
        saveDc: 16,
        dcSuccess: 'none',
      });
    });

    it('should call addEntry with ability_use type for each target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledTimes(4);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Mass Suggestion',
        description: expect.stringContaining('Mass Suggestion'),
        promptId: 'ms-prompt',
      });
    });
  });

  describe('failed save handling', () => {
    it('should apply Charmed condition on failed save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should call addExpiration for caster-target charmed tracking', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        [{ type: 'charmed', condition: 'charmed' }],
        campaignName,
        24,
      );
    });

    it('should log condition application via postLogEntry', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Mass Suggestion spell',
        note: expect.stringContaining('Mass Suggestion'),
        timestamp: expect.any(Number),
      });
    });

    it('should not call addEntry with save_result on failed save (only on success)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      const saveResultCalls = addEntry.mock.calls.filter(
        call => call[1].type === 'save_result',
      );
      expect(saveResultCalls.length).toBe(0);
    });

    it('should deduplicate Charmed if already present', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue(['charmed', 'frightened']);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      // Should remove existing 'charmed' then append, resulting in ['frightened', 'charmed']
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName,
      );
    });

    it('should handle undefined activeConditions gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue(undefined);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });
  });

  describe('successful save handling', () => {
    it('should not apply conditions on successful save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeSuccessSaveMock());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('should call addEntry with save_result on successful save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeSuccessSaveMock());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-mass-suggestion',
        targetName: 'Goblin',
        saveDc: 16,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Mass Suggestion.',
      });
    });

    it('should not call postLogEntry or addExpiration on successful save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeSuccessSaveMock());

      await handle(action, ps, campaignName, null);

      expect(postLogEntry).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('max targets limit', () => {
    it('should limit to maxTargets when more creatures exist', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ maxTargets: 2 });

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      const calledWithTargetNames = createSaveListener.mock.calls.map(
        call => call[1].targetName,
      );
      expect(calledWithTargetNames).toEqual(['Goblin', 'Orc']);
    });

    it('should default to 12 max targets when not specified', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ maxTargets: undefined });

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      // 4 non-caster creatures, all under default limit of 12
      expect(createSaveListener).toHaveBeenCalledTimes(4);
    });

    it('should handle maxTargets of 0 by treating it as falsy and defaulting to 12', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ maxTargets: 0 });

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      // Source uses `auto.maxTargets || 12` which treats 0 as falsy
      expect(createSaveListener).toHaveBeenCalledTimes(4);
    });
  });

  describe('summary popup', () => {
    it('should return popup with affected count summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Mass Suggestion');
      expect(result.payload.description).toContain('Mass Suggestion affects 4');
      expect(result.payload.description).toContain('Charmed');
    });

    it('should return popup when no creatures are affected', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeSuccessSaveMock());

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Mass Suggestion');
      expect(result.payload.description).toContain('No creatures affected');
      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('should include saved count in summary when some fail and some succeed', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount % 2 === 0; // alternate: fail, success, fail, success
        return { promptId: `ms-prompt-${callCount}`, promise: Promise.resolve({ success }) };
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Mass Suggestion affects 2');
      expect(result.payload.description).toContain('2 creature(s) saved');
    });

    it('should mention spell end condition in summary for affected targets', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('damage');
      expect(result.payload.description).toContain('Charmed');
    });
  });

  describe('edge cases', () => {
    it('should handle campaignName being undefined in no-combat case', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, null, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should handle single non-caster target', async () => {
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
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      const result = await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Mass Suggestion affects 1');
    });

    it('should handle all creatures being the caster (no enemies)', async () => {
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
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeSuccessSaveMock());

      const result = await handle(action, ps, campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected');
    });

    it('should use action.name in popup payload', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Custom Mass Suggestion', automation: { type: 'mass_suggestion' } };

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Custom Mass Suggestion');
    });

    it('should use action.name in addEntry abilityName field', async () => {
      const ps = makePlayerStats();
      const action = { name: 'My Mass Suggestion', automation: { type: 'mass_suggestion' } };

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          abilityName: 'My Mass Suggestion',
        }),
      );
    });
  });
});
