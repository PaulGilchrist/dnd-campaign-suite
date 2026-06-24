// @improved-by-ai
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

// ── Constants & Helpers ────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestHero';

function makePlayerStats(overrides = {}) {
  return { name: PLAYER_NAME, ...overrides };
}

function makeAction(automation = {}) {
  return {
    name: 'Blade Ward',
    automation: { type: 'buff', ...automation },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('bladeWardHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleBuff calls', () => {
    it('passes playerName, buffName, merged effect object, and campaignName', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 minute' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', duration: '1 minute', effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
    });

    it('overrides any existing effect value to blade_ward', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'some_other_effect' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
    });

    it('passes extra automation properties through to the effect object', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 hour', extraProp: 'value' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', duration: '1 hour', extraProp: 'value', effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
    });

    it('handles empty automation object', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Blade Ward', automation: {} };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
    });
  });

  describe('expiration registration', () => {
    it('registers expiration on first activation (wasActive false)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        CAMPAIGN_NAME
      );
    });

    it('does not register expiration on deactivation (wasActive true)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('uses playerName as both attacker and target in expiration', async () => {
      const ps = makePlayerStats({ name: 'AnotherHero' });
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'AnotherHero',
        'AnotherHero',
        [{ type: 'remove_active_buff', buffName: action.name }],
        CAMPAIGN_NAME
      );
    });
  });

  describe('return value on activation (wasActive false)', () => {
    it('returns popup with automation_info payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('includes buff name in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.name).toBe(action.name);
    });

    it('includes automationType from action.automation.type', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ customType: 'x' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automationType).toBe('buff');
    });

    it('includes activation description with the standard message', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toBe(
        'Blade Ward activated — attackers subtract 1d4 from attack rolls against you'
      );
    });

    it('uses the action name in the activation description', async () => {
      const ps = makePlayerStats();
      const action = { ...makeAction(), name: 'Custom Blade Ward' };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toBe(
        'Custom Blade Ward activated — attackers subtract 1d4 from attack rolls against you'
      );
    });

    it('includes the automation object in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '2 minutes' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('handles missing automation.type gracefully', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Blade Ward', automation: {} };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automationType).toBeUndefined();
    });
  });

  describe('return value on deactivation (wasActive true)', () => {
    it('returns popup with automation_info payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('includes buff name in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.name).toBe(action.name);
    });

    it('includes automationType from action.automation.type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automationType).toBe('buff');
    });

    it('includes expired description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toBe('Blade Ward expired');
    });

    it('uses the action name in the expired description', async () => {
      const ps = makePlayerStats();
      const action = { ...makeAction(), name: 'My Ward' };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toBe('My Ward expired');
    });

    it('includes the automation object in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '5 minutes' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automation).toEqual(action.automation);
    });
  });

  describe('edge cases', () => {
    it('handles minimal playerStats with only a name', async () => {
      const ps = { name: 'Minimal' };
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        CAMPAIGN_NAME
      );
    });

    it('returns correct result when toggled off with empty automation', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Blade Ward', automation: {} };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toBe('Blade Ward expired');
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });
});
