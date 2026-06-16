import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

import { handle, processFleshToStoneRepeatSave } from './fleshToStoneHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';

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
    name: 'Flesh to Stone',
    automation: { type: 'flesh_to_stone', saveType: 'CON', saveDc: 15, ...automation },
  };
}

describe('fleshToStoneHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target resolution', () => {
    it('should return popup when no target selected', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
      resolveTarget.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('construct handling', () => {
    it('should auto-succeed for construct creatures', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'IronGolem', type: 'construct' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'IronGolem', type: 'construct' } });
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Construct');
      expect(result.payload.description).toContain('automatically succeeds');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('should apply speed_zero condition to constructs', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'IronGolem', type: 'construct' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'IronGolem', type: 'construct' } });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'IronGolem',
        'activeConditions',
        expect.arrayContaining(['speed_zero']),
        campaignName,
      );
    });

    it('should add speed_zero expiration for constructs', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'IronGolem', type: 'construct' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'IronGolem', type: 'construct' } });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'IronGolem',
        expect.arrayContaining([{ type: 'speed_zero' }]),
        campaignName,
        1,
      );
    });
  });

  describe('initial save', () => {
    it('should create save listener for non-construct', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue(null);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'fts-save',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        dcSuccess: 'none',
      });
    });

    it('should apply restrained on failed save', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'fts-fail',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['restrained']),
        campaignName,
      );
    });

    it('should initialize tracking [0, 1] on failed save', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'fts-track',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_fleshToStone_Goblin',
        [0, 1],
        campaignName,
      );
    });

    it('should add restrained expiration on failed save', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'fts-expire',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'condition', condition: 'restrained' }]),
        campaignName,
        10,
      );
    });

    it('should store target effect for repeat saves', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'fts-effect',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'flesh_to_stone_repeat_save',
          }),
        ]),
        campaignName,
      );
    });

    it('should apply speed_zero on successful save', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'fts-success',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['speed_zero']),
        campaignName,
      );
    });

    it('should add postLogEntry for successful save speed_zero', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'fts-postlog',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          condition: 'Speed 0',
        }),
      );
    });
  });

  describe('repeat save delegation', () => {
    it('should delegate to processFleshToStoneRepeatSave when tracking exists', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'monster' } });
      getRuntimeValue.mockReturnValue([0, 1]);
      buildSaveDc.mockReturnValue(15);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        dcSuccess: 'none',
      });
    });
  });
});

describe('fleshToStoneHandler.processFleshToStoneRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no tracking exists', async () => {
    getRuntimeValue.mockReturnValue(null);
    const result = await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);
    expect(result).toBeNull();
  });

  it('should return null when tracking is not an array with 2 elements', async () => {
    getRuntimeValue.mockReturnValue([0]);
    const result = await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);
    expect(result).toBeNull();
  });

  it('should create save listener with CON save type', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_fleshToStone_Goblin') return [0, 0];
      return null;
    });
    createSaveListener.mockReturnValue({
      promptId: 'fts-repeat',
      promise: Promise.resolve({ success: false }),
    });

    await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 15,
      dcSuccess: 'none',
    });
  });

  describe('success tracking', () => {
    it('should end spell after 3 successes', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Restrained'];
        return [2, 0];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-3success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(result.payload.description).toContain('Flesh to Stone ends');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.not.arrayContaining(['restrained']),
        campaignName,
      );
    });

    it('should continue tracking when less than 3 successes', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_fleshToStone_Goblin') return [1, 0];
        return null;
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-2success',
        promise: Promise.resolve({ success: true }),
      });

      await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_fleshToStone_Goblin',
        [2, 0],
        campaignName,
      );
    });
  });

  describe('failure tracking', () => {
    it('should petrify after 3 failures', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Restrained'];
        return [0, 2];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-3fail',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(result.payload.description).toContain('Petrified');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['petrified']),
        campaignName,
      );
    });

    it('should continue tracking when less than 3 failures', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_fleshToStone_Goblin') return [0, 1];
        return null;
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-2fail',
        promise: Promise.resolve({ success: false }),
      });

      await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_fleshToStone_Goblin',
        [0, 2],
        campaignName,
      );
    });

    it('should call postLogEntry for petrification', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Restrained'];
        return [0, 2];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-petrilog',
        promise: Promise.resolve({ success: false }),
      });

      await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          condition: 'Petrified',
        }),
      );
    });
  });

  describe('cleanup', () => {
    it('should clean up target effect when spell ends', async () => {
      getRuntimeValue.mockImplementation((caster, key, prop) => {
        if (key === '_fleshToStone_Goblin') return [2, 0];
        if (prop === 'targetEffects') return [{ target: 'Goblin', effect: 'flesh_to_stone_repeat_save', source: 'TestCaster' }];
        return [2, 0];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-cleanup',
        promise: Promise.resolve({ success: true }),
      });

      await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({ target: 'Goblin', effect: 'flesh_to_stone_repeat_save', source: 'TestCaster' }),
        ]),
        campaignName,
      );
    });

    it('should clean up target effect when petrified', async () => {
      getRuntimeValue.mockImplementation((caster, key, prop) => {
        if (key === '_fleshToStone_Goblin') return [0, 2];
        if (prop === 'targetEffects') return [{ target: 'Goblin', effect: 'flesh_to_stone_repeat_save', source: 'TestCaster' }];
        return [0, 2];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-petriclean',
        promise: Promise.resolve({ success: false }),
      });

      await processFleshToStoneRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({ target: 'Goblin', effect: 'flesh_to_stone_repeat_save', source: 'TestCaster' }),
        ]),
        campaignName,
      );
    });
  });
});
