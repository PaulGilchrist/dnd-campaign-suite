// @maintained-by-ai
// Command spell lane — canonical home for commandHandler.handle (save-or-suck latch, no clock).
// Live path (grep-verified 2026-10-16): triggerSpells.js handleCommand → modalName 'commandChoice'
// → useSpellCastExecutor.js:130 → CommandModal.jsx (exact 5 options Approach/Drop/Flee/Grovel/Halt)
// → commandService.triggerCommand → executeHandler → automation/index.js:577 `command: handleCommand`.
// metaCtx.metamagicHeighten transport is live (savePath.js/noSavePath.js set it app-wide).
//
// NOT in the #1884/#1885 charm pair: commandHandler rolls its save directly through
// savePrompt.createSaveListener — it does NOT consume charmSpellUtils.rollNpcSave (that seam
// belongs to dominateHandler.js:174 / crownOfMadnessHandler.js:182 consumers of the charm pair).
// Full-string own-composition pins live here: commandLogDescription table + effectDescriptions
// table + cast/save_result strings.
//
// Seam notes:
// - buildSaveDc is stubbed to 16 (≠ auto.saveDc 15) so every downstream pin proves the DC
//   source is buildSaveDc, not action.automation.saveDc.
// - storeSpellLastAttack fires BEFORE resolveTarget and unconditionally — even a no-target
//   cast registers the rollback (pinned). addTargetResult rejections propagate to the
//   upstream commandService try/catch (out-of-file, by design).
// - `commandHalt` (Halt latch): grep confirms NO in-repo consumer (sentinelHalt is a distinct
//   key) — GM-adjudication marker. Write byte-pinned; consumer absence recorded honestly.
// - Turn-based: latch writes only on failed save at cast time; no timers, no wall-clock decay.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './commandHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

const campaignName = 'test-campaign';
// 16 ≠ automation.saveDc 15 → pins that DC flows from buildSaveDc.
const DC = 16;

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', level: 10, proficiency: 4, ...overrides };
}

// MERGE-style helper: overrides splice into automation/metaCtx instead of replacing the shell.
function makeAction(commandChoice = 'Approach', overrides = {}) {
  const { automation: automationOverrides, ...rest } = overrides;
  return {
    name: 'Command',
    automation: { type: 'command', commandChoice, saveType: 'WIS', saveDc: 15, ...automationOverrides },
    ...rest,
  };
}

