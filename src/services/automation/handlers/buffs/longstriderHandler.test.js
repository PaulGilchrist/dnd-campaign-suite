// @improved-by-ai
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

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, applyLongstrider } from './longstriderHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as logPoster from '../../../shared/logPoster.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerStats = { name: 'TestCharacter', speed: 30 };

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

function makeCombatContext(overrides = {}) {
  return {
    creatures: [
      { name: 'Ally1' },
      { name: 'Ally2' },
      { name: 'TestCharacter' },
      ...(overrides.creatures || []),
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('longstriderHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns target selection popup when combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      targetResolver.resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('longstrider_target_selection');
      expect(result.payload.name).toBe('Longstrider');
      expect(result.payload.creatureTargets).toEqual(['Ally1', 'Ally2']);
      expect(result.payload.range).toBe('Touch');
      expect(result.payload.duration).toBe('1 hour');
      expect(result.payload.attackerPos).toBeNull();
    });

    it('excludes caster from target list', async () => {
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext({
          creatures: [{ name: 'Ally1' }, { name: 'TestCharacter' }],
        })
      );

      const result = await handle(makeAction(), playerStats, campaignName, null);

      expect(result.payload.creatureTargets).not.toContain('TestCharacter');
      expect(result.payload.creatureTargets).toContain('Ally1');
    });

    it('returns empty creatureTargets when caster is the only creature', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestCharacter' }],
      });

      const result = await handle(makeAction(), playerStats, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns info popup when no combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      targetResolver.resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain('Longstrider');
    });

    it('uses spell.range when action.spell.range is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      rangeValidation.rangeToFeet.mockReturnValue(30);

      const action = makeAction({ spell: { name: 'Longstrider' } });
      const result = await handle(action, playerStats, campaignName, null);

      expect(result.payload.range).toBe('Touch');
      expect(result.payload.rangeFt).toBe(30);
    });

    it('defaults range to Touch when action.spell is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      rangeValidation.rangeToFeet.mockReturnValue(5);

      const action = makeAction({ spell: undefined });
      const result = await handle(action, playerStats, campaignName, null);

      expect(result.payload.range).toBe('Touch');
      expect(result.payload.rangeFt).toBe(5);
    });

    it('passes custom duration from spell', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());

      const action = makeAction({ spell: { duration: '10 minutes' } });
      const result = await handle(action, playerStats, campaignName, null);

      expect(result.payload.duration).toBe('10 minutes');
    });

    it('returns null attackerPos when mapName is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      targetResolver.resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), playerStats, campaignName, null);

      expect(result.payload.attackerPos).toBeNull();
    });

    it('returns attackerPos when mapName is provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

      const result = await handle(makeAction(), playerStats, campaignName, 'test-map');

      expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
    });

    it('defaults range to Touch when spell is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      rangeValidation.rangeToFeet.mockReturnValue(5);

      const action = { name: 'Longstrider' };
      const result = await handle(action, playerStats, campaignName, null);

      expect(result.payload.range).toBe('Touch');
      expect(result.payload.rangeFt).toBe(5);
    });
  });

  describe('applyLongstrider', () => {
    it('applies speed_boost buff to target', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => []);

      const action = makeAction({ spell: { duration: '1 hour' } });
      const result = await applyLongstrider(action, playerStats, campaignName, null, ['Ally1']);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1 target(s)');
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
            sourceCharacter: 'TestCharacter',
          }),
        ]),
        campaignName
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestCharacter',
        'Ally1',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Longstrider',
          }),
        ]),
        campaignName
      );
    });

    it('does not duplicate buff when already active', async () => {
      const existingBuffs = [
        { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
        { name: 'Bless', effect: 'attack_roll_bonus', bonus: 1 },
      ];
      runtimeState.getRuntimeValue.mockImplementation(() => existingBuffs);

      const action = makeAction();
      const result = await applyLongstrider(action, playerStats, campaignName, null, ['Ally1']);

      expect(result).not.toBeNull();

      const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCall).toBeUndefined();
    });

    it('does not apply buff when already active but still adds expiration', async () => {
      const existingBuffs = [
        { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
      ];
      runtimeState.getRuntimeValue.mockImplementation(() => existingBuffs);

      const action = makeAction();
      await applyLongstrider(action, playerStats, campaignName, null, ['Ally1']);

      const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCall).toBeUndefined();

      expect(expirations.addExpiration).toHaveBeenCalled();
    });

    it('applies to multiple targets', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => []);

      const action = makeAction();
      const result = await applyLongstrider(action, playerStats, campaignName, null, ['Ally1', 'Ally2']);

      expect(result.payload.description).toContain('2 target(s)');

      const buffsCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'activeBuffs'
      );
      expect(buffsCalls).toHaveLength(2);
      expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
      expect(logPoster.postLogEntry).toHaveBeenCalledTimes(2);
    });

    it('returns null for empty target list', async () => {
      const action = makeAction();
      const result = await applyLongstrider(action, playerStats, campaignName, null, []);

      expect(result).toBeNull();
    });

    it('returns null for null target list', async () => {
      const action = makeAction();
      const result = await applyLongstrider(action, playerStats, campaignName, null, null);

      expect(result).toBeNull();
    });

    it('returns null for undefined target list', async () => {
      const action = makeAction();
      const result = await applyLongstrider(action, playerStats, campaignName, null, undefined);

      expect(result).toBeNull();
    });

    it('returns null for non-array target list', async () => {
      const action = makeAction();
      const result = await applyLongstrider(action, playerStats, campaignName, null, 'Ally1');

      expect(result).toBeNull();
    });

    it('uses default duration when spell has no duration', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => []);

      const action = makeAction({ spell: { name: 'Longstrider' } });
      await applyLongstrider(action, playerStats, campaignName, null, ['Ally1']);

      const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      const buffs = buffsCall[2];
      const longstriderBuff = buffs.find((b) => b.name === 'Longstrider');

      expect(longstriderBuff.duration).toBe('1 hour');
    });

    it('posts log entry for each target', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => []);

      const action = makeAction();
      await applyLongstrider(action, playerStats, campaignName, null, ['Ally1', 'Ally2']);

      expect(logPoster.postLogEntry).toHaveBeenCalledTimes(2);
      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCharacter',
        abilityName: 'Longstrider',
        description: expect.stringContaining('Longstrider'),
      });
    });

    it('uses correct sourceCharacter in buff', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => []);

      const action = makeAction();
      await applyLongstrider(action, playerStats, campaignName, null, ['Ally1']);

      const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'activeBuffs'
      );
      const longstriderBuff = buffsCall[2].find((b) => b.name === 'Longstrider');

      expect(longstriderBuff.sourceCharacter).toBe('TestCharacter');
    });

    it('handles target with no existing buffs (undefined)', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => undefined);

      const action = makeAction();
      await applyLongstrider(action, playerStats, campaignName, null, ['Ally1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Longstrider' }),
        ]),
        campaignName
      );
    });

    it('handles target with non-array activeBuffs stored', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => 'not an array');

      const action = makeAction();
      await applyLongstrider(action, playerStats, campaignName, null, ['Ally1']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Longstrider' }),
        ]),
        campaignName
      );
    });

    it('returns popup with correct description format', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => []);

      const action = makeAction();
      const result = await applyLongstrider(action, playerStats, campaignName, null, ['Ally1', 'Ally2', 'Ally3']);

      expect(result.payload.description).toContain('3 target(s)');
      expect(result.payload.description).toContain('+10 feet');
      expect(result.payload.description).toContain('Longstrider');
    });

    it('adds expiration for each target even when buff already exists', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => [
        { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
      ]);

      const action = makeAction();
      await applyLongstrider(action, playerStats, campaignName, null, ['Ally1', 'Ally2']);

      expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
    });
  });
});
