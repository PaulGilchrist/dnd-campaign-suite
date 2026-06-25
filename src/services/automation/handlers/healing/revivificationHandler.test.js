// @improved-by-ai
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

  // ── Rage checks ────────────────────────────────────────────

  describe('rage validation', () => {
    it('returns automation_info popup when rage is 0', async () => {
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
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('returns automation_info popup when rage is negative', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return -2;
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

    it('treats null stored rage as 0', async () => {
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

    it('reads rage with correct character name, key, and campaign', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'ragePoints',
        campaignName,
      );
    });
  });

  // ── Combat context checks ──────────────────────────────────

  describe('combat context', () => {
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
      expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
    });

    it('passes correct campaign name to getCombatContext', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
    });
  });

  // ── Target selection checks ────────────────────────────────

  describe('target selection', () => {
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

    it('passes correct combat context and attacker name to getTargetFromAttacker', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      const combatContext = { creatures: [] };
      damageUtils.getCombatContext.mockResolvedValue(combatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith(
        combatContext,
        playerName,
      );
    });
  });

  // ── Target HP checks ───────────────────────────────────────

  describe('target HP validation', () => {
    it('reads target HP from runtime state for player targets', async () => {
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

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        campaignName,
      );
    });

    it('reads target HP from target.currentHp for NPC targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(
        makeNPCTarget('Goblin', 0),
      );

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'currentHitPoints',
        campaignName,
      );
    });

    it('defaults target HP to 0 when getRuntimeValue returns null for player', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return null;
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

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        campaignName,
      );
    });

    it('defaults target HP to 0 when target.currentHp is null for NPC', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Goblin',
        type: 'npc',
        currentHp: null,
      });

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'currentHitPoints',
        campaignName,
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

    it('does not call setRuntimeValue when target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 5;
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

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
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

    it('does not call setRuntimeValue for rage when target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 5;
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

      const rageCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'ragePoints',
      );
      expect(rageCalls).toHaveLength(0);
    });

    it('does not call storage.set or dispatchEvent when target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 5;
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

      expect(storage.set).not.toHaveBeenCalled();
    });

    it('does not call postLogEntry when target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 5;
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

      expect(logPoster.postLogEntry).not.toHaveBeenCalled();
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

    it('calls rage decrement before healing', async () => {
      const callOrder = [];
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      useRuntimeState.setRuntimeValue.mockImplementation((target, key) => {
        callOrder.push(key);
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      const rageIndex = callOrder.indexOf('ragePoints');
      const hpIndex = callOrder.indexOf('currentHitPoints');
      expect(rageIndex).toBeLessThan(hpIndex);
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

    it('does not call storage.set when healing player target', async () => {
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

      expect(storage.set).not.toHaveBeenCalled();
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

    it('dispatches event even when healing NPC target', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin'));

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

    it('uses default healAmount of 1 when level is 0', async () => {
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

    it('uses default healAmount of 1 when level is falsy (undefined)', async () => {
      const ps = makePlayerStats({ level: undefined });
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

    it('includes the automation object in the success payload', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const customAutomation = { customFlag: true, value: 42 };
      const result = await handle(
        makeAction(customAutomation),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.automation).toEqual(customAutomation);
    });
  });

  // ── Target type edge cases ─────────────────────────────────

  describe('target type edge cases', () => {
    it('treats target without type field as non-player (NPC path)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Unknown',
        currentHp: 0,
      });

      const target = { name: 'Unknown', currentHp: 0 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(target.currentHp).toBe(5);
      expect(storage.set).toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Unknown',
        'currentHitPoints',
        expect.anything(),
        campaignName,
      );
    });
  });
});
