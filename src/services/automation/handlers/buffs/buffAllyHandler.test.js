// @maintained-by-ai
// Deterministic handler-contract tests: volatile deps (buffToggle, expirations,
// runtime store) are mocked; this file pins buffAllyHandler's own stable contract
// (uses math, key derivation, popup shape, expiration registration).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────

describe('buffAllyHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Activation / deactivation ──────────────────────────────────

  describe('activation / deactivation', () => {
    it('returns full activation popup when buff is not active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Tactical Warning');
      expect(result.payload.automationType).toBe('buff_ally');
      expect(result.payload.description).toBe(
        'Tactical Warning activated — allies have Advantage on attack rolls and saving throws until the start of your next turn',
      );
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('returns expired popup without registering expiration when buff is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Tactical Warning');
      expect(result.payload.description).toBe('Tactical Warning expired');
      expect(result.payload.automation).toEqual(action.automation);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('registers remove_active_buff expiration on activation with player as both names', async () => {
      const ps = makePlayerStats({ name: 'Valorous Paladin' });
      const action = { name: 'Inspiring Shield', automation: { type: 'buff_ally', effect: '' } };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: 'Valorous Paladin',
        targetName: 'Valorous Paladin',
        effects: expect.arrayContaining([
          expect.objectContaining({ type: 'remove_active_buff', buffName: 'Inspiring Shield' }),
        ]),
        campaignName,
      });
    });

    it('passes buffExpression, falling back to effect, as the toggle effect', async () => {
      const cases = [
        { automation: { effect: 'my_effect', buffExpression: 'custom_expression' }, expected: 'custom_expression' },
        { automation: { effect: 'my_effect', buffExpression: undefined }, expected: 'my_effect' },
      ];

      for (const { automation, expected } of cases) {
        vi.clearAllMocks();
        const action = makeAction(automation);
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        await handle(action, makePlayerStats(), campaignName, null);

        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
          'Fighter',
          'Tactical Warning',
          expect.objectContaining({ effect: expected }),
          campaignName,
        );
      }
    });
  });

  // ── Uses exhausted ─────────────────────────────────────────────

  describe('uses exhausted', () => {
    it('returns early popup with no side effects when current uses is zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Tactical Warning');
      expect(result.payload.description).toContain('cannot be used again until a long rest');
      expect(result.payload.automation).toEqual(action.automation);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
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

    it('includes or omits the Rage recharge hint based on recharge value', async () => {
      const cases = [
        { recharge: 'long_rest_or_expend_rage', expectHint: true },
        { recharge: 'short_rest', expectHint: false },
      ];

      for (const { recharge, expectHint } of cases) {
        vi.clearAllMocks();
        const action = makeAction({ usesMax: 1, recharge });
        useRuntimeState.getRuntimeValue.mockReturnValue(0);

        const result = await handle(action, makePlayerStats(), campaignName, null);

        if (expectHint) {
          expect(result.payload.description).toContain('expend one use of Rage');
        } else {
          expect(result.payload.description).not.toContain('Rage');
        }
      }
    });
  });

  // ── Uses tracking (not exhausted) ──────────────────────────────

  describe('uses not exhausted', () => {
    it('decrements uses under the default action-derived key and toggles buff', async () => {
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
      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        'Fighter',
        'Tactical Warning',
        expect.any(Object),
        campaignName,
      );
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

    it('treats null or undefined runtime value as maxUses before decrementing', async () => {
      for (const runtimeValue of [null, undefined]) {
        vi.clearAllMocks();
        const action = makeAction({ usesMax: 3 });
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
        useRuntimeState.getRuntimeValue.mockReturnValue(runtimeValue);

        await handle(action, makePlayerStats(), campaignName, null);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Fighter',
          'tacticalwarningUses',
          2,
          campaignName,
        );
      }
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
  });
});
