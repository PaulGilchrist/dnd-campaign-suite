// @cleaned-by-ai
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

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
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
import * as logPoster from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
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

function makeNPCTarget(name, currentHp = 0) {
  return { name, type: 'npc', currentHp };
}

// ── Tests ──────────────────────────────────────────────────────

describe('revivificationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Guard clauses ──────────────────────────────────────────

  describe('guard clauses', () => {
    it('returns popup when rage is 0', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 0;
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

    it('returns popup when rage is negative or null', async () => {
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
      expect(result.payload.description).toBe(
        'No Rage remaining to power Revivification.',
      );
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

    it('returns popup when player target is not at 0 HP', async () => {
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

    it('returns popup when NPC target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(
        makeNPCTarget('Goblin', 3),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Goblin is not at 0 Hit Points.',
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

    it('heals NPC target by setting target.currentHp directly', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      const target = makeNPCTarget('Goblin', 0);
      damageUtils.getTargetFromAttacker.mockReturnValue(target);

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(target.currentHp).toBe(5);
    });
  });

  // ── Rage decrement ─────────────────────────────────────────

  describe('rage decrement', () => {
    it('decrements ragePoints by 1 for player target', async () => {
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

    it('decrements ragePoints by 1 for NPC target', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 3;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin'));

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
    it('calls storage.set with combatSummary when healing NPC', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      const combatContext = { creatures: [] };
      damageUtils.getCombatContext.mockResolvedValue(combatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin'));

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        combatContext,
        campaignName,
      );
    });

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
    it('posts heal log entry with correct data for player target', async () => {
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

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'heal',
        characterName: playerName,
        targetName: 'Ally',
        amount: 5,
        abilityName: 'Revivification',
        timestamp: now,
      });
      dateSpy.mockRestore();
    });

    it('posts heal log entry with correct data for NPC target', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin'));

      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'heal',
        characterName: playerName,
        targetName: 'Goblin',
        amount: 5,
        abilityName: 'Revivification',
        timestamp: now,
      });
      dateSpy.mockRestore();
    });
  });

  // ── Heal amount ────────────────────────────────────────────

  describe('heal amount', () => {
    it('uses playerStats.level as healAmount', async () => {
      const ps = makePlayerStats({ level: 7 });
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(
        makeAction(),
        ps,
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        7,
        campaignName,
      );
    });

    it('uses default healAmount of 1 when level is falsy', async () => {
      const ps = makePlayerStats({ level: 0 });
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

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

  // ── Success popup ──────────────────────────────────────────

  describe('success popup', () => {
    it('returns automation_info popup with correct description for player target', async () => {
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

    it('returns automation_info popup with correct description for NPC target', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin'));

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'TestHero uses Revivification to save Goblin, setting their Hit Points to 5 and expending 1 Rage.',
      );
    });
  });
});
