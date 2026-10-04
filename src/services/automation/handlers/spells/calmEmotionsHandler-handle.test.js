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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

const { default: storage } = await import('../../../ui/storage.js');

vi.mock('../../../combat/automation/automationService.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

import { handle } from './calmEmotionsHandler.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    proficiency: 4,
    ...overrides,
  };
}

function makeAction(automation = {}, metaCtx = {}) {
  return {
    name: 'Calm Emotions',
    automation: {
      type: 'calm_emotions',
      ...automation,
    },
    metaCtx,
  };
}

const singleTargetCombat = {
  creatures: [{ name: 'EnemyGoblin' }],
};

const multiTargetCombat = {
  creatures: [
    { name: 'EnemyGoblin' },
    { name: 'EnemyOrc' },
  ],
};

describe('calmEmotionsHandler - handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(13);
    getCombatSummary.mockReturnValue(null);
    getRuntimeValue.mockReturnValue(undefined);
  });

  describe('combat context validation', () => {
    it('should return popup when no creatures in combat', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Calm Emotions');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when creatures array is empty', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('concentration registration', () => {
    it('should register concentration when combat summary is available', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'prompt',
        promise: Promise.resolve({ success: true }),
      });

      const mockCombatSummary = { creatures: [{ name: 'TestWizard' }] };
      getCombatSummary.mockReturnValue(mockCombatSummary);

      const statsWithSaveDc = makePlayerStats({ spellAbilities: { saveDc: 15 } });
      await handle(makeAction(), statsWithSaveDc, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        mockCombatSummary,
        'TestWizard',
        'Calm Emotions',
        15,
      );
    });

    it('should compute spell DC from 8 + proficiency when spellAbilities.saveDc is missing', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'prompt',
        promise: Promise.resolve({ success: true }),
      });

      const mockCombatSummary = { creatures: [{ name: 'TestWizard' }] };
      getCombatSummary.mockReturnValue(mockCombatSummary);

      const statsNoSaveDc = makePlayerStats({
        spellAbilities: { modifier: 3 },
        proficiency: 4,
      });
      await handle(makeAction(), statsNoSaveDc, campaignName, null);

      // Handler uses: 8 + (playerStats.proficiency || 2) = 8 + 4 = 12
      expect(addConcentration).toHaveBeenCalledWith(
        mockCombatSummary,
        'TestWizard',
        'Calm Emotions',
        12,
      );
    });

    it('should not register concentration when combat summary is null', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'prompt',
        promise: Promise.resolve({ success: true }),
      });
      getCombatSummary.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
    });
  });

  describe('storeSpellLastAttack', () => {
    it('should store spell last attack with correct parameters', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestWizard',
        spellName: 'Calm Emotions',
        saveType: 'CHA',
        saveDc: 13,
        attackScope: 'aoe',
      });
    });
  });

  describe('save prompt creation', () => {
    it('should call createSaveListener with CHA save config', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CHA',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('should skip the caster from targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestWizard' },
          { name: 'EnemyGoblin' },
        ],
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CHA',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('should apply disadvantage when metamagicHeighten matches target', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(
        makeAction({}, { metamagicHeighten: 'EnemyGoblin' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CHA',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: true,
      });
    });
  });

  describe('save success', () => {
    it('should log ability_use and save_result for successful save', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestWizard',
        abilityName: 'Calm Emotions',
        description: expect.stringContaining('casts Calm Emotions'),
        promptId: 'goblin-prompt',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-calm-emotions',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CHA',
        success: true,
        description: expect.stringContaining('succeeded on CHA save'),
      });
    });

    it('should call addTargetResult with success data', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({
          success: true,
          roll: 12,
          total: 15,
        }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveResult: 'success',
        roll: 12,
        total: 15,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('should include saved count in popup description', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) saved');
      expect(result.payload.description).toContain('No creatures affected');
    });

    it('should use default roll/total when not provided', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });
  });

  describe('save failure', () => {
    it('should apply immunity effects on failed save', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'EnemyGoblin',
            effect: 'calm_emotions',
            mode: 'immunity',
            dc: 13,
          }),
        ]),
        campaignName,
      );
    });

    it('should log ability_use and save_result for failed save', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestWizard',
        abilityName: 'Calm Emotions',
        description: expect.stringContaining('casts Calm Emotions'),
        promptId: 'goblin-prompt',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-calm-emotions',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CHA',
        success: false,
        description: expect.stringContaining('failed CHA save'),
      });
    });

    it('should call addTargetResult with failure data', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({
          success: false,
          roll: 3,
          total: 6,
        }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveResult: 'failure',
        roll: 3,
        total: 6,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('should include affected count in popup description', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('immune to Charmed');
      expect(result.payload.description).toContain('0 creature(s) saved');
    });
  });

  describe('multiple targets', () => {
    it('should process all creatures excluding caster', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: `prompt-${callCount}`,
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(result.type).toBe('popup');
    });

    it('should report mixed save results correctly', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: `prompt-${callCount}`,
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });

    it('should report all targets affected when all fail', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'multi-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('2 creature(s)');
      expect(result.payload.description).toContain('immune to Charmed');
    });

    it('should report all targets saving', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'multi-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('2 creature(s) saved');
      expect(result.payload.description).toContain('No creatures affected');
    });

    it('should report no creatures affected when all saved', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'multi-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No creatures affected');
    });
  });

  describe('SP-020 fixes', () => {
    it('B5: registers a 10-round calm_emotions_end expiration clock on the caster', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestWizard',
        targetName: 'TestWizard',
        effects: [{ type: 'calm_emotions_end', source: 'TestWizard' }],
        campaignName,
        rounds: 10,
        expireOnCreatureName: null,
      });
    });

    it('B2: non-Humanoid creatures are excluded from saves and logged ineligible', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'EnemyGoblin' },
          { name: 'Pseudodragon' },
        ],
      });
      getMonsterData.mockImplementation(async (name) => {
        if (String(name).startsWith('Pseudodragon')) return { name: 'Pseudodragon', type: 'Dragon' };
        return { name: 'Bandit', type: 'Humanoid' };
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'EnemyGoblin' }));
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        automationType: 'calm_emotions_ineligible',
        automationDetail: 'not_humanoid',
        characterName: 'Pseudodragon',
      }));
    });

    it('B4: no active map logs a lenient sphere advisory', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        automationType: 'calm_emotions_sphere_advisory',
        automationDetail: 'no_map_lenient',
      }));
    });
  });

  describe('popup payload structure', () => {
    it('should return popup type with automation_info payload', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Calm Emotions');
    });

    it('should use action.name in the popup', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const customAction = {
        name: 'Custom Calm Emotions',
        automation: { type: 'calm_emotions' },
        metaCtx: {},
      };
      const result = await handle(customAction, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('Custom Calm Emotions');
    });
  });

  describe('storage and event dispatch', () => {
    it('should call storage.set and dispatch event when concentration is registered', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'prompt',
        promise: Promise.resolve({ success: true }),
      });

      const mockCombatSummary = { creatures: [{ name: 'TestWizard' }] };
      getCombatSummary.mockReturnValue(mockCombatSummary);

      const stats = makePlayerStats({ spellAbilities: { saveDc: 15 } });
      await handle(makeAction(), stats, campaignName, null);

      expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, campaignName);
    });
  });
});
