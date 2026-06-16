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

// ── Tests ──────────────────────────────────────────────────────

describe('feignDeathHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activation', () => {
    it('should return popup with automation_info type on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Feign Death');
    });

    it('should add the feign death buff to activeBuffs', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Feign Death',
            effect: 'feign_death',
            resistanceTypes: expect.any(Array),
            conditionImmunity: ['poisoned'],
            sourceCharacter: 'TestCaster',
          }),
        ]),
        campaignName,
      );
    });

    it('should apply blinded, incapacitated, and speed_zero conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeConditions',
        expect.arrayContaining(['blinded', 'incapacitated', 'speed_zero']),
        campaignName,
      );
    });

    it('should register an expiration for the buff', async () => {
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

    it('should include all 11 damage resistances except psychic', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      const buffCall = setRuntimeValue.mock.calls.find(
        call => call[1] === 'activeBuffs',
      );
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.resistanceTypes).toEqual([
        'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
        'necrotic', 'piercing', 'poison', 'radiant', 'slashing', 'thunder',
      ]);
    });

    it('should use custom duration from automation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '10 minutes' });

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      const buffCall = setRuntimeValue.mock.calls.find(
        call => call[1] === 'activeBuffs',
      );
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.duration).toBe('10 minutes');
    });

    it('should default duration to 1 hour when not specified', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      const buffCall = setRuntimeValue.mock.calls.find(
        call => call[1] === 'activeBuffs',
      );
      const buff = buffCall[2].find(b => b.name === 'Feign Death');
      expect(buff.duration).toBe('1 hour');
    });

    it('should remove poisoned condition if target had it', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      // First call: activeBuffs (no existing buff → activation path)
      // Second call: activeConditions in applyFeignDeathConditions (has 'poisoned' and 'blinded')
      // Third call: activeConditions in poisoned removal block (reads what was just set)
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(['poisoned', 'blinded'])
        .mockReturnValueOnce(['poisoned', 'blinded', 'blinded', 'incapacitated', 'speed_zero']);

      await handle(action, ps, campaignName, null);

      // applyFeignDeathConditions adds blinded, incapacitated, speed_zero to ['poisoned', 'blinded']
      // Then poisoned filter removes 'poisoned' → ['blinded', 'blinded', 'incapacitated', 'speed_zero']
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeConditions',
        ['blinded', 'blinded', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });

    it('should not call setRuntimeValue for poisoned removal if target did not have it', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce(['blinded']);

      await handle(action, ps, campaignName, null);

      // Should have exactly one setRuntimeValue for activeConditions (the conditions merge)
      const conditionsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
      expect(conditionsCalls.length).toBe(1);
    });

    it('should use targetName from automation when provided', async () => {
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

    it('should set sourceCharacter to the caster name in buff', async () => {
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
    it('should remove the buff when it was already active', async () => {
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

    it('should filter out only the feign death buff, keeping others', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const existingBuffs = [
        { name: 'Feign Death', effect: 'feign_death' },
        { name: 'Other Buff', effect: 'other' },
      ];
      getRuntimeValue.mockReturnValueOnce(existingBuffs);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeBuffs',
        [{ name: 'Other Buff', effect: 'other' }],
        campaignName,
      );
    });

    it('should remove feign death conditions on deactivation', async () => {
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

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeConditions',
        ['poisoned'],
        campaignName,
      );
    });

    it('should not register expiration on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const existingBuffs = [{ name: 'Feign Death', effect: 'feign_death' }];
      getRuntimeValue.mockReturnValueOnce(existingBuffs);

      await handle(action, ps, campaignName, null);

      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('should handle deactivation when no buffs exist (should activate instead)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      // When wasActive is false (no existing buff), it should activate
      expect(result.payload.description).toContain('activated');
    });
  });

  describe('edge cases', () => {
    it('should handle activeBuffs being undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
    });

    it('should handle activeBuffs being a non-array', async () => {
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

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });

    it('should handle activeConditions being null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(null);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });

    it('should handle activeConditions being a non-array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('not an array');

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });

    it('should handle empty automation object', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Feign Death', automation: {} };

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Feign Death');
    });

    it('should handle playerStats with no name', async () => {
      const ps = makePlayerStats({ name: undefined });
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('undefined');
    });

    it('should handle campaignName being undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, undefined, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
    });

    it('should handle custom action name in popup description', async () => {
      const ps = makePlayerStats({ name: 'CasterA' });
      const action = { name: 'My Custom Feign Death', automation: { type: 'feign_death' } };

      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('My Custom Feign Death');
      expect(result.payload.description).toContain('My Custom Feign Death');
    });

    it('should deduplicate conditions when adding feign death conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getRuntimeValue.mockReturnValueOnce([]).mockReturnValueOnce(['blinded', 'incapacitated']);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'activeConditions',
        ['blinded', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });

    it('should use targetName for condition operations when provided', async () => {
      const ps = makePlayerStats({ name: 'CasterA' });
      const action = makeAction({ targetName: 'AllyB' });

      getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(['blinded']);

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'AllyB',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });
  });
});
