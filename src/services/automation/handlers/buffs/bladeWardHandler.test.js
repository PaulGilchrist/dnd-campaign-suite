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

  describe('activation (wasActive false)', () => {
    it('toggles the buff, registers expiration, and returns activation popup', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 minute' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', duration: '1 minute', effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        CAMPAIGN_NAME
      );
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: 'buff',
          description: 'Blade Ward activated — attackers subtract 1d4 from attack rolls against you',
          automation: action.automation,
        },
      });
    });

    it('passes extra automation properties through to the effect object', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 hour', extraProp: 'value' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ duration: '1 hour', extraProp: 'value', effect: 'blade_ward' }),
        CAMPAIGN_NAME
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
  });

  describe('deactivation (wasActive true)', () => {
    it('toggles the buff, skips expiration, and returns expired popup', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: 'buff',
          description: 'Blade Ward expired',
          automation: action.automation,
        },
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty automation object', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Blade Ward', automation: {} };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
      expect(result.payload.description).toContain('activated');
    });
  });
});
