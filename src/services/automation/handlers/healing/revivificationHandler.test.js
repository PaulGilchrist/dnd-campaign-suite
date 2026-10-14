import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './revivificationHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logPoster from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerName = 'TestHero';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Revivification',
    automation,
  };
}

function makePlayerTarget(name) {
  return { name, type: 'player' };
}

// ── Tests ──────────────────────────────────────────────────────

describe('revivificationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Guard clauses ──────────────────────────────────────────

  describe('guard clauses', () => {
    it('returns popup when rage is 0 or null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return null;
        return null;
      });

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'No Rage remaining to power Revivification.',
      );
      expect(result.payload.automation).toEqual({});
    });

    it('returns popup when no combat is active', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No combat active.');
    });

    it('returns popup when no target selected', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Select a target in the combat tracker first.',
      );
    });

    it('returns popup when target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 5;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Ally is not at 0 Hit Points.',
      );
    });
  });

  // ── Healing logic ──────────────────────────────────────────

  describe('healing', () => {
    it('heals player target via setRuntimeValue for currentHitPoints', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        5,
        campaignName,
      );
    });

    it('heals player target with level 0 using default heal amount of 1', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const ps = makePlayerStats({ level: 0 });

      await handle(
        makeAction(),
        ps,
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        1,
        campaignName,
      );
    });
  });

  // ── Rage decrement ─────────────────────────────────────────

  describe('rage decrement', () => {
    it('decrements ragePoints by 1 regardless of target type', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 3;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'ragePoints',
        2,
        campaignName,
      );
    });
  });

  // ── Storage and event dispatch ─────────────────────────────

  describe('storage and events', () => {
    it('dispatches combat-summary-updated event', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'combat-summary-updated' }),
      );
      dispatchEventSpy.mockRestore();
    });
  });

  // ── Logging ────────────────────────────────────────────────

  describe('logging', () => {
    it('posts heal log entry with correct data', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'heal',
        characterName: playerName,
        targetName: 'Ally',
        amount: 5,
        abilityName: 'Revivification',
        timestamp: now,
      });
      dateSpy.mockRestore();
    });
  });

  // ── Success popup ──────────────────────────────────────────

  describe('success popup', () => {
    it('returns automation_info popup with correct description', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'TestHero uses Revivification to save Ally, setting their Hit Points to 5 and expending 1 Rage.',
      );
      expect(result.payload.name).toBe('Revivification');
    });
  });

  // ── NPC target healing ─────────────────────────────────────

  describe('NPC target healing', () => {
    function makeNPCTarget(name) {
      return { name, type: 'npc', currentHp: 0 };
    }

    it('sets target.currentHp for NPC target and saves combat summary', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      const combatCtx = { creatures: [] };
      damageUtils.getCombatContext.mockResolvedValue(combatCtx);
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin'));

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'ragePoints',
        0,
        campaignName,
      );
      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        combatCtx,
        campaignName,
      );
      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'TestHero uses Revivification to save Goblin, setting their Hit Points to 5 and expending 1 Rage.',
      );
    });

    it('uses default heal amount of 1 when level is 0 for NPC', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      const combatCtx = { creatures: [] };
      damageUtils.getCombatContext.mockResolvedValue(combatCtx);
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Ogre'));

      const ps = makePlayerStats({ level: 0 });

      await handle(
        makeAction(),
        ps,
        campaignName,
        null,
      );

      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        combatCtx,
        campaignName,
      );
    });

    it('handles negative rage value for player target (converts to 0)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return -1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'No Rage remaining to power Revivification.',
      );
    });
  });

  // ── Log error handling ─────────────────────────────────────

  describe('log error handling', () => {
    it('catches and logs addEntry errors', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));
      logPoster.addEntry.mockRejectedValue(new Error('Log service unavailable'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[revivification] Error:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
