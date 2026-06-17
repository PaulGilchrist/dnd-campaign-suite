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

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(({ targetName, saveType, saveDc }) => ({
    promptId: `prompt-${targetName}-${saveType}-${saveDc}`,
    promise: Promise.resolve({ success: false }),
  })),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, isResilientSphereActive, getResilientSphereSource } from './resilientSphereHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as logPoster from '../../../shared/logPoster.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Resilient Sphere',
    automation: {
      type: 'spell',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('resilientSphereHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'EnemyGoblin' } });
  });

  describe('Combat context checks', () => {
    it('should return popup when no creatures in combat', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when combat context is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('Target resolution', () => {
    it('should return popup when no target selected', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyGoblin' }] });
      targetResolver.resolveTarget.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('Save - success', () => {
    it('should return popup when target succeeds on save', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on DEX save');
    });

    it('should add save_result log entry on success', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-resilient-sphere',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'DEX',
        success: true,
        description: expect.stringContaining('succeeded on DEX save'),
      });
    });
  });

  describe('Save - failure', () => {
    it('should toggle resilient sphere buff on failed save', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('enclosed in a Resilient Sphere');
    });

    it('should add expiration for concentration', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestWizard',
        'EnemyGoblin',
        [{ type: 'remove_active_buff', buffName: 'Resilient Sphere', effect: 'resilient_sphere' }],
        campaignName,
        10,
      );
    });

    it('should post log entry for condition applied', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'EnemyGoblin',
        condition: 'Resilient Sphere',
        reason: 'Resilient Sphere',
        note: expect.stringContaining('enclosed in Otiluke\'s Resilient Sphere'),
        timestamp: expect.any(Number),
      });
    });

    it('should add save_result log entry on failure', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-resilient-sphere',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'DEX',
        success: false,
        description: expect.stringContaining('failed DEX save'),
      });
    });

    it('should use custom duration from automation when provided', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: false }),
      });

      const action = makeAction({ duration: 'Concentration, up to 2 minutes' });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestWizard',
        'EnemyGoblin',
        [{ type: 'remove_active_buff', buffName: 'Resilient Sphere', effect: 'resilient_sphere' }],
        campaignName,
        10,
      );
    });
  });

  describe('isResilientSphereActive', () => {
    it('should return true when resilient sphere buff is active', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resilient Sphere', effect: 'resilient_sphere' },
      ]);

      const result = isResilientSphereActive('EnemyGoblin', campaignName);

      expect(result).toBe(true);
    });

    it('should return false when resilient sphere buff is not active', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Fire Shield', effect: 'fire_shield' },
      ]);

      const result = isResilientSphereActive('EnemyGoblin', campaignName);

      expect(result).toBe(false);
    });

    it('should return false when activeBuffs is empty', () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = isResilientSphereActive('EnemyGoblin', campaignName);

      expect(result).toBe(false);
    });

    it('should return false when activeBuffs is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = isResilientSphereActive('EnemyGoblin', campaignName);

      expect(result).toBe(false);
    });
  });

  describe('getResilientSphereSource', () => {
    it('should return caster name when sphere is active', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resilient Sphere', effect: 'resilient_sphere', sourceCharacter: 'TestWizard' },
      ]);

      const result = getResilientSphereSource('EnemyGoblin', campaignName);

      expect(result).toBe('TestWizard');
    });

    it('should return null when sphere is not active', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Fire Shield', effect: 'fire_shield' },
      ]);

      const result = getResilientSphereSource('EnemyGoblin', campaignName);

      expect(result).toBe(null);
    });

    it('should return null when no sourceCharacter on buff', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resilient Sphere', effect: 'resilient_sphere' },
      ]);

      const result = getResilientSphereSource('EnemyGoblin', campaignName);

      expect(result).toBe(null);
    });
  });

  describe('Toggle behavior', () => {
    it('should deactivate when sphere is already active on re-cast', async () => {
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-DEX-13',
        promise: Promise.resolve({ success: false }),
      });

      runtimeState.getRuntimeValue
        .mockReturnValueOnce([{ name: 'Resilient Sphere', effect: 'resilient_sphere' }]) // first call in toggle
        .mockReturnValueOnce([{ name: 'Resilient Sphere', effect: 'resilient_sphere' }]); // second call in toggle

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('enclosed in a Resilient Sphere');
    });
  });
});
