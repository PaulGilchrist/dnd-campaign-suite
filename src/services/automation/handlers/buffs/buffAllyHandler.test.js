// @maintained-by-ai 2026-11-26
// Deterministic handler-contract tests: volatile deps (buffToggle, expirations,
// runtime store) are mocked; this file pins buffAllyHandler's own stable contract
// (popup shape, uses-key derivation, toggle effect resolution, expiration registration).
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
const ACTION_NAME = 'Tactical Warning';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Fighter',
    level: 3,
    ...overrides,
  };
}

function makeAction(automationOverrides = {}) {
  return {
    name: ACTION_NAME,
    automation: {
      type: 'buff_ally',
      effect: '',
      ...automationOverrides,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('buffAllyHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Activation / deactivation ──────────────────────────────────

  it('activates: returns full activation popup and registers a remove_active_buff expiration owned by the player', async () => {
    const ps = makePlayerStats({ name: 'Valorous Paladin' });
    const action = { name: 'Inspiring Shield', automation: { type: 'buff_ally', effect: '' } };
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    const result = await handle(action, ps, campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Inspiring Shield',
        automationType: 'buff_ally',
        description:
          'Inspiring Shield activated — allies have Advantage on attack rolls and saving throws until the start of your next turn',
        automation: action.automation,
      },
    });
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Valorous Paladin',
      targetName: 'Valorous Paladin',
      effects: [{ type: 'remove_active_buff', buffName: 'Inspiring Shield' }],
      campaignName,
    });
  });

  it('deactivates: returns expired popup and registers no new expiration', async () => {
    const action = makeAction();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: ACTION_NAME,
        automationType: 'buff_ally',
        description: `${ACTION_NAME} expired`,
        automation: action.automation,
      },
    });
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });

  // ── Toggle effect resolution (buffExpression || effect) ────────

  it.each([
    { label: 'prefers buffExpression', buffExpression: 'custom_expression', effect: 'my_effect', expected: 'custom_expression' },
    { label: 'falls back to effect when buffExpression is unset', buffExpression: undefined, effect: 'my_effect', expected: 'my_effect' },
    { label: 'falls back to effect when buffExpression is empty', buffExpression: '', effect: 'my_effect', expected: 'my_effect' },
  ])('passes the $label as the toggle effect', async ({ buffExpression, effect, expected }) => {
    const automation = { type: 'buff_ally', effect, buffExpression };
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    await handle({ name: ACTION_NAME, automation }, makePlayerStats(), campaignName, null);

    expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
      'Fighter',
      ACTION_NAME,
      { ...automation, effect: expected },
      campaignName,
    );
  });

  // ── Uses exhausted ─────────────────────────────────────────────

  const EXHAUSTED_DESCRIPTION = `${ACTION_NAME} has been used and cannot be used again until a long rest.`;

  it.each([
    { label: 'usesMax', automation: { usesMax: 3 }, description: EXHAUSTED_DESCRIPTION },
    { label: 'uses fallback', automation: { uses: 2 }, description: EXHAUSTED_DESCRIPTION },
    {
      label: 'Rage recharge hint included',
      automation: { usesMax: 1, recharge: 'long_rest_or_expend_rage' },
      description: `${EXHAUSTED_DESCRIPTION} You may expend one use of Rage to restore it.`,
    },
    {
      label: 'Rage recharge hint omitted for other recharges',
      automation: { usesMax: 1, recharge: 'short_rest' },
      description: EXHAUSTED_DESCRIPTION,
    },
  ])('returns the exhausted popup ($label) with zero store, toggle, or expiration writes', async ({ automation, description }) => {
    const action = makeAction(automation);
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: ACTION_NAME,
        description,
        automation: action.automation,
      },
    });
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });

  // ── Uses tracking (not exhausted) ──────────────────────────────

  it.each([
    {
      label: 'decrements under the default action-derived key',
      automation: { usesMax: 3 },
      currentUses: 1,
      expectedKey: 'tacticalWarningUses',
      expectedRemaining: 0,
    },
    {
      label: 'honors custom resourceKey',
      automation: { usesMax: 3, resourceKey: 'myCustomResource' },
      currentUses: 2,
      expectedKey: 'myCustomResource',
      expectedRemaining: 1,
    },
    {
      label: 'treats null runtime value as maxUses',
      automation: { usesMax: 3 },
      currentUses: null,
      expectedKey: 'tacticalWarningUses',
      expectedRemaining: 2,
    },
    {
      label: 'treats undefined runtime value as maxUses',
      automation: { usesMax: 3 },
      currentUses: undefined,
      expectedKey: 'tacticalWarningUses',
      expectedRemaining: 2,
    },
  ])('$label', async ({ automation, currentUses, expectedKey, expectedRemaining }) => {
    const action = makeAction(automation);
    useRuntimeState.getRuntimeValue.mockReturnValue(currentUses);
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    await handle(action, makePlayerStats(), campaignName, null);

    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', expectedKey, campaignName);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Fighter',
      expectedKey,
      expectedRemaining,
      campaignName,
    );
    expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
      'Fighter',
      ACTION_NAME,
      expect.any(Object),
      campaignName,
    );
  });

  it('skips usage tracking entirely when usesMax and uses are both absent', async () => {
    const action = makeAction();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(buffToggle.toggleBuff).toHaveBeenCalled();
    expect(result.type).toBe('popup');
  });
});
