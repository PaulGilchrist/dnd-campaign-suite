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
import * as logPoster from '../../../ui/logService.js';
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
      it('returns popup when no creatures in combat (null context, empty array, or no creatures property)', async () => {
        damageUtils.getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Resilient Sphere');
        expect(result.payload.description).toContain('No creatures in combat');
      });
    });

    describe('target resolution', () => {
      it('returns popup when no target selected (null, undefined, or empty object)', async () => {
        targetResolver.resolveTarget.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
      });
    });

    describe('save success path', () => {
      it('returns popup with success message and logs save_result when target passes save', async () => {
        savePrompt.createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: true }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('succeeded on DEX save');
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
        expect(logPoster.addEntry).toHaveBeenCalledTimes(2);
        const abilityEntries = logPoster.addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
        expect(abilityEntries.length).toBe(1);
        const saveEntries = logPoster.addEntry.mock.calls.filter(call => call[1].type === 'save_result');
        expect(saveEntries.length).toBe(1);
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

        expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
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
    });

    describe('toggle behavior (re-cast)', () => {
      it('removes the buff and does not add expiration when sphere is already active', async () => {
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

    it('returns false when target has different buff, empty array, or null/undefined buffs', () => {
      const testCases = [
        { buffs: [{ name: 'Fire Shield', effect: 'fire_shield' }], expected: false },
        { buffs: [], expected: false },
        { buffs: null, expected: false },
        { buffs: undefined, expected: false },
      ];

      for (const { buffs, expected } of testCases) {
        runtimeState.getRuntimeValue.mockReturnValue(buffs);
        const result = isResilientSphereActive(targetName, campaignName);
        expect(result).toBe(expected);
      }
    });
  });

  describe('getResilientSphereSource', () => {
    it('returns caster name when sphere is active with sourceCharacter, null otherwise', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resilient Sphere', effect: 'resilient_sphere', sourceCharacter: casterName },
      ]);

      expect(getResilientSphereSource(targetName, campaignName)).toBe(casterName);

      const testCases = [
        { buffs: [{ name: 'Fire Shield', effect: 'fire_shield' }] },
        { buffs: [{ name: 'Resilient Sphere', effect: 'resilient_sphere' }] },
        { buffs: null },
      ];

      for (const { buffs } of testCases) {
        runtimeState.getRuntimeValue.mockReturnValue(buffs);
        expect(getResilientSphereSource(targetName, campaignName)).toBeNull();
      }
    });
  });
});
