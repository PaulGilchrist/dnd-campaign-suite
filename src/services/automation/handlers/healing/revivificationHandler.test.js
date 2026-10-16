// @maintained-by-ai
// Deterministic unit contract for the revivification handler (dead/0-HP target restore
// via rage spend). Module boundaries fully mocked; exact-key + full-string own-composition
// pins. Registry internals belong to targetEffectDefinitions.test.js; reaction rendering
// belongs to CharReactions.edgeCases.test.jsx.

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

// MERGES automation overrides onto a realistic default (CharReactions.jsx shape).
function makeAction(automationOverrides = {}) {
  return {
    name: 'Revivification',
    automation: { type: 'revivification', ...automationOverrides },
  };
}

function makePlayerTarget(name) {
  return { name, type: 'player' };
}

function makeNPCTarget(name, currentHp = 0) {
  return { name, type: 'npc', currentHp };
}

function stubRage(value) {
  useRuntimeState.getRuntimeValue.mockImplementation((_target, key) => {
    if (key === 'ragePoints') return value;
    return null;
  });
}

function stubCombatReady(rage = 1) {
  useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
    if (key === 'ragePoints') return rage;
    if (key === 'currentHitPoints') return 0;
    return null;
  });
  damageUtils.getCombatContext.mockResolvedValue({});
}

// ── Tests ──────────────────────────────────────────────────────

describe('revivificationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Guard clauses ──────────────────────────────────────────

  describe('guard clauses', () => {
    it('returns info popup when rage is missing, and echoes action automation untouched', async () => {
      stubRage(null);

      const automation = { type: 'revivification', reactionSave: { dc: 15, type: 'CON' } };
      const result = await handle(
        makeAction(automation),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'No Rage remaining to power Revivification.',
      );
      expect(result.payload.automation).toEqual(automation);
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('returns popup when stored rage is negative', async () => {
      stubRage(-1);

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
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns popup when no combat is active', async () => {
      stubRage(1);
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
      stubRage(1);
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
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns popup when NPC target is not at 0 HP', async () => {
      stubCombatReady();
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin', 7));

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
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  // ── Player target lane ─────────────────────────────────────

  describe('player target healing', () => {
    it('sets player currentHitPoints to level and spends 1 rage via setRuntimeValue', async () => {
      stubCombatReady(3);
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
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'ragePoints',
        2,
        campaignName,
      );
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('defaults heal amount to 1 when level is 0', async () => {
      stubCombatReady();
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(
        makeAction(),
        makePlayerStats({ level: 0 }),
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

    it('returns success popup with full description', async () => {
      stubCombatReady();
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Revivification');
      expect(result.payload.description).toBe(
        'TestHero uses Revivification to save Ally, setting their Hit Points to 5 and expending 1 Rage.',
      );
    });

    it('dispatches combat-summary-updated event', async () => {
      stubCombatReady();
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

  // ── NPC target lane ────────────────────────────────────────

  describe('NPC target healing', () => {
    it('mutates target.currentHp and persists combat summary via storage.set', async () => {
      stubCombatReady();
      const combatCtx = { creatures: [] };
      damageUtils.getCombatContext.mockResolvedValue(combatCtx);
      const goblin = makeNPCTarget('Goblin');
      damageUtils.getTargetFromAttacker.mockReturnValue(goblin);

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(goblin.currentHp).toBe(5);
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
  });

  // ── Logging ──────────────────────────────────────────────────

  describe('logging', () => {
    it('posts heal log entry with exact payload', async () => {
      stubCombatReady();
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

    it('catches addEntry rejection, logs it, and still returns success popup', async () => {
      stubCombatReady();
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));
      logPoster.addEntry.mockRejectedValueOnce(new Error('Log service unavailable'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[revivification] Error:',
        expect.any(Error),
      );
      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'TestHero uses Revivification to save Ally, setting their Hit Points to 5 and expending 1 Rage.',
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
