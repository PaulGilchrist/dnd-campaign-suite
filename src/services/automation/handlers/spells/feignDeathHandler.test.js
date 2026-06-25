// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './feignDeathHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

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

function getBuffsCall() {
  return setRuntimeValue.mock.calls.find(call => call[1] === 'activeBuffs');
}

function getConditionsCall(index = 0) {
  const conditionsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
  return conditionsCalls[index];
}

// ── Tests ──────────────────────────────────────────────────────

describe('feignDeathHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activation', () => {
    it('should return a popup with automation_info type on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Feign Death');
      expect(result.payload.automationType).toBe('feign_death');
      expect(result.payload.description).toContain('activated');
    });

    it('should add the feign death buff with all properties when activating', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      const buffCall = getBuffsCall();
      expect(buffCall).toBeDefined();
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff).toBeDefined();
      expect(buff.effect).toBe('feign_death');
      expect(buff.duration).toBe('1 hour');
      expect(buff.conditionImmunity).toEqual(['poisoned']);
      expect(buff.sourceCharacter).toBe('TestCaster');
    });

    it('should apply blinded, incapacitated, and speed_zero conditions on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName, null);

      const conditionsCall = getConditionsCall();
      expect(conditionsCall).toBeDefined();
      expect(conditionsCall[2]).toContain('blinded');
      expect(conditionsCall[2]).toContain('incapacitated');
      expect(conditionsCall[2]).toContain('speed_zero');
    });

    it('should register an expiration on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'TestCaster',
        [{ type: 'remove_feign_death_buff', buffName: 'Feign Death' }],
        campaignName,
      );
    });

    it('should include all 12 damage resistances except psychic', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      const buffCall = getBuffsCall();
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.resistanceTypes).toEqual([
        'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
        'necrotic', 'piercing', 'poison', 'radiant', 'slashing', 'thunder',
      ]);
      expect(buff.resistanceTypes).toHaveLength(12);
    });

    it('should use custom duration from automation when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '10 minutes' });

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      const buffCall = getBuffsCall();
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.duration).toBe('10 minutes');
    });

    it('should apply conditions without duplicating existing ones', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce(['blinded', 'incapacitated']);

      await handle(action, ps, campaignName, null);

      const conditionsCall = getConditionsCall();
      expect(conditionsCall[2]).toEqual(['blinded', 'incapacitated', 'speed_zero']);
    });

    it('should remove poisoned condition after applying feign death conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      // Call 1: activeBuffs → null (activation path)
      // Call 2: activeConditions inside applyFeignDeathConditions → ['poisoned', 'blinded']
      // Call 3: activeConditions for poisoned removal (reads what applyFeignDeathConditions set)
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(['poisoned', 'blinded'])
        .mockReturnValueOnce(['poisoned', 'blinded', 'incapacitated', 'speed_zero']);

      await handle(action, ps, campaignName, null);

      // The handler filters poisoned from the conditions read on call 3,
      // so the second setRuntimeValue for activeConditions should not contain poisoned.
      const conditionsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
      expect(conditionsCalls.length).toBeGreaterThanOrEqual(2);
      const lastConditionsCall = conditionsCalls[conditionsCalls.length - 1];
      expect(lastConditionsCall[2]).not.toContain('poisoned');
    });

    it('should skip poisoned removal when target did not have poisoned', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce(['blinded']);

      await handle(action, ps, campaignName, null);

      const conditionsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
      expect(conditionsCalls.length).toBe(1);
    });

    it('should use targetName from automation for buff, conditions, and expiration', async () => {
      const ps = makePlayerStats({ name: 'CasterA' });
      const action = makeAction({ targetName: 'AllyB' });

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'AllyB',
        'activeBuffs',
        expect.any(Array),
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'AllyB',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
      expect(addExpiration).toHaveBeenCalledWith(
        'CasterA',
        'AllyB',
        expect.any(Array),
        campaignName,
      );
    });

    it('should set sourceCharacter to the caster name in the buff', async () => {
      const ps = makePlayerStats({ name: 'CasterA' });
      const action = makeAction({ targetName: 'AllyB' });

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      const buffCall = setRuntimeValue.mock.calls.find(
        call => call[0] === 'AllyB' && call[1] === 'activeBuffs',
      );
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.sourceCharacter).toBe('CasterA');
    });
  });

  describe('deactivation', () => {
    it('should return a popup indicating expiration on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const existingBuffs = [
        { name: 'Feign Death', effect: 'feign_death' },
        { name: 'Other Buff', effect: 'other' },
      ];
      getRuntimeValue.mockReturnValueOnce(existingBuffs);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('expired');
    });

    it('should remove only the feign death buff while preserving others', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const existingBuffs = [
        { name: 'Feign Death', effect: 'feign_death' },
        { name: 'Other Buff', effect: 'other' },
      ];
      getRuntimeValue.mockReturnValueOnce(existingBuffs);

      await handle(action, ps, campaignName, null);

      const buffsCall = setRuntimeValue.mock.calls.find(call => call[1] === 'activeBuffs');
      const remainingBuffs = buffsCall[2];
      expect(remainingBuffs).toHaveLength(1);
      expect(remainingBuffs[0].name).toBe('Other Buff');
    });

    it('should remove feign death conditions but preserve unrelated ones on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const existingBuffs = [{ name: 'Feign Death', effect: 'feign_death' }];
      getRuntimeValue.mockReturnValueOnce(existingBuffs).mockReturnValueOnce([
        'blinded',
        'incapacitated',
        'speed_zero',
        'poisoned',
      ]);

      await handle(action, ps, campaignName, null);

      const conditionsCall = getConditionsCall();
      expect(conditionsCall[2]).toEqual(['poisoned']);
    });

    it('should not register expiration on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const existingBuffs = [{ name: 'Feign Death', effect: 'feign_death' }];
      getRuntimeValue.mockReturnValueOnce(existingBuffs);

      await handle(action, ps, campaignName, null);

      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should activate when activeBuffs is undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
    });

    it('should activate when activeBuffs is a non-array value', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue('not an array');

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
    });

    it('should handle activeConditions being undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(undefined);

      await handle(action, ps, campaignName, null);

      const conditionsCall = getConditionsCall();
      expect(conditionsCall).toBeDefined();
      expect(Array.isArray(conditionsCall[2])).toBe(true);
    });

    it('should handle activeConditions being null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(null);

      await handle(action, ps, campaignName, null);

      const conditionsCall = getConditionsCall();
      expect(conditionsCall).toBeDefined();
      expect(Array.isArray(conditionsCall[2])).toBe(true);
    });

    it('should handle activeConditions being a non-array value', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('not an array');

      await handle(action, ps, campaignName, null);

      const conditionsCall = getConditionsCall();
      expect(conditionsCall).toBeDefined();
      expect(Array.isArray(conditionsCall[2])).toBe(true);
    });

    it('should handle empty automation object with defaults', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Feign Death', automation: {} };

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Feign Death');

      const buffCall = getBuffsCall();
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.duration).toBe('1 hour');
    });

    it('should deduplicate conditions when target already has some feign death conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce(['blinded', 'incapacitated']);

      await handle(action, ps, campaignName, null);

      const conditionsCall = getConditionsCall();
      expect(conditionsCall[2]).toEqual(['blinded', 'incapacitated', 'speed_zero']);
    });

    it('should not call setRuntimeValue for conditions when no changes are needed after deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const existingBuffs = [{ name: 'Feign Death', effect: 'feign_death' }];
      // Conditions already have no feign death conditions
      getRuntimeValue.mockReturnValueOnce(existingBuffs).mockReturnValueOnce(['poisoned', 'fatigued']);

      await handle(action, ps, campaignName, null);

      const conditionsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
      expect(conditionsCalls.length).toBe(0);
    });

    it('should use targetName for condition operations when provided', async () => {
      const ps = makePlayerStats({ name: 'CasterA' });
      const action = makeAction({ targetName: 'AllyB' });

      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(['blinded']);

      await handle(action, ps, campaignName, null);

      const conditionsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
      expect(conditionsCalls.length).toBeGreaterThan(0);
      expect(conditionsCalls[0][0]).toBe('AllyB');
    });

    it('should use custom action name in popup and buff', async () => {
      const ps = makePlayerStats({ name: 'CasterA' });
      const actionName = 'My Custom Feign Death';
      const action = { name: actionName, automation: { type: 'feign_death' } };

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe(actionName);
      expect(result.payload.description).toContain(actionName);

      const buffCall = getBuffsCall();
      const buff = buffCall[2].find(b => b.name === actionName);
      expect(buff).toBeDefined();
    });
  });
});
