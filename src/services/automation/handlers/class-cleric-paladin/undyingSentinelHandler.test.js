// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle } from './undyingSentinelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    class: { class_levels: [{ level: 5 }] },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Undying Sentinel',
    automation: { type: 'undying_sentinel', ...automation },
  };
}

function makePlayerTarget(name = 'DownedAlly', hp = 0) {
  return { name, type: 'player', currentHitPoints: hp };
}

function makeNPCTarget(name = 'Goblin', hp = 0) {
  return { name, type: 'npc', currentHp: hp };
}

// ── beforeEach / afterEach ───────────────────────────────────────

let dispatchEventSpy;
let dateNowSpy;

beforeEach(() => {
  vi.clearAllMocks();
  dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
  dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
});

afterEach(() => {
  dispatchEventSpy.mockRestore();
  dateNowSpy.mockRestore();
});

// ── Tests ────────────────────────────────────────────────────────

describe('undyingSentinelHandler', () => {
  describe('handle', () => {
    describe('guard clauses', () => {
      it('returns popup when ability already used this long rest', async () => {
        getRuntimeValue.mockReturnValue(true);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result).toEqual({
          type: 'popup',
          payload: expect.objectContaining({
            type: 'automation_info',
            name: 'Undying Sentinel',
            description: expect.stringContaining('already been used'),
          }),
        });
      });

      it('returns popup when no combat is active', async () => {
        getRuntimeValue.mockReturnValue(false);
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result).toEqual({
          type: 'popup',
          payload: expect.objectContaining({
            type: 'automation_info',
            description: 'No combat active.',
          }),
        });
      });

      it('returns popup when no target is selected in combat', async () => {
        getRuntimeValue.mockReturnValue(false);
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result).toEqual({
          type: 'popup',
          payload: expect.objectContaining({
            type: 'automation_info',
            description: 'Select a target in the combat tracker first.',
          }),
        });
      });

      it('returns popup when target is not at 0 HP', async () => {
        getRuntimeValue
          .mockReturnValueOnce(false)
          .mockImplementation((name, key) => {
            if (key === 'currentHitPoints' && name === 'DownedAlly') return 5;
            return null;
          });
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue(makePlayerTarget('DownedAlly', 5));

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result).toEqual({
          type: 'popup',
          payload: expect.objectContaining({
            type: 'automation_info',
            description: 'DownedAlly is not at 0 Hit Points.',
          }),
        });
      });
    });

    describe('successful heal — player target', () => {
      function setupPlayerHeal(targetName = 'DownedAlly', maxHp = 50) {
        getRuntimeValue
          .mockReturnValueOnce(false)
          .mockImplementation((name, key) => {
            if (key === 'currentHitPoints' && name === targetName) return 0;
            if (key === 'hitPoints' && name === 'TestCleric') return maxHp;
            return null;
          });
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue(makePlayerTarget(targetName, 0));
      }

      it('heals target and marks ability as used', async () => {
        setupPlayerHeal();
        const stats = makePlayerStats({ level: 5 });

        const result = await handle(makeAction(), stats, campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestCleric',
          'undyingSentinelUsed',
          true,
          campaignName,
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'DownedAlly',
          'currentHitPoints',
          16,
          campaignName,
        );
        expect(result.payload.description).toContain('survive');
        expect(result.payload.description).toContain('16 HP');
      });

      it('caps healed HP at target maximum HP', async () => {
        setupPlayerHeal('DownedAlly', 10);

        await handle(makeAction(), makePlayerStats({ level: 5 }), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'DownedAlly',
          'currentHitPoints',
          10,
          campaignName,
        );
      });

      it('uses level 7 paladin to heal 22 HP', async () => {
        setupPlayerHeal('DownedAlly', 100);

        await handle(makeAction(), makePlayerStats({ level: 7 }), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'DownedAlly',
          'currentHitPoints',
          22,
          campaignName,
        );
      });

      it('posts a heal log entry and dispatches combat-summary-updated event', async () => {
        setupPlayerHeal();

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
          type: 'heal',
          characterName: 'TestCleric',
          targetName: 'DownedAlly',
          amount: 16,
          abilityName: 'Undying Sentinel',
          timestamp: 1700000000000,
        });
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'combat-summary-updated' }),
        );
      });
    });

    describe('successful heal — NPC target', () => {
      function setupNPCHeal(target = makeNPCTarget()) {
        getRuntimeValue
          .mockReturnValueOnce(false)
          .mockReturnValue(null);
        getCombatContext.mockResolvedValue({ creatures: [] });
        getTargetFromAttacker.mockReturnValue(target);
      }

      it('heals NPC target, saves combatSummary, posts log, and dispatches event', async () => {
        const target = makeNPCTarget('Goblin', 0);
        const cs = { creatures: [target] };
        getRuntimeValue
          .mockReturnValueOnce(false)
          .mockReturnValue(null);
        getCombatContext.mockResolvedValue(cs);
        getTargetFromAttacker.mockReturnValue(target);

        await handle(makeAction(), makePlayerStats({ level: 5 }), campaignName, null);

        expect(target.currentHp).toBe(16);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
        expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
          type: 'heal',
          characterName: 'TestCleric',
          targetName: 'Goblin',
          amount: 16,
          abilityName: 'Undying Sentinel',
          timestamp: 1700000000000,
        });
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'combat-summary-updated' }),
        );
      });
    });
  });

});
