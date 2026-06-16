import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './bladeWardHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Blade Ward',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('bladeWardHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleBuff invocation', () => {
    it('should call toggleBuff with playerName, buffName, merged auto+effect, and campaignName', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 minute' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', duration: '1 minute', effect: 'blade_ward' },
        campaignName
      );
    });

    it('should pass the mapName parameter as fourth argument to toggleBuff', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, 'TestMap');

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', effect: 'blade_ward' },
        campaignName
      );
    });

    it('should override effect to blade_ward even when auto already has an effect', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'some_other_effect' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', effect: 'blade_ward' },
        campaignName
      );
    });
  });

  describe('Expiration registration', () => {
    it('should call addExpiration when buff was not active (first activation)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        campaignName
      );
    });

    it('should NOT call addExpiration when buff was already active (deactivation)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('should use playerName as both attacker and target in addExpiration', async () => {
      const ps = makePlayerStats({ name: 'AnotherHero' });
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'AnotherHero',
        'AnotherHero',
        [{ type: 'remove_active_buff', buffName: action.name }],
        campaignName
      );
    });
  });

  describe('Return value - wasActive false (activation)', () => {
    it('should return type popup with automation_info payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should include buff name in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe(action.name);
    });

    it('should include automationType from action.automation.type', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ customType: 'x' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automationType).toBe('buff');
    });

    it('should include correct activation description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Blade Ward activated — attackers subtract 1d4 from attack rolls against you'
      );
    });

    it('should include the automation object in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '2 minutes' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should use the action name in the description', async () => {
      const ps = makePlayerStats();
      const action = { ...makeAction(), name: 'Custom Blade Ward' };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Custom Blade Ward activated — attackers subtract 1d4 from attack rolls against you'
      );
    });
  });

  describe('Return value - wasActive true (deactivation/expiry)', () => {
    it('should return type popup with automation_info payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should include buff name in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe(action.name);
    });

    it('should include automationType from action.automation.type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automationType).toBe('buff');
    });

    it('should include expired description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Blade Ward expired');
    });

    it('should use the action name in the expired description', async () => {
      const ps = makePlayerStats();
      const action = { ...makeAction(), name: 'My Ward' };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('My Ward expired');
    });

    it('should include the automation object in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '5 minutes' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty automation object', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Blade Ward', automation: {} };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { effect: 'blade_ward' },
        campaignName
      );
      expect(result.payload.description).toBe(
        'Blade Ward activated — attackers subtract 1d4 from attack rolls against you'
      );
    });

    it('should handle automation with extra properties', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 hour', extraProp: 'value' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', duration: '1 hour', extraProp: 'value', effect: 'blade_ward' },
        campaignName
      );
    });

    it('should handle playerStats with no extra properties', async () => {
      const ps = { name: 'Minimal' };
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        campaignName
      );
    });

    it('should pass through the mapName parameter even though it is not used in the function body', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, 'MapName');

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', effect: 'blade_ward' },
        campaignName
      );
    });

    it('should return correct result when toggled off (wasActive true) with empty automation', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Blade Ward', automation: {} };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Blade Ward expired');
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });
});
