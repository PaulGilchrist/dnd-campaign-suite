// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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
  buildSaveDc: vi.fn().mockReturnValue(13),
  createSaveListener: vi.fn(() => ({
    promptId: 'test-prompt-id',
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
const casterName = 'TestWizard';
const targetName = 'EnemyGoblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 16, WIS: 10, CHA: 10 },
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

function defaultCombatContext() {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name: targetName }],
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('resilientSphereHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: targetName } });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-id',
      promise: Promise.resolve({ success: false }),
    });
    defaultCombatContext();
  });

  describe('handle', () => {
    describe('combat context validation', () => {
      it('returns popup when combat context is null', async () => {
        damageUtils.getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Resilient Sphere');
        expect(result.payload.description).toContain('No creatures in combat');
      });

      it('returns popup when no creatures in combat', async () => {
        damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No creatures in combat');
      });
    });

    describe('target resolution', () => {
      it('returns popup when no target selected', async () => {
        targetResolver.resolveTarget.mockResolvedValue({});

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
      });

      it('returns popup when resolveTarget returns null', async () => {
        targetResolver.resolveTarget.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
      });
    });

    describe('save success path', () => {
      it('returns popup with success message when target passes save', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: true }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('succeeded on DEX save');
      });

      it('logs save_result with success=true when target passes save', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: true }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-resilient-sphere',
          targetName,
          saveDc: 13,
          saveType: 'DEX',
          success: true,
          description: expect.stringContaining('succeeded on DEX save'),
        });
      });

      it('does not apply buff or expiration on save success', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: true }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logPoster.postLogEntry).not.toHaveBeenCalled();
      });
    });

    describe('save failure path', () => {
      it('returns popup with failure message when target fails save', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Resilient Sphere');
      });

      it('logs ability_use when casting', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Resilient Sphere',
          description: expect.stringContaining('casts Resilient Sphere'),
          promptId: 'test-prompt-id',
        });
      });

      it('logs save_result with success=false when target fails save', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-resilient-sphere',
          targetName,
          saveDc: 13,
          saveType: 'DEX',
          success: false,
          description: expect.stringContaining('failed DEX save'),
        });
      });

      it('posts condition log entry for applied sphere', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Resilient Sphere',
          reason: 'Resilient Sphere',
          note: expect.stringContaining('enclosed in Otiluke\'s Resilient Sphere'),
          timestamp: expect.any(Number),
        });
      });

      it('calls setRuntimeValue to add the active buff', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          targetName,
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({
              name: 'Resilient Sphere',
              effect: 'resilient_sphere',
              sourceCharacter: casterName,
            }),
          ]),
          campaignName,
        );
      });

      it('calls addExpiration for concentration timer', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(expirations.addExpiration).toHaveBeenCalledWith(
          casterName,
          targetName,
          [{ type: 'remove_active_buff', buffName: 'Resilient Sphere', effect: 'resilient_sphere' }],
          campaignName,
          10,
        );
      });

      it('uses custom duration from automation config', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        const action = makeAction({ duration: 'Concentration, up to 2 minutes' });

        await handle(action, makePlayerStats(), campaignName, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          targetName,
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({
              duration: 'Concentration, up to 2 minutes',
            }),
          ]),
          campaignName,
        );
      });

      it('uses default duration when not provided in automation', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          targetName,
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({
              duration: 'Concentration, up to 1 minute',
            }),
          ]),
          campaignName,
        );
      });
    });

    describe('toggle behavior (re-cast)', () => {
      it('removes the buff when sphere is already active', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        runtimeState.getRuntimeValue.mockReturnValue([
          { name: 'Resilient Sphere', effect: 'resilient_sphere', sourceCharacter: casterName },
        ]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          targetName,
          'activeBuffs',
          expect.not.arrayContaining([
            expect.objectContaining({ effect: 'resilient_sphere' }),
          ]),
          campaignName,
        );
      });

      it('does not add expiration when deactivating existing sphere', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        runtimeState.getRuntimeValue.mockReturnValue([
          { name: 'Resilient Sphere', effect: 'resilient_sphere', sourceCharacter: casterName },
        ]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(expirations.addExpiration).not.toHaveBeenCalled();
      });


    });

    describe('buildSaveDc integration', () => {
      it('passes automation and playerStats to buildSaveDc', async () => {
        savePrompt.buildSaveDc.mockReturnValue(15);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'spell' }),
          expect.objectContaining({ name: casterName }),
        );
      });
    });
  });

  describe('isResilientSphereActive', () => {
    it('returns true when resilient sphere buff is active on target', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resilient Sphere', effect: 'resilient_sphere' },
      ]);

      const result = isResilientSphereActive(targetName, campaignName);

      expect(result).toBe(true);
    });

    it('returns false when target has different buff', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Fire Shield', effect: 'fire_shield' },
      ]);

      const result = isResilientSphereActive(targetName, campaignName);

      expect(result).toBe(false);
    });

    it('returns false when activeBuffs array is empty', () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = isResilientSphereActive(targetName, campaignName);

      expect(result).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = isResilientSphereActive(targetName, campaignName);

      expect(result).toBe(false);
    });

    it('returns false when activeBuffs is undefined', () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = isResilientSphereActive(targetName, campaignName);

      expect(result).toBe(false);
    });
  });

  describe('getResilientSphereSource', () => {
    it('returns caster name when sphere is active with sourceCharacter', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resilient Sphere', effect: 'resilient_sphere', sourceCharacter: casterName },
      ]);

      const result = getResilientSphereSource(targetName, campaignName);

      expect(result).toBe(casterName);
    });

    it('returns null when sphere is not active on target', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Fire Shield', effect: 'fire_shield' },
      ]);

      const result = getResilientSphereSource(targetName, campaignName);

      expect(result).toBe(null);
    });

    it('returns null when buff exists but has no sourceCharacter', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resilient Sphere', effect: 'resilient_sphere' },
      ]);

      const result = getResilientSphereSource(targetName, campaignName);

      expect(result).toBe(null);
    });

    it('returns null when activeBuffs is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = getResilientSphereSource(targetName, campaignName);

      expect(result).toBe(null);
    });
  });
});
