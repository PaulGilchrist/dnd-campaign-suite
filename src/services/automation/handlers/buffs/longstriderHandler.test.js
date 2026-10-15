// @maintained-by-ai
// Longstrider handler: pure, fully-mocked automation handler. Tests pin exact popup
// payloads, activeBuffs stamps, expiration payloads, and campaign log entries
// (AGENTS.md requires logging on every automation). Deterministic contract — no churn.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(() => 5),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, applyLongstrider } from './longstriderHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as logPoster from '../../../ui/logService.js';

// ── Constants & Helpers ──────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestCharacter';

function makePlayerStats(overrides = {}) {
  return {
    name: PLAYER_NAME,
    speed: 30,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Longstrider',
    spell: {
      name: 'Longstrider',
      range: 'Touch',
      duration: '1 hour',
      ...overrides.spell,
    },
    ...overrides,
  };
}

function makeCombatContext(creatureNames = []) {
  return {
    creatures: creatureNames.map((name) => ({ name })),
  };
}

function mockEmptyBuffs() {
  runtimeState.getRuntimeValue.mockReturnValue([]);
}

function buffWriteCalls() {
  return runtimeState.setRuntimeValue.mock.calls.filter((call) => call[1] === 'activeBuffs');
}

// ── Tests ────────────────────────────────────────────────────────

describe('longstriderHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns full longstrider_target_selection popup for combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1', 'Ally2', PLAYER_NAME]));
      targetResolver.resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'longstrider_target_selection',
          name: 'Longstrider',
          creatureTargets: ['Ally1', 'Ally2', PLAYER_NAME],
          range: 'Touch',
          rangeFt: 5,
          duration: '1 hour',
          attackerPos: null,
        },
      });
    });

    it('returns automation_info popup when no combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Longstrider',
          description: 'No combat context found. Cannot apply Longstrider.',
        },
      });
      expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });

    it('propagates spell range and duration overrides to the popup payload', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));
      rangeValidation.rangeToFeet.mockReturnValue(30);

      const action = makeAction({ spell: { range: '30 feet', duration: '10 minutes' } });
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('30 feet');
      expect(result.payload.range).toBe('30 feet');
      expect(result.payload.rangeFt).toBe(30);
      expect(result.payload.duration).toBe('10 minutes');
    });

    it('defaults range to Touch and duration to 1 hour for empty spell or no spell', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));

      const emptySpell = await handle(makeAction({ spell: {} }), makePlayerStats(), CAMPAIGN_NAME, null);
      const noSpell = await handle({ name: 'Longstrider' }, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('Touch');
      expect(emptySpell.payload.range).toBe('Touch');
      expect(emptySpell.payload.duration).toBe('1 hour');
      expect(noSpell.payload.range).toBe('Touch');
      expect(noSpell.payload.duration).toBe('1 hour');
      expect(noSpell.payload.attackerPos).toBeNull();
    });

    it('includes attackerPos resolved from mapName', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));
      targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map');

      expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        'test-map',
        PLAYER_NAME
      );
      expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
    });

    it('returns empty creatureTargets when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([]));

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('longstrider_target_selection');
      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  describe('applyLongstrider', () => {
    it('stamps speed_boost buff, expiration, and log entry, returning exact info popup', async () => {
      mockEmptyBuffs();

      const result = await applyLongstrider(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', [
        {
          name: 'Longstrider',
          effect: 'speed_boost',
          speedBonus: 10,
          duration: '1 hour',
          sourceCharacter: PLAYER_NAME,
        },
      ], CAMPAIGN_NAME);

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: PLAYER_NAME,
        targetName: 'Ally1',
        effects: [{ type: 'remove_active_buff', buffName: 'Longstrider' }],
        campaignName: CAMPAIGN_NAME,
      });

      expect(logPoster.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'ability_use',
        characterName: PLAYER_NAME,
        abilityName: 'Longstrider',
        description: `${PLAYER_NAME} cast Longstrider on Ally1. Speed increased by 10 feet.`,
      });

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Longstrider',
          description: 'Ally1 gained +10 feet speed from Longstrider.',
        },
      });
    });

    it('treats null activeBuffs as uninitialized and writes fresh buff array', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      await applyLongstrider(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      expect(buffWriteCalls()).toEqual([
        ['Ally1', 'activeBuffs', [
          {
            name: 'Longstrider',
            effect: 'speed_boost',
            speedBonus: 10,
            duration: '1 hour',
            sourceCharacter: PLAYER_NAME,
          },
        ], CAMPAIGN_NAME],
      ]);
    });

    it('propagates custom spell duration onto the buff stamp', async () => {
      mockEmptyBuffs();

      const action = makeAction({ spell: { duration: '10 minutes' } });
      await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      expect(buffWriteCalls()[0][2]).toEqual([
        expect.objectContaining({ name: 'Longstrider', duration: '10 minutes' }),
      ]);
    });

    it('mixed list: skips target with existing Longstrider, stamps, expires, and logs every target', async () => {
      runtimeState.getRuntimeValue.mockImplementation((targetName, key) => {
        if (key === 'activeBuffs' && targetName === 'Ally1') {
          return [{ name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 }];
        }
        return [];
      });

      const action = makeAction({ name: 'MyCustomLongstrider' });
      const result = await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2']);

      // No write for the skipped target; exact stamp for the fresh one.
      const writes = buffWriteCalls();
      expect(writes).toHaveLength(1);
      expect(writes[0]).toEqual(['Ally2', 'activeBuffs', [
        {
          name: 'Longstrider',
          effect: 'speed_boost',
          speedBonus: 10,
          duration: '1 hour',
          sourceCharacter: PLAYER_NAME,
        },
      ], CAMPAIGN_NAME]);

      // Expiration and log fire for every target, even the skipped one.
      expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
      expect(expirations.addExpiration).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Ally1' }));
      expect(expirations.addExpiration).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Ally2' }));
      expect(logPoster.addEntry).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'MyCustomLongstrider',
          description: 'Ally1, Ally2 gained +10 feet speed from MyCustomLongstrider.',
        },
      });
    });

    it('returns null and causes no side effects for empty, null, undefined, or non-array target list', async () => {
      const action = makeAction();
      for (const targets of [[], null, undefined, 'Ally1']) {
        expect(await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, targets)).toBeNull();
      }

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(logPoster.addEntry).not.toHaveBeenCalled();
    });
  });
});
