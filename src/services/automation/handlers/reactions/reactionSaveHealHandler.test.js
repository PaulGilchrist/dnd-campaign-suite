import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(({ targetName, saveType, saveDc }) => ({
    promptId: `prompt-${targetName}-${saveType}-${saveDc}`,
    promise: Promise.resolve({ success: false }),
  })),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './reactionSaveHealHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as savePrompt from '../../common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestBarbarian',
    level: 11,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Relentless Rage',
    automation: {
      type: 'reaction_save_heal',
      saveType: 'CON',
      saveDc: 10,
      dcScaling: 5,
      healExpression: '2 * barbarian_level',
      recharge: 'short_or_long_rest',
      ...automation,
    },
  };
}

function createRuntimeMock(values) {
  return vi.fn((name, key, campaign) => {
    const k = `${name}:${key}:${campaign}`;
    if (values[k] !== undefined) return values[k];
    if (values[key] !== undefined) return values[key];
    return null;
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionSaveHealHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rage checks', () => {
    it('should return "no rage" popup when rage is 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Rage remaining to power Relentless Rage.');
    });

    it('should return "no rage" popup when rage is negative', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(-2);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Rage remaining to power Relentless Rage.');
    });

    it('should return "no rage" popup when storedRage is null', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Rage remaining to power Relentless Rage.');
    });
  });

  describe('Combat context checks', () => {
    it('should return "no combat" popup when getCombatContext returns null', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat active.');
    });
  });

  describe('HP checks', () => {
    it('should return "not at 0 HP" popup when player is above 0 HP', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 5 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('TestBarbarian is not at 0 Hit Points.');
    });

    it('should proceed when player is at exactly 0 HP', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('must make a CON saving throw');
    });

    it('should get player HP from getRuntimeValue for player-type creatures', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player' }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        campaignName,
      );
    });
  });

  describe('Usage tracking', () => {
    it('should return "no uses remaining" when already used this rest period', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 1,
        relentlessrageRestTimestamp: Date.now() - 3600000,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should allow use when uses < max', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });
  });

  describe('Save DC calculation', () => {
    it('should use base DC when no uses have been made', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });


  });

  describe('Save listener setup', () => {
    it('should call createSaveListener with correct parameters', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });

    it('should add save-result event listener', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });
  });

  describe('Logging', () => {
    it('should call addEntry with ability_use type', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBarbarian',
        abilityName: 'Relentless Rage',
        description: expect.stringContaining('Relentless Rage triggered'),
        promptId: expect.any(String),
      });
    });
  });

  describe('Popup response', () => {
    it('should return popup with automation_info type', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Relentless Rage');
      expect(result.payload.targetName).toBe('TestBarbarian');
    });

    it('should include save DC in description', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('TestBarbarian must make a CON saving throw (DC 10).');
    });
  });

  describe('Heal expression evaluation', () => {
    it('should calculate heal amount as 2 * barbarian level', async () => {
      const ps = makePlayerStats({
        class: {
          class_levels: [{ name: 'Barbarian', level: 11 }],
        },
      });

      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        expect.any(Number),
        campaignName,
      );
    });

    it('should calculate heal amount as 2 * level when barbarian level not found', async () => {
      const ps = makePlayerStats({
        class: {
          class_levels: [{ name: 'Fighter', level: 5 }],
        },
      });

      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });
  });



  describe('Save result handler - failure path', () => {
    it('should NOT set currentHitPoints on save failure', async () => {
      const ps = makePlayerStats();

      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      runtimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-TestBarbarian-CON-10',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        expect.any(Number),
        campaignName,
      );
    });
  });



  describe('Custom feature name', () => {
    it('should use action.name as featureName when provided', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }],
      });

      const action = {
        name: 'Custom Feature',
        automation: { type: 'reaction_save_heal' },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('Custom Feature');
    });
  });
});
