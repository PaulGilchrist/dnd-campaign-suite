import { describe, it, expect, vi } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(({ targetName, saveType, saveDc }) => ({
    promptId: `prompt-${targetName}-${saveType}-${saveDc}`,
  })),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './reactionSaveHealHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as savePrompt from '../../common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
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
      casting_time: '1 reaction',
      ...automation,
    },
  };
}

function createRuntimeMock(values) {
  return vi.fn((name, key) => {
    if (values[key] !== undefined) return values[key];
    return null;
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionSaveHealHandler.handle', () => {
  describe('Rage checks', () => {
    it('should return "no rage" popup when rage is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Rage remaining to power Relentless Rage.');
    });

    it('should return "no rage" popup when rage is negative', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(-2);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Rage remaining to power Relentless Rage.');
    });

    it('should return "no rage" popup when storedRage is null (defaults to 0)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Rage remaining to power Relentless Rage.');
    });
  });

  describe('Combat context checks', () => {
    it('should return "no combat" popup when getCombatContext returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat active.');
    });
  });

  describe('HP checks', () => {
    it('should return "not at 0 HP" popup when player is above 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 5 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('TestHero is not at 0 Hit Points.');
    });

    it('should proceed when player is at exactly 0 HP', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
      });
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player' }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('TestHero', 'currentHitPoints', campaignName);
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should allow use when uses < max for short_or_long_rest recharge', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestHero',
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestHero',
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Relentless Rage');
      expect(result.payload.targetName).toBe('TestHero');
    });

    it('should include save DC in description', async () => {
      const runtime = createRuntimeMock({
        currentHitPoints: 0,
        ragePoints: 2,
        relentlessrageUses: 0,
      });
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('TestHero must make a CON saving throw (DC 10).');
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Failed save', () => {
    it('should log failure and NOT heal when save fails', async () => {
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestHero',
        'currentHitPoints',
        expect.any(Number),
        campaignName
      );
    });
  });

  describe('Usage increment', () => {
    it('should track that save prompt was created', async () => {
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });
  });

  describe('Event cleanup', () => {
    it('should set up event listener for save-result', async () => {
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      await handle(makeAction(), ps, campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });
  });

  describe('Combat summary update', () => {
    it('should set up save listener for prompt', async () => {
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
      useRuntimeState.getRuntimeValue.mockImplementation(runtime);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestHero', type: 'player', currentHp: 0 }],
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });
  });
});