function setupBaseMocks(saveResult = { success: true }) {
  resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  buildSaveDc.mockReturnValue(DC);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('commandHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('cast seam (exact keys)', () => {
    it('registers spell-last-attack rollback before target resolution, DC from buildSaveDc', async () => {
      resolveTarget.mockResolvedValue(null);
      buildSaveDc.mockReturnValue(DC);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Command',
        saveType: 'WIS',
        saveDc: DC,
        attackScope: 'single',
      });
      // Unconditional pre-resolution: the no-target popup still rides on a stored rollback.
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Command',
          description: 'No target selected. Command has no effect.',
        },
      });
    });

    it('resolves target with campaignName and caster name', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });

    it('nameless target: no-effect popup, no save prompt, no logs', async () => {
      resolveTarget.mockResolvedValue({ target: {} });
      buildSaveDc.mockReturnValue(DC);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('No target selected. Command has no effect.');
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('opens WIS save prompt with exact args (dcSuccess none, disadvantage false)', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: DC,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('Heightened metamagic transports save disadvantage (live metaCtx lane)', async () => {
      setupBaseMocks();

      await handle(makeAction('Approach', { metaCtx: { metamagicHeighten: true } }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveDc: DC,
        disadvantage: true,
      }));
    });

    it('defaults commandChoice to Approach when automation omits it', async () => {
      setupBaseMocks();

      await handle(makeAction(undefined, { commandChoice: undefined }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        description: 'TestCaster casts Command on Goblin with command "Approach"! Goblin must make a WIS save (DC 16) or follow the command.',
      }));
    });

    it('logs the cast with full composed description and promptId', async () => {
      setupBaseMocks();

      await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Command',
        description: 'TestCaster casts Command on Goblin with command "Grovel"! Goblin must make a WIS save (DC 16) or follow the command.',
        promptId: 'test-prompt-id',
      });
    });
  });

  describe('successful save', () => {
    it('reports success via addTargetResult, transports roll/total, defaults missing to 0', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 17 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 12,
        total: 17,
        conditions: [],
        appliedDamage: 0,
      });

      // Second cast with no roll metadata: ?? 0 defaults pin the rollback ledger shape.
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('logs save_result success and returns popup with exact strings; zero runtime writes', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-command',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Command.',
      });
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Command',
          description: 'Goblin succeeded on WIS save against Command.',
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('failed save — 5-command strict table (own composition)', () => {
    // commandLogDescription (ability_use leg) and effectDescriptions (save_result/popup leg)
    // are two DISTINCT tables in the handler — full strings keep them honest (e.g. Flee and
    // Halt diverge between legs). Rows mirror CommandModal.jsx COMMAND_OPTIONS exactly.
    const rows = [
      {
        choice: 'Approach',
        commandLog: 'Goblin failed WIS save against Command. Command: Approach — Goblin should move toward TestCaster by the shortest route and end turn within 5 feet.',
        resultLog: 'Goblin failed WIS save against Command (Approach). Goblin should move toward the caster by the shortest route and end turn within 5 feet.',
        conditions: [],
        runtime: 'none',
      },
      {
        choice: 'Drop',
        commandLog: 'Goblin failed WIS save against Command. Command: Drop — Goblin should drop held items and end turn.',
        resultLog: 'Goblin failed WIS save against Command (Drop). Goblin should drop held items and end turn.',
        conditions: [],
        runtime: 'none',
      },
      {
        choice: 'Flee',
        commandLog: 'Goblin failed WIS save against Command. Command: Flee — Goblin should spend turn moving away from TestCaster by the fastest means.',
        resultLog: 'Goblin failed WIS save against Command (Flee). Goblin should spend the turn moving away from the caster by the fastest means.',
        conditions: [],
        runtime: 'none',
      },
      {
        choice: 'Grovel',
        commandLog: null, // commandLogDescription default: NO ability_use command leg for Grovel — condition log only
        resultLog: 'Goblin failed WIS save against Command (Grovel). Goblin falls prone and then ends turn.',
        conditions: ['prone'],
        runtime: 'activeConditions',
      },
      {
        choice: 'Halt',
        commandLog: 'Goblin failed WIS save against Command. Command: Halt — Goblin shouldn\'t move or take actions on its next turn.',
        resultLog: 'Goblin failed WIS save against Command (Halt). Goblin shouldn\'t move or take actions or bonus actions on its next turn.',
        conditions: [],
        runtime: 'commandHalt',
      },
    ];

    it.each(rows)('$choice: exact ledger, logs, popup and latch', async ({ choice, commandLog, resultLog, conditions, runtime }) => {
      setupBaseMocks({ success: false, roll: 5, total: 10 });

      const result = await handle(makeAction(choice), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 10,
        conditions,
        appliedDamage: 0,
      });

      if (commandLog === null) {
        expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({
          abilityName: `Command: ${choice}`,
        }));
      } else {
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: `Command: ${choice}`,
          description: commandLog,
          timestamp: expect.any(Number),
        });
      }

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-command',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'WIS',
        success: false,
        description: resultLog,
      });

      expect(result.payload.description).toBe(resultLog);

      // Turn-based latch: only Grovel/Halt touch the runtime store, and only at cast time.
      if (runtime === 'none') {
        expect(setRuntimeValue).not.toHaveBeenCalled();
      } else if (runtime === 'commandHalt') {
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'commandHalt', true, campaignName);
      } else {
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['prone'], campaignName);
      }
    });

    it('unknown commandChoice falls back to the approach effect (choice text still transports)', async () => {
      setupBaseMocks({ success: false });

      const result = await handle(makeAction('Sleep'), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Command: Sleep',
        description: 'Goblin failed WIS save against Command. Command: Sleep — Goblin should move toward TestCaster by the shortest route and end turn within 5 feet.',
      }));
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({ conditions: [] }));
      expect(result.payload.description).toBe('Goblin failed WIS save against Command (Sleep). Goblin should move toward the caster by the shortest route and end turn within 5 feet.');
    });
  });

  describe('Grovel runtime write (latch internals)', () => {
    it('dedupes and re-appends prone, preserving other conditions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['prone', 'restrained']);

      await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['restrained', 'prone'], campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Prone',
        reason: 'Command spell (Grovel)',
        note: 'Goblin falls prone due to Command spell.',
      }));
    });

    it('non-array stored conditions are replaced with a lone prone', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue('prone');

      await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['prone'], campaignName);
    });
  });

  describe('error handling (log rejections never break the cast)', () => {
    it('ability_use cast-log rejection is caught and logged once; cast proceeds', async () => {
      setupBaseMocks({ success: true });
      addEntry.mockRejectedValueOnce(new Error('log error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('[command] Error:', expect.any(Error));
      });
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toBe('Goblin succeeded on WIS save against Command.');
      consoleSpy.mockRestore();
    });

    it('save_result rejection (Grovel fail) is caught; condition write and popup intact', async () => {
      setupBaseMocks({ success: false });
      addEntry.mockImplementation((campaign, entry) => (
        entry.type === 'save_result' ? Promise.reject(new Error('log error')) : Promise.resolve()
      ));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction('Grovel'), makePlayerStats(), campaignName, null);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledTimes(1);
      });
      expect(consoleSpy).toHaveBeenCalledWith('[command] Error:', expect.any(Error));
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['prone'], campaignName);
      expect(result.payload.description).toBe('Goblin failed WIS save against Command (Grovel). Goblin falls prone and then ends turn.');
      consoleSpy.mockRestore();
    });
  });
});
