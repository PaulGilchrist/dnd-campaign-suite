// @maintained-by-ai 2026-10-16
// Deterministic unit contract for the revivification handler (dead/0-HP target restore
// via rage spend). Module boundaries fully mocked; exact-key + full-string own-composition
// pins. Registry internals belong to targetEffectDefinitions.test.js; reaction rendering
// belongs to CharReactions.edgeCases.test.jsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
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
    it('sets player currentHitPoints to level in the merged death-state batch and spends 1 rage via setRuntimeValue', async () => {
      stubCombatReady(3);
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
        'Ally',
        {
          currentHitPoints: 5,
          deathSaves: [false, false, false],
          deathFailures: [false, false, false],
          isDead: 0,
        },
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

      expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
        'Ally',
        expect.objectContaining({ currentHitPoints: 1 }),
        campaignName,
      );
    });

    it('clears the death-state keys on resurrect (isDead-stuck regression)', async () => {
      // bug-revivification-handler-leaves-isdead-stuck: the old lane wrote only
      // currentHitPoints, leaving isDead:1 on a living 18-HP ally so every
      // downstream death gate (isCreatureDead, the Revivify corpse census)
      // still read it as a corpse. The resurrect commit must carry the full
      // CLA-092 death-state reset — the same write set as the HoUoM twin
      // (7d64885e3) and the sheet-revive lane (db0ad4cf8).
      stubCombatReady();
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(
        makeAction(),
        makePlayerStats({ level: 18 }),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
      const [target, writes, campaign] = useRuntimeState.setRuntimeBatch.mock.calls[0];
      expect(target).toBe('Ally');
      expect(campaign).toBe(campaignName);
      expect(writes.currentHitPoints).toBe(18);
      expect(writes.isDead).toBe(0);
      expect(writes.deathSaves).toEqual([false, false, false]);
      expect(writes.deathFailures).toEqual([false, false, false]);
      // HP must NOT ride a separate single-key write — that was the leak face.
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Ally', 'currentHitPoints', expect.anything(), campaignName);
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

  // ── Death→life crossing `unconscious` strip (improve 2026-11-15, QY backlog) ──
  // The pre-payment gate refuses any living target, so reaching the commit IS
  // the crossing: the interceptor-parity strip (stripUnconsciousOnRevive sheds
  // exactly `unconscious`, case-folded; prone rides through) must fold into the
  // ONE merged batch, never a second victim write. A living target refuses
  // pre-spend with zero reads of the condition bucket.

  describe('revive-crossing condition strip', () => {
    function stubCombatWithConditions(rage, conditions) {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return rage;
        if (key === 'currentHitPoints') return 0;
        if (key === 'activeConditions') return conditions;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
    }

    it('player corpse carrying unconscious+prone: the merged batch sheds unconscious and keeps prone', async () => {
      stubCombatWithConditions(1, ['unconscious', 'prone']);
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      await handle(makeAction(), makePlayerStats({ level: 18 }), campaignName, null);

      expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith(
        'Ally',
        {
          currentHitPoints: 18,
          deathSaves: [false, false, false],
          deathFailures: [false, false, false],
          isDead: 0,
          activeConditions: ['prone'],
        },
        campaignName,
      );
      // No second victim POST: only the rage spend rides setRuntimeValue.
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName, 'ragePoints', 0, campaignName);
    });

    it('player corpse with an unconscious-free bucket keeps the exact four-key batch (nothing materialised)', async () => {
      for (const raw of [null, [], ['prone']]) {
        useRuntimeState.setRuntimeBatch.mockClear();
        stubCombatWithConditions(1, raw);
        damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        const writes = useRuntimeState.setRuntimeBatch.mock.calls[0][1];
        expect(Object.keys(writes)).toEqual([
          'currentHitPoints', 'deathSaves', 'deathFailures', 'isDead',
        ]);
      }
    });

    it('monster corpse crossing sheds unconscious from its condition bucket', async () => {
      stubCombatWithConditions(1, ['unconscious']);
      const combatCtx = { creatures: [] };
      damageUtils.getCombatContext.mockResolvedValue(combatCtx);
      damageUtils.getTargetFromAttacker.mockReturnValue(makeNPCTarget('Goblin'));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', [], campaignName);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', combatCtx, campaignName);
    });

    it('living-target refusal pays nothing and NEVER reads the condition bucket (no strip off-crossing)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'ragePoints') return 1;
        if (key === 'currentHitPoints') return 5; // alive despite the seed trap
        if (key === 'activeConditions') return ['unconscious'];
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(makePlayerTarget('Ally'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('Ally is not at 0 Hit Points.');
      expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      const condReads = useRuntimeState.getRuntimeValue.mock.calls
        .filter(([, key]) => key === 'activeConditions');
      expect(condReads).toEqual([]);
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

      // Log-family parity (2026-11-14 resurrection log-family split): the old
      // unregistered type:'heal' row escaped every hp_change-keyed audit and
      // rendered via GenericEntry; revive writers ride the hp_change family.
      expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName: 'Ally',
        delta: 5,
        currentHp: 5,
        maxHp: undefined,
        isHealing: true,
        sourceName: playerName,
        note: 'Revivification',
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
