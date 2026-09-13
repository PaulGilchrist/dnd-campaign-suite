// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'TestCaster' },
      { name: 'AllyB' },
      { name: 'EnemyC' },
    ],
  })),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(() => Promise.resolve({ attackerPos: { x: 0, y: 0 } })),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyFeignDeath } from './feignDeathHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Feign Death',
    automation: {
      type: 'feign_death',
      ...automation,
    },
  };
}

function getBuffsCall(targetName) {
  return setRuntimeValue.mock.calls.find(
    call => call[0] === targetName && call[1] === 'activeBuffs'
  );
}

function getConditionsCall(targetName, index = 0) {
  const conditionsCalls = setRuntimeValue.mock.calls.filter(
    call => call[0] === targetName && call[1] === 'activeConditions'
  );
  return conditionsCalls[index];
}

// ── Tests ──────────────────────────────────────────────────────

describe('feignDeathHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle (target selection modal)', () => {
    it('should return a modal for target selection', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null, []);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('feignDeathTargetSelection');
      expect(result.payload.name).toBe('Feign Death');
      expect(result.payload.creatureTargets).toEqual(['TestCaster', 'AllyB', 'EnemyC']);
      expect(result.payload.range).toBe('Touch');
      expect(result.payload.duration).toBe('1 hour');
    });

    it('should use spell range when provided', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Feign Death',
        automation: { type: 'feign_death' },
        spell: { range: '60 feet' },
      };

      const result = await handle(action, ps, campaignName, null, []);
      expect(result.payload.range).toBe('60 feet');
    });

    it('should use spell duration when provided', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Feign Death',
        automation: { type: 'feign_death' },
        spell: { duration: '8 hours' },
      };

      const result = await handle(action, ps, campaignName, null, []);
      expect(result.payload.duration).toBe('8 hours');
    });

    it('should return empty creatureTargets when no combat summary', async () => {
      vi.mocked(getCombatSummary).mockReturnValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null, []);
      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  describe('applyFeignDeath (activation)', () => {
    it('should return null when no target names provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyFeignDeath(action, ps, campaignName, null, []);
      expect(result).toBeNull();
    });

    it('should return null when target names is not an array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyFeignDeath(action, ps, campaignName, null, 'AllyB');
      expect(result).toBeNull();
    });

    it('should apply buff with resistanceTypes and conditionImmunity', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValue(null);

      const result = await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      expect(result).not.toBeNull();
      expect(result.payload.type).toBe('automation_info');

      const buffCall = getBuffsCall('AllyB');
      expect(buffCall).toBeDefined();
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff).toBeDefined();
      expect(buff.effect).toBe('feign_death');
      expect(buff.duration).toBe('1 hour');
      expect(buff.resistanceTypes).toContain('acid');
      expect(buff.resistanceTypes).toContain('fire');
      expect(buff.resistanceTypes).not.toContain('psychic');
      expect(buff.conditionImmunity).toContain('poisoned');
      expect(buff.sourceCharacter).toBe('TestCaster');
    });

    it('should apply blinded, incapacitated, and speed_zero conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValue(null);

      await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      const conditionsCall = getConditionsCall('AllyB');
      expect(conditionsCall).toBeDefined();
      expect(conditionsCall[2]).toContain('blinded');
      expect(conditionsCall[2]).toContain('incapacitated');
      expect(conditionsCall[2]).toContain('speed_zero');
    });

    it('should register expiration with expireOnCreatureName for initiative roll', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValue(null);

      await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'AllyB', effects: [{ type: 'remove_feign_death_buff', buffName: 'Feign Death' }], campaignName, rounds: undefined, expireOnCreatureName: 'AllyB' });
    });

    it('should log the ability use to campaign log', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValue(null);

      await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Feign Death',
        description: expect.stringContaining('AllyB'),
      }));
    });

    it('should log "themself" when caster targets self', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValue(null);

      await applyFeignDeath(action, ps, campaignName, null, ['TestCaster']);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          description: expect.stringContaining('themself'),
        })
      );
    });

    it('should use custom duration from spell', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Feign Death',
        automation: { type: 'feign_death' },
        spell: { duration: '8 hours' },
      };
      getRuntimeValue.mockReturnValue(null);

      await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      const buffCall = getBuffsCall('AllyB');
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.duration).toBe('8 hours');
    });

    it('should not duplicate buff if already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const existingBuffs = [
        { name: 'Feign Death', effect: 'feign_death' },
        { name: 'Other Buff', effect: 'other' },
      ];
      getRuntimeValue.mockReturnValue(existingBuffs);

      await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      const buffCall = getBuffsCall('AllyB');
      // Should not have called setRuntimeValue for buffs since Feign Death is already active
      expect(buffCall).toBeUndefined();
    });

    it('should not duplicate conditions if already present', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(['blinded', 'incapacitated']);

      await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      const conditionsCall = getConditionsCall('AllyB');
      expect(conditionsCall[2]).toEqual(['blinded', 'incapacitated', 'speed_zero']);
    });

    it('should remove poisoned condition if target has it', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      // Call 1: activeBuffs for buff check → null
      // Call 2: activeConditions in applyFeignDeathConditions → ['poisoned', 'blinded']
      // Call 3: activeConditions in poisoned removal → ['poisoned', 'blinded', 'incapacitated', 'speed_zero']
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(['poisoned', 'blinded'])
        .mockReturnValueOnce(['poisoned', 'blinded', 'incapacitated', 'speed_zero']);

      await applyFeignDeath(action, ps, campaignName, null, ['AllyB']);

      const conditionsCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions'
      );
      expect(conditionsCalls.length).toBeGreaterThanOrEqual(2);
      const lastConditionsCall = conditionsCalls[conditionsCalls.length - 1];
      expect(lastConditionsCall[2]).not.toContain('poisoned');
    });

    it('should handle multiple targets', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getRuntimeValue.mockReturnValue(null);

      const result = await applyFeignDeath(action, ps, campaignName, null, ['AllyB', 'EnemyC']);

      expect(result).not.toBeNull();
      expect(result.payload.description).toContain('AllyB, EnemyC');

      // Should have applied to both targets
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'AllyB', 'activeBuffs', expect.any(Array), campaignName
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'EnemyC', 'activeBuffs', expect.any(Array), campaignName
      );
    });
  });
});
