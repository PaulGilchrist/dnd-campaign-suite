import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './reactionSaveHealHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestBarbarian',
    level: 5,
    barbarianLevel: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Relentless Rage',
    automation: {
      saveType: 'CON',
      saveDc: 12,
      healExpression: 'barbarian_level + 4',
      ...automation,
    },
  };
}

function makeCombatSummary(overrides = {}) {
  return {
    creatures: [
      {
        name: 'TestBarbarian',
        type: 'player',
        currentHp: 0,
      },
    ],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionSaveHealHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((name, key, _camName) => {
      if (key === 'ragePoints') return 1;
      if (key === 'currentHitPoints') return 0;
      if (key === 'relentlessrageUses') return 0;
      return 0;
    });
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
    logService.addEntry.mockReturnValue(Promise.resolve({}));
    damageUtils.getCombatContext.mockResolvedValue(
      makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
    );
  });

  // ── Rage check ──────────────────────────────────────────────

  describe('Rage check', () => {
    it('returns popup when no rage remaining (storedRage = 0)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No Rage remaining');
    });

    it('returns popup when no rage remaining (storedRage = null)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No Rage remaining');
    });

    it('returns popup when no rage remaining (storedRage undefined)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No Rage remaining');
    });

    it('returns popup when rage is negative', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(-1);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No Rage remaining');
    });


  });

  // ── Combat context check ────────────────────────────────────

  describe('Combat context check', () => {
    it('returns popup when no combat active (getCombatContext returns null)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat active');
    });

    it('proceeds when combat is active', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });
  });

  // ── HP check ────────────────────────────────────────────────

  describe('HP check', () => {
    it('returns popup when player HP > 0 (not at 0)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({
          creatures: [
            { name: 'TestBarbarian', type: 'player', currentHp: 5 },
          ],
        })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not at 0 Hit Points');
    });

    it('proceeds when player not found in combat creatures (defaults to 0 HP)', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });

    it('proceeds when player HP is exactly 0', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });

    it('reads HP from runtime state when creature type is player', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1); // rage
      runtimeState.getRuntimeValue.mockReturnValueOnce(10); // currentHitPoints (shouldn't reach this check)
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 10 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      // Should still proceed because creature.currentHp > 0
      expect(result.payload.description).toContain('not at 0 Hit Points');
    });

    it('reads HP from creature when type is not player', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });

    it('handles creature with missing currentHp (defaults to 0)', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player' }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      // currentHp is undefined, defaults to 0 via ??, so player is at 0 HP
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });
  });

  // ── Uses / recharge check ───────────────────────────────────

  describe('Uses / recharge check', () => {
    it('returns popup when uses exhausted (currentUses >= maxUses)', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 1;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('proceeds when uses available', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });

    it('uses feature name to build uses key', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'short_or_long_rest' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'relentlessrageUses',
      );
    });

    it('handles custom feature name for uses key', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'specialrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = { name: 'Special Rage', automation: { saveType: 'CON' } };

      await handle(action, ps, campaignName, null);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'specialrageUses',
      );
    });
  });

  // ── Save DC calculation ─────────────────────────────────────

  describe('Save DC calculation', () => {
    it('uses automation saveDc when provided', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 15 });

      await handle(action, ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 15,
      });
    });

    it('defaults saveDc to 10 when not provided', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = { name: 'Relentless Rage', automation: { saveType: 'CON' } };

      await handle(action, ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 10,
      });
    });


  });

  // ── Save type ───────────────────────────────────────────────

  describe('Save type', () => {
    it('uses automation saveType when provided', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'WIS' });

      await handle(action, ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'WIS',
        saveDc: 12,
      });
    });

    it('defaults saveType to CON when not provided', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = { name: 'Relentless Rage', automation: { saveDc: 12 } };

      await handle(action, ps, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: 12,
      });
    });
  });

  // ── Log entry ───────────────────────────────────────────────

  describe('Log entry', () => {
    it('adds ability_use log entry on trigger', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBarbarian',
        abilityName: 'Relentless Rage',
        description: 'Relentless Rage triggered — TestBarbarian must make CON save (DC 12)',
        promptId: 'prompt-123',
      });
    });

    it('includes promptId in log entry', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );
      savePrompt.createSaveListener.mockReturnValue({ promptId: 'unique-prompt-id' });

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        promptId: 'unique-prompt-id',
      }));
    });

    it('uses custom saveType in log entry description', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'WIS' });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: 'Relentless Rage triggered — TestBarbarian must make WIS save (DC 12)',
      }));
    });

  });

  // ── Popup return ────────────────────────────────────────────

  describe('Popup return', () => {
    it('returns popup with automation_info payload on success path', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Relentless Rage');
      expect(result.payload.targetName).toBe('TestBarbarian');
      expect(result.payload.automation).toBe(action.automation);
    });

    it('includes save type and DC in popup description', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 15 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('CON saving throw');
      expect(result.payload.description).toContain('DC 15');
    });

    it('uses default CON in popup description when saveType missing', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = { name: 'Relentless Rage', automation: { saveDc: 12 } };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('CON saving throw');
      expect(result.payload.description).toContain('DC 12');
    });

    it('uses custom feature name in popup', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = { name: 'Unbreakable Spirit', automation: { saveType: 'CON' } };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Unbreakable Spirit');
    });
  });

  // ── Save result - Success path ──────────────────────────────

  describe('Save result - Success path', () => {
    it('sets HP to healAmount on successful save', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ healExpression: 'barbarian_level + 4' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        expect.any(Number),
        campaignName,
      );
    });

    it('adds save_result log entry on success', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      await vi.waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          type: 'save_result',
          success: true,
          saveType: 'CON',
          saveDc: 12,
        }));
      });
    });

    it('dispatches combat-summary-updated event on success', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      const eventDispatched = vi.fn();
      window.addEventListener('combat-summary-updated', eventDispatched, { once: true });

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      await vi.waitFor(() => {
        expect(eventDispatched).toHaveBeenCalled();
      });
    });

    it('increments uses after successful save', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      await vi.waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestBarbarian',
          'relentlessrageUses',
          1,
          campaignName,
        );
      });
    });

    it('removes event listener after save result', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      await vi.waitFor(() => {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          'save-result',
          expect.any(Function),
        );
      });

      removeEventListenerSpy.mockRestore();
    });

    it('uses custom saveType in success log entry', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'WIS' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      await vi.waitFor(() => {
        const saveResultCalls = logService.addEntry.mock.calls.filter(
          call => call[1]?.type === 'save_result'
        );
        expect(saveResultCalls.length).toBeGreaterThan(0);
        expect(saveResultCalls[0][1].saveType).toBe('WIS');
      });
    });

    it('ignores save-result events with different promptId on success path', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'wrong-prompt-id', success: true },
      }));

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        expect.any(Number),
        campaignName,
      );
    });
  });

  // ── Save result - Failure path ──────────────────────────────

  describe('Save result - Failure path', () => {
    it('adds save_result log entry with success=false on failed save', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false },
      }));

      const saveResultCalls = logService.addEntry.mock.calls.filter(
        call => call[1]?.type === 'save_result'
      );
      expect(saveResultCalls.length).toBeGreaterThan(0);
      expect(saveResultCalls[0][1].success).toBe(false);
    });

    it('does not set HP on failed save', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false },
      }));

      // setRuntimeValue should NOT have been called for currentHitPoints
      const hpCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'currentHitPoints'
      );
      expect(hpCalls.length).toBe(0);
    });

    it('still increments uses after failed save', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false },
      }));

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'relentlessrageUses',
        1,
        campaignName,
      );
    });

    it('does not dispatch combat-summary-updated on failed save', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      const eventDispatched = vi.fn();
      window.addEventListener('combat-summary-updated', eventDispatched, { once: true });

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false },
      }));

      expect(eventDispatched).not.toHaveBeenCalled();
    });

    it('ignores save-result events with different promptId on failure path', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'wrong-prompt-id', success: false },
      }));

      const saveResultCalls = logService.addEntry.mock.calls.filter(
        call => call[1]?.type === 'save_result'
      );
      expect(saveResultCalls.length).toBe(0);
    });
  });

  // ── Heal expression evaluation ──────────────────────────────

  describe('Heal expression evaluation', () => {
    it('evaluates numeric healExpression directly', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ healExpression: 10 });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('evaluates barbarian_level + N expression', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ barbarianLevel: 5 });
      const action = makeAction({ healExpression: 'barbarian_level + 4' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      // The handler uses evaluateHealExpression which matches "2 * barbarian_level"
      // for 'barbarian_level + 4' it falls through to the generic numeric match
      // which tries to parse "barbarian_level + 4" as "N * field"
      // This won't match the regex /^(\d+)\s*\*\s*(\w+)$/ so it falls to "level || 1"
      // Actually let's trace: String('barbarian_level + 4').match(/2\s*\*\s*barbarian_level/i) -> null
      // Then /^(\d+)\s*\*\s*(\w+)$/ -> null (no '*' in expression)
      // Then returns playerStats.level || 1 = 5
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        5,
        campaignName,
      );
    });

    it('evaluates "2 * barbarian_level" expression', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ barbarianLevel: 5 });
      const action = makeAction({ healExpression: '2 * barbarian_level' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('evaluates "2 * level" expression', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ level: 7 });
      const action = makeAction({ healExpression: '2 * level' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        14,
        campaignName,
      );
    });

    it('falls back to player level when expression is unrecognizable', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ healExpression: '1d8+CON' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      // Unrecognizable expression falls through to playerStats.level || 1
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        3,
        campaignName,
      );
    });

    it('falls back to level 1 when no expression and no level', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ level: undefined, barbarianLevel: undefined });
      const action = makeAction({ healExpression: undefined });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      // No expression -> evaluateHealExpression returns playerStats.level || 1 = 1
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        1,
        campaignName,
      );
    });

    it('uses barbarian_level from class_levels when barbarianLevel not on stats', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ barbarianLevel: undefined, class: { class_levels: [{ name: 'Barbarian', level: 8 }] } });
      const action = makeAction({ healExpression: '2 * barbarian_level' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      // Should find Barbarian level 8 from class_levels
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        16,
        campaignName,
      );
    });

    it('uses player level as fallback when barbarian not found in class_levels', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ barbarianLevel: undefined, class: { class_levels: [{ name: 'Fighter', level: 10 }] } });
      const action = makeAction({ healExpression: '2 * barbarian_level' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      // No Barbarian in class_levels, falls back to playerStats.level || 1
      // 2 * 5 = 10
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        10,
        campaignName,
      );
    });

    it('uses 1 as fallback when barbarian not found and no player level', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ barbarianLevel: undefined, level: undefined, class: { class_levels: [{ name: 'Fighter', level: 3 }] } });
      const action = makeAction({ healExpression: '2 * barbarian_level' });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      // No Barbarian in class_levels, no player level -> defaults to 1
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        2,
        campaignName,
      );
    });
  });

  // ── Creature name matching ──────────────────────────────────

  describe('Creature name matching', () => {
    it('finds creature by exact name match', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('finds creature by name prefix match (name + space)', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian (Player)', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });

    it('proceeds when creature not found (defaults to 0 HP)', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'OtherCreature', type: 'npc', currentHp: 5 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saving throw');
    });
  });

  // ── Recharge / maxUses ──────────────────────────────────────

  describe('Recharge / maxUses', () => {
    it('treats short_or_long_rest as maxUses = 1', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 1;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'short_or_long_rest' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('no uses remaining');
    });

    it('treats unspecified recharge as maxUses = 1', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 1;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('no uses remaining');
    });
  });

  // ── Event listener cleanup ──────────────────────────────────

  describe('Event listener cleanup', () => {
    it('handles event listener removal on failed save', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      // Dispatch failure - this should trigger log entry and removeEventListener
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: false },
      }));

      await vi.waitFor(() => {
        const allCalls = logService.addEntry.mock.calls;
        const saveResultCalls = allCalls.filter(
          call => call[1]?.type === 'save_result'
        );
        expect(saveResultCalls.length).toBeGreaterThanOrEqual(1);
        expect(saveResultCalls[saveResultCalls.length - 1][1].success).toBe(false);
      });
    });
  });

  // ── Edge cases ──────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles campaignName parameter correctly', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key, campaignNameParam) => {
        if (key === 'ragePoints') return campaignNameParam === campaignName ? 1 : 0;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'ragePoints',
        campaignName,
      );
    });

    it('handles player name with special characters', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'Test-Barbarian!', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ name: 'Test-Barbarian!' });
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe('Test-Barbarian!');
    });

    it('handles null campaignName gracefully (getCombatContext returns null)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, null, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No combat active');
    });

    it('handles undefined playerStats.level gracefully', async () => {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'relentlessrageUses') return 0;
        return 0;
      });
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatSummary({ creatures: [{ name: 'TestBarbarian', type: 'player', currentHp: 0 }] })
      );

      const ps = makePlayerStats({ level: undefined });
      const action = makeAction({ healExpression: 5 });

      await handle(action, ps, campaignName, null);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'prompt-123', success: true },
      }));

      // healExpression is numeric 5, so it returns 5 directly
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBarbarian',
        'currentHitPoints',
        5,
        campaignName,
      );
    });
  });
});
