import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle } from './buffAllyHandler.js';

import * as buffToggle from '../common/buffToggle.js';
import * as expirations from '../../rules/effects/expirations.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';

// ── Helpers ───────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Fighter',
    level: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Tactical Warning',
    automation: {
      type: 'buff_ally',
      effect: '',
      ...automation,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('buffAllyHandler.handle', () => {
  function resetMocks() {
    useRuntimeState.getRuntimeValue.mockClear().mockReset();
    useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
    buffToggle.toggleBuff.mockClear().mockReset();
    expirations.addExpiration.mockClear().mockReset();
  }

  beforeEach(() => {
    resetMocks();
  });

  // ── Default (no uses or maxUses = 0) ─────────────────────────

  describe('default behaviour (no usage tracking)', () => {
    it('activates buff when not currently active', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        'Fighter',
        'Tactical Warning',
        { type: 'buff_ally', effect: '' },
        campaignName,
      );
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('allies have Advantage');
    });

    it('deactivates buff when already active', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Tactical Warning expired');
    });

    it('calls addExpiration only when buff was not previously active', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      // Activation (wasActive: false) → addExpiration should be called
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Fighter',
        'Fighter',
        [{ type: 'remove_active_buff', buffName: 'Tactical Warning' }],
        campaignName,
      );

      // Reset and test deactivation (wasActive: true) → no addExpiration
      expirations.addExpiration.mockClear();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('returns correct payload structure on activation', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'advantage' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Tactical Warning');
      expect(result.payload.automationType).toBe('buff_ally');
    });

    it('uses buffExpression preference over effect when both present', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({
        effect: 'effect_value',
        buffExpression: 'custom_expression',
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        'Fighter',
        'Tactical Warning',
        { type: 'buff_ally', effect: 'custom_expression', buffExpression: 'custom_expression' },
        campaignName,
      );
    });
  });

  // ── Uses exhausted ────────────────────────────────────────────

  describe('uses exhausted', () => {
    it('returns early popup when usesUsed >= usesMax (usesMax field)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again until a long rest');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('returns early popup when usesUsed >= auto.uses (uses field)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses: 2 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again until a long rest');
    });

    it('prefers usesMax over uses for max calculation', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 1, uses: 5 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0); // >= usesMax (1)

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again');
    });

    it('includes recharge Rage hint when recharge is long_rest_or_expend_rage', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 1, recharge: 'long_rest_or_expend_rage' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('expend one use of Rage');
    });

    it('does not include recharge hint when recharge is a different value', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 1, recharge: 'short_rest' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('Rage');
    });
  });

  // ── Uses tracking (not exhausted) ────────────────────────────

  describe('uses not exhausted', () => {
    it('increments uses count and proceeds to toggle buff', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(1); // 1/3, not exhausted
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        0,
        campaignName,
      );
    });

    it('uses custom resourceKey for uses tracking when provided', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 3, resourceKey: 'myCustomResource' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'myCustomResource',
        1,
        campaignName,
      );
    });

    it('defaults to action name as resourceKey when not provided', async () => {
      const ps = makePlayerStats({});
      const action = {
        name: 'Tactical Warning',
        automation: { type: 'buff_ally', effect: '', usesMax: 3 },
      };
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      // resourceKey defaults to action.name.toLowerCase().replace(/\s+/g, '') + 'Uses'
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        1,
        campaignName,
      );
    });

    it('handles null runtime value as zero before incrementing', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(null); // null ?? maxUses = 3
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        2,
        campaignName,
      );
    });

    it('handles undefined runtime value as zero before incrementing', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined); // undefined ?? maxUses = 3
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        2,
        campaignName,
      );
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('skips usage tracking when usesMax and uses are both absent (defaults to 0)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({}); // no usesMax, no uses → maxUses = 0
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('passes action.name as buffName to addExpiration', async () => {
      const ps = makePlayerStats({});
      const action = { name: 'Inspiring Shield', automation: { type: 'buff_ally', effect: '' } };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Fighter',
        'Fighter',
        [{ type: 'remove_active_buff', buffName: 'Inspiring Shield' }],
        campaignName,
      );
    });

    it('passes playerStats.name to addExpiration for both caller and target', async () => {
      const ps = makePlayerStats({ name: 'Valorous Paladin' });
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Valorous Paladin',
        'Valorous Paladin',
        expect.any(Array),
        campaignName,
      );
    });

    it('includes automation object in returned payload', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'advantage', usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });
  });
});
