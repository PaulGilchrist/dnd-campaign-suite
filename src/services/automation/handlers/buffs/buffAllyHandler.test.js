import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle } from './buffAllyHandler.js';

import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

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

function resetMocks() {
  vi.clearAllMocks();
}

// ── Tests ────────────────────────────────────────────────────────

describe('buffAllyHandler.handle', () => {
  beforeEach(resetMocks);

  // ── Default (no uses or maxUses = 0) ─────────────────────────

  describe('default behaviour (no usage tracking)', () => {
    it('activates buff and returns popup when not currently active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Tactical Warning');
      expect(result.payload.automationType).toBe('buff_ally');
      expect(result.payload.description).toContain('activated');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('deactivates buff and returns expired message when already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Tactical Warning expired');
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('registers expiration only on activation, not deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledTimes(1);

      expirations.addExpiration.mockClear();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('uses buffExpression over effect when both are provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        effect: 'effect_value',
        buffExpression: 'custom_expression',
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      const callArgs = buffToggle.toggleBuff.mock.calls[0];
      expect(callArgs[2].effect).toBe('custom_expression');
      expect(callArgs[2].buffExpression).toBe('custom_expression');
    });
  });

  // ── Uses exhausted ────────────────────────────────────────────

  describe('uses exhausted', () => {
    it('returns early popup when usesUsed >= usesMax', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again until a long rest');
      expect(result.payload.automation).toEqual(action.automation);
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('returns early popup when usesUsed >= uses (fallback field)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again until a long rest');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    });

    it('prefers usesMax over uses for max calculation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 1, uses: 5 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    });

    it('includes Rage recharge hint when recharge is long_rest_or_expend_rage', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 1, recharge: 'long_rest_or_expend_rage' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('expend one use of Rage');
    });

    it('omits Rage hint for other recharge values', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 1, recharge: 'short_rest' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('Rage');
    });
  });

  // ── Uses tracking (not exhausted) ────────────────────────────

  describe('uses not exhausted', () => {
    it('decrements uses count and toggles buff', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        0,
        campaignName,
      );
      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('uses custom resourceKey when provided', async () => {
      const ps = makePlayerStats();
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

    it('defaults resourceKey to action name when not provided', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Tactical Warning',
        automation: { type: 'buff_ally', effect: '', usesMax: 3 },
      };
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        1,
        campaignName,
      );
    });

    it('treats null or undefined runtime value as maxUses before decrementing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 3 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      // Simulates null — currentUses = 3 ?? 3 = 3, then 3 - 1 = 2
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        2,
        campaignName,
      );

      // Simulates undefined — same behavior
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenLastCalledWith(
        'Fighter',
        'tacticalwarningUses',
        2,
        campaignName,
      );
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('skips usage tracking when usesMax and uses are both absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('passes player and action names to addExpiration', async () => {
      const ps = makePlayerStats({ name: 'Valorous Paladin' });
      const action = { name: 'Inspiring Shield', automation: { type: 'buff_ally', effect: '' } };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Valorous Paladin',
        'Valorous Paladin',
        expect.arrayContaining([
          expect.objectContaining({ type: 'remove_active_buff', buffName: 'Inspiring Shield' }),
        ]),
        campaignName,
      );
    });
  });
});
