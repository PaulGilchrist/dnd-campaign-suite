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

    it('defaults range to Touch when spell is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      rangeValidation.rangeToFeet.mockReturnValue(5);

      const action = { name: 'Longstrider' };
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

    it('returns attackerPos when mapName is provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext());
      targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

      const result = await handle(makeAction(), playerStats, campaignName, 'test-map');

      expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
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

    it('returns null for empty, null, undefined, or non-array target list', async () => {
      const action = makeAction();
      expect(await applyLongstrider(action, playerStats, campaignName, null, [])).toBeNull();
      expect(await applyLongstrider(action, playerStats, campaignName, null, null)).toBeNull();
      expect(await applyLongstrider(action, playerStats, campaignName, null, undefined)).toBeNull();
      expect(await applyLongstrider(action, playerStats, campaignName, null, 'Ally1')).toBeNull();
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
  });
});
