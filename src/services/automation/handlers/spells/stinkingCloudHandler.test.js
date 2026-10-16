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
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
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

import { handle } from './stinkingCloudHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeAction(automation = {}, metaCtx = {}) {
  return {
    name: 'Stinking Cloud',
    automation: {
      type: 'stinking_cloud',
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

describe('stinkingCloudHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(13);
    getCombatSummary.mockReturnValue(null);
    addEntry.mockResolvedValue(undefined);
  });

  describe('combat context validation', () => {
    it('should return popup when no creatures in combat', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Stinking Cloud');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('has no effect');
    });

    it('should return popup when creatures array is empty', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target selection', () => {
    it('should use all creatures when no targets specified in metaCtx', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
    });

    it('should only process selected targets from metaCtx', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction({}, { targets: ['EnemyGoblin'] }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CON',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('should return popup when selected targets are empty', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);

      const result = await handle(makeAction({}, { targets: [] }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures selected');
    });

    it('should filter to only included creatures', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction({}, { targets: ['EnemyGoblin'] }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
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

      const statsWithSaveDc = makePlayerStats({ spellAbilities: { saveDc: 13 } });
      await handle(makeAction(), statsWithSaveDc, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        mockCombatSummary,
        'TestWizard',
        'Stinking Cloud',
        13
      );
    });
  });

  describe('save success', () => {
    it('should call createSaveListener with CON save config', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CON',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('should log ability_use and save_result for the caster', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestWizard',
        abilityName: 'Stinking Cloud',
        description: expect.stringContaining('casts Stinking Cloud'),
        promptId: 'goblin-prompt',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-stinking-cloud',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CON',
        success: true,
        description: expect.stringContaining('succeeded on CON save'),
      });
    });

    it('should include saved count in popup description', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Full-string own-composition pin — empty immune slot leaves a trailing space.
      expect(result.payload.description).toBe('No creatures affected by Stinking Cloud. 1 creature(s) saved. ');
    });
  });

  describe('save failure', () => {
    it('should set activeConditions with poisoned on failed save', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'EnemyGoblin',
        'activeConditions',
        ['poisoned'],
        campaignName,
      );
    });

    it('should deduplicate poisoned when target already has it', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        if (field === 'activeConditions') return ['poisoned', 'stunned'];
        if (field === 'activeConditionMeta') return {};
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'EnemyGoblin',
        'activeConditions',
        ['stunned', 'poisoned'],
        campaignName,
      );
    });

    it('should add expiration for concentration', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWizard', targetName: 'EnemyGoblin', effects: [{ type: 'condition', condition: 'poisoned' }], campaignName });
    });

    it('should call addExpiration for zone area and concentration expiry', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Zone area expiration (1 minute = 10 rounds) + poisoned/concentration expiry
      expect(addExpiration).toHaveBeenCalledTimes(2);
    });

    it('should track stinking_cloud in targetEffects', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
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
            effect: 'stinking_cloud',
            source: 'TestWizard',
            conditions: ['poisoned'],
            duration: 'concentration',
          }),
        ]),
        campaignName,
      );
    });

    it('should include poisoned description in popup', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Full-string own-composition pin (buildStinkingCloudSummary, cast lane):
      // the empty immune slot renders as the double space before "Affected".
      expect(result.payload.description).toBe(
        'Stinking Cloud affects 1 creature(s). EnemyGoblin is Poisoned. 0 creature(s) saved.  Affected creatures are Poisoned (can\'t take Actions or Bonus Actions) until the end of their current turn.'
      );
    });
  });

  describe('target immunity', () => {
    it('should skip targets with poison immunity from target immunities', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const immuneCombat = {
        creatures: [{ name: 'EnemyGoblin', weaknessesAndResistivities: { immunities: ['poison'] } }],
      };
      getCombatContext.mockResolvedValue(immuneCombat);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('immune');
    });

    it('should check each target immunity individually', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const mixedCombat = {
        creatures: [
          { name: 'EnemyGoblin', weaknessesAndResistivities: { immunities: ['poison'] } },
          { name: 'EnemyOrc' },
        ],
      };
      getCombatContext.mockResolvedValue(mixedCombat);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Only Orc should have a save prompt (Goblin is immune)
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyOrc',
        saveType: 'CON',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('immune');
    });

    it('should report immune count in popup', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const mixedCombat = {
        creatures: [
          { name: 'EnemyGoblin', weaknessesAndResistivities: { immunities: ['poison'] } },
          { name: 'EnemyOrc' },
        ],
      };
      getCombatContext.mockResolvedValue(mixedCombat);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) immune');
    });
  });

  describe('multiple targets', () => {
    it('should process all creatures when no targets specified', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: `goblin-prompt-${callCount}`,
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
          promptId: `goblin-prompt-${callCount}`,
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });

    it('should report all targets affected when all fail saves', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'multi-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('2 creature(s)');
      expect(result.payload.description).toContain('Poisoned');
    });

    it('should report all targets saving', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'multi-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Full-string own-composition pin — empty immune slot leaves a trailing space.
      expect(result.payload.description).toBe('No creatures affected by Stinking Cloud. 2 creature(s) saved. ');
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
      expect(result.payload.name).toBe('Stinking Cloud');
    });

    it('should use action.name in the popup', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const customAction = { name: 'Custom Cloud', automation: { type: 'stinking_cloud' }, metaCtx: {} };
      const result = await handle(customAction, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('Custom Cloud');
    });
  });

  describe('error handling in .catch chains', () => {
    it('should catch errors from addEntry in immune path', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getCombatContext.mockResolvedValue(multiTargetCombat);
      addEntry.mockRejectedValue(new Error('log error'));
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const mixedCombat = {
        creatures: [
          { name: 'EnemyGoblin', weaknessesAndResistivities: { immunities: ['poison'] } },
          { name: 'EnemyOrc' },
        ],
      };
      getCombatContext.mockResolvedValue(mixedCombat);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('immune');
      expect(console.error).toHaveBeenCalledWith('[stinkingCloud] Error:', expect.any(Error));
      spy.mockRestore();
    });

    it('should catch errors from addEntry in save success path', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getCombatContext.mockResolvedValue(singleTargetCombat);
      addEntry.mockRejectedValue(new Error('log error'));
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('saved');
      expect(console.error).toHaveBeenCalledWith('[stinkingCloud] Error:', expect.any(Error));
      spy.mockRestore();
    });

    it('should catch errors from addEntry in save failure path', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getCombatContext.mockResolvedValue(singleTargetCombat);
      addEntry.mockRejectedValue(new Error('log error'));
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Poisoned');
      expect(console.error).toHaveBeenCalledWith('[stinkingCloud] Error:', expect.any(Error));
      spy.mockRestore();
    });
  });

  describe('targetEffects update existing', () => {
    it('should update existing stinking_cloud effect instead of pushing duplicate', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') {
          return [{
            target: 'EnemyGoblin',
            effect: 'stinking_cloud',
            source: 'OldCaster',
            conditions: ['poisoned'],
            dc: 10,
            duration: ' Concentration',
          }];
        }
        return [];
      });
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
            effect: 'stinking_cloud',
            source: 'TestWizard',
            dc: 13,
          }),
        ]),
        campaignName,
      );
      // The existing effect should be replaced, not duplicated
      const callArgs = setRuntimeValue.mock.calls;
      const effectsCalls = callArgs.filter(
        (call) => call[0] === 'campaign' && call[1] === 'targetEffects'
      );
      expect(effectsCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('disadvantage on specific targets', () => {
    it('should apply disadvantage when target matches heightenedTarget', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(
        makeAction({}, { heightenTarget: 'EnemyGoblin' }),
        makePlayerStats(),
        campaignName,
        null
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CON',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: true,
      });
    });

    it('should not apply disadvantage for non-heightened targets', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });

      let callIndex = 0;
      createSaveListener.mockImplementation((_campaign, _opts) => {
        callIndex++;
        return {
          promptId: `goblin-prompt-${callIndex}`,
          promise: Promise.resolve({ success: false }),
        };
      });

      await handle(
        makeAction({}, { heightenTarget: 'EnemyGoblin' }),
        makePlayerStats(),
        campaignName,
        null
      );

      // First call is for EnemyGoblin (heightened), second is for EnemyOrc (not heightened)
      const goblinCall = createSaveListener.mock.calls.find(
        (call) => call[1].targetName === 'EnemyGoblin'
      );
      const orcCall = createSaveListener.mock.calls.find(
        (call) => call[1].targetName === 'EnemyOrc'
      );
      expect(goblinCall[1].disadvantage).toBe(true);
      expect(orcCall[1].disadvantage).toBe(false);
    });
  });

  describe('activeConditionMeta', () => {
    it('should set condition metadata on failed save', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        if (field === 'activeConditions') return [];
        if (field === 'activeConditionMeta') return {};
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'EnemyGoblin',
        'activeConditionMeta',
        expect.objectContaining({
          poisoned: expect.objectContaining({
            dc: 13,
            ability: 'con',
          }),
        }),
        campaignName,
      );
    });
  });

  // ── SP-111 cast-time wires (inherited from areaSave lane #1973 seam map,
  // trimmed out of it 2026-10-16 — never re-add there) ──────────────────
  describe('SP-111 cast-time zone wires', () => {
    it('writes the _stinkingCloud_<caster> tracking store on cast (saveDc/saveType CON/radius 20/mapName)', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

      // Exact-key pin: consumer processStinkingCloudAreaSave reads this store
      // at every turn start (expireStaleEffects Phase 4). timestamp is
      // write-metadata, not a game clock — excluded.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_stinkingCloud_TestWizard',
        expect.objectContaining({
          caster: 'TestWizard',
          mapName: 'test-map',
          campaignName,
          saveDc: 13,
          saveType: 'CON',
          radius: 20,
          duration: 'Concentration, up to 1 minute',
        }),
        campaignName,
      );
    });

    it('registers the zone expiration with rounds:10 (CLA-334 minutes→rounds×10, matured at initiative seams)', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // 'Concentration, up to 1 minute' → 10 rounds (round counter, never a
      // wall-clock timer): clears zone tracking + both zone-sourced tes.
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestWizard',
        targetName: 'TestWizard',
        effects: [
          { type: 'clear_runtime_value', creatureName: 'TestWizard', key: '_stinkingCloud_TestWizard' },
          { type: 'remove_target_effect', effectKey: 'stinking_cloud', source: 'TestWizard' },
          { type: 'remove_target_effect', effectKey: 'no_action_and_bonus_action', source: 'TestWizard' },
        ],
        campaignName,
        rounds: 10,
      });
    });

    it('encodes explicit duration strings: minutes ×10, rounds verbatim', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction({ duration: '2_minutes' }), makePlayerStats(), campaignName, null);
      await handle(makeAction({ duration: '3_rounds' }), makePlayerStats(), campaignName, null);

      const zoneCalls = addExpiration.mock.calls.map(([arg]) => arg).filter(arg => arg.rounds !== undefined);
      expect(zoneCalls.map(arg => arg.rounds)).toEqual([20, 3]);
    });

    it('writes the cast-time block te through registerTargetEffect with skipSync=true on a failed save', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombat);
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // 5-arg pin distinguishes the REAL registerTargetEffect write
      // (targetEffectDefinitions.js:1505, skipSync=true — server already
      // persists; SSE-echo safe) from this lane's own 4-arg stinking_cloud
      // marker write above. Shed by applyStinkingCloudTurnEnd at turn end.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'EnemyGoblin',
            effect: 'no_action_and_bonus_action',
            source: 'TestWizard',
            duration: 'until_end_of_current_turn',
          }),
        ]),
        campaignName,
        true,
      );
    });
  });
});
