// @improved-by-ai
// @cleaned-by-ai
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

// ── Tests ────────────────────────────────────────────────────────

describe('longstriderHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns target selection popup with creature list when combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1', 'Ally2', 'TestCharacter']));
      targetResolver.resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('longstrider_target_selection');
      expect(result.payload.name).toBe('Longstrider');
      expect(result.payload.creatureTargets).toEqual(['Ally1', 'Ally2', 'TestCharacter']);
      expect(result.payload.range).toBe('Touch');
      expect(result.payload.rangeFt).toBe(5);
      expect(result.payload.duration).toBe('1 hour');
      expect(result.payload.attackerPos).toBeNull();
    });

    it('returns automation_info popup when no combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Longstrider');
      expect(result.payload.description).toBe('No combat context found. Cannot apply Longstrider.');
    });

    it('uses spell.range value when present', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));
      rangeValidation.rangeToFeet.mockReturnValue(30);

      const action = makeAction({ spell: { range: '30 feet' } });
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.range).toBe('30 feet');
      expect(result.payload.rangeFt).toBe(30);
    });

    it('defaults range to Touch when spell.range is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));
      rangeValidation.rangeToFeet.mockReturnValue(5);

      const action = makeAction({ spell: { name: 'Longstrider' } });
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.range).toBe('Touch');
      expect(result.payload.rangeFt).toBe(5);
    });

    it('defaults range to Touch when spell is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));
      rangeValidation.rangeToFeet.mockReturnValue(5);

      const action = { name: 'Longstrider' };
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.range).toBe('Touch');
      expect(result.payload.rangeFt).toBe(5);
    });

    it('uses custom duration from spell', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));

      const action = makeAction({ spell: { duration: '10 minutes' } });
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.duration).toBe('10 minutes');
    });

    it('defaults duration to 1 hour when spell.duration is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));

      const action = makeAction({ spell: { range: 'Touch' } });
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.duration).toBe('1 hour');
    });

    it('includes attackerPos when mapName is provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));
      targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map');

      expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
      expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        'test-map',
        PLAYER_NAME
      );
    });

    it('returns empty creatureTargets when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([]));

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('longstrider_target_selection');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('defaults attackerPos to null when no mapName provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext(['Ally1']));

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.attackerPos).toBeNull();
    });
  });

  describe('applyLongstrider', () => {
    it('applies speed_boost buff to target and returns info popup', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return [];
        return [];
      });

      const action = makeAction({ spell: { duration: '1 hour' } });
      const result = await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Ally1');
      expect(result.payload.description).toContain('+10 feet');

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Longstrider',
            effect: 'speed_boost',
            speedBonus: 10,
            duration: '1 hour',
            sourceCharacter: PLAYER_NAME,
          }),
        ]),
        CAMPAIGN_NAME
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: 'Ally1', effects: expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Longstrider',
          }),
        ]), campaignName: CAMPAIGN_NAME });
    });

    it('skips buff when Longstrider already active but still adds expiration', async () => {
      const existingBuffs = [
        { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
      ];
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return existingBuffs;
        return [];
      });

      const action = makeAction();
      await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCall).toBeUndefined();

      expect(expirations.addExpiration).toHaveBeenCalled();
    });

    it('applies to multiple targets', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return [];
        return [];
      });

      const action = makeAction();
      const result = await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2']);

      expect(result.payload.description).toContain('Ally1');
      expect(result.payload.description).toContain('Ally2');

      const buffsCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCalls).toHaveLength(2);
      expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
      expect(logPoster.addEntry).toHaveBeenCalledTimes(2);
    });

    it('skips targets that already have Longstrider in mixed list', async () => {
      runtimeState.getRuntimeValue.mockImplementation((targetName, key) => {
        if (key === 'activeBuffs') {
          if (targetName === 'Ally1') return [{ name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 }];
          return [];
        }
        return [];
      });

      const action = makeAction();
      const result = await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2']);

      expect(result.payload.description).toContain('Ally1');
      expect(result.payload.description).toContain('Ally2');

      const buffsCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCalls).toHaveLength(1);
      expect(buffsCalls[0][0]).toBe('Ally2');
    });

    it('returns null for empty, null, undefined, or non-array target list', async () => {
      const action = makeAction();
      expect(await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, [])).toBeNull();
      expect(await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, null)).toBeNull();
      expect(await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, undefined)).toBeNull();
      expect(await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, 'Ally1')).toBeNull();
    });

    it('posts log entry for each target', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return [];
        return [];
      });

      const action = makeAction();
      await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2']);

      expect(logPoster.addEntry).toHaveBeenCalledTimes(2);
      expect(logPoster.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'ability_use',
        characterName: PLAYER_NAME,
        abilityName: 'Longstrider',
        description: expect.stringContaining('Longstrider'),
      });
    });

    it('handles activeBuffs being null (uninitialized)', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return null;
        return null;
      });

      const action = makeAction();
      const result = await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      expect(result).not.toBeNull();
      const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCall).toBeDefined();
      expect(buffsCall[2]).toContainEqual(
        expect.objectContaining({ name: 'Longstrider' })
      );
    });

    it('uses custom duration from spell for buff and expiration', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return [];
        return [];
      });

      const action = makeAction({ spell: { duration: '10 minutes' } });
      await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      const buffCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffCall[2]).toContainEqual(
        expect.objectContaining({ duration: '10 minutes' })
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: 'Ally1', effects: expect.any(Array), campaignName: CAMPAIGN_NAME });
    });

    it('records sourceCharacter as the caster name', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return [];
        return [];
      });

      const caster = makePlayerStats({ name: 'ClericOfLathander' });
      const action = makeAction();
      await applyLongstrider(action, caster, CAMPAIGN_NAME, null, ['Goblin']);

      const buffCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffCall[2]).toContainEqual(
        expect.objectContaining({ sourceCharacter: 'ClericOfLathander' })
      );
    });

    it('uses action.name in the description for single target', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return [];
        return [];
      });

      const action = makeAction({ name: 'MyCustomLongstrider' });
      const result = await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

      expect(result.payload.description).toContain('MyCustomLongstrider');
    });

    it('uses action.name in the description for multiple targets', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
        if (key === 'activeBuffs') return [];
        return [];
      });

      const action = makeAction({ name: 'MyCustomLongstrider' });
      const result = await applyLongstrider(action, makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1', 'Ally2']);

      expect(result.payload.description).toContain('Ally1, Ally2');
      expect(result.payload.description).toContain('MyCustomLongstrider');
    });
  });
});
