// @improved-by-ai

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

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

// ── Imports ──────────────────────────────────────────────────────

import { handle } from './buffAllyHandler.js';

import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Fighter',
    level: 3,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Tactical Warning',
    automation: {
      type: 'buff_ally',
      effect: '',
      ...overrides,
    },
  };
}

function resetMocks() {
  vi.clearAllMocks();
}

// ── Tests ────────────────────────────────────────────────────────

describe('buffAllyHandler.handle', () => {
  beforeEach(resetMocks);

  // ── Activation / deactivation ──────────────────────────────────

  describe('no usage tracking', () => {
    it('returns activated popup with automation info when buff is not active', async () => {
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

    it('returns expired popup when buff is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Tactical Warning expired');
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

    it('passes buffExpression as effect when both are provided, falling back to effect when buffExpression is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        effect: 'my_effect',
        buffExpression: 'custom_expression',
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        'Fighter',
        'Tactical Warning',
        expect.objectContaining({ effect: 'custom_expression' }),
        campaignName,
      );

      resetMocks();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      await handle({ ...action, automation: { ...action.automation, buffExpression: undefined } }, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        'Fighter',
        'Tactical Warning',
        expect.objectContaining({ effect: 'my_effect' }),
        campaignName,
      );
    });
  });

  // ── Uses exhausted ─────────────────────────────────────────────

  describe('uses exhausted', () => {
    it('returns early popup when current uses is zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('cannot be used again until a long rest');
      expect(result.payload.automation).toEqual(action.automation);
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('uses the "uses" fallback field for max when usesMax is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again until a long rest');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    });

    it('prefers usesMax over uses for the max calculation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 1, uses: 5 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    });

    it('includes Rage recharge hint for long_rest_or_expend_rage, omits it for other recharge values', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 1, recharge: 'long_rest_or_expend_rage' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('expend one use of Rage');

      resetMocks();
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      const result2 = await handle(makeAction({ usesMax: 1, recharge: 'short_rest' }), ps, campaignName, null);

      expect(result2.payload.description).not.toContain('Rage');
    });
  });

  // ── Uses tracking (not exhausted) ──────────────────────────────

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

      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Fighter',
        'tacticalwarningUses',
        2,
        campaignName,
      );

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

  // ── Edge cases ─────────────────────────────────────────────────

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
